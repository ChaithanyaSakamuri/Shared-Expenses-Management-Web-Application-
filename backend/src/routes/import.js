const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const { processImportCSV } = require('../services/importer');
const { parse } = require('csv-parse');
const z = require('zod');

// Helper to parse CSV asynchronously
const parseCSV = (content) => new Promise((resolve, reject) => {
  parse(content, { 
    columns: true, 
    skip_empty_lines: true, 
    trim: true,
    cast: false // Keep raw strings to handle commas/floats manually in validator
  }, (err, records) => {
    if (err) reject(err);
    else resolve(records);
  });
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

// Upload CSV and analyze anomalies
router.post('/upload', authenticate, async (req, res) => {
  const { csvContent, groupId, filename } = req.body;
  if (!csvContent || !groupId) {
    return res.status(400).json({ error: 'csvContent and groupId are required' });
  }

  try {
    // Check group membership
    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: parseInt(groupId), userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Parse CSV rows
    const rawRows = await parseCSV(csvContent);
    
    // Analyze rows for anomalies
    const analyzed = await processImportCSV(parseInt(groupId), rawRows);

    // Create ImportJob
    const job = await prisma.importJob.create({
      data: {
        filename: filename || 'expenses_import.csv',
        status: 'PENDING',
        uploadedById: req.user.id,
      }
    });

    const anomaliesToCreate = [];
    analyzed.forEach((row) => {
      if (row.anomalies.length > 0) {
        row.anomalies.forEach((anom) => {
          anomaliesToCreate.push({
            jobId: job.id,
            rowIndex: row.rowIndex,
            rawRowData: JSON.stringify(row.parsedData),
            anomalyType: anom.type,
            description: anom.description,
            suggestedAction: anom.suggestedAction,
            status: 'PENDING',
          });
        });
      }
    });

    if (anomaliesToCreate.length > 0) {
      await prisma.importAnomaly.createMany({
        data: anomaliesToCreate,
      });
    }

    // Fetch created anomalies for return
    const anomalies = await prisma.importAnomaly.findMany({
      where: { jobId: job.id }
    });

    await logAction(req.user.id, 'CSV_UPLOAD', { jobId: job.id, filename: job.filename, anomaliesCount: anomalies.length });

    res.json({
      jobId: job.id,
      status: anomalies.length > 0 ? 'PENDING' : 'COMPLETED',
      anomalies,
      analyzedRows: analyzed, // Return analyzed rows including rows with no anomalies
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process CSV file. Ensure it has correct headers.' });
  }
});

// Commit import resolutions
router.post('/:jobId/commit', authenticate, async (req, res) => {
  const jobId = parseInt(req.params.jobId);
  const { resolutions, groupId } = req.body; // resolutions: array of { rowIndex, action: 'SKIPPED'|'IMPORTED_AS_IS'|'CORRECTED'|'SETTLEMENT_CREATED', data: ... }
  
  if (isNaN(jobId) || !groupId) {
    return res.status(400).json({ error: 'Invalid jobId or missing groupId' });
  }

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: { anomalies: true }
    });
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    const isMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: parseInt(groupId), userId: req.user.id } }
    });
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Apply import in a single database transaction
    await prisma.$transaction(async (tx) => {
      // Loop through resolutions
      for (const resItem of resolutions) {
        const { rowIndex, action, data } = resItem;
        
        // Mark corresponding anomalies as resolved
        await tx.importAnomaly.updateMany({
          where: { jobId, rowIndex },
          data: {
            status: 'RESOLVED',
            resolvedAction: action,
            resolvedById: req.user.id,
          }
        });

        if (action === 'SKIPPED') {
          continue;
        }

        if (action === 'SETTLEMENT_CREATED') {
          // Create a settlement record instead of expense
          await tx.settlement.create({
            data: {
              groupId: parseInt(groupId),
              payerId: data.paidById,
              payeeId: data.payeeId, // Who is being paid back
              amount: data.amount,
              currency: data.currency.toUpperCase(),
              date: new Date(data.date),
              status: 'COMPLETED',
            }
          });
        } else if (action === 'IMPORTED_AS_IS' || action === 'CORRECTED') {
          // Create Expense
          const expense = await tx.expense.create({
            data: {
              groupId: parseInt(groupId),
              description: data.description,
              amount: data.amount,
              currency: data.currency.toUpperCase(),
              paidById: data.paidById,
              splitType: data.splitType,
              date: new Date(data.date),
              notes: data.notes || '',
            }
          });

          // Create Expense participants
          const participantsData = data.participants.map(p => ({
            expenseId: expense.id,
            userId: p.userId,
            amount: p.amount,
            percentage: p.percentage || null,
            shares: p.shares || null,
          }));

          await tx.expenseParticipant.createMany({
            data: participantsData,
          });
        }
      }

      // Update import job status to COMPLETED
      await tx.importJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED' }
      });
    });

    await logAction(req.user.id, 'CSV_COMMIT', { jobId, resolutionsCount: resolutions.length });

    res.json({ message: 'Import job successfully committed to group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to commit import job. Ensure all resolutions are valid.' });
  }
});

// Get recent import jobs for audit
router.get('/jobs/recent', authenticate, async (req, res) => {
  try {
    const jobs = await prisma.importJob.findMany({
      include: {
        uploadedBy: { select: { name: true } },
        anomalies: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
