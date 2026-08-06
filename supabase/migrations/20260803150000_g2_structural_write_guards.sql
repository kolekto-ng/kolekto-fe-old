-- ============================================================================
-- G2 — Structural write guards (architectural hardening follow-up)
-- ============================================================================
-- Context: two real incidents this cycle were caused by business rules living
-- ONLY in application code, duplicated across multiple write paths (Express +
-- several Supabase Edge Functions) that silently drifted out of sync — one
-- deployed Edge Function went 3.5 weeks without a KYC gate its own repo
-- source had, another (update-collection-status) had never had one at all.
--
-- This migration makes the database itself the final backstop for the rules
-- that mattered most: no application code path, present or future, can insert
-- a row that violates them — regardless of which language/runtime/deployment
-- performs the write.
--
-- STATUS: OPERATOR-GATED, applied via `supabase db push` against a LINKED
-- project only. Every block is additive (new trigger/function/index) — no
-- existing row is modified, and existing valid data is never touched.
-- ============================================================================

-- ── 1. Collection creation: KYC gate + collection-limit, enforced in the DB ──
--
-- Mirrors kolekto-be-old/services/featureAccessService.js canCreateCollection()
-- EXACTLY: verified === true, OR existing non-deleted collection count < 1.
-- This is a backstop, not a replacement — the application layer (Express
-- CollectionService, the Edge Function) still owns the friendly 403 +
-- KYC_REQUIRED response; this trigger only fires if that layer is ever
-- bypassed, buggy, or a brand-new write path forgets to call it.
--
-- The advisory lock closes the TOCTOU race a plain trigger would still have:
-- two concurrent inserts for the SAME user could otherwise both see
-- count = 0 before either commits. Locking on hashtext(user_id) serializes
-- only inserts for the SAME user — no cross-user contention.
CREATE OR REPLACE FUNCTION enforce_collection_kyc_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_kyc_status TEXT;
  v_existing_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT status INTO v_kyc_status
    FROM kyc_verifications
   WHERE user_id = NEW.user_id;

  IF v_kyc_status IS DISTINCT FROM 'verified' THEN
    SELECT COUNT(*) INTO v_existing_count
      FROM collections
     WHERE user_id = NEW.user_id
       AND status != 'deleted';

    IF v_existing_count >= 1 THEN
      RAISE EXCEPTION 'Complete KYC verification to create more than one collection.'
        USING ERRCODE = 'P0001', HINT = 'KYC_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_collection_kyc_limit ON collections;
CREATE TRIGGER trg_enforce_collection_kyc_limit
  BEFORE INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION enforce_collection_kyc_limit();

-- ── 2. Payout accounts: at most one default per user, enforced structurally ─
--
-- Application code (controllers/settings/profile.js saveAccount) already
-- clears every other default before setting a new one, but that is a
-- sequence of separate statements, not a constraint — a race or a future
-- bug could leave two rows with is_default = true. A partial unique index
-- makes a second concurrent "set default" simply fail at the database
-- rather than silently producing two defaults (which would make withdrawal
-- pick an arbitrary one).
--
-- Pre-check first, matching the g1 pattern: refuse to add the index while a
-- violation already exists, rather than the index silently rejecting a
-- migration in a half-applied state.
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id FROM public.payout_accounts
     WHERE is_default = true
     GROUP BY user_id HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'G2: % user(s) already have multiple default payout accounts. Resolve before adding the unique index.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_one_default_per_user
    ON public.payout_accounts (user_id)
    WHERE is_default = true;

-- ── 3. Withdrawal requests: atomic balance check + insert ────────────────────
--
-- controllers/withdrawal.js requestWithdrawal() re-reads the wallet balance
-- and sums pending withdrawal requests, THEN inserts — two separate
-- round-trips from Node, so two concurrent requests for the same collection
-- can both read the same "pending requests" total, both pass the cap check,
-- and both insert. Neither individually exceeds the check, but their SUM can
-- exceed the real withdrawable amount.
--
-- This function does not re-implement the fee-bearer wallet math (that stays
-- in Node/the FPE engine — the one canonical place for that calculation).
-- It only makes the RACE-SENSITIVE step — "given the already-fresh
-- available_balance, is there still room for this request once concurrent
-- pending requests are counted, and if so, insert" — atomic. Node calls
-- refreshWallet() (which persists a fresh wallets.available_balance) BEFORE
-- calling this function, so the balance this function reads is current.
CREATE OR REPLACE FUNCTION request_withdrawal_atomic(
  p_user_id UUID,
  p_collection_id UUID,
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_destination_account JSONB,
  p_paystack_transfer_code TEXT,
  p_paystack_recipient_code TEXT
) RETURNS SETOF withdrawals AS $$
DECLARE
  v_available_balance NUMERIC;
  v_pending_sum NUMERIC;
  v_cap NUMERIC;
BEGIN
  -- Serializes concurrent withdrawal requests for the SAME collection only.
  PERFORM pg_advisory_xact_lock(hashtext(p_collection_id::text));

  SELECT available_balance INTO v_available_balance
    FROM wallets
   WHERE id = p_wallet_id;

  IF v_available_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for this collection.'
      USING ERRCODE = 'P0002', HINT = 'WALLET_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_sum
    FROM withdrawals
   WHERE collection_id = p_collection_id
     AND status IN ('pending', 'processing');

  v_cap := GREATEST(0, v_available_balance - v_pending_sum);

  IF p_amount > v_cap THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance.'
      USING ERRCODE = 'P0003', HINT = 'INSUFFICIENT_BALANCE';
  END IF;

  RETURN QUERY
    INSERT INTO withdrawals (
      user_id, collection_id, wallet_id, amount, status,
      destination_account, paystack_transfer_code, paystack_recipient_code
    ) VALUES (
      p_user_id, p_collection_id, p_wallet_id, p_amount, 'pending',
      p_destination_account, p_paystack_transfer_code, p_paystack_recipient_code
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification queries (read-only):
--
--   -- confirm the collection trigger is live
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'collections'::regclass;
--
--   -- confirm the payout-account unique index is live
--   SELECT indexname FROM pg_indexes WHERE tablename = 'payout_accounts'
--    AND indexname = 'uq_payout_accounts_one_default_per_user';
--
--   -- confirm the withdrawal RPC exists
--   SELECT proname FROM pg_proc WHERE proname = 'request_withdrawal_atomic';
-- ============================================================================
