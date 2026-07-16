# Kolekto Push Notification Investigation

## Outcome

Push delivery now uses one backend service with durable delivery state, atomic idempotency, multi-device fan-out, expired-subscription cleanup, and structured lifecycle logs. Successful-contribution push notifications originate only from the verified Paystack `charge.success` webhook after paid contribution rows exist.

The database migration in `kolekto-be-old/database/push_notifications.sql` must be applied before the new backend is deployed.

## What was broken

1. `push_notification_events` was only a dedupe marker. The backend inserted the marker before checking subscriptions or calling the push provider. A missing subscription, temporary database/provider error, or invalid VAPID deployment permanently suppressed every retry.
2. Successful-payment pushes could start from frontend-driven verification and the Edge Function receipt callback. That made the browser callback part of the notification path even though Paystack's webhook must be the source of truth.
3. Delivery attempts had no persisted status, counts, error, payload, attempt timestamp, or sent timestamp, so operations could not distinguish sent, failed, expired, duplicate, and no-subscription outcomes.
4. Collection-full detection covered fundraising targets and `max_contributions`, but not finite tier/ticket inventory. Different full conditions also used different dedupe keys and could notify twice.
5. Withdrawal approval and final Paystack transfer success shared the same `withdrawal_processed` event, so approval could suppress the later processed notification. Failed transfers were also reported as admin rejections.
6. A browser subscription created with an old VAPID key was reused forever. A local subscription was treated as enabled even when its backend row had been lost or belonged to a previous authenticated account.
7. Fundraising approval performed outside the organizer status endpoint could bypass the trigger. Installed PWAs also retained v3 runtime caches and used prompt registration despite an immediate-activation service worker configuration.

## Root cause

The main root cause was conflating event detection with successful delivery. Idempotency was claimed too early and had no retryable state machine. Secondary causes were multiple payment-notification entry points, incomplete collection-capacity modeling, and no browser/server subscription reconciliation.

## Files inspected

Frontend:

- `src/utils/pushNotifications.ts`
- `src/components/PushNotificationPrompt.tsx`
- `src/components/profile/PushNotificationSettings.tsx`
- `public/push-sw.js`
- `public/sw-cleanup.js`
- `src/main.tsx`
- `src/lib/pwaUpdates.ts`
- `vite.config.ts`
- `src/App.tsx`
- Paystack Edge Functions under `supabase/functions/`

Backend:

- `app.js`, including raw-body webhook mounting
- `controllers/deposit.js`
- `controllers/withdrawal.js`
- `controllers/collection.js`
- `controllers/admin/kyc.js`
- `controllers/push.js`
- `controllers/settings/profile.js`
- `utils/pushNotifications.js`
- `utils/verifyToken.js`
- `utils/client.js`
- `routes/payment.js`, `routes/push.js`, `routes/withdrawal.js`
- `jobs/pushNotifications.js`
- `database/push_notifications.sql`

## Fixes

### Backend delivery service

- Added an atomic `claim_push_notification_event` RPC keyed by user, event type, and entity/reference key.
- Added delivery states: `processing`, `sent`, `failed`, and `no_subscriptions`.
- Persisted payload, attempts, subscription/sent/failed/removed counts, last error, last attempt, update time, and sent time.
- Only `sent` events are permanently suppressed. Failed/no-subscription events and stale processing leases are retryable.
- A five-minute worker retries recent failed deliveries; saving a new device retries recent failed/no-subscription events for that user.
- Kept one subscription per endpoint while supporting many endpoints per user.
- Continued safe removal of HTTP 404/410 subscriptions.
- Added logs for event detection, target resolution, subscriptions found, success, failure, removal, and duplicate suppression.

### Payment contribution

- Kept raw Paystack request bytes and timing-safe SHA-512 signature verification.
- Removed successful-payment push calls from frontend verification and the Edge Function receipt callback.
- The webhook verifies/reconciles payment, waits for paid contribution rows, resolves `collections.user_id`, and then calls the central service.
- Payload:
  - Title: `New contribution received`
  - Body: `[Contributor] paid ₦[Amount] for [Collection].`
  - URL: `/collections/[collectionId]`

### Collection milestones

- Full is now one idempotent event when any applicable condition becomes true:
  - fundraising/open-pool target reached;
  - fixed/ticket contributor limit reached;
  - every tier in a finite tiered/ticket collection is sold out.
- The 80% target, contributor-limit, and finite-tier warnings are sent once.
- Full payload now uses the required title/body and `/collections/[collectionId]` URL.

### Other events

- Split withdrawal requested, approved, processed, rejected, and failed/reversed events.
- KYC approved/rejected/reminder triggers continue through the central service.
- Failed-delivery retries run every five minutes. Deadline checks are hourly. Collections configured with `auto_close` are closed conditionally and receive both deadline and closed events once.
- Active fundraising campaigns are swept hourly so an admin-side status update cannot bypass the approval notification.

### Frontend/PWA

- Existing subscriptions are re-saved for the current authenticated user on dashboard startup.
- A VAPID public-key mismatch unsubscribes the obsolete endpoint and creates a new subscription.
- Local unsubscribe completes even if the backend is temporarily unavailable; the stale server endpoint is later removed on 404/410.
- Service worker registration now auto-updates, cache IDs moved to v4, and v3 runtime caches are cleaned.
- Notification clicks remain same-origin and route `/collections/:id` into the authenticated collection screen.

## Deployment order

1. Apply `kolekto-be-old/database/push_notifications.sql` in the Supabase SQL editor/migration pipeline.
2. Configure the backend environment variables below.
3. Deploy the backend.
4. Deploy the frontend so installed PWAs receive the v4 worker.
5. Confirm Paystack's dashboard webhook URL is `https://<backend>/api/payments/webhook`.
6. Confirm the Edge Function secrets (`BACKEND_URL`, `BACKEND_NOTIFY_SECRET`) match the backend, even though that callback now handles email only.

## Required environment variables

Backend:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
PAYSTACK_SECRET_KEY=...
FRONTEND_URL=https://www.kolekto.com.ng
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:support@kolekto.com.ng
INTERNAL_NOTIFY_SECRET=...
```

Supabase `verify-paystack-payment` Edge Function:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PAYSTACK_SECRET_KEY=...
BACKEND_URL=https://api.kolekto.com.ng
BACKEND_NOTIFY_SECRET=<same value as INTERNAL_NOTIFY_SECRET>
```

Frontend:

```env
VITE_API_URL=https://api.kolekto.com.ng/api
```

Do not put the VAPID private key or Supabase service-role key in a `VITE_` variable.

## Test plan

1. **Enable/subscription:** Sign in on Android Chrome over HTTPS, enable notifications, and confirm a `push_subscriptions` row with the organizer's auth UUID. Sign in on a second device and confirm two rows.
2. **Account reconciliation:** Sign out/in as another user on the same browser. Reload the dashboard and confirm the endpoint's `user_id` changes to the current user.
3. **VAPID rotation:** In staging only, rotate the key pair, reload the dashboard, and confirm the old endpoint is removed and a new endpoint is stored.
4. **Contribution:** Send a signed Paystack `charge.success` test webhook. Confirm the contribution is `paid` before the push log becomes `sent`, the recipient is `collections.user_id`, and the notification opens `/collections/[id]`.
5. **Webhook idempotency:** Replay the identical webhook concurrently. Confirm one `contribution_paid` event and one visible notification tag.
6. **Full collections:** Make the last payment for (a) fixed max contributors, (b) ticket fixed limit, (c) all finite ticket/tier inventory, and (d) fundraising target. Confirm one `collection_full` event per collection.
7. **80% warning:** Cross each configured threshold and add more contributions without reaching full. Confirm the relevant 80% event appears once.
8. **Withdrawal:** Submit, approve, then deliver a Paystack `transfer.success`; test admin rejection and `transfer.failed` separately. Confirm distinct event types.
9. **KYC:** Approve/reject a KYC record and run the daily reminder job against an incomplete record.
10. **Deadline/close:** Use an expired active collection, first with `auto_close=false`, then true. Run the hourly job and verify deadline once and closed only for auto-close.
11. **Fundraising approval:** Change a pending campaign to active through the admin path, run the hourly sweep, and confirm one approval event.
12. **Expired endpoint:** Insert/use an expired test subscription returning 410. Confirm it is deleted and the event log records the removal.
13. **Click behavior:** Test foreground/background/closed PWA states and confirm the existing window is focused/navigated or a new same-origin window opens.

Useful delivery-log query:

```sql
select event_type, dedupe_key, status, attempt_count,
       subscription_count, sent_count, failed_count, removed_count,
       last_error, last_attempt_at, sent_at
from public.push_notification_events
order by created_at desc
limit 100;
```

## Browser limitations

- Push requires HTTPS (localhost is the development exception).
- iOS/iPadOS web push requires 16.4+ and an installed Home Screen web app. Permission must be requested from a user action. Normal Safari tabs cannot use this flow.
- Android Chrome/Edge supports installed and browser-based web push, but OS battery restrictions and disabled system notification channels can delay/block display after the provider accepted the message.
- Private browsing and some enterprise/content-blocking policies may disable service workers or push.
- Browser permission denial cannot be reversed by application code; the user must change site/OS settings.

## Verification performed

- Frontend production build: passed (`npm run build`).
- Changed frontend files: passed focused ESLint.
- Changed backend JavaScript files: passed `node --check`.
- Repository-wide ESLint/typecheck: currently fails on hundreds of pre-existing issues, including generated `dev-dist` Workbox files, widespread legacy `any` usage, Deno Edge Function typing, and broken TypeScript alias resolution. No changed file has a focused ESLint error.
- A live Paystack/provider delivery test was not possible without production/staging credentials and a real browser push endpoint; follow the test plan above after deployment.
