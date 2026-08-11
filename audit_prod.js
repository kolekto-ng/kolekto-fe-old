#!/usr/bin/env node

/**
 * Kolekto Production Financial Audit via Supabase REST API
 * No dependencies — uses native Node.js fetch + minimal REST calls
 */

const PROD_URL = 'https://busfgcmbndleljklrcbd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1c2ZnY21ibmRsZWxqa2xyY2JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgzMzgwNSwiZXhwIjoyMDY0NDA5ODA1fQ.hw0qYFoNKVyL-qolVFBkd6eXJ6QmDOWWFBHvGwBM5tM';

async function query(table, filters = {}) {
  let url = `${PROD_URL}/rest/v1/${table}?select=*`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `&${k}=${encodeURIComponent(v)}`;
  });

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`Error querying ${table}:`, err.message);
    return [];
  }
}

async function main() {
  console.log('\n' + '═'.repeat(100));
  console.log('KOLEKTO PRODUCTION FINANCIAL RECONCILIATION AUDIT');
  console.log('═'.repeat(100));
  console.log(`Production Database: ${PROD_URL}`);
  console.log(`Audit Start: ${new Date().toISOString()}`);
  console.log('═'.repeat(100) + '\n');

  console.log('📡 Fetching data from production database...\n');

  // Fetch all relevant tables
  console.log('⏳ Fetching contributions...');
  const contributions = await query('contributions');
  console.log(`   ✓ ${contributions.length} total contribution records`);

  console.log('⏳ Fetching wallets...');
  const wallets = await query('wallets');
  console.log(`   ✓ ${wallets.length} wallet records`);

  console.log('⏳ Fetching withdrawals...');
  const withdrawals = await query('withdrawals');
  console.log(`   ✓ ${withdrawals.length} withdrawal records`);

  console.log('⏳ Fetching collections...');
  const collections = await query('collections');
  console.log(`   ✓ ${collections.length} collection records`);

  console.log('⏳ Fetching deposits...');
  const deposits = await query('deposits');
  console.log(`   ✓ ${deposits.length} deposit records\n`);

  // Analyze contributions
  console.log('\n' + '═'.repeat(100));
  console.log('CONTRIBUTION ANALYSIS (SOURCE OF TRUTH)');
  console.log('═'.repeat(100));

  const paidContribs = contributions.filter(c => c.status === 'paid');
  const pendingContribs = contributions.filter(c => c.status === 'pending');
  const failedContribs = contributions.filter(c => c.status === 'failed' || c.status === 'abandoned');

  const totalNetPaid = paidContribs.reduce((s, c) => s + (c.amount || 0), 0);
  const totalGrossPaid = paidContribs.reduce((s, c) => s + (c.gross_amount || 0), 0);

  console.log(`
Total Contributions:        ${contributions.length}
  ├─ Paid:                  ${paidContribs.length}
  ├─ Pending:               ${pendingContribs.length}
  └─ Failed/Abandoned:      ${failedContribs.length}

Paid Contribution Totals:
  ├─ Total Gross Paid:      ₦${totalGrossPaid.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ├─ Total Net (raised):    ₦${totalNetPaid.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  └─ Platform Fees:         ₦${(totalGrossPaid - totalNetPaid).toLocaleString('en-NG', { maximumFractionDigits: 2 })}

Unique Payment References:  ${new Set(paidContribs.map(c => c.payment_reference).filter(Boolean)).size}
Duplicate References:       ${paidContribs.filter(c => paidContribs.filter(x => x.payment_reference === c.payment_reference).length > 1).length}
Orphaned (no ref):          ${paidContribs.filter(c => !c.payment_reference).length}
`);

  // Analyze wallets
  console.log('\n' + '═'.repeat(100));
  console.log('WALLET ANALYSIS (CACHED PROJECTION)');
  console.log('═'.repeat(100));

  const totalNetWallet = wallets.reduce((s, w) => s + (w.net_payment || 0), 0);
  const totalAvailWallet = wallets.reduce((s, w) => s + (w.available_balance || 0), 0);
  const totalPendingWallet = wallets.reduce((s, w) => s + (w.pending_balance || 0), 0);
  const totalWithdrawnWallet = wallets.reduce((s, w) => s + (w.withdrawn || 0), 0);
  const negativeWallets = wallets.filter(w => w.available_balance < 0);
  const missingWallets = collections.filter(c => !wallets.find(w => w.collection_id === c.id));
  const brokenIdentity = wallets.filter(w => (w.available_balance + w.pending_balance) !== w.ledger_balance);

  console.log(`
Total Wallets:              ${wallets.length}
Missing Wallets:            ${missingWallets.length}
Negative Available Balance: ${negativeWallets.length}
Broken Ledger Identity:     ${brokenIdentity.length}

Wallet Totals:
  ├─ Total Net Payment:     ₦${totalNetWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ├─ Total Available:       ₦${totalAvailWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ├─ Total Pending:         ₦${totalPendingWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  └─ Total Withdrawn:       ₦${totalWithdrawnWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
`);

  // Analyze withdrawals
  console.log('\n' + '═'.repeat(100));
  console.log('WITHDRAWAL ANALYSIS');
  console.log('═'.repeat(100));

  const successfulWD = withdrawals.filter(w => ['completed', 'successful', 'success', 'approved'].includes(w.status));
  const pendingWD = withdrawals.filter(w => !['completed', 'successful', 'success', 'approved', 'rejected', 'failed'].includes(w.status));
  const failedWD = withdrawals.filter(w => ['rejected', 'failed', 'reversed', 'cancelled'].includes(w.status));

  const totalSuccessfulAmount = successfulWD.reduce((s, w) => s + (w.amount || 0), 0);
  const totalPendingAmount = pendingWD.reduce((s, w) => s + (w.amount || 0), 0);

  console.log(`
Total Withdrawals:          ${withdrawals.length}
  ├─ Successful/Completed:  ${successfulWD.length}
  ├─ Pending/Processing:    ${pendingWD.length}
  └─ Failed/Rejected:       ${failedWD.length}

Withdrawal Amounts:
  ├─ Total Successful:      ₦${totalSuccessfulAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  └─ Total Pending:         ₦${totalPendingAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
`);

  // Main reconciliation
  console.log('\n' + '═'.repeat(100));
  console.log('PRIMARY RECONCILIATION: TOTAL USER MONEY HELD BY KOLEKTO');
  console.log('═'.repeat(100));

  const calculatedOutstanding = totalNetPaid - totalSuccessfulAmount;
  const storedOutstanding = totalNetWallet - totalWithdrawnWallet;
  const diff = calculatedOutstanding - storedOutstanding;

  console.log(`
CALCULATION METHOD 1: From Transaction Records (Source of Truth)
  Total Net Raised:         ₦${totalNetPaid.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  Less: Withdrawn:          ₦${totalSuccessfulAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ─────────────────────────────────────────────────
  CALCULATED OUTSTANDING:   ₦${calculatedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

CALCULATION METHOD 2: From Wallet Cache (Projection)
  Total Wallet Net:         ₦${totalNetWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  Less: Wallet Withdrawn:   ₦${totalWithdrawnWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ─────────────────────────────────────────────────
  STORED OUTSTANDING:       ₦${storedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

RECONCILIATION DIFFERENCE:  ₦${diff.toLocaleString('en-NG', { maximumFractionDigits: 2 })} ${diff === 0 ? '✅ MATCHES' : '⚠️ DISCREPANCY'}
`);

  // Breakdown by status
  console.log('\n' + '═'.repeat(100));
  console.log('BREAKDOWN: WHERE THE MONEY IS');
  console.log('═'.repeat(100));

  console.log(`
AVAILABLE FOR WITHDRAWAL NOW:
  Wallet Available Balance: ₦${Math.max(0, totalAvailWallet).toLocaleString('en-NG', { maximumFractionDigits: 2 })}

PENDING / UNSETTLED (not available yet):
  Wallet Pending Balance:   ₦${totalPendingWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

PENDING WITHDRAWAL REQUESTS:
  Amount Requested:         ₦${totalPendingAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

ALREADY WITHDRAWN / PAID OUT:
  Successful Payouts:       ₦${totalSuccessfulAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

TOTAL OUTSTANDING USER LIABILITY:
  ═══════════════════════════════════════════════════════════
  Available + Pending + Pending Withdrawals =
  ₦${Math.max(0, totalAvailWallet).toLocaleString('en-NG', { maximumFractionDigits: 2 })} + ₦${totalPendingWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })} + ₦${totalPendingAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })} =
  ₦${(Math.max(0, totalAvailWallet) + totalPendingWallet + totalPendingAmount).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  ═══════════════════════════════════════════════════════════
`);

  // Data quality checks
  console.log('\n' + '═'.repeat(100));
  console.log('DATA QUALITY & INTEGRITY CHECKS');
  console.log('═'.repeat(100));

  const orphanedPaid = paidContribs.filter(c => !c.payment_reference);
  const dupRefs = {};
  paidContribs.forEach(c => {
    if (c.payment_reference) {
      dupRefs[c.payment_reference] = (dupRefs[c.payment_reference] || 0) + 1;
    }
  });
  const hasDups = Object.values(dupRefs).some(c => c > 1);

  console.log(`
✓ Paid contributions without payment_reference:  ${orphanedPaid.length}
✓ Duplicate payment references:                 ${hasDups ? '⚠️ YES' : '✅ NO'}
✓ Wallets with negative available:              ${negativeWallets.length}
✓ Wallets with broken ledger identity:          ${brokenIdentity.length}
✓ Missing wallet rows:                          ${missingWallets.length}
✓ Deposits table status:                        ${deposits.length} rows (${deposits.length === 0 ? '⚠️ EMPTY' : 'OK'})
`);

  if (negativeWallets.length > 0) {
    console.log(`\n⚠️ WARNING: ${negativeWallets.length} wallets have negative available_balance`);
    console.log('   This suggests a settlement or balance calculation bug.');
    console.log(`   Total negative impact: ₦${negativeWallets.reduce((s, w) => s + w.available_balance, 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`);
  }

  if (diff !== 0) {
    console.log(`\n⚠️ WARNING: Reconciliation mismatch of ₦${Math.abs(diff).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`);
    console.log('   This indicates the wallet cache may not match source transactions.');
  }

  // Summary
  console.log('\n' + '═'.repeat(100));
  console.log('EXECUTIVE SUMMARY');
  console.log('═'.repeat(100));

  const confidence = diff === 0 && negativeWallets.length === 0 && brokenIdentity.length === 0 ? 'HIGH' : 'MEDIUM';

  console.log(`
Total Successful Payment Volume:    ₦${totalGrossPaid.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total Kolekto Fees:                 ₦${(totalGrossPaid - totalNetPaid).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total User Entitlement:             ₦${totalNetPaid.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

Successfully Withdrawn to Users:    ₦${totalSuccessfulAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

Available User Funds (ready):        ₦${Math.max(0, totalAvailWallet).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Pending User Funds (unsettled):      ₦${totalPendingWallet.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Pending Withdrawal Requests:         ₦${totalPendingAmount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

╔════════════════════════════════════════════════════════════╗
║ TOTAL USER MONEY STILL HELD BY KOLEKTO (OUTSTANDING):      ║
║ ₦${calculatedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 2 }).padStart(52, ' ')} ║
╚════════════════════════════════════════════════════════════╝

Reconciliation Status:               ${confidence === 'HIGH' ? '✅ VERIFIED' : '⚠️ POTENTIAL ISSUES'}
Confidence Level:                   ${confidence}
Audit Timestamp:                    ${new Date().toISOString()}
`);

  console.log('═'.repeat(100) + '\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
