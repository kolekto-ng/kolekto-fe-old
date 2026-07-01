# Toast and Error Message Audit

## Scope

This audit covers the frontend toast and notification pass for the Kolekto app. The work stayed within UI presentation and user-facing copy. Authentication, payment, contribution, withdrawal, KYC, collection, and API contract behavior were not changed.

## Global Toast Systems Found

- `src/App.tsx` mounts both global notification systems:
  - `src/components/ui/sonner.tsx` for Sonner toasts used across most app screens.
  - `src/components/ui/toaster.tsx` and `src/components/ui/toast.tsx` for the older Radix/shadcn toast API used in profile and KYC screens.
- `src/hooks/use-toast.ts` provides the older `useToast()` API.

## UI Changes Made

- Moved global toasts from bottom placement to the center of the screen.
- Added compact centered toast sizing for mobile and PWA screens.
- Added success, error, warning, info, and loading icons.
- Added smooth entrance and exit animations with reduced-motion support.
- Restyled toast cards with modern radius, shadow, spacing, and readable type.
- Kept both Sonner and Radix/shadcn toast systems visually consistent so existing call sites continue to work globally.

## Message Cleanup Made

- Expanded `src/utils/errorMessages.ts` into the central formatter for API/backend errors.
- Added friendly handling for:
  - Axios/request failures.
  - HTTP status code text.
  - network and timeout failures.
  - internal server errors.
  - Supabase and edge-function errors.
  - Paystack/payment gateway errors.
  - validation/cast/syntax/database errors.
  - token/session errors.
  - KYC, BVN, NIN, bank account, and withdrawal errors.
- Preserved short validation messages when they are useful to users.
- Shortened success messages across auth, collections, profile, payment, withdrawals, QR/receipt actions, and campus forms.

## Frontend Areas Updated

- Auth:
  - `src/store/useAuthStore.ts`
  - `src/components/auth/LoginForm.tsx`
  - `src/components/auth/RegisterForm.tsx`
  - `src/components/auth/ForgotPasswordForm.tsx`
  - `src/components/auth/ResetPasswordForm.tsx`
- Collections:
  - `src/store/useCollectionStore.ts`
  - `src/components/collections/CreateCollectionForm.tsx`
  - `src/components/collections/wizard/CreateCollectionWizard.tsx`
  - `src/components/collections/EditCollectionDialog.tsx`
  - `src/components/collections/CollectionManagementMenu.tsx`
  - `src/components/collections/QRCodeDisplay.tsx`
- Contributor and payment flow:
  - `src/hooks/usePaystack.ts`
  - `src/store/usePaystackStore.ts`
  - `src/components/contribute/ContributionForm.tsx`
  - `src/components/contribute/ContributeFlow.tsx`
  - `src/components/contribute/paymentCallback.tsx`
  - `src/components/contribute/PaymentSuccessful.tsx`
- Withdrawals and transactions:
  - `src/store/useWithdrawalStore.ts`
  - `src/store/useTransactions.ts`
  - `src/store/useTransactionStore.ts`
  - `src/components/withdrawals/WithdrawFundsDialog.tsx`
  - `src/pages/dashboard/TransactionHistoryPage.tsx`
- Profile, KYC, and bank details:
  - `src/store/useProfileStore.ts`
  - `src/components/settings/profile-picture-upload.tsx`
  - `src/components/profile/PaymentAccount.tsx`
  - `src/components/profile/BankDetailsSection.tsx`
  - Existing `useToast()` KYC/profile forms now inherit the new centered Radix toast styling.
- Other pages:
  - `src/pages/ActiveCampaignsPage.tsx`
  - `src/pages/KolektoCampus.tsx`
  - `src/pages/ContactPage.tsx`
  - dashboard collection pages that use shared toast systems.

## Technical Messages Replaced or Guarded

- Raw `error.message`, `err.message`, Axios, Supabase, edge-function, and Paystack errors are now routed through `toFriendlyErrorMessage()` before being shown in key user-facing toasts and state fields.
- Browser `alert()` calls that were active in profile/bank/dashboard paths were replaced with toast messages.
- Store error fields that may be rendered by pages were sanitized in collection, contribution, dashboard, transaction, withdrawal, payment, and profile stores.

## Backend Cleanup Still Recommended

The frontend now guards common user-facing paths, but the backend still returns raw or technical details in several places. A later backend cleanup should replace these with stable error codes plus safe public messages.

Known backend files with raw details or internal messages include:

- `controllers/auth.js`
- `controllers/collection.js`
- `controllers/collection/createCollection.jsx`
- `controllers/contribution.js`
- `controllers/deposit.js`
- `controllers/withdrawal.js`
- `controllers/wallet.js`
- `controllers/dashboard.js`
- `controllers/userController.js`
- `controllers/kolektoOnCampus.js`
- `controllers/settings/profile.js`
- `controllers/settings/security.js`
- `controllers/settings/kyc.js`
- `controllers/admin/kyc.js`
- `routes/settings/kyc.js`
- `utils/recaptcha.js`

Examples found include responses based on `error.message`, `err.message`, `error.response?.data?.message`, `details: err.message`, and strings such as `Internal server error`.

## Verification Checklist

- Global Sonner toast position changed to center.
- Older Radix/shadcn toasts now render from the center too.
- Toasts include icons and smooth animation.
- Mobile width is constrained to fit 320px, 375px, and 430px screens.
- Toast helper sanitizes common raw backend/API errors.
- Public contributor flow still uses the same payment and contribution paths.
- No login requirement was added to public contributor pages.
