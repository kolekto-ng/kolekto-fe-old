#!/usr/bin/env node

/**
 * Kolekto User-by-User Financial Breakdown
 * Generates: User ID, Name, Collection, Amount Raised, Withdrawn, Balance
 */

const PROD_URL = 'https://busfgcmbndleljklrcbd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1c2ZnY21ibmRsZWxqa2xyY2JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODgzMzgwNSwiZXhwIjoyMDY0NDA5ODA1fQ.hw0qYFoNKVyL-qolVFBkd6eXJ6QmDOWWFBHvGwBM5tM';

const fs = require('fs');
const path = require('path');

async function query(table, limit = 5000, where = '') {
  let url = `${PROD_URL}/rest/v1/${table}?select=*&limit=${limit}`;
  if (where) url += `&${where}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Error querying ${table}:`, err.message);
    return [];
  }
}

async function main() {
  console.log('\n' + '═'.repeat(120));
  console.log('KOLEKTO USER-BY-USER FINANCIAL BREAKDOWN');
  console.log('═'.repeat(120));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  // Fetch all data
  console.log('📡 Fetching data from production...\n');

  const collections = await query('collections', 5000);
  console.log(`✓ ${collections.length} collections`);

  const wallets = await query('wallets', 5000);
  console.log(`✓ ${wallets.length} wallets`);

  const contributions = await query('contributions', 5000);
  console.log(`✓ ${contributions.length} contributions`);

  const withdrawals = await query('withdrawals', 5000);
  console.log(`✓ ${withdrawals.length} withdrawals\n`);

  // Build user financial data
  const userFinancials = [];

  for (const collection of collections) {
    // Get wallet for this collection
    const wallet = wallets.find(w => w.collection_id === collection.id);

    // Get all paid contributions for this collection
    const collectionContribs = contributions.filter(
      c => c.collection_id === collection.id && c.status === 'paid'
    );

    // Get all successful withdrawals for this collection
    const collectionWithdrawals = withdrawals.filter(
      w => w.collection_id === collection.id &&
           ['completed', 'successful', 'success', 'approved'].includes(w.status)
    );

    // Calculate totals
    const totalRaised = collectionContribs.reduce((s, c) => s + (c.amount || 0), 0);
    const totalGrossRaised = collectionContribs.reduce((s, c) => s + (c.gross_amount || 0), 0);
    const totalWithdrawn = collectionWithdrawals.reduce((s, w) => s + (w.amount || 0), 0);
    const platformFees = totalGrossRaised - totalRaised;

    // Get current balance
    const currentBalance = wallet ? wallet.available_balance : 0;
    const pendingBalance = wallet ? wallet.pending_balance : 0;
    const walletNetPayment = wallet ? wallet.net_payment : 0;

    // Calculate expected balance (raised - withdrawn)
    const expectedBalance = totalRaised - totalWithdrawn;

    userFinancials.push({
      collectionId: collection.id,
      userId: collection.user_id || collection.owner_id || 'N/A',
      collectionName: collection.name || 'Untitled Collection',
      description: collection.description || '',
      status: collection.status || 'unknown',
      createdAt: collection.created_at,
      // Financial data
      totalContributions: collectionContribs.length,
      totalRaisedNet: totalRaised,
      totalRaisedGross: totalGrossRaised,
      platformFees: platformFees,
      // Withdrawal data
      totalWithdrawals: collectionWithdrawals.length,
      totalWithdrawn: totalWithdrawn,
      // Balance data
      walletNetPayment: walletNetPayment,
      walletAvailable: currentBalance,
      walletPending: pendingBalance,
      expectedOutstanding: expectedBalance,
      walletLastUpdated: wallet?.updated_at,
      // Discrepancy check
      balanceDiscrepancy: currentBalance - expectedBalance,
    });
  }

  // Sort by amount raised (descending)
  userFinancials.sort((a, b) => b.totalRaisedNet - a.totalRaisedNet);

  // Generate console output
  console.log('═'.repeat(120));
  console.log('USER FINANCIAL SUMMARY (Sorted by Amount Raised)');
  console.log('═'.repeat(120));
  console.log('');

  const header = [
    'S.No',
    'Collection Name',
    'User ID',
    'Contributions',
    'Amount Raised (₦)',
    'Withdrawn (₦)',
    'Available (₦)',
    'Pending (₦)',
    'Expected Balance (₦)',
    'Wallet Balance (₦)',
    'Discrepancy (₦)',
  ];

  console.log(header.map(h => h.padEnd(18)).join(''));
  console.log('─'.repeat(120));

  let totalRaised = 0;
  let totalWithdrawn = 0;
  let totalAvailable = 0;
  let totalPending = 0;
  let totalExpected = 0;
  let totalDiscrepancy = 0;

  userFinancials.forEach((user, idx) => {
    const row = [
      (idx + 1).toString(),
      (user.collectionName || 'Untitled').substring(0, 16),
      (user.userId || 'N/A').substring(0, 16),
      user.totalContributions.toString(),
      user.totalRaisedNet.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.totalWithdrawn.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.walletAvailable.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.walletPending.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.expectedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.walletNetPayment.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      user.balanceDiscrepancy.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    ];

    console.log(row.map(r => r.padEnd(18)).join(''));

    totalRaised += user.totalRaisedNet;
    totalWithdrawn += user.totalWithdrawn;
    totalAvailable += user.walletAvailable;
    totalPending += user.walletPending;
    totalExpected += user.expectedOutstanding;
    totalDiscrepancy += user.balanceDiscrepancy;
  });

  console.log('─'.repeat(120));
  const totals = [
    'TOTAL',
    '',
    '',
    '',
    totalRaised.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    totalWithdrawn.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    totalAvailable.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    totalPending.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    totalExpected.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
    '',
    totalDiscrepancy.toLocaleString('en-NG', { maximumFractionDigits: 0 }),
  ];
  console.log(totals.map(r => r.padEnd(18)).join(''));
  console.log('═'.repeat(120));

  // Generate CSV for detailed export
  const csvContent = [
    [
      'Collection ID',
      'User ID',
      'Collection Name',
      'Status',
      'Created Date',
      'Total Contributions',
      'Amount Raised (Net)',
      'Amount Raised (Gross)',
      'Platform Fees',
      'Total Withdrawals',
      'Total Withdrawn',
      'Wallet Available Balance',
      'Wallet Pending Balance',
      'Wallet Net Payment',
      'Expected Outstanding (Raised - Withdrawn)',
      'Balance Discrepancy (Wallet vs Expected)',
      'Wallet Last Updated',
    ],
    ...userFinancials.map(u => [
      u.collectionId,
      u.userId,
      u.collectionName,
      u.status,
      u.createdAt,
      u.totalContributions,
      u.totalRaisedNet,
      u.totalRaisedGross,
      u.platformFees,
      u.totalWithdrawals,
      u.totalWithdrawn,
      u.walletAvailable,
      u.walletPending,
      u.walletNetPayment,
      u.expectedOutstanding,
      u.balanceDiscrepancy,
      u.walletLastUpdated,
    ]),
  ];

  const csvString = csvContent.map(row =>
    row.map(cell => {
      const str = (cell || '').toString();
      // Escape quotes and wrap if contains comma
      if (str.includes(',') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');

  // Save CSV file
  const csvPath = path.join(process.cwd(), 'user_financial_breakdown.csv');
  fs.writeFileSync(csvPath, csvString);
  console.log(`\n✅ CSV Export saved: ${csvPath}`);

  // Generate JSON for detailed analysis
  const jsonPath = path.join(process.cwd(), 'user_financial_breakdown.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalUsers: userFinancials.length,
      totalRaised,
      totalWithdrawn,
      totalAvailable,
      totalPending,
      totalExpected,
      totalDiscrepancy,
    },
    users: userFinancials,
  }, null, 2));
  console.log(`✅ JSON Export saved: ${jsonPath}`);

  // Generate detailed HTML report
  const htmlPath = path.join(process.cwd(), 'user_financial_breakdown.html');
  const htmlContent = generateHTML(userFinancials, {
    totalRaised,
    totalWithdrawn,
    totalAvailable,
    totalPending,
    totalExpected,
    totalDiscrepancy,
  });
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`✅ HTML Report saved: ${htmlPath}`);

  console.log('\n' + '═'.repeat(120));
  console.log('SUMMARY STATISTICS');
  console.log('═'.repeat(120));
  console.log(`
Total Users/Collections:     ${userFinancials.length}
Total Amount Raised:         ₦${totalRaised.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total Withdrawn to Users:    ₦${totalWithdrawn.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total Available (Wallet):    ₦${totalAvailable.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total Pending (Wallet):      ₦${totalPending.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Expected Outstanding:        ₦${totalExpected.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
Total Discrepancy:           ₦${totalDiscrepancy.toLocaleString('en-NG', { maximumFractionDigits: 2 })}

Collections with Positive Outstanding:  ${userFinancials.filter(u => u.expectedOutstanding > 0).length}
Collections with Zero Outstanding:      ${userFinancials.filter(u => u.expectedOutstanding === 0).length}
Collections with Negative Outstanding:  ${userFinancials.filter(u => u.expectedOutstanding < 0).length}

Collections with Balance Discrepancy:   ${userFinancials.filter(u => u.balanceDiscrepancy !== 0).length}
Max Discrepancy (individual):           ₦${Math.max(...userFinancials.map(u => Math.abs(u.balanceDiscrepancy))).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
  `);

  // Find edge cases
  const negative = userFinancials.filter(u => u.expectedOutstanding < 0);
  const largeDiscrepancy = userFinancials.filter(u => Math.abs(u.balanceDiscrepancy) > 100);

  if (negative.length > 0) {
    console.log('\n⚠️ COLLECTIONS WITH NEGATIVE OUTSTANDING (Overpaid):');
    console.log('─'.repeat(120));
    negative.forEach(u => {
      console.log(`  ${u.collectionName}: ₦${u.expectedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`);
    });
  }

  if (largeDiscrepancy.length > 0) {
    console.log('\n⚠️ COLLECTIONS WITH LARGE BALANCE DISCREPANCIES (>₦100):');
    console.log('─'.repeat(120));
    largeDiscrepancy.slice(0, 10).forEach(u => {
      console.log(`  ${u.collectionName}: ₦${u.balanceDiscrepancy.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`);
    });
  }

  console.log('\n' + '═'.repeat(120) + '\n');
}

function generateHTML(users, totals) {
  const rows = users.map((u, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${u.collectionName}</td>
      <td>${u.userId}</td>
      <td>${u.totalContributions}</td>
      <td>₦${u.totalRaisedNet.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
      <td>₦${u.totalWithdrawn.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
      <td style="${u.walletAvailable >= 0 ? 'color: green' : 'color: red'}">₦${u.walletAvailable.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
      <td>₦${u.walletPending.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
      <td style="${u.expectedOutstanding >= 0 ? 'color: green' : 'color: red'}">₦${u.expectedOutstanding.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
      <td style="${u.balanceDiscrepancy === 0 ? 'color: green' : 'color: orange'}">₦${u.balanceDiscrepancy.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Kolekto User Financial Breakdown</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { background: #f0f4ff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 20px; font-weight: bold; color: #2563eb; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #2563eb; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
    tr:hover { background: #f9f9f9; }
    .positive { color: #16a34a; font-weight: 500; }
    .negative { color: #dc2626; font-weight: 500; }
    .timestamp { color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏦 Kolekto User Financial Breakdown</h1>
    <p class="timestamp">Generated: ${new Date().toISOString()}</p>

    <div class="summary">
      <div class="stat">
        <div class="stat-label">Total Collections</div>
        <div class="stat-value">${users.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Raised</div>
        <div class="stat-value">₦${totals.totalRaised.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Withdrawn</div>
        <div class="stat-value">₦${totals.totalWithdrawn.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Available (Wallet)</div>
        <div class="stat-value">₦${totals.totalAvailable.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>S.No</th>
          <th>Collection Name</th>
          <th>User ID</th>
          <th>Contributions</th>
          <th>Amount Raised (₦)</th>
          <th>Withdrawn (₦)</th>
          <th>Available (₦)</th>
          <th>Pending (₦)</th>
          <th>Expected Balance (₦)</th>
          <th>Discrepancy (₦)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
