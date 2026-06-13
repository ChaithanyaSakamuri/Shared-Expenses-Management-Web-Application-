const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const { calculateGroupBalances, simplifyDebts } = require('../services/balances');
const z = require('zod');

// Schema validation
const settlementSchema = z.object({
  groupId: z.number(),
  payerId: z.number(),
  payeeId: z.number(),
  amount: z.number().min(0.01),
  currency: z.string().min(3).max(3).default('INR'),
  date: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  status: z.enum(['PENDING', 'COMPLETED']).default('COMPLETED'),
});

async function logAction(userId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
      },
    });
  } catch (err) {
    console.error('Audit logging failed', err);
  }
}

// Record settlement
router.post('/', authenticate, async (req, res) => {
  try {
    const data = settlementSchema.parse(req.body);

    // Verify user is in group
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Verify payer and payee are group members
    const payerMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId: data.payerId } }
    });
    const payeeMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId: data.payeeId } }
    });

    if (!payerMember || !payeeMember) {
      return res.status(400).json({ error: 'Payer or Payee is not a member of this group' });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: data.groupId,
        payerId: data.payerId,
        payeeId: data.payeeId,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        date: data.date ? new Date(data.date) : new Date(),
        status: data.status,
      },
      include: {
        payer: { select: { name: true } },
        payee: { select: { name: true } },
      }
    });

    await logAction(req.user.id, 'SETTLEMENT_CREATE', {
      settlementId: settlement.id,
      payer: settlement.payer.name,
      payee: settlement.payee.name,
      amount: settlement.amount,
      currency: settlement.currency,
    });

    res.status(201).json(settlement);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update settlement status (e.g. mark completed)
router.patch('/:id/complete', authenticate, async (req, res) => {
  const settlementId = parseInt(req.params.id);
  if (isNaN(settlementId)) {
    return res.status(400).json({ error: 'Invalid settlement ID' });
  }

  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { group: true }
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Verify requester is in the group
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: settlement.groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: { status: 'COMPLETED' },
      include: {
        payer: { select: { name: true } },
        payee: { select: { name: true } },
      }
    });

    await logAction(req.user.id, 'SETTLEMENT_COMPLETE', {
      settlementId: updated.id,
      payer: updated.payer.name,
      payee: updated.payee.name,
      amount: updated.amount,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group balance summaries, simplified debts, and breakdowns
router.get('/group/:groupId/summary', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }

  const currency = (req.query.currency || 'INR').toUpperCase();

  try {
    // Check group membership
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Compute balances with detailed breakdowns
    const balances = await calculateGroupBalances(groupId, currency);

    // Compute simplified debts
    const simplifiedDebts = simplifyDebts(balances);

    // Fetch settlements list
    const settlementsList = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json({
      balances,
      simplifiedDebts,
      settlements: settlementsList,
      targetCurrency: currency,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
