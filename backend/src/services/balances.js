const prisma = require('../prisma');

/**
 * Get exchange rate between two currencies on a specific date.
 * Fallback to general rates if no date-specific rate is found.
 */
async function getExchangeRate(fromCurrency, toCurrency, date = new Date()) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return 1.0;

  try {
    // Try to find the closest rate on or before the date
    const rateRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        date: {
          lte: new Date(date),
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (rateRecord) return rateRecord.rate;

    // Fallback: search for any rate between these currencies
    const fallbackRecord = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (fallbackRecord) return fallbackRecord.rate;

    // Default static fallbacks
    if (from === 'USD' && to === 'INR') return 83.0;
    if (from === 'INR' && to === 'USD') return 0.012;

    throw new Error(`Exchange rate from ${from} to ${to} not found.`);
  } catch (err) {
    console.error('Error fetching exchange rate:', err);
    // Return standard fallbacks to avoid breaking calculations
    if (from === 'USD' && to === 'INR') return 83.0;
    if (from === 'INR' && to === 'USD') return 0.012;
    return 1.0;
  }
}

/**
 * Calculate balances for all users in a group.
 * Returns both net balances and a detailed, transaction-by-transaction explanation for each user.
 */
async function calculateGroupBalances(groupId, targetCurrency = 'INR') {
  targetCurrency = targetCurrency.toUpperCase();

  // Fetch all group members
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const usersMap = {};
  members.forEach((m) => {
    usersMap[m.userId] = {
      id: m.userId,
      name: m.user.name,
      email: m.user.email,
      status: m.status,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
      netBalance: 0.0,
      breakdown: [],
    };
  });

  // Fetch all expenses in the group
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      participants: true,
      paidBy: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Fetch all completed settlements in the group
  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: 'COMPLETED' },
    include: {
      payer: { select: { name: true } },
      payee: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Process Expenses
  for (const exp of expenses) {
    const rate = await getExchangeRate(exp.currency, targetCurrency, exp.date);
    const convertedTotal = exp.amount * rate;

    // Calculate participant shares
    const participantsList = exp.participants;
    
    // For each member, calculate what they paid and what they owe
    for (const member of members) {
      const uId = member.userId;
      if (!usersMap[uId]) continue; // In case database has mismatched users

      let amountPaid = 0.0;
      if (exp.paidById === uId) {
        amountPaid = convertedTotal;
      }

      // Check if they are a participant
      const part = participantsList.find((p) => p.userId === uId);
      let amountOwed = 0.0;

      if (part) {
        amountOwed = part.amount * rate;
      }

      const netEffect = amountPaid - amountOwed;
      
      // Only record in breakdown if they are involved (paid or owed > 0)
      if (amountPaid > 0 || amountOwed > 0) {
        usersMap[uId].netBalance += netEffect;
        usersMap[uId].breakdown.push({
          type: 'expense',
          id: exp.id,
          description: exp.description,
          date: exp.date,
          originalAmount: exp.amount,
          originalCurrency: exp.currency,
          convertedAmount: convertedTotal,
          convertedCurrency: targetCurrency,
          paidBy: exp.paidBy.name,
          role: exp.paidById === uId ? (part ? 'PAYER_AND_PARTICIPANT' : 'PAYER_ONLY') : 'PARTICIPANT_ONLY',
          amountPaid,
          amountOwed,
          netEffect,
        });
      }
    }
  }

  // Process Settlements
  for (const set of settlements) {
    const rate = await getExchangeRate(set.currency, targetCurrency, set.date);
    const convertedAmount = set.amount * rate;

    const payerId = set.payerId;
    const payeeId = set.payeeId;

    // Payer's balance increases (paid off debt)
    if (usersMap[payerId]) {
      usersMap[payerId].netBalance += convertedAmount;
      usersMap[payerId].breakdown.push({
        type: 'settlement',
        id: set.id,
        description: `Paid settlement to ${set.payee.name}`,
        date: set.date,
        originalAmount: set.amount,
        originalCurrency: set.currency,
        convertedAmount,
        convertedCurrency: targetCurrency,
        paidBy: set.payer.name,
        role: 'PAYER',
        amountPaid: convertedAmount,
        amountOwed: 0.0,
        netEffect: convertedAmount,
      });
    }

    // Payee's balance decreases (received payment)
    if (usersMap[payeeId]) {
      usersMap[payeeId].netBalance -= convertedAmount;
      usersMap[payeeId].breakdown.push({
        type: 'settlement',
        id: set.id,
        description: `Received settlement from ${set.payer.name}`,
        date: set.date,
        originalAmount: set.amount,
        originalCurrency: set.currency,
        convertedAmount,
        convertedCurrency: targetCurrency,
        paidBy: set.payer.name,
        role: 'PAYEE',
        amountPaid: 0.0,
        amountOwed: convertedAmount,
        netEffect: -convertedAmount,
      });
    }
  }

  // Round balances to 2 decimal places to avoid floating point issues
  Object.keys(usersMap).forEach((uId) => {
    usersMap[uId].netBalance = Math.round(usersMap[uId].netBalance * 100) / 100;
  });

  return usersMap;
}

/**
 * Greedily simplify debts to minimize the number of transaction settlements.
 */
function simplifyDebts(userBalances) {
  // Convert userBalances map to array of active balances
  const balances = Object.values(userBalances).map((u) => ({
    userId: u.id,
    name: u.name,
    netBalance: u.netBalance,
  }));

  const creditors = [];
  const debtors = [];

  balances.forEach((b) => {
    // Round to 2 decimal places to avoid noise
    const val = Math.round(b.netBalance * 100) / 100;
    if (val > 0.01) {
      creditors.push({ ...b, netBalance: val });
    } else if (val < -0.01) {
      debtors.push({ ...b, netBalance: val });
    }
  });

  const settlements = [];

  // Greedy match largest debtor with largest creditor
  while (creditors.length > 0 && debtors.length > 0) {
    // Sort creditors descending, debtors ascending (most negative first)
    creditors.sort((a, b) => b.netBalance - a.netBalance);
    debtors.sort((a, b) => a.netBalance - b.netBalance);

    const creditor = creditors[0];
    const debtor = debtors[0];

    const debtAmount = Math.abs(debtor.netBalance);
    const creditAmount = creditor.netBalance;

    const settlementAmount = Math.min(debtAmount, creditAmount);
    const roundedAmount = Math.round(settlementAmount * 100) / 100;

    if (roundedAmount > 0) {
      settlements.push({
        payerId: debtor.userId,
        payerName: debtor.name,
        payeeId: creditor.userId,
        payeeName: creditor.name,
        amount: roundedAmount,
      });
    }

    // Update balances
    debtor.netBalance += roundedAmount;
    creditor.netBalance -= roundedAmount;

    // Filter out resolved balances
    if (Math.abs(debtor.netBalance) < 0.01) {
      debtors.shift();
    }
    if (Math.abs(creditor.netBalance) < 0.01) {
      creditors.shift();
    }
  }

  return settlements;
}

module.exports = {
  getExchangeRate,
  calculateGroupBalances,
  simplifyDebts,
};
