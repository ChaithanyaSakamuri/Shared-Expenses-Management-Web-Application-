const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');

// Get all audit logs
router.get('/logs', authenticate, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200 // Cap at 200 logs for list view
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reports data
router.get('/reports', authenticate, async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) {
    return res.status(400).json({ error: 'groupId query parameter is required' });
  }

  const gId = parseInt(groupId);

  try {
    // 1. Fetch group details
    const group = await prisma.group.findUnique({
      where: { id: gId },
      include: { members: { include: { user: true } } }
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // 2. Import stats (Import Report)
    const importJobs = await prisma.importJob.findMany({
      where: { uploadedById: { in: group.members.map(m => m.userId) } },
      include: { anomalies: true }
    });

    const totalJobs = importJobs.length;
    const completedJobs = importJobs.filter(j => j.status === 'COMPLETED').length;
    
    let totalAnomalies = 0;
    let resolvedAnomalies = 0;
    const anomalyTypeStats = {};

    importJobs.forEach((job) => {
      totalAnomalies += job.anomalies.length;
      job.anomalies.forEach((anom) => {
        if (anom.status === 'RESOLVED') resolvedAnomalies++;
        
        anomalyTypeStats[anom.anomalyType] = (anomalyTypeStats[anom.anomalyType] || 0) + 1;
      });
    });

    // 3. Expense and Settlement stats (Settlement & Balance Report)
    const expenses = await prisma.expense.findMany({
      where: { groupId: gId },
      include: { participants: true }
    });
    const totalExpensesSum = expenses.reduce((sum, e) => sum + e.amount, 0); // Note: mixes currencies, but we can do a converted INR total
    
    // Fetch rates to sum everything in INR for report
    const usdToInr = 83.0; // standard approximation
    const inrExpensesSum = expenses.reduce((sum, e) => {
      const rate = e.currency === 'USD' ? usdToInr : 1.0;
      return sum + (e.amount * rate);
    }, 0);

    const settlements = await prisma.settlement.findMany({
      where: { groupId: gId },
      include: { payer: true, payee: true }
    });
    const completedSettlementsSum = settlements
      .filter(s => s.status === 'COMPLETED')
      .reduce((sum, s) => {
        const rate = s.currency === 'USD' ? usdToInr : 1.0;
        return sum + (s.amount * rate);
      }, 0);

    const pendingSettlementsCount = settlements.filter(s => s.status === 'PENDING').length;

    res.json({
      groupName: group.name,
      importReport: {
        totalJobs,
        completedJobs,
        totalAnomalies,
        resolvedAnomalies,
        anomalyTypeStats
      },
      balanceReport: {
        totalExpensesCount: expenses.length,
        inrExpensesSum: Math.round(inrExpensesSum * 100) / 100,
        averageExpensePerMember: group.members.length > 0 ? Math.round((inrExpensesSum / group.members.length) * 100) / 100 : 0
      },
      settlementReport: {
        totalSettlementsCount: settlements.length,
        completedSettlementsSumInr: Math.round(completedSettlementsSum * 100) / 100,
        pendingSettlementsCount,
        recentSettlements: settlements.slice(0, 10).map(s => ({
          payer: s.payer.name,
          payee: s.payee.name,
          amount: s.amount,
          currency: s.currency,
          status: s.status,
          date: s.date
        }))
      },
      anomalyReport: {
        anomalyTypeStats,
        resolutionPercentage: totalAnomalies > 0 ? Math.round((resolvedAnomalies / totalAnomalies) * 100) : 100
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating reports' });
  }
});

module.exports = router;
