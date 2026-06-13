const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const z = require('zod');

// Validation schemas
const participantSchema = z.object({
  userId: z.number(),
  amount: z.number().min(0),
  percentage: z.number().optional().nullable(),
  shares: z.number().optional().nullable(),
});

const expenseSchema = z.object({
  groupId: z.number(),
  description: z.string().min(1),
  amount: z.number().min(0.01),
  currency: z.string().min(3).max(3).default('INR'),
  paidById: z.number(),
  splitType: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARE']),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes: z.string().optional().nullable(),
  participants: z.array(participantSchema).min(1),
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

// Create Expense
router.post('/', authenticate, async (req, res) => {
  try {
    const data = expenseSchema.parse(req.body);
    
    // Verify user is in group
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const expenseDate = new Date(data.date);

    // Verify payer and participants are group members and active during expense date
    const memberIds = [data.paidById, ...data.participants.map(p => p.userId)];
    const uniqueMemberIds = [...new Set(memberIds)];

    for (const mId of uniqueMemberIds) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: data.groupId, userId: mId } }
      });
      if (!membership) {
        return res.status(400).json({ error: `User with ID ${mId} is not a member of this group` });
      }

      // Check date bounds
      if (expenseDate < membership.joinedAt) {
        return res.status(400).json({ 
          error: `User ${membership.userId} was not in the group on the expense date (${data.date}). Joined on: ${membership.joinedAt.toISOString().slice(0,10)}` 
        });
      }
      if (membership.leftAt && expenseDate > membership.leftAt) {
        return res.status(400).json({ 
          error: `User ${membership.userId} had already left the group on the expense date (${data.date}). Left on: ${membership.leftAt.toISOString().slice(0,10)}` 
        });
      }
    }

    // Double check split sums consistency
    const totalSplitAmount = data.participants.reduce((sum, p) => sum + p.amount, 0);
    // Use epsilon for float comparisons
    if (Math.abs(totalSplitAmount - data.amount) > 0.05) {
      return res.status(400).json({ 
        error: `Inconsistent split totals: split sum (${totalSplitAmount}) does not match total amount (${data.amount})` 
      });
    }

    // Write to DB in a Transaction
    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId: data.groupId,
          description: data.description,
          amount: data.amount,
          currency: data.currency.toUpperCase(),
          paidById: data.paidById,
          splitType: data.splitType,
          date: expenseDate,
          notes: data.notes,
        },
      });

      const participantRecords = data.participants.map(p => ({
        expenseId: expense.id,
        userId: p.userId,
        amount: p.amount,
        percentage: p.percentage,
        shares: p.shares,
      }));

      await tx.expenseParticipant.createMany({
        data: participantRecords,
      });

      return await tx.expense.findUnique({
        where: { id: expense.id },
        include: { participants: true },
      });
    });

    await logAction(req.user.id, 'EXPENSE_CREATE', {
      expenseId: result.id,
      description: result.description,
      amount: result.amount,
      currency: result.currency,
      groupId: result.groupId
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit Expense
router.put('/:id', authenticate, async (req, res) => {
  const expenseId = parseInt(req.params.id);
  if (isNaN(expenseId)) {
    return res.status(400).json({ error: 'Invalid expense ID' });
  }

  try {
    const data = expenseSchema.parse(req.body);
    const existingExpense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Verify user is in group
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const expenseDate = new Date(data.date);

    // Verify active membership check
    const memberIds = [data.paidById, ...data.participants.map(p => p.userId)];
    const uniqueMemberIds = [...new Set(memberIds)];

    for (const mId of uniqueMemberIds) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: data.groupId, userId: mId } }
      });
      if (!membership) {
        return res.status(400).json({ error: `User with ID ${mId} is not a member of this group` });
      }

      if (expenseDate < membership.joinedAt) {
        return res.status(400).json({ error: `User ${mId} was not in the group on the expense date` });
      }
      if (membership.leftAt && expenseDate > membership.leftAt) {
        return res.status(400).json({ error: `User ${mId} had left the group on the expense date` });
      }
    }

    // Verify split total consistency
    const totalSplitAmount = data.participants.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalSplitAmount - data.amount) > 0.05) {
      return res.status(400).json({ error: 'Inconsistent split totals' });
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete old participants
      await tx.expenseParticipant.deleteMany({ where: { expenseId } });

      // Update core expense
      const updatedExpense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: data.description,
          amount: data.amount,
          currency: data.currency.toUpperCase(),
          paidById: data.paidById,
          splitType: data.splitType,
          date: expenseDate,
          notes: data.notes,
        },
      });

      // Create new participants
      const participantRecords = data.participants.map(p => ({
        expenseId,
        userId: p.userId,
        amount: p.amount,
        percentage: p.percentage,
        shares: p.shares,
      }));

      await tx.expenseParticipant.createMany({
        data: participantRecords,
      });

      return await tx.expense.findUnique({
        where: { id: expenseId },
        include: { participants: true },
      });
    });

    await logAction(req.user.id, 'EXPENSE_UPDATE', {
      expenseId: result.id,
      description: result.description,
      amount: result.amount,
      currency: result.currency
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Expense
router.delete('/:id', authenticate, async (req, res) => {
  const expenseId = parseInt(req.params.id);
  if (isNaN(expenseId)) {
    return res.status(400).json({ error: 'Invalid expense ID' });
  }

  try {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Verify user is in group
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    await logAction(req.user.id, 'EXPENSE_DELETE', {
      expenseId,
      description: expense.description,
      amount: expense.amount
    });

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List Group Expenses
router.get('/group/:groupId', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }

  try {
    // Check membership
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        participants: {
          include: {
            expense: false
          }
        },
        paidBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: { date: 'desc' },
    });

    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
