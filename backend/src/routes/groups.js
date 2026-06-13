const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const z = require('zod');

// Schema validations
const createGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  userId: z.number(),
  joinedAt: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

const removeMemberSchema = z.object({
  leftAt: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
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

// Create Group
router.post('/', authenticate, async (req, res) => {
  try {
    const data = createGroupSchema.parse(req.body);
    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        createdById: req.user.id,
      },
    });

    // Add creator as first active member
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: req.user.id,
        joinedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    await logAction(req.user.id, 'GROUP_CREATE', { groupId: group.id, name: group.name });

    res.status(201).json(group);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List Groups for user
router.get('/', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } }
            }
          }
        }
      },
    });
    const groups = memberships.map(m => m.group);
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Group Details
router.get('/:id', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.id);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }

  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } }
          }
        },
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Member
router.post('/:id/members', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.id);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Invalid group ID' });
  }

  try {
    const data = addMemberSchema.parse(req.body);
    
    // Verify user exists
    const userToAdd = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions (must be member)
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Only group members can add new members' });
    }

    const joinDate = data.joinedAt ? new Date(data.joinedAt) : new Date();

    // Upsert membership
    const membership = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: data.userId } },
      update: {
        status: 'ACTIVE',
        joinedAt: joinDate,
        leftAt: null,
      },
      create: {
        groupId,
        userId: data.userId,
        joinedAt: joinDate,
        status: 'ACTIVE',
      },
    });

    await logAction(req.user.id, 'GROUP_ADD_MEMBER', {
      groupId,
      addedUserId: data.userId,
      addedUserName: userToAdd.name,
      joinedAt: joinDate
    });

    res.status(200).json(membership);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove Member (Reactivate / Soft-remove)
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);

  if (isNaN(groupId) || isNaN(targetUserId)) {
    return res.status(400).json({ error: 'Invalid IDs' });
  }

  try {
    // Check permissions
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Only group members can remove members' });
    }

    // Body validation for custom left date
    let leftDate = new Date();
    if (req.body && req.body.leftAt) {
      leftDate = new Date(req.body.leftAt);
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Set status to INACTIVE
    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: {
        status: 'INACTIVE',
        leftAt: leftDate,
      },
    });

    await logAction(req.user.id, 'GROUP_REMOVE_MEMBER', {
      groupId,
      removedUserId: targetUserId,
      leftAt: leftDate
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all registered users (for search/adding members)
router.get('/users/all', authenticate, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
