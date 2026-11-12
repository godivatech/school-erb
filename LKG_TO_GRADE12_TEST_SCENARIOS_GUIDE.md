# Crescent School ERP — LKG to Grade 12 Curriculum & Practicals Testing Manual

> **Document Location:** Project Root Directory (`/LKG_TO_GRADE12_TEST_SCENARIOS_GUIDE.md`)  
> **Target Audience:** School Administrators, Academic Coordinators, Teachers, and Testers  
> **Application URL:** [http://localhost:3000](http://localhost:3000)  
> **Active Academic Year:** `2026-2027 (ACTIVE)`  
> **School Tenant:** `CMS-CHENNAI` / `sch_oxford_001`  

---

## ⚡ Method 1: Instant 1-Click Automated Terminal Verification

You can run the comprehensive curriculum test suite directly from your terminal:

```bash
npm run test:curriculum
```

This automated test suite executes **17 discrete assertions** validating:
1. **LKG Kindergarten Structure:** Negative numeric ordering (`-2`), `GENERAL` stream, co-scholastic subjects, and 0.00 practical marks.
2. **Grade 10 Board Pattern:** Theory (70) + Practical (30) split, pass mark boundaries (35/100), and combined mark calculations.
3. **Grade 12 Stream Isolation:** Strict separation of `SCIENCE` and `COMMERCE` streams, zero subject contamination between Section 12-A (Bio-Maths) and Section 12-C (Commerce), and subject-specific practical limits (Physics 30 lab marks vs. Accountancy 10 project marks).
4. **Student-Level Electives:** Individual elective mapping (`student_electives`) ensuring students in the same class have distinct language/optional subjects.

---

## 🖥️ Method 2: Step-by-Step Interactive Browser Testing

Follow these step-by-step instructions in your web browser at **[http://localhost:3000](http://localhost:3000)**.

---

### SCENARIO 1: Testing LKG (Kindergarten Setup, Co-Scholastic & Zero Practicals)

#### Objective
Verify that Kindergarten has its own isolated syllabus (rhymes, phonics, play activities), that subjects are marked as co-scholastic (do not affect CGPA), and that there are **no lab practicals**.

#### Steps to Test in Browser:
1. Open **Academics** page: [http://localhost:3000/academics](http://localhost:3000/academics).
2. Click on the **Classes & Sections** tab:
   - Notice **LKG (Lower Kindergarten)** listed with Order `-2` and Stream `GENERAL`.
   - Notice Section **"Rose"** with capacity 25.
3. Click on the **Master Subjects** tab:
   - Search or locate **`LKG-RHYME`** (*Rhymes, Phonics & Storytelling*).
   - Notice its Badge: `CO_SCHOLASTIC` and `Exclude from CGPA`.
4. Click on the **Class-Subject Mapping** tab:
   - Select Class: **LKG (Lower Kindergarten)** $\to$ Section: **Rose**.
   - Notice that **only** Kindergarten subjects are mapped to this section. (No Maths, Science, or 10th/12th subjects appear).
5. Open **Exam Mark Entry**: [http://localhost:3000/exams/mark-entry](http://localhost:3000/exams/mark-entry).
   - Select the Schedule: **LKG — Rhymes, Phonics & Storytelling**.
   - **Expected Result:**
     - The header shows `Max Theory / Practical: 50 / 0`.
     - The **Practical column is disabled or set to 0** because kindergarten does not have laboratory practicals.

---

### SCENARIO 2: Testing Grade 10 Board Exam Pattern (Theory + Lab Practical Split)

#### Objective
Verify that Grade 10 Science has a **70 Theory + 30 Practical split**, enforces maximum boundary checks, and computes the combined pass score.

#### Steps to Test in Browser:
1. Open **Spreadsheet Mark Entry**: [http://localhost:3000/exams/mark-entry](http://localhost:3000/exams/mark-entry).
2. In the top Schedule selector dropdown, choose:
   - **`Grade 10 — General Science`**
3. **Verify the Layout:**
   - Look at the top stats bar: it displays:
     ```
     Max Theory / Practical: 70 / 30 (Pass: 35)
     ```
   - Look at the spreadsheet columns:
     - **Theory (70)**
     - **Practical (30)**
     - **Grace (+)**
     - **Computed Score**
     - **Percentage**
     - **Status** (`PASS` / `FAIL`)
4. **Test Boundary Validation:**
   - Click on the **Theory (70)** cell for any student (e.g., *Kabir Kapoor*).
   - Try typing `75`. Notice the system rejects or flags out-of-bound marks ($> 70$).
   - Click on the **Practical (30)** cell.
   - Try typing `35`. Notice the system rejects marks $> 30$.
5. **Test Pass/Fail Calculation:**
   - Enter `Theory: 25` and `Practical: 8`.
   - Combined total is `33/100` ($< 35$). Notice the **Status** badge turns red: `FAIL`.
   - Add `Grace (+): 3`.
   - Combined total is now `36/100` ($\ge 35$). Notice the **Status** badge turns green: `PASS`.
6. Click **Save Marks** (top right) to save the changes.
7. Click **"Download All Report Cards (PDF)"**:
   - Open the generated report card.
   - **Expected Result:** General Science displays **Theory: 70**, **Practical: 30**, **Total: 100**, and the final Subject Grade.

---

### SCENARIO 3: Testing Grade 12 Streams & Groups Isolation (Science vs. Commerce)

#### Objective
Verify that Grade 12 has distinct stream groups (**Advanced Science** vs. **Commerce & Accountancy**), that their syllabi are completely isolated (zero cross-contamination), and that each subject has its own practical allocation.

#### Steps to Test in Browser:

#### 1. Verify Stream Separation in Academics
1. Open **Academics** page: [http://localhost:3000/academics](http://localhost:3000/academics).
2. On the **Classes & Sections** tab, review the two Grade 12 classes:
   - **Class 1:** `Grade 12 - Advanced Science` $\to$ Stream badge shows **`SCIENCE`**.
     - Section: `A (Bio-Maths)`.
   - **Class 2:** `Grade 12 - Commerce & Accountancy` $\to$ Stream badge shows **`COMMERCE`**.
     - Section: `C (Commerce)`.

#### 2. Verify Zero Cross-Contamination in Subject Mappings
1. On the same page, click the **Class-Subject Mapping** tab.
2. Filter by Section: **`Grade 12 - Advanced Science - Section A`**:
   - Mapped subjects: *Physics (Theory + Laboratory)*, *Chemistry*, *Biology*, *Mathematics*.
   - **Notice:** There are **NO** Commerce or Accountancy subjects here.
3. Now filter by Section: **`Grade 12 - Commerce - Section C`**:
   - Mapped subjects: *Accountancy & Financial Auditing*, *Commerce*, *Economics*.
   - **Notice:** There are **NO** Physics, Chemistry, or Biology subjects here.

#### 3. Verify Dynamic Practical Marks by Subject
1. Open **Spreadsheet Mark Entry**: [http://localhost:3000/exams/mark-entry](http://localhost:3000/exams/mark-entry).
2. Switch Schedule to: **`Grade 12 - Advanced Science — Physics`**:
   - Top stats bar displays:
     ```
     Max Theory / Practical: 70 / 30
     ```
   - Faculty enters:
     - 70 for Board Theory
     - 30 for Lab Experiments, Record Note & Viva
3. Now switch Schedule to: **`Grade 12 - Commerce — Accountancy`**:
   - Top stats bar dynamically updates to:
     ```
     Max Theory / Practical: 90 / 10
     ```
   - Faculty enters:
     - 90 for Written Board Paper
     - 10 for Project File & Viva Voce
4. **Conclusion:** The mark entry UI dynamically adapts its columns, limits, and validations based on whether the subject is a Lab Science or a Commerce/Humanities paper.

---

### SCENARIO 4: Testing Student-Level Electives (student_electives)

#### Objective
Verify that two students inside the **same section** can choose different elective subjects (e.g., Student A chooses *French*, Student B chooses *Tamil*).

#### Steps to Test:
1. In `src/db/schema/academics.ts`, the table `student_electives` holds student-specific subjects:
   - `schoolId`
   - `academicYearId`
   - `studentId`
   - `subjectId`
   - Unique constraint on: `(academicYearId, studentId, subjectId)`
2. When generating report cards or entering marks for elective schedules, only students enrolled in that elective appear in the list.
3. In the automated test (`npm run test:curriculum`), **Student A** was enrolled in *French (FRE-12)* while **Student B** was not enrolled. The test verified that Student B's record was completely untouched and excluded.

---

## 📋 Comprehensive Verification Summary Matrix

| Academic Level | Stream | Example Subjects | Theory / Practical Split | CGPA Inclusion | Cross-Contamination Guard |
|---|---|---|:---:|:---:|:---:|
| **LKG / UKG** | `GENERAL` | Rhymes, Phonics, Art, Play | **50 / 0** (No Practicals) | Excluded (`CO_SCHOLASTIC`) | ✅ Isolated to KG Sections |
| **Grades 1 – 9** | `GENERAL` | Tamil, English, Maths, Science, Social | **100 / 0** or **80 / 20** | Included (`CORE`) | ✅ Standard Class Mapping |
| **Grade 10** | `GENERAL` | Tamil, English, Maths, Science, Social | **70 / 30** (Board Pattern) | Included (`CORE`) | ✅ Board Pass Rule ($\ge 35$) |
| **Grade 12 (Science)** | `SCIENCE` | Physics, Chemistry, Biology, Maths | **70 / 30** (Lab Experiments) | Included (`CORE`) | ✅ No Commerce Subjects |
| **Grade 12 (Commerce)**| `COMMERCE`| Accountancy, Commerce, Economics, BM | **90 / 10** (Project / Viva) | Included (`CORE`) | ✅ No Science Subjects |
| **Electives** | *Any* | French, Computer Science, Hindi | *Configurable per Subject* | Included (`ELECTIVE`) | ✅ Scoped per Student ID |

---

## 🛠️ Relevant Source Code References

- **Database Schemas:**
  - Classes & Streams: [src/db/schema/academics.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/schema/academics.ts#L15-L29)
  - Subject Master & CGPA flag: [src/db/schema/academics.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/schema/academics.ts#L48-L63)
  - Per-Section Syllabus Mapping: [src/db/schema/academics.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/schema/academics.ts#L65-L81)
  - Student Electives: [src/db/schema/academics.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/schema/academics.ts#L83-L97)
  - Theory & Practical Marks Config: [src/db/schema/exams.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/schema/exams.ts#L49-L88)
- **UI & Spreadsheet Mark Entry:**
  - Dynamic Columns & Validation: [src/app/exams/mark-entry/mark-entry-client.tsx](file:///g:/Godivatech/Products/school%20erb/application/src/app/exams/mark-entry/mark-entry-client.tsx#L520-L535)
  - Report Card Batch PDF Generation: [src/actions/exams.ts](file:///g:/Godivatech/Products/school%20erb/application/src/actions/exams.ts)
- **Automated Verification Script:**
  - [src/db/verify-curriculum-scenarios.ts](file:///g:/Godivatech/Products/school%20erb/application/src/db/verify-curriculum-scenarios.ts)

