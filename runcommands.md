# Crescent School ERP — Commands & Role Credentials Guide

## Quick Startup Commands

```bash
# 1. Start the Next.js development server
npm run dev

# 2. Run the automated business logic test suite (5 rules)
npm run test:logic

# 3. Run the concurrency & race condition test suite (P0-2, P0-3, P0-4)
npx tsx src/db/verify-concurrency.ts

# 4. Run the background outbox cron processor test suite
npx tsx src/db/verify-cron.ts

# 5. Compile full production build
npm run build
```

---

## 🔑 Role Accounts & Credentials

In development/demo mode, the application features **1-Click Role Switching**:
1. Open the application at [http://localhost:3000](http://localhost:3000).
2. Click the user badge in the **top-right context bar** (next to the Academic Year dropdown).
3. Select any role from the dropdown menu to instantly assume that persona with full session syncing.

### Seeded User Directory

| Role | Name | Email | Phone | User ID / Access Key | Primary Permissions & Portals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | K. Rajasekaran | `admin@crescent.internal` | `9845011111` | `usr_superadmin` | Complete system control, lock bypass with audit override, tenant configs |
| **`PRINCIPAL`** | Dr. K. Senthil Kumar | `principal@crescent.internal` | `9845022222` | `usr_principal` | Academic approvals, student admissions, TC issuance, payroll runs, timetable substitutions |
| **`ACCOUNTANT`** | R. Meenakshi Sundaram | `accounts@crescent.internal` | `9845033333` | `usr_accountant` | Supermarket Fee POS (`/finance/pos`), cheque clearance, bounced receipt rollback, fee ledger |
| **`TEACHER`** | V. Anandakrishnan | `teacher1@crescent.internal` | `9845044444` | `usr_teacher_1` | Attendance roster (`/attendance`), mark entry spreadsheet (`/exams/mark-entry`), timetable |
| **`TEACHER`** | Dr. Subbulakshmi Ramanathan | `teacher2@crescent.internal` | `9845055555` | `usr_teacher_2` | Section 8A class teacher, mark entry spreadsheet, notices |
| **`PARENT`** | S. Karthikeyan Sundaram | `karthik.sundaram@gmail.com` | `9876543210` | `usr_parent_mehta` | Unified Parent Mobile Portal (`/parent`), 1-click UPI fee pay, sibling dues, report card |

---

## 👨‍👩‍👧 Sample Parent Family with Linked Siblings

To test the **Unified Parent Portal (`/parent`)** and **Fee POS Sibling Dues Banner**:
* **Parent Phone:** `9876543210`
* **Family Name:** S. Karthikeyan & Deepa Sundaram
* **Enrolled Children:**
  1. **Kavin Kumar** — Grade 8A (`ADM-2026-0801`)
  2. **Harini Sundaram** — Grade 4B (`ADM-2026-0401`)
* Direct URL: `http://localhost:3000/parent?familyPhone=9876543210`

