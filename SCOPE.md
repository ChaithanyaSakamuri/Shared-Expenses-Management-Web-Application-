# Scope & Anomaly Analysis Report

This document details every validation anomaly detected within the raw `Expenses Export.csv` file, the system's interactive resolution policies, and the normalized schema model.

## CSV Anomaly Audit Log

The Spreetail Importer scans and highlights the following anomalies:

| Row | Item Description | Detected Anomaly | System Handling / Resolution Policy |
| :--- | :--- | :--- | :--- |
| 5 & 6 | Dinner at Marina Bites / dinner - marina bites | **Duplicate Expense** (Same date, amount, and payer logged twice). | Highlight duplicate card; recommend skipping row 6 and importing row 5. |
| 7 | Electricity Feb | **Amount Format Issues** (Commas in string `"1,200"`). | Clean commas automatically to parse as numerical `1200.0`. |
| 9 | Movie night snacks | **User Name Case Mismatch** (`priya` instead of `Priya`). | Fuzzy-matches to registered ID for `Priya` automatically. |
| 11 | Groceries DMart | **Name Variation** (`Priya S` paid instead of `Priya`). | Fuzzy-matches to registered ID for `Priya` and prompts correction. |
| 13 | House cleaning supplies | **Blank/Missing Payer** (No paid_by provided). | Flags missing payer; prompts user to select a payer from active members. |
| 14 | Rohan paid Aisha back | **Settlement Logged as Expense** (Debt settlement). | Prompts user to convert row into a **Settlement Transfer** instead of an Expense. |
| 15 | Pizza Friday | **Inconsistent Split Math** (Percentages sum to 110%). | Flags math issue; prompts correction or rescale to 100% (e.g. 30/30/20/20). |
| 23 | Parasailing | **Unregistered Member** (Kabir joined for the day). | Flags unregistered user; prompts creating user or splitting only with active members. |
| 24 & 25 | Thalassa dinner | **Potential Duplicate Payer Conflict** (Different payers logged same dinner). | Highlight duplicate conflict; recommend importing Rohan's 2450 row and skipping Aisha's. |
| 26 | Parasailing refund | **Negative Amount** (Refund of -$30 USD). | Suggests importing as a refund deduction, or recording as settlement. |
| 27 | Airport cab | **Invalid Date Format** (`Mar-14`) and trailing space in name (`rohan `). | Re-formats date to `14-03-2026` using incomplete year logic; trims space. |
| 28 | Groceries DMart | **Missing Currency** (Currency field left empty). | Highlights missing currency; defaults to group's target currency (`INR`). |
| 31 | Dinner order Swiggy | **Zero Amount** (Amount is 0). | Flags zero amount; suggests skipping row to avoid empty expense. |
| 34 | Deep cleaning service | **Ambiguous Date Format** (`04-05-2026`). | Flags date ambiguity; prompts user to confirm if April 5 or May 4. |
| 36 | Groceries BigBasket | **Inactive Member split** (Meera included after leaving). | Flags split on inactive member; prompts removing Meera from split. |
| 38 | Sam deposit share | **Settlement Logged as Expense** (Deposit transfer). | Prompts user to convert row into a **Settlement Transfer** instead of an Expense. |

---

## Database Schema Explanation

We use Prisma ORM to map entities into a relational SQL structure:

1. **User**: Stores login credentials (`passwordHash`), roles, and profile details.
2. **Group**: Core organizational unit for flatmates or trips.
3. **GroupMember**: Tracks membership timelines with `joinedAt` and `leftAt`. Essential for verifying if a user was active during an expense date.
4. **Expense**: Header record storing core expense metrics (total, currency, date, notes).
5. **ExpenseParticipant**: Detail records storing individual debtor amounts, shares, and percentages.
6. **Settlement**: Record of debt payments between roommates (marks payments as pending or completed).
7. **ExchangeRate**: Store historical rates for multi-currency conversion (USD $\leftrightarrow$ INR).
8. **ImportJob & ImportAnomaly**: Tracks CSV file imports, detected anomalies, and how they were resolved.
9. **AuditLog**: Stores change trails (e.g. `USER_LOGIN`, `CSV_COMMIT`, `EXPENSE_CREATE`).
