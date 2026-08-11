#!/usr/bin/env node

/**
 * Deep Financial Forensics - Investigation into the ₦40.7M Discrepancy
 */

const PROD_URL = 'https://busfgcmbndleljklrcbd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1c2ZnY21ibmRsZWxqa2xyY2JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgzMzgwNSwiZXhwIjoyMDY0NDA5ODA1fQ.hw0qYFoNKVyL-qolVFBkd6eXJ6QmDOWWFBHvGwBM5tM';

async function query(table, limit = 1000, where = '') {
  let url = `${PROD_URL}/rest/v1/${table}?select=*&limit=${limit}`;
  if (where) url += `&${where}`;

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
    console.error(`Error: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('\n' + '═'.repeat(100));
  console.log('DEEP FINANCIAL FORENSICS: ₦40.7M DISCREPANCY INVESTIGATION');
  console.log('═'.repeat(100) + '\n');

  // Investigation 1: Contribution Payment References
  console.log('🔍 INVESTIGATION 1: Contribution Payment Reference Corruption\n');

  const paidContribs = await query('contributions', 100, 'status=eq.paid');
  console.log(`Fetched ${paidContribs.length} paid contributions (sample)\n`);

  if (paidContribs.length > 0) {
    console.log('Sample paid contributions:');
    paidContribs.slice(0, 5).forEach(c => {
      console.log(`  ID: ${c.id}`);
      console.log(`    Amount: ₦${c.amount} | Gross: ₦${c.gross_amount}`);
      console.log(`    Ref: ${c.payment_reference || '(NULL)'}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    Collection: ${c.collection_id}`);
      console.log('');
    });
  }

  // Check contributions vs deposits
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INVESTIGATION 2: Contributions vs Deposits Table Mismatch\n');

  const allContribs = await query('contributions', 1000);
  const allDeposits = await query('deposits', 1000);

  const paidFromContribs = allContribs.filter(c => c.status === 'paid');
  const successDeposits = allDeposits.filter(d => d.status === 'success');

  console.log(`Contributions Table:`);
  console.log(`  Total rows: ${allContribs.length}`);
  console.log(`  Paid rows: ${paidFromContribs.length}`);
  console.log(`  Total paid amount: ₦${paidFromContribs.reduce((s, c) => s + (c.amount || 0), 0)}`);

  console.log(`\nDeposits Table:`);
  console.log(`  Total rows: ${allDeposits.length}`);
  console.log(`  Success rows: ${successDeposits.length}`);
  console.log(`  Total success amount: ₦${successDeposits.reduce((s, d) => s + (d.net_amount || 0), 0)}`);

  // Check for orphaned deposits
  console.log(`\n  Deposits by status:`);
  const depositsByStatus = {};
  allDeposits.forEach(d => {
    depositsByStatus[d.status] = (depositsByStatus[d.status] || 0) + 1;
  });
  Object.entries(depositsByStatus).forEach(([status, count]) => {
    console.log(`    ${status}: ${count}`);
  });

  // Investigation 3: Wallet vs Transaction Reconciliation
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INVESTIGATION 3: Wallet vs Transaction Reconciliation\n');

  const wallets = await query('wallets', 300);
  const collections = await query('collections', 300);

  console.log(`Wallets: ${wallets.length}`);
  console.log(`Collections: ${collections.length}\n`);

  // Per-collection reconciliation
  console.log('Sample collection-level reconciliation (first 10):');
  let idx = 0;
  for (const collection of collections.slice(0, 10)) {
    const wallet = wallets.find(w => w.collection_id === collection.id);
    const collectionContribs = paidFromContribs.filter(c => c.collection_id === collection.id);
    const collectionWithdrawals = (await query('withdrawals', 100, `collection_id=eq.${collection.id}`))
      .filter(w => ['completed', 'successful', 'success', 'approved'].includes(w.status));

    const transactionNet = collectionContribs.reduce((s, c) => s + (c.amount || 0), 0);
    const withdrawnAmount = collectionWithdrawals.reduce((s, w) => s + (w.amount || 0), 0);
    const expectedOutstanding = transactionNet - withdrawnAmount;
    const walletNet = wallet?.net_payment || 0;

    const mismatch = walletNet - transactionNet;

    console.log(`\n${idx + 1}. Collection: ${collection.name} (${collection.id})`);
    console.log(`   Transactions: ₦${transactionNet}`);
    console.log(`   Wallet Net:   ₦${walletNet}`);
    console.log(`   MISMATCH:     ₦${mismatch} ${mismatch !== 0 ? '⚠️' : '✅'}`);
    console.log(`   Withdrawn:    ₦${withdrawnAmount}`);
    console.log(`   Expected:     ₦${expectedOutstanding}`);

    idx++;
  }

  // Check for data duplication
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INVESTIGATION 4: Data Duplication Checks\n');

  // Check duplicate contributions
  const contribByRef = {};
  paidFromContribs.forEach(c => {
    const ref = c.payment_reference || '(NULL)';
    contribByRef[ref] = (contribByRef[ref] || 0) + 1;
  });

  const dupRefs = Object.entries(contribByRef)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  if (dupRefs.length > 0) {
    console.log(`⚠️ Duplicate payment references in contributions: ${dupRefs.length}`);
    dupRefs.slice(0, 5).forEach(([ref, count]) => {
      console.log(`   "${ref}": ${count} times`);
    });
  } else {
    console.log(`✅ No duplicate payment references found`);
  }

  // Check duplicate wallets
  const walletsByCollection = {};
  wallets.forEach(w => {
    if (!walletsByCollection[w.collection_id]) {
      walletsByCollection[w.collection_id] = [];
    }
    walletsByCollection[w.collection_id].push(w);
  });

  const dupWallets = Object.entries(walletsByCollection)
    .filter(([_, wlist]) => wlist.length > 1);

  console.log(`\nDuplicate wallets per collection: ${dupWallets.length}`);

  // Check for withdrawals exceeding net_payment
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INVESTIGATION 5: Withdrawals Exceeding Raised (Money Loss Check)\n');

  const allWithdrawals = await query('withdrawals', 500);
  const successfulWithdrawals = allWithdrawals.filter(w =>
    ['completed', 'successful', 'success', 'approved'].includes(w.status)
  );

  const overpayments = [];
  for (const wallet of wallets) {
    const walletSuccessfulWD = successfulWithdrawals.filter(w => w.collection_id === wallet.collection_id);
    const totalWDAmount = walletSuccessfulWD.reduce((s, w) => s + (w.amount || 0), 0);

    if (totalWDAmount > wallet.net_payment) {
      overpayments.push({
        collectionId: wallet.collection_id,
        netPayment: wallet.net_payment,
        withdrawn: totalWDAmount,
        overage: totalWDAmount - wallet.net_payment,
      });
    }
  }

  if (overpayments.length > 0) {
    console.log(`⚠️ CRITICAL: ${overpayments.length} collections have withdrawn MORE than raised!\n`);
    overpayments.slice(0, 10).forEach(o => {
      console.log(`   Collection ${o.collectionId}:`);
      console.log(`     Raised: ₦${o.netPayment}`);
      console.log(`     Withdrawn: ₦${o.withdrawn}`);
      console.log(`     OVERAGE: ₦${o.overage} ⚠️\n`);
    });

    const totalOverage = overpayments.reduce((s, o) => s + o.overage, 0);
    console.log(`   TOTAL OVERPAYMENT: ₦${totalOverage}`);
  } else {
    console.log(`✅ No overpayments detected - all withdrawals within bounds`);
  }

  // Timestamp analysis
  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INVESTIGATION 6: Temporal Analysis\n');

  console.log(`Earliest contribution created: ${paidFromContribs.length > 0 ? new Date(paidFromContribs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0].created_at).toISOString() : 'N/A'}`);
  console.log(`Latest contribution created: ${paidFromContribs.length > 0 ? new Date(paidFromContribs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at).toISOString() : 'N/A'}`);

  const oldestWallet = wallets.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))[0];
  const newestWallet = wallets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];

  console.log(`\nWallet updates:`);
  console.log(`  Oldest: ${oldestWallet?.updated_at || 'N/A'}`);
  console.log(`  Newest: ${newestWallet?.updated_at || 'N/A'}`);

  console.log('\n' + '═'.repeat(100));
  console.log('CONCLUSION');
  console.log('═'.repeat(100) + '\n');

  if (overpayments.length > 0) {
    console.log(`🚨 CRITICAL FINDING: Kolekto has overpaid organizers by ₦${overpayments.reduce((s, o) => s + o.overage, 0)}`);
    console.log(`   This indicates severe reconciliation or data integrity issues.`);
  }

  if (dupRefs.length > 0) {
    console.log(`⚠️ WARNING: Duplicate payment references found - possible double-counting.`);
  }

  if (paidFromContribs.filter(c => !c.payment_reference).length > 100) {
    console.log(`⚠️ WARNING: ${paidFromContribs.filter(c => !c.payment_reference).length} paid contributions have no payment_reference.`);
    console.log(`   This breaks idempotency guarantees and prevents duplicate detection.`);
  }

  console.log('\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
