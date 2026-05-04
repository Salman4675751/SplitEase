/**
 * Debt Simplification Algorithm (Minimize Cash Flow)
 *
 * Given a set of expenses and settlements within a group, computes the minimum
 * number of transactions needed to settle all debts.
 *
 * Steps:
 *   1. Compute net balance per user: positive = owed to them, negative = they owe
 *   2. Separate into creditors and debtors
 *   3. Greedily match largest debtor with largest creditor until all settled
 */

const EPSILON = 0.01; // treat balances < 1 cent as zero

/**
 * @param {Array} expenses  - Expense documents with paidBy[] and splits[]
 * @param {Array} settlements - Settlement documents
 * @returns {Object} { balances: { userId: netAmount }, transactions: [{from, to, amount}] }
 */
function simplifyGroupDebts(expenses, settlements) {
  const balances = {};

  const ensure = (id) => {
    if (!balances[id]) balances[id] = 0;
  };

  // Each expense: payers gain credit, split members owe
  for (const expense of expenses) {
    for (const payer of expense.paidBy) {
      const id = payer.user.toString();
      ensure(id);
      balances[id] += payer.amount;
    }
    for (const split of expense.splits) {
      const id = split.user.toString();
      ensure(id);
      balances[id] -= split.amount;
    }
  }

  // Settlements reduce outstanding balances
  for (const settlement of settlements) {
    const from = settlement.paidBy.toString();
    const to = settlement.paidTo.toString();
    ensure(from);
    ensure(to);
    balances[from] += settlement.amount; // debtor paid, their debt decreases
    balances[to] -= settlement.amount;   // creditor received, their credit decreases
  }

  const transactions = minimizeCashFlow(balances);

  return { balances, transactions };
}

function minimizeCashFlow(balances) {
  const creditors = []; // owed money (balance > 0)
  const debtors = [];   // owe money (balance < 0)

  for (const [userId, amount] of Object.entries(balances)) {
    if (amount > EPSILON) creditors.push({ userId, amount });
    else if (amount < -EPSILON) debtors.push({ userId, amount: -amount });
  }

  // Sort descending by amount for greedy efficiency
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const settle = Math.min(creditors[i].amount, debtors[j].amount);

    transactions.push({
      from: debtors[j].userId,
      to: creditors[i].userId,
      amount: Math.round(settle * 100) / 100, // round to 2 decimal places
    });

    creditors[i].amount -= settle;
    debtors[j].amount -= settle;

    if (creditors[i].amount < EPSILON) i++;
    if (debtors[j].amount < EPSILON) j++;
  }

  return transactions;
}

module.exports = { simplifyGroupDebts };
