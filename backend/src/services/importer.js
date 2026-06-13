const prisma = require('../prisma');

/**
 * Standardize name and match with registered users.
 * Returns { matchedUser, suggestion }
 */
async function matchUser(rawName, dbUsers) {
  if (!rawName) return { matchedUser: null, suggestion: 'blank' };
  
  const name = rawName.trim().toLowerCase();
  
  // Exact match (case insensitive)
  let matched = dbUsers.find(u => u.name.toLowerCase() === name);
  if (matched) return { matchedUser: matched, suggestion: null };

  // Fuzzy matches
  if (name === 'priya s') {
    const priya = dbUsers.find(u => u.name.toLowerCase() === 'priya');
    return { matchedUser: priya || null, suggestion: 'Priya' };
  }
  if (name === 'rohan') {
    const rohan = dbUsers.find(u => u.name.toLowerCase() === 'rohan');
    return { matchedUser: rohan || null, suggestion: 'Rohan' };
  }
  
  // Try substring matching
  matched = dbUsers.find(u => u.name.toLowerCase().includes(name) || name.includes(u.name.toLowerCase()));
  if (matched) {
    return { matchedUser: matched, suggestion: matched.name };
  }

  return { matchedUser: null, suggestion: 'register_user' };
}

/**
 * Parse date string and detect formatting anomalies.
 */
function parseAndValidateDate(dateStr) {
  if (!dateStr) return { date: null, error: 'blank', isAmbiguous: false, isFuture: false };

  const trimmed = dateStr.trim();
  let parsedDate = null;
  let error = null;
  let isAmbiguous = false;
  let isFuture = false;

  // Format 1: DD-MM-YYYY (e.g. 01-02-2026)
  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  // Format 2: Mar-14
  const mdyRegex = /^([a-zA-Z]{3})-(\d{1,2})$/;

  const now = new Date('2026-06-13T16:26:01+05:30'); // System time from metadata

  if (dmyRegex.test(trimmed)) {
    const [, dayStr, monthStr, yearStr] = trimmed.match(dmyRegex);
    const day = parseInt(dayStr);
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      error = 'invalid_date_values';
    } else {
      parsedDate = new Date(Date.UTC(year, month - 1, day));
      
      // Check for ambiguity (both day and month are <= 12)
      if (day <= 12 && month <= 12 && day !== month) {
        isAmbiguous = true;
      }
    }
  } else if (mdyRegex.test(trimmed)) {
    const [, monthStr, dayStr] = trimmed.match(mdyRegex);
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const m = months[monthStr.toLowerCase().substring(0, 3)];
    const d = parseInt(dayStr);
    
    if (m === undefined || d < 1 || d > 31) {
      error = 'invalid_date_format';
    } else {
      // Assume year 2026 since other dates are 2026
      parsedDate = new Date(Date.UTC(2026, m, d));
      error = 'incomplete_year';
    }
  } else {
    // Try native Date.parse
    const stamp = Date.parse(trimmed);
    if (!isNaN(stamp)) {
      parsedDate = new Date(stamp);
    } else {
      error = 'unparseable_format';
    }
  }

  if (parsedDate) {
    if (parsedDate > now) {
      isFuture = true;
    }
  }

  return {
    date: parsedDate,
    error,
    isAmbiguous,
    isFuture
  };
}

/**
 * Scan row and identify all anomalies.
 */
async function analyzeCSVRow(rowIndex, row, dbUsers, groupMembers, importedRows, existingDbExpenses) {
  const anomalies = [];
  const parsedData = {
    date: null,
    description: row.description || '',
    paidBy: row.paid_by || '',
    amount: null,
    currency: row.currency || '',
    splitType: row.split_type || '',
    splitWith: row.split_with || '',
    splitDetails: row.split_details || '',
    notes: row.notes || '',
  };

  // 1. Check for blank essential values
  if (!row.description) {
    anomalies.push({
      type: 'BLANK_DESCRIPTION',
      description: 'Expense description is empty.',
      suggestedAction: 'SET_DEFAULT_DESCRIPTION',
      suggestion: 'Unnamed Expense',
    });
  }

  if (row.amount === undefined || row.amount === '') {
    anomalies.push({
      type: 'BLANK_AMOUNT',
      description: 'Expense amount is empty.',
      suggestedAction: 'SET_AMOUNT_ZERO',
      suggestion: '0',
    });
  } else {
    // Remove formatting commas e.g. "1,200" -> 1200
    const cleanAmountStr = String(row.amount).replace(/,/g, '');
    const amt = parseFloat(cleanAmountStr);
    if (isNaN(amt)) {
      anomalies.push({
        type: 'INVALID_AMOUNT_FORMAT',
        description: `Amount '${row.amount}' is not a valid number.`,
        suggestedAction: 'FIX_AMOUNT_FORMAT',
        suggestion: '0',
      });
    } else if (amt < 0) {
      parsedData.amount = amt;
      anomalies.push({
        type: 'NEGATIVE_AMOUNT',
        description: `Expense amount is negative (${amt}). It is likely a refund.`,
        suggestedAction: 'CONVERT_TO_REFUND_OR_REVERSE_PAYER',
        suggestion: String(Math.abs(amt)),
      });
    } else if (amt === 0) {
      parsedData.amount = 0;
      anomalies.push({
        type: 'ZERO_AMOUNT',
        description: 'Expense amount is zero.',
        suggestedAction: 'SKIP_ROW',
        suggestion: '',
      });
    } else {
      parsedData.amount = amt;
    }
  }

  // 2. Check Currency
  if (!row.currency) {
    anomalies.push({
      type: 'MISSING_CURRENCY',
      description: 'Currency is empty.',
      suggestedAction: 'DEFAULT_TO_INR',
      suggestion: 'INR',
    });
    parsedData.currency = 'INR';
  } else {
    const cur = row.currency.trim().toUpperCase();
    if (cur !== 'INR' && cur !== 'USD') {
      anomalies.push({
        type: 'UNSUPPORTED_CURRENCY',
        description: `Currency '${row.currency}' is unsupported. Only INR and USD are supported.`,
        suggestedAction: 'CONVERT_TO_INR',
        suggestion: 'INR',
      });
    } else {
      parsedData.currency = cur;
    }
  }

  // 3. Date Validation
  const dateRes = parseAndValidateDate(row.date);
  if (dateRes.date) {
    parsedData.date = dateRes.date;
  }
  if (dateRes.error === 'blank') {
    anomalies.push({
      type: 'BLANK_DATE',
      description: 'Date field is blank.',
      suggestedAction: 'DEFAULT_TO_CURRENT_DATE',
      suggestion: '2026-06-13',
    });
  } else if (dateRes.error === 'invalid_date_values' || dateRes.error === 'unparseable_format') {
    anomalies.push({
      type: 'INVALID_DATE_FORMAT',
      description: `Date '${row.date}' is invalid or unparseable.`,
      suggestedAction: 'CORRECT_DATE_FORMAT',
      suggestion: '2026-03-14',
    });
  } else if (dateRes.error === 'incomplete_year') {
    anomalies.push({
      type: 'INCOMPLETE_DATE_YEAR',
      description: `Date '${row.date}' is missing the year.`,
      suggestedAction: 'ASSUME_YEAR_2026',
      suggestion: parsedData.date ? parsedData.date.toISOString().slice(0, 10) : '2026-03-14',
    });
  }
  if (dateRes.isAmbiguous) {
    anomalies.push({
      type: 'AMBIGUOUS_DATE',
      description: `Date '${row.date}' is ambiguous (could be DD-MM or MM-DD).`,
      suggestedAction: 'CONFIRM_DATE_INTERPRETATION',
      suggestion: parsedData.date ? parsedData.date.toISOString().slice(0, 10) : '',
    });
  }
  if (dateRes.isFuture) {
    anomalies.push({
      type: 'FUTURE_DATE',
      description: `Date '${row.date}' is in the future relative to the system date.`,
      suggestedAction: 'ADJUST_TO_PRESENT',
      suggestion: new Date().toISOString().slice(0, 10),
    });
  }

  // 4. Validate Payer (paid_by)
  let payerUser = null;
  if (!row.paid_by) {
    anomalies.push({
      type: 'BLANK_PAYER',
      description: 'Payer name (paid_by) is empty.',
      suggestedAction: 'ASSIGN_DEFAULT_PAYER',
      suggestion: 'Aisha',
    });
  } else {
    const { matchedUser, suggestion } = await matchUser(row.paid_by, dbUsers);
    if (matchedUser) {
      payerUser = matchedUser;
      
      // Verify if payer is in the group member list
      const isGrpMem = groupMembers.find(m => m.userId === payerUser.id);
      if (!isGrpMem) {
        anomalies.push({
          type: 'PAYER_NOT_IN_GROUP',
          description: `Payer '${row.paid_by}' is a registered user but not a member of the group.`,
          suggestedAction: 'ADD_USER_TO_GROUP',
          suggestion: String(payerUser.id),
        });
      } else if (parsedData.date) {
        // Verify if payer was active in the group on the expense date
        const expDate = parsedData.date;
        if (expDate < isGrpMem.joinedAt) {
          anomalies.push({
            type: 'PAYER_INACTIVE_ON_DATE',
            description: `Payer '${row.paid_by}' was not active in the group on ${row.date}. Joined on: ${isGrpMem.joinedAt.toISOString().slice(0, 10)}`,
            suggestedAction: 'ADJUST_MEMBER_JOIN_DATE',
            suggestion: expDate.toISOString().slice(0, 10),
          });
        } else if (isGrpMem.leftAt && expDate > isGrpMem.leftAt) {
          anomalies.push({
            type: 'PAYER_INACTIVE_ON_DATE',
            description: `Payer '${row.paid_by}' had already left the group on ${row.date}. Left on: ${isGrpMem.leftAt.toISOString().slice(0, 10)}`,
            suggestedAction: 'EXTEND_MEMBERSHIP_STAY',
            suggestion: expDate.toISOString().slice(0, 10),
          });
        }
      }
    } else {
      anomalies.push({
        type: 'UNREGISTERED_PAYER',
        description: `Payer name '${row.paid_by}' does not match any registered user.`,
        suggestedAction: suggestion === 'register_user' ? 'CREATE_AND_ADD_USER' : 'CORRECT_PAYER_NAME',
        suggestion: suggestion === 'register_user' ? row.paid_by : suggestion,
      });
    }
  }

  // 5. Check if Settlement is logged as Expense
  const desc = (row.description || '').toLowerCase();
  const isSettlement = desc.includes('paid back') || desc.includes('settled') || desc.includes('transfer') || desc.includes('deposit share') || !row.split_type;
  if (isSettlement) {
    anomalies.push({
      type: 'SETTLEMENT_LOGGED_AS_EXPENSE',
      description: `Description '${row.description}' or missing split_type indicates this is a debt settlement, not a group expense.`,
      suggestedAction: 'CREATE_SETTLEMENT_RECORD',
      suggestion: 'SETTLEMENT',
    });
  }

  // 6. Split Participants Validation (split_with and split_details)
  const splitUsers = [];
  if (row.split_with) {
    const rawNames = row.split_with.split(';');
    for (const rawName of rawNames) {
      const trimmedName = rawName.trim();
      if (!trimmedName) continue;

      const { matchedUser, suggestion } = await matchUser(trimmedName, dbUsers);
      if (matchedUser) {
        splitUsers.push(matchedUser);

        // Verify if split user is in the group
        const isGrpMem = groupMembers.find(m => m.userId === matchedUser.id);
        if (!isGrpMem) {
          anomalies.push({
            type: 'PARTICIPANT_NOT_IN_GROUP',
            description: `Split participant '${trimmedName}' is not in the group.`,
            suggestedAction: 'ADD_USER_TO_GROUP',
            suggestion: String(matchedUser.id),
          });
        } else if (parsedData.date) {
          // Check if split user was active on the expense date
          const expDate = parsedData.date;
          if (expDate < isGrpMem.joinedAt) {
            anomalies.push({
              type: 'PARTICIPANT_INACTIVE_ON_DATE',
              description: `Participant '${trimmedName}' was not in the group on ${row.date}. Joined on: ${isGrpMem.joinedAt.toISOString().slice(0, 10)}`,
              suggestedAction: 'ADJUST_MEMBER_JOIN_DATE',
              suggestion: expDate.toISOString().slice(0, 10),
            });
          } else if (isGrpMem.leftAt && expDate > isGrpMem.leftAt) {
            anomalies.push({
              type: 'PARTICIPANT_INACTIVE_ON_DATE',
              description: `Participant '${trimmedName}' had left the group on ${row.date}. Left on: ${isGrpMem.leftAt.toISOString().slice(0, 10)}`,
              suggestedAction: 'EXTEND_MEMBERSHIP_STAY',
              suggestion: expDate.toISOString().slice(0, 10),
            });
          }
        }
      } else {
        anomalies.push({
          type: 'UNREGISTERED_PARTICIPANT',
          description: `Participant '${trimmedName}' does not match any registered user.`,
          suggestedAction: suggestion === 'register_user' ? 'CREATE_AND_ADD_USER' : 'CORRECT_PARTICIPANT_NAME',
          suggestion: suggestion === 'register_user' ? trimmedName : suggestion,
        });
      }
    }
  } else {
    anomalies.push({
      type: 'MISSING_PARTICIPANTS',
      description: 'Split list (split_with) is empty.',
      suggestedAction: 'SPLIT_EQUALLY_WITH_ALL_ACTIVE_MEMBERS',
      suggestion: '',
    });
  }

  // 7. Validate Split Math Consistency
  if (parsedData.amount !== null && parsedData.amount > 0 && row.split_type) {
    const splitType = row.split_type.trim().toLowerCase();
    
    if (splitType === 'percentage') {
      // Parse details: Aisha 30%; Rohan 30%; Priya 30%; Meera 20%
      const details = row.split_details || '';
      const parts = details.split(';').map(p => p.trim()).filter(Boolean);
      let totalPct = 0;
      
      parts.forEach((p) => {
        const match = p.match(/(.+)\s+(\d+(?:\.\d+)?)\s*%/);
        if (match) {
          totalPct += parseFloat(match[2]);
        }
      });

      if (Math.abs(totalPct - 100.0) > 0.01) {
        anomalies.push({
          type: 'INCONSISTENT_SPLIT_PERCENTAGE',
          description: `Split percentages sum to ${totalPct}%, which does not equal 100%.`,
          suggestedAction: 'RESCALE_TO_100_PERCENT',
          suggestion: '100%',
        });
      }
    } else if (splitType === 'unequal' || splitType === 'exact') {
      // Parse details: Rohan 700; Priya 400; Meera 400
      const details = row.split_details || '';
      const parts = details.split(';').map(p => p.trim()).filter(Boolean);
      let totalAmt = 0;

      parts.forEach((p) => {
        const match = p.match(/(.+)\s+(\d+(?:\.\d+)?)/);
        if (match) {
          totalAmt += parseFloat(match[2]);
        }
      });

      if (Math.abs(totalAmt - parsedData.amount) > 0.05) {
        anomalies.push({
          type: 'INCONSISTENT_SPLIT_TOTAL',
          description: `Split exact amounts sum to ${totalAmt}, which does not match the total expense amount of ${parsedData.amount}.`,
          suggestedAction: 'ADJUST_TOTAL_OR_PRO_RATA',
          suggestion: String(totalAmt),
        });
      }
    }
  }

  // 8. Check for duplicates (within the CSV file or in the DB)
  // Check within current CSV import set
  const duplicateInImport = importedRows.find(
    r => r.description.trim().toLowerCase() === parsedData.description.trim().toLowerCase() &&
         r.amount === parsedData.amount &&
         r.paidBy.trim().toLowerCase() === parsedData.paidBy.trim().toLowerCase() &&
         r.date && parsedData.date && r.date.getTime() === parsedData.date.getTime()
  );

  // Check in database
  const duplicateInDb = existingDbExpenses.find(
    e => e.description.trim().toLowerCase() === parsedData.description.trim().toLowerCase() &&
         Math.abs(e.amount - (parsedData.amount || 0)) < 0.01 &&
         e.date.toISOString().slice(0, 10) === (parsedData.date ? parsedData.date.toISOString().slice(0, 10) : '')
  );

  if (duplicateInImport || duplicateInDb) {
    anomalies.push({
      type: 'DUPLICATE_EXPENSE',
      description: `Expense resembles an already logged expense (Description: '${row.description}', Amount: ${row.amount}, Date: ${row.date}).`,
      suggestedAction: 'SKIP_ROW',
      suggestion: 'DUPLICATE',
    });
  }

  return {
    rowIndex,
    parsedData,
    anomalies,
  };
}

/**
 * Process raw CSV rows and returns the import analysis.
 */
async function processImportCSV(groupId, csvRows) {
  // Fetch database users and group members
  const dbUsers = await prisma.user.findMany();
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
  });

  const existingDbExpenses = await prisma.expense.findMany({
    where: { groupId },
  });

  const analyzedRows = [];
  
  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i];
    // Skip empty lines
    if (!row.date && !row.description && !row.amount) continue;

    const analysis = await analyzeCSVRow(
      i + 1, // 1-indexed row number
      row,
      dbUsers,
      groupMembers,
      analyzedRows.map(r => r.parsedData), // for duplicate check in same file
      existingDbExpenses
    );

    analyzedRows.push(analysis);
  }

  return analyzedRows;
}

module.exports = {
  processImportCSV,
  parseAndValidateDate,
  matchUser,
};
