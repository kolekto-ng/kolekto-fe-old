-- ============================================================================
-- sql.harness.sql — Postgres golden-vector harness (READY, run in Wave 3).
-- ============================================================================
-- Proves the SQL wallet projection matches the TypeScript engine on the SAME
-- golden vectors the Node/Deno harnesses use. Self-contained: creates temp
-- functions, needs NO app schema, mutates nothing. Run against any Postgres:
--
--     psql "$DATABASE_URL" -f test/sql.harness.sql
--
-- It fails loudly (RAISE EXCEPTION) on the first mismatch; on success it prints
-- a pass count. In Wave 3 this same fixture is bound to the DEPLOYED
-- public.settlement_recompute_wallets() (which additionally folds in
-- normalization); here we mirror the L2 wallet projection
-- (computeWallet / computeWalletBalances) exactly.
--
-- MIRRORS kolekto-shared-financial/src/projections.ts @ computeWalletBalances
--   net       = Σ amount
--   gross     = Σ coalesce(gross_amount, amount, 0)
--   pending   = Σ amount WHERE created_at >= cutoff
--   withdrawn = Σ amount WHERE status IN (completed, successful, success, approved)  -- canonical superset
--   available = greatest(0, (net - pending) - withdrawn)
--   ledger    = available + pending
--
-- The completed-withdrawal set matches database/settlement_recompute.sql (which
-- already used the Node superset), so the `divergence` vectors — the edge-only
-- {completed, successful} gap — pass here just as they do in the engine.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── cutoff, parameterised by an injected `now` (mirrors settlement_cutoff) ────
CREATE OR REPLACE FUNCTION pg_temp.fpe_cutoff(now_ts timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN now_ts >= ((date_trunc('day', now_ts AT TIME ZONE 'UTC') + interval '4 hours') AT TIME ZONE 'UTC')
      THEN  (date_trunc('day', now_ts AT TIME ZONE 'UTC') + interval '4 hours') AT TIME ZONE 'UTC'
      ELSE ((date_trunc('day', now_ts AT TIME ZONE 'UTC') + interval '4 hours') AT TIME ZONE 'UTC') - interval '1 day'
  END;
$fn$;

-- ── the L2 wallet projection over jsonb event arrays ─────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.fpe_compute_wallet(
  contribs jsonb, wds jsonb, now_ts timestamptz)
RETURNS TABLE (gross numeric, net numeric, withdrawn numeric,
               pending numeric, available numeric, ledger numeric)
LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  v_cutoff timestamptz := pg_temp.fpe_cutoff(now_ts);
  v_net numeric; v_gross numeric; v_pending numeric; v_withdrawn numeric;
  v_settled numeric; v_available numeric;
BEGIN
  SELECT
    round(coalesce(sum((c->>'amount')::numeric), 0), 2),
    round(coalesce(sum(coalesce((c->>'gross_amount')::numeric, (c->>'amount')::numeric, 0)), 0), 2),
    round(coalesce(sum((c->>'amount')::numeric)
          FILTER (WHERE (c->>'created_at')::timestamptz >= v_cutoff), 0), 2)
  INTO v_net, v_gross, v_pending
  FROM jsonb_array_elements(coalesce(contribs, '[]'::jsonb)) AS c;

  SELECT round(coalesce(sum((w->>'amount')::numeric)
          FILTER (WHERE (w->>'status') IN ('completed','successful','success','approved')), 0), 2)
  INTO v_withdrawn
  FROM jsonb_array_elements(coalesce(wds, '[]'::jsonb)) AS w;

  v_settled   := round(v_net - v_pending, 2);
  v_available := round(greatest(0, v_settled - v_withdrawn), 2);

  gross := v_gross; net := v_net; withdrawn := v_withdrawn;
  pending := v_pending; available := v_available;
  ledger := round(v_available + v_pending, 2);
  RETURN NEXT;
END;
$fn$;

-- ── vectors (mirror of golden-vectors.json `wallet` + `divergence`) ──────────
-- Regenerate from golden-vectors.json in Wave 3 CI; inlined here so the harness
-- is runnable stand-alone today.
CREATE TEMP TABLE fpe_vectors (name text, now_ts timestamptz, contribs jsonb, wds jsonb, expected jsonb);

INSERT INTO fpe_vectors VALUES
('empty → all zero', '2026-01-15T12:00:00Z',
 '[]', '[]',
 '{"gross":0,"net":0,"withdrawn":0,"pending":0,"available":0,"ledger":0}'),

('single settled contribution is available', '2026-01-15T12:00:00Z',
 '[{"amount":5000,"gross_amount":5100,"created_at":"2026-01-14T10:00:00Z"}]', '[]',
 '{"gross":5100,"net":5000,"withdrawn":0,"pending":0,"available":5000,"ledger":5000}'),

('single today''s contribution is pending', '2026-01-15T12:00:00Z',
 '[{"amount":3000,"gross_amount":3000,"created_at":"2026-01-15T06:00:00Z"}]', '[]',
 '{"gross":3000,"net":3000,"withdrawn":0,"pending":3000,"available":0,"ledger":3000}'),

('mixed + approved withdrawal reduces available only', '2026-01-15T12:00:00Z',
 '[{"amount":5000,"gross_amount":5000,"created_at":"2026-01-14T10:00:00Z"},{"amount":2000,"gross_amount":2000,"created_at":"2026-01-15T06:00:00Z"}]',
 '[{"amount":1000,"status":"approved"}]',
 '{"gross":7000,"net":7000,"withdrawn":1000,"pending":2000,"available":4000,"ledger":6000}'),

('over-withdrawn floors available at 0', '2026-01-15T12:00:00Z',
 '[{"amount":1000,"gross_amount":1000,"created_at":"2026-01-14T10:00:00Z"}]',
 '[{"amount":5000,"status":"completed"}]',
 '{"gross":1000,"net":1000,"withdrawn":5000,"pending":0,"available":0,"ledger":0}'),

('pending/processing withdrawals do NOT reduce available', '2026-01-15T12:00:00Z',
 '[{"amount":5000,"gross_amount":5000,"created_at":"2026-01-14T10:00:00Z"}]',
 '[{"amount":1000,"status":"pending"},{"amount":500,"status":"processing"}]',
 '{"gross":5000,"net":5000,"withdrawn":0,"pending":0,"available":5000,"ledger":5000}'),

('gross falls back to amount when gross_amount missing', '2026-01-15T12:00:00Z',
 '[{"amount":5000,"created_at":"2026-01-14T10:00:00Z"}]', '[]',
 '{"gross":5000,"net":5000,"withdrawn":0,"pending":0,"available":5000,"ledger":5000}'),

('boundary: exactly at cutoff is pending', '2026-01-15T12:00:00Z',
 '[{"amount":4000,"gross_amount":4000,"created_at":"2026-01-15T04:00:00Z"}]', '[]',
 '{"gross":4000,"net":4000,"withdrawn":0,"pending":4000,"available":0,"ledger":4000}'),

('boundary: one ms before cutoff is settled', '2026-01-15T12:00:00Z',
 '[{"amount":4000,"gross_amount":4000,"created_at":"2026-01-15T03:59:59.999Z"}]', '[]',
 '{"gross":4000,"net":4000,"withdrawn":0,"pending":0,"available":4000,"ledger":4000}'),

('multiple withdrawals, mixed statuses', '2026-01-15T12:00:00Z',
 '[{"amount":10000,"gross_amount":10000,"created_at":"2026-01-14T10:00:00Z"}]',
 '[{"amount":2000,"status":"completed"},{"amount":1000,"status":"successful"},{"amount":500,"status":"pending"},{"amount":1500,"status":"rejected"}]',
 '{"gross":10000,"net":10000,"withdrawn":3000,"pending":0,"available":7000,"ledger":7000}'),

('fractional amounts preserve ledger identity', '2026-01-15T12:00:00Z',
 '[{"amount":1234.56,"gross_amount":1234.56,"created_at":"2026-01-14T10:00:00Z"},{"amount":999.99,"gross_amount":999.99,"created_at":"2026-01-15T06:00:00Z"}]',
 '[{"amount":500,"status":"approved"}]',
 '{"gross":2234.55,"net":2234.55,"withdrawn":500,"pending":999.99,"available":734.56,"ledger":1734.55}'),

('before-cutoff now shifts window to prior day', '2026-01-15T03:00:00Z',
 '[{"amount":6000,"gross_amount":6000,"created_at":"2026-01-14T02:00:00Z"},{"amount":2000,"gross_amount":2000,"created_at":"2026-01-14T10:00:00Z"}]', '[]',
 '{"gross":8000,"net":8000,"withdrawn":0,"pending":2000,"available":6000,"ledger":8000}'),

-- divergence vectors: the edge-only {completed,successful} gap. SQL (Node
-- superset) counts approved/success — these MUST pass here.
('DIVERGENCE approved counts as withdrawn', '2026-01-15T12:00:00Z',
 '[{"amount":10000,"gross_amount":10000,"created_at":"2026-01-14T10:00:00Z"}]',
 '[{"amount":4000,"status":"approved"}]',
 '{"gross":10000,"net":10000,"withdrawn":4000,"pending":0,"available":6000,"ledger":6000}'),

('DIVERGENCE success counts as withdrawn', '2026-01-15T12:00:00Z',
 '[{"amount":8000,"gross_amount":8000,"created_at":"2026-01-14T10:00:00Z"}]',
 '[{"amount":3000,"status":"success"}]',
 '{"gross":8000,"net":8000,"withdrawn":3000,"pending":0,"available":5000,"ledger":5000}');

-- ── run + assert ─────────────────────────────────────────────────────────────
DO $harness$
DECLARE
  v record; r record; e jsonb; n_pass int := 0; n_total int := 0;
BEGIN
  FOR v IN SELECT * FROM fpe_vectors LOOP
    n_total := n_total + 1;
    SELECT * INTO r FROM pg_temp.fpe_compute_wallet(v.contribs, v.wds, v.now_ts);
    e := v.expected;
    IF round(r.gross,2)     <> round((e->>'gross')::numeric,2)
    OR round(r.net,2)       <> round((e->>'net')::numeric,2)
    OR round(r.withdrawn,2) <> round((e->>'withdrawn')::numeric,2)
    OR round(r.pending,2)   <> round((e->>'pending')::numeric,2)
    OR round(r.available,2) <> round((e->>'available')::numeric,2)
    OR round(r.ledger,2)    <> round((e->>'ledger')::numeric,2) THEN
      RAISE EXCEPTION E'SQL golden-vector MISMATCH: %\n  expected: %\n  actual:   gross=% net=% withdrawn=% pending=% available=% ledger=%',
        v.name, e, r.gross, r.net, r.withdrawn, r.pending, r.available, r.ledger;
    END IF;
    -- invariant: ledger = available + pending; available >= 0
    IF round(r.available + r.pending, 2) <> round(r.ledger, 2) OR r.available < 0 THEN
      RAISE EXCEPTION 'SQL invariant violated on vector: %', v.name;
    END IF;
    n_pass := n_pass + 1;
  END LOOP;
  RAISE NOTICE '── SQL golden-vector harness: %/% PASS (0 drift) ──', n_pass, n_total;
END;
$harness$;

ROLLBACK;  -- harness mutates nothing
