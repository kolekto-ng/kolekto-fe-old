# Error Messages Audit

Reviewed frontend `src` and backend `kolekto-be-old` with `rg` for visible error strings, toast errors, thrown errors, and JSON `error`/`message` responses.

## Frontend updates made

| Area | Location | Current message/pattern found | Updated/suggested message | Status |
| --- | --- | --- | --- | --- |
| Shared API | `src/utils/api.ts` | `HTTP ${response.status}` / raw `error.error` / raw `error.message` | `Something went wrong. Please try again.` when technical | Updated |
| Shared UI helper | `src/utils/errorMessages.ts` | No centralized filter for technical user-facing messages | Added `toFriendlyErrorMessage()` for HTTP/status/internal/gateway/raw exception text | Updated |
| Auth sign in | `src/store/useAuthStore.ts`, `src/components/auth/LoginForm.tsx` | Raw backend/error message or `An unexpected error occurred` | `Sign in failed. Please check your details and try again.` | Updated |
| Auth signup | `src/store/useAuthStore.ts`, `src/components/auth/RegisterForm.tsx` | Raw backend/error message or `An unexpected error occurred` | `Sign up failed. Please check your details and try again.` | Updated |
| Magic link | `src/store/useAuthStore.ts`, `src/components/auth/LoginForm.tsx` | `Failed to send magic link` / raw error | `Could not send magic link. Please try again.` | Updated |
| Forgot password | `src/store/useAuthStore.ts`, `src/components/auth/ForgotPasswordForm.tsx` | `Failed to send password reset email` / raw error | `Could not send the password reset email. Please try again.` | Updated |
| Reset password | `src/store/useAuthStore.ts`, `src/components/auth/ResetPasswordForm.tsx` | `Failed to reset password` / raw error | `Could not reset your password. Please try again.` | Updated |
| Collections list | `src/pages/dashboard/CollectionsPage.tsx`, `src/pages/pwa/pages/Collections.tsx` | `Failed to load collections. Please try again.` | Already clear | Reviewed |
| Collection creation | `src/components/collections/CreateCollectionForm.tsx` | Backend `err.response.data.message` or generic create failure | `Could not create collection. Please check the details and try again.` | Updated |
| Collection details | `src/pages/dashboard/CollectionDetailsPage.tsx` | `Failed to load collection`, `Failed to update ticket status`, `Failed to update status` | Clear enough, but could be standardized as `Could not load/update this collection. Please try again.` | Recommended |
| Collection delete | `src/pages/dashboard/CollectionDetailsPage.tsx` | `Cannot delete a collection with existing payments. Close it instead.` | Clear and actionable | Reviewed |
| PWA collection details withdrawal | `src/pages/pwa/pages/CollectionDetails.tsx` | Raw withdrawal submit error or `Failed to submit withdrawal request` | `Could not submit withdrawal request. Please try again.` | Updated |
| Contribution page loading | `src/pages/contribute/ContributePage.tsx` | Raw load error or `Failed to load collection.` | `Could not load this collection. Please check the link and try again.` | Updated |
| Contribution validation | `src/components/contribute/ContributeFlow.tsx`, `ContributionForm.tsx` | `Full name is required`, `Valid email is required`, `Please select a tier`, ticket quantity messages | Clear validation messages | Reviewed |
| Contribution payment start | `src/components/contribute/ContributeFlow.tsx` | Raw edge/gateway error or `Failed to initiate payment` | `We could not start your payment. Please try again.` | Updated |
| Payment hook initialization | `src/hooks/usePaystack.ts` | `Payment initialization failed: ${error.message}` | `We could not start your payment. Please try again.` when technical | Updated |
| Payment verification | `src/hooks/usePaystack.ts`, `src/components/contribute/paymentCallback.tsx` | `Payment verification failed: ${error.message}` / raw verify error | `We could not verify your payment. Please try again.` | Updated |
| Receipt actions | `src/components/contribute/PaymentSuccessful.tsx` | `Failed to copy receipt`, `Failed to download PDF` | Clear enough | Reviewed |
| Wallet/withdrawal | `src/components/withdrawals/WithdrawFundsDialog.tsx`, `src/store/useTransactions.ts` | `Failed to process withdrawal request. Please try again later.`, raw backend withdrawal messages | `Could not submit withdrawal. Please try again.` in transaction store | Updated |
| Transactions | `src/store/useTransactions.ts` | `Failed to fetch payments`, `Failed to fetch withdrawals`, raw backend messages | `Could not load payments/withdrawals. Please try again.` | Updated |
| Profile update | `src/store/useProfileStore.ts` | Raw profile update error or `Failed to update profile` | `Could not update profile. Please try again.` | Updated |
| Security OTP | `src/store/useProfileStore.ts` | Raw OTP/password change errors | `Could not send OTP. Please try again.` / `Could not change password. Please try again.` | Updated |
| Bank setup | `src/components/profile/BankDetailsSection.tsx` | Raw bank list/verify/save errors | `Could not load banks. Please try again.`, `Unable to verify that bank account.`, `Could not save bank account. Please try again.` | Updated |
| KYC BVN | `src/components/profile/KYCVerificationTab.tsx` | Raw BVN verification error | `Could not verify BVN. Please try again.` | Updated |
| KYC document upload | `src/components/profile/forms/DocumentUploadForm.tsx` | `Something went wrong` / raw upload error | `Could not upload document. Please try again.` | Updated |
| Campus/contact forms | `src/pages/KolektoCampus.tsx`, `src/pages/ContactPage.tsx` | `Something went wrong. Please try again.`, required field messages | Clear enough | Reviewed |

## Backend messages found and recommendations

The backend was reviewed from the frontend workspace. I did not modify backend files in this pass.

| Area | Location | Current backend message found | Suggested user-facing/API message | Status |
| --- | --- | --- | --- | --- |
| Auth signin validation | `controllers/auth.js` | `Email and password are required.` | Keep | Reviewed |
| Auth signin failure | `controllers/auth.js` | Raw Supabase `error.message` | `Invalid email or password.` | Recommended |
| Auth signin server error | `controllers/auth.js` | `Internal server error during sign in` | `Could not sign in. Please try again.` | Recommended |
| Auth signup validation | `controllers/auth.js` | `Email, password, first name and last name are required.` | Keep | Reviewed |
| Recaptcha | `controllers/auth.js`, `utils/recaptcha.js` | `Failed v2 verification`, `reCAPTCHA score too low...`, missing secret details | `We could not verify this request. Please try again.` | Recommended |
| Auth signout | `controllers/auth.js` | `Internal server error during sign out` | `Could not sign out. Please try again.` | Recommended |
| Auth session | `controllers/auth.js`, `utils/verifyToken.js` | `No token provided`, `Invalid token`, `Invalid or expired token`, raw `err.message` | `Your session has expired. Please sign in again.` | Recommended |
| Admin guard | `utils/requireAdmin.js` | `Forbidden: admin access required` | `You do not have permission to access this page.` | Recommended |
| Collections/payment init | `controllers/deposit.js` | `email, collectionId, and amount are required` with debug object | `Please check the payment details and try again.` | Recommended |
| Collection lookup | `controllers/deposit.js` | `Collection not found` plus `collectionId`/`supabaseError` | `Collection not found.` without internal details | Recommended |
| Payment amount validation | `controllers/deposit.js` | `Invalid amount for fixed/tiered/ticket collection: expected..., received...` | `The payment amount does not match this collection. Please refresh and try again.` | Recommended |
| Payment records | `controllers/deposit.js` | `Failed to create contribution record`, `Failed to create payment record` | `Could not prepare this payment. Please try again.` | Recommended |
| Payment provider | `controllers/deposit.js`, `utils/paystack.js` | Raw Paystack `error.response?.data?.message || error.message` | `Payment service is temporarily unavailable. Please try again.` | Recommended |
| Payment verification | `controllers/deposit.js` | `Reference is required`, `Deposit not found and fallback verification failed.`, raw deposit errors | `Could not verify this payment. Please contact support if you were charged.` | Recommended |
| Webhook | `controllers/deposit.js` | `Invalid JSON`, `Invalid signature`, `Edge function verification failed`, `Webhook processing failed` | Internal-only logs; avoid surfacing to users | Recommended |
| Settings banks | `utils/banksData.js`, `utils/paystack.js` | `Failed to fetch banks`, `Failed to verify account`, raw Paystack messages | `Could not load banks. Please try again.` / `Unable to verify that bank account.` | Recommended |
| KYC admin | `controllers/admin/kyc.js` | `Failed to fetch KYC documents`, `details: err.message`, `Unexpected error approving/rejecting KYC` | `Could not load/update KYC details. Please try again.` | Recommended |
| KYC uploads | `routes/settings/kyc.js` | `Each file must be 5 MB or smaller.`, `You can upload at most 5 files per request.`, `Unsupported file type...` | Keep; they are clear validation messages | Reviewed |
| KYC upload fallback | `routes/settings/kyc.js` | `err.message || "Upload failed"` | `Could not upload document. Please try again.` | Recommended |

## Notes

- Validation messages that tell the user exactly what to fix were kept.
- Technical, long, gateway, HTTP status, Supabase, token/JWT, and internal server messages are now filtered in the frontend when routed through `toFriendlyErrorMessage()`.
- Backend should eventually avoid sending `details`, `debug`, provider messages, and raw exception strings to production clients.
