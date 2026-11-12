import { db } from "./index";
import * as schema from "./schema";
import { eq, and } from "drizzle-orm";

export async function seedDatabase() {
  console.log("=== Crescent School ERP: Seeding Realistic Production Dataset ===");

  // 1. School
  const schoolId = "sch_oxford_001";
  const [existingSchool] = await db
    .select()
    .from(schema.schools)
    .where(eq(schema.schools.id, schoolId))
    .limit(1);

  if (!existingSchool) {
    await db.insert(schema.schools).values({
      id: schoolId,
      name: "Crescent Matriculation Higher Secondary School, Chennai",
      code: "CMS-CHENNAI",
      address: "No. 42, Anna Salai, Guindy, Chennai, Tamil Nadu - 600032",
      phone: "+91 44 2235 6789",
      email: "admin@crescent.internal",
      settingsJson: {
        currencySymbol: "₹",
        dateFormat: "DD/MM/YYYY",
        timezone: "Asia/Kolkata",
        holdResultsForDefaulters: true,
        defaulterThresholdAmount: 5000,
        chequeBouncePenalty: 500,
        smsSenderId: "CMSTN",
      },
    });
    console.log("✓ School: Crescent Matriculation Higher Secondary School, Chennai created.");
  }

  // 2. Academic Years
  const academicYearsData = [
    {
      id: "ay_2025_2026",
      schoolId,
      name: "2025-2026",
      startDate: "2025-04-01",
      endDate: "2026-03-31",
      status: "LOCKED" as const,
    },
    {
      id: "ay_2026_2027",
      schoolId,
      name: "2026-2027",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      status: "ACTIVE" as const,
    },
  ];

  for (const ay of academicYearsData) {
    const [exist] = await db
      .select()
      .from(schema.academicYears)
      .where(eq(schema.academicYears.id, ay.id))
      .limit(1);
    if (!exist) {
      await db.insert(schema.academicYears).values(ay);
    }
  }
  console.log("✓ Academic Years: 2025-2026 (LOCKED) and 2026-2027 (ACTIVE) verified.");

  // 3. Staff Users (5 Staff: Super Admin, Principal, Accountant, 2 Teachers)
  const staffUsers = [
    {
      id: "usr_superadmin",
      schoolId,
      name: "Super Administrator (K. Rajasekaran)",
      email: "admin@crescent.internal",
      phone: "9845011111",
      role: "SUPER_ADMIN" as const,
      isActive: true,
    },
    {
      id: "usr_principal",
      schoolId,
      name: "Dr. K. Senthil Kumar, M.Sc., M.Ed., Ph.D.",
      email: "principal@crescent.internal",
      phone: "9845022222",
      role: "PRINCIPAL" as const,
      isActive: true,
    },
    {
      id: "usr_accountant",
      schoolId,
      name: "R. Meenakshi Sundaram",
      email: "accounts@crescent.internal",
      phone: "9845033333",
      role: "ACCOUNTANT" as const,
      isActive: true,
    },
    {
      id: "usr_teacher_1",
      schoolId,
      name: "V. Anandakrishnan",
      email: "teacher1@crescent.internal",
      phone: "9845044444",
      role: "TEACHER" as const,
      isActive: true,
    },
    {
      id: "usr_teacher_2",
      schoolId,
      name: "Dr. Subbulakshmi Ramanathan",
      email: "teacher2@crescent.internal",
      phone: "9845055555",
      role: "TEACHER" as const,
      isActive: true,
    },
  ];

  for (const u of staffUsers) {
    const [exist] = await db.select().from(schema.users).where(eq(schema.users.id, u.id)).limit(1);
    if (!exist) {
      await db.insert(schema.users).values(u);
    }
  }
  console.log("✓ 5 Staff Users created.");

  // Staff Profiles
  const staffProfilesData = [
    {
      id: "stf_prof_001",
      userId: "usr_superadmin",
      schoolId,
      employeeCode: "EMP-001",
      designation: "Chief System Administrator",
      basicSalary: "85000.00",
      hra: "20000.00",
      allowances: "5000.00",
      pfDeduction: "1800.00",
    },
    {
      id: "stf_prof_002",
      userId: "usr_principal",
      schoolId,
      employeeCode: "EMP-002",
      designation: "Head of School / Principal",
      basicSalary: "95000.00",
      hra: "25000.00",
      allowances: "8000.00",
      pfDeduction: "1800.00",
    },
    {
      id: "stf_prof_003",
      userId: "usr_accountant",
      schoolId,
      employeeCode: "EMP-003",
      designation: "Senior Bursar / Accountant",
      basicSalary: "55000.00",
      hra: "15000.00",
      allowances: "3000.00",
      pfDeduction: "1800.00",
    },
    {
      id: "stf_prof_004",
      userId: "usr_teacher_1",
      schoolId,
      employeeCode: "EMP-004",
      designation: "Senior Mathematics Teacher",
      basicSalary: "48000.00",
      hra: "12000.00",
      allowances: "2500.00",
      pfDeduction: "1800.00",
    },
    {
      id: "stf_prof_005",
      userId: "usr_teacher_2",
      schoolId,
      employeeCode: "EMP-005",
      designation: "Senior Science & English Teacher",
      basicSalary: "46000.00",
      hra: "12000.00",
      allowances: "2500.00",
      pfDeduction: "1800.00",
    },
  ];

  for (const sp of staffProfilesData) {
    const [exist] = await db.select().from(schema.staffProfiles).where(eq(schema.staffProfiles.id, sp.id)).limit(1);
    if (!exist) {
      await db.insert(schema.staffProfiles).values(sp);
    }
  }

  // 4. Classes & Sections
  const classesData = [
    { id: "cls_g10", schoolId, name: "Grade 10", numericOrder: 10, stream: "GENERAL" as const },
    { id: "cls_g8", schoolId, name: "Grade 8", numericOrder: 8, stream: "GENERAL" as const },
    { id: "cls_g4", schoolId, name: "Grade 4", numericOrder: 4, stream: "GENERAL" as const },
  ];

  for (const c of classesData) {
    const [exist] = await db.select().from(schema.classes).where(eq(schema.classes.id, c.id)).limit(1);
    if (!exist) {
      await db.insert(schema.classes).values(c);
    }
  }

  const sectionsData = [
    { id: "sec_10a", schoolId, classId: "cls_g10", name: "A", capacity: 40, classTeacherId: "usr_teacher_1" },
    { id: "sec_8a", schoolId, classId: "cls_g8", name: "A", capacity: 40, classTeacherId: "usr_teacher_2" },
    { id: "sec_4b", schoolId, classId: "cls_g4", name: "B", capacity: 35, classTeacherId: "usr_teacher_1" },
  ];

  for (const s of sectionsData) {
    const [exist] = await db.select().from(schema.sections).where(eq(schema.sections.id, s.id)).limit(1);
    if (!exist) {
      await db.insert(schema.sections).values(s);
    }
  }
  console.log("✓ Classes & Sections (Grade 10A, 8A, 4B) verified.");

  // 5. Subjects & Class Subjects
  const subjectsData = [
    { id: "subj_math", schoolId, name: "Mathematics", code: "MATH-01", type: "CORE" as const, includeInCgpa: true },
    { id: "subj_sci", schoolId, name: "General Science", code: "SCI-01", type: "CORE" as const, includeInCgpa: true },
    { id: "subj_eng", schoolId, name: "English Language & Literature", code: "ENG-01", type: "CORE" as const, includeInCgpa: true },
    { id: "subj_sst", schoolId, name: "Social Studies", code: "SST-01", type: "CORE" as const, includeInCgpa: true },
    { id: "subj_comp", schoolId, name: "Computer Applications", code: "COMP-01", type: "ELECTIVE" as const, includeInCgpa: true },
  ];

  for (const sub of subjectsData) {
    const [exist] = await db.select().from(schema.subjects).where(eq(schema.subjects.id, sub.id)).limit(1);
    if (!exist) {
      await db.insert(schema.subjects).values(sub);
    }
  }

  // Link subjects to sections for 2026-2027
  const classSubjectsData = [
    { id: "cs_10a_math", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", subjectId: "subj_math", teacherId: "usr_teacher_1" },
    { id: "cs_10a_sci", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", subjectId: "subj_sci", teacherId: "usr_teacher_2" },
    { id: "cs_10a_eng", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", subjectId: "subj_eng", teacherId: "usr_teacher_2" },
    { id: "cs_8a_math", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", subjectId: "subj_math", teacherId: "usr_teacher_1" },
    { id: "cs_8a_sci", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", subjectId: "subj_sci", teacherId: "usr_teacher_2" },
    { id: "cs_4b_math", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_4b", subjectId: "subj_math", teacherId: "usr_teacher_1" },
    { id: "cs_4b_eng", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_4b", subjectId: "subj_eng", teacherId: "usr_teacher_2" },
  ];

  for (const cs of classSubjectsData) {
    const [exist] = await db.select().from(schema.classSubjects).where(eq(schema.classSubjects.id, cs.id)).limit(1);
    if (!exist) {
      await db.insert(schema.classSubjects).values(cs);
    }
  }

  // 6. Parent Families (Including 2 Siblings in 8A and 4B)
  const familiesData = [
    {
      id: "fam_mehta",
      schoolId,
      primaryParentName: "S. Karthikeyan & Deepa Sundaram",
      primaryPhone: "9876543210", // Primary sibling linking key
      secondaryParentName: "Deepa Sundaram",
      secondaryPhone: "9876543211",
      email: "karthik.sundaram@gmail.com",
      address: "12/4, 4th Main Road, Anna Nagar West, Chennai - 600040",
      occupation: "Chartered Accountant / Financial Consultant",
    },
    {
      id: "fam_kapoor",
      schoolId,
      primaryParentName: "Saravanan & Priya Rajan",
      primaryPhone: "9811223344",
      secondaryParentName: "Priya Rajan",
      secondaryPhone: "9811223345",
      email: "saravanan.rajan@gmail.com",
      address: "78, 1st Cross Street, T. Nagar, Chennai - 600017",
      occupation: "Software Architect (Tidel Park)",
    },
    {
      id: "fam_gupta",
      schoolId,
      primaryParentName: "Senthil Nathan & Bhuvana",
      primaryPhone: "9899887766",
      secondaryParentName: "Bhuvana Nathan",
      secondaryPhone: "9899887767",
      email: "senthil.nathan@gmail.com",
      address: "23, Velachery Main Road, Velachery, Chennai - 600042",
      occupation: "Civil Engineer",
    },
  ];

  for (const f of familiesData) {
    const [exist] = await db.select().from(schema.families).where(eq(schema.families.id, f.id)).limit(1);
    if (!exist) {
      await db.insert(schema.families).values(f);
    }
  }
  console.log("✓ 3 Parent Families created (Sundaram family with 2 siblings: 9876543210).");

  // Also create user accounts for parents to test Parent Portal
  const parentUsers = [
    {
      id: "usr_parent_mehta",
      schoolId,
      name: "S. Karthikeyan Sundaram",
      email: "karthik.sundaram@gmail.com",
      phone: "9876543210",
      role: "PARENT" as const,
      isActive: true,
    },
  ];
  for (const pu of parentUsers) {
    const [exist] = await db.select().from(schema.users).where(eq(schema.users.id, pu.id)).limit(1);
    if (!exist) {
      await db.insert(schema.users).values(pu);
    }
  }

  // 7. 30 Students (10 in Grade 10A, 10 in Grade 8A, 10 in Grade 4B)
  const studentsToSeed = [
    // Sibling 1 (Grade 8A)
    {
      id: "stu_mehta_aarav",
      familyId: "fam_mehta",
      admissionNo: "ADM-2026-0801",
      firstName: "Kavin",
      lastName: "Kumar",
      dob: "2012-05-14",
      gender: "MALE" as const,
      bloodGroup: "O+",
      classId: "cls_g8",
      sectionId: "sec_8a",
      rollNo: 1,
    },
    // Sibling 2 (Grade 4B)
    {
      id: "stu_mehta_ananya",
      familyId: "fam_mehta",
      admissionNo: "ADM-2026-0401",
      firstName: "Harini",
      lastName: "Sundaram",
      dob: "2016-09-22",
      gender: "FEMALE" as const,
      bloodGroup: "O+",
      classId: "cls_g4",
      sectionId: "sec_4b",
      rollNo: 1,
    },
    // Student in Grade 10A
    {
      id: "stu_kapoor_kabir",
      familyId: "fam_kapoor",
      admissionNo: "ADM-2026-1001",
      firstName: "Anirudh",
      lastName: "Saravanan",
      dob: "2010-02-18",
      gender: "MALE" as const,
      bloodGroup: "A+",
      classId: "cls_g10",
      sectionId: "sec_10a",
      rollNo: 1,
    },
    // Student in Grade 8A
    {
      id: "stu_gupta_rohan",
      familyId: "fam_gupta",
      admissionNo: "ADM-2026-0802",
      firstName: "Dharanidharan",
      lastName: "Nathan",
      dob: "2012-11-03",
      gender: "MALE" as const,
      bloodGroup: "B+",
      classId: "cls_g8",
      sectionId: "sec_8a",
      rollNo: 2,
    },
  ];

  // Generate 26 additional students with authentic Tamil names & surnames
  const firstNamesM = [
    "Vetrivel", "Ashwin", "Pranav", "Madhavan", "Siddharth", "Mukilan", "Dharun",
    "Sanjay", "Aakash", "Vignesh", "Naveen", "Iniyan", "Sabarish"
  ];
  const firstNamesF = [
    "Yazhini", "Keerthana", "Divya", "Sneha", "Nandhini", "Subhadra", "Varsha",
    "Janani", "Pavithra", "Swetha", "Kavya", "Rakshitha", "Deepika"
  ];
  const lastNames = [
    "Sundaram", "Subramanian", "Natarajan", "Balasubramanian", "Ramaswamy",
    "Krishnan", "Venkatesan", "Swaminathan", "Ganesan", "Rajendran", "Selvam",
    "Chandrasekar", "Murugesan"
  ];

  let count10 = 2;
  let count8 = 3;
  let count4 = 2;

  for (let i = 0; i < 26; i++) {
    const isMale = i % 2 === 0;
    const fn = isMale ? firstNamesM[i % firstNamesM.length] : firstNamesF[i % firstNamesF.length];
    const ln = lastNames[i % lastNames.length];
    const id = `stu_gen_${i + 1}`;

    let classId = "cls_g10";
    let sectionId = "sec_10a";
    let rollNo = count10++;
    let admNo = `ADM-2026-10${String(rollNo).padStart(2, "0")}`;
    let dob = "2010-06-15";

    if (i < 9) {
      // 10A students (total 10)
      classId = "cls_g10";
      sectionId = "sec_10a";
    } else if (i < 17) {
      // 8A students (total 10)
      classId = "cls_g8";
      sectionId = "sec_8a";
      rollNo = count8++;
      admNo = `ADM-2026-08${String(rollNo).padStart(2, "0")}`;
      dob = "2012-08-20";
    } else {
      // 4B students (total 10)
      classId = "cls_g4";
      sectionId = "sec_4b";
      rollNo = count4++;
      admNo = `ADM-2026-04${String(rollNo).padStart(2, "0")}`;
      dob = "2016-04-10";
    }

    studentsToSeed.push({
      id,
      familyId: i % 2 === 0 ? "fam_kapoor" : "fam_gupta",
      admissionNo: admNo,
      firstName: fn,
      lastName: ln,
      dob,
      gender: isMale ? ("MALE" as const) : ("FEMALE" as const),
      bloodGroup: "B+",
      classId,
      sectionId,
      rollNo,
    });
  }

  // Insert students & enrollments
  for (const s of studentsToSeed) {
    const [existStu] = await db.select().from(schema.students).where(eq(schema.students.id, s.id)).limit(1);
    if (!existStu) {
      await db.insert(schema.students).values({
        id: s.id,
        schoolId,
        familyId: s.familyId,
        admissionNo: s.admissionNo,
        firstName: s.firstName,
        lastName: s.lastName,
        dob: s.dob,
        gender: s.gender,
        bloodGroup: s.bloodGroup,
        status: "ACTIVE",
        walletBalance: "0.00",
      });
    }

    const enrollmentId = `enr_${s.id}`;
    const [existEnr] = await db.select().from(schema.enrollments).where(eq(schema.enrollments.id, enrollmentId)).limit(1);
    if (!existEnr) {
      await db.insert(schema.enrollments).values({
        id: enrollmentId,
        schoolId,
        studentId: s.id,
        academicYearId: "ay_2026_2027",
        classId: s.classId,
        sectionId: s.sectionId,
        rollNo: s.rollNo,
        promotionStatus: "ACTIVE",
        enrollmentDate: "2026-04-01",
      });
    }
  }
  console.log(`✓ 30 Students enrolled across Grade 10A, 8A, and 4B.`);

  // 8. Fee Heads & Structures
  const feeHeadsData = [
    { id: "fh_late", schoolId, name: "Late Fine", frequency: "MONTHLY" as const, priorityOrder: 1, isMandatory: false },
    { id: "fh_trans", schoolId, name: "Transport Fee", frequency: "MONTHLY" as const, priorityOrder: 2, isMandatory: false },
    { id: "fh_tuit", schoolId, name: "Tuition Fee", frequency: "QUARTERLY" as const, priorityOrder: 3, isMandatory: true },
    { id: "fh_lab", schoolId, name: "Science & Computer Lab Fee", frequency: "ANNUAL" as const, priorityOrder: 4, isMandatory: true },
    { id: "fh_adm", schoolId, name: "Admission Fee", frequency: "ONE_TIME" as const, priorityOrder: 5, isMandatory: true },
  ];

  for (const fh of feeHeadsData) {
    const [exist] = await db.select().from(schema.feeHeads).where(eq(schema.feeHeads.id, fh.id)).limit(1);
    if (!exist) {
      await db.insert(schema.feeHeads).values(fh);
    }
  }

  const feeStructuresData = [
    // Grade 10
    { id: "fs_10_tuit", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g10", feeHeadId: "fh_tuit", amount: "12000.00", dueDateDay: 10 },
    { id: "fs_10_trans", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g10", feeHeadId: "fh_trans", amount: "2500.00", dueDateDay: 10 },
    // Grade 8
    { id: "fs_8_tuit", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g8", feeHeadId: "fh_tuit", amount: "10500.00", dueDateDay: 10 },
    { id: "fs_8_trans", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g8", feeHeadId: "fh_trans", amount: "2500.00", dueDateDay: 10 },
    // Grade 4
    { id: "fs_4_tuit", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g4", feeHeadId: "fh_tuit", amount: "9500.00", dueDateDay: 10 },
    { id: "fs_4_trans", schoolId, academicYearId: "ay_2026_2027", classId: "cls_g4", feeHeadId: "fh_trans", amount: "2200.00", dueDateDay: 10 },
  ];

  for (const fs of feeStructuresData) {
    const [exist] = await db.select().from(schema.feeStructures).where(eq(schema.feeStructures.id, fs.id)).limit(1);
    if (!exist) {
      await db.insert(schema.feeStructures).values(fs);
    }
  }

  // 9. Fee Invoices (Paid, Overdue, Partial)
  const invoicesData = [
    // Sibling 1: Aarav Mehta (Overdue Invoice)
    {
      id: "inv_aarav_q1",
      schoolId,
      academicYearId: "ay_2026_2027",
      studentId: "stu_mehta_aarav",
      enrollmentId: "enr_stu_mehta_aarav",
      invoiceNo: "INV-2026-0001",
      installmentLabel: "Q1 - Apr to Jun 2026",
      dueDate: "2026-05-10",
      baseAmount: "13000.00",
      discountAmount: "0.00",
      lateFineAmount: "250.00",
      netAmount: "13250.00",
      paidAmount: "0.00",
      status: "UNPAID" as const,
      items: [
        { id: "it_aarav_tuit", feeHeadId: "fh_tuit", amount: "10500.00", paidAmount: "0.00" },
        { id: "it_aarav_trans", feeHeadId: "fh_trans", amount: "2500.00", paidAmount: "0.00" },
        { id: "it_aarav_late", feeHeadId: "fh_late", amount: "250.00", paidAmount: "0.00" },
      ],
    },
    // Sibling 2: Ananya Mehta (Partial Invoice)
    {
      id: "inv_ananya_q1",
      schoolId,
      academicYearId: "ay_2026_2027",
      studentId: "stu_mehta_ananya",
      enrollmentId: "enr_stu_mehta_ananya",
      invoiceNo: "INV-2026-0002",
      installmentLabel: "Q1 - Apr to Jun 2026",
      dueDate: "2026-05-10",
      baseAmount: "9500.00",
      discountAmount: "0.00",
      lateFineAmount: "0.00",
      netAmount: "9500.00",
      paidAmount: "5000.00",
      status: "PARTIAL" as const,
      items: [
        { id: "it_ananya_tuit", feeHeadId: "fh_tuit", amount: "9500.00", paidAmount: "5000.00" },
      ],
    },
    // Kabir Kapoor (Fully Paid Invoice)
    {
      id: "inv_kabir_q1",
      schoolId,
      academicYearId: "ay_2026_2027",
      studentId: "stu_kapoor_kabir",
      enrollmentId: "enr_stu_kapoor_kabir",
      invoiceNo: "INV-2026-0003",
      installmentLabel: "Q1 - Apr to Jun 2026",
      dueDate: "2026-05-10",
      baseAmount: "12000.00",
      discountAmount: "0.00",
      lateFineAmount: "0.00",
      netAmount: "12000.00",
      paidAmount: "12000.00",
      status: "PAID" as const,
      items: [
        { id: "it_kabir_tuit", feeHeadId: "fh_tuit", amount: "12000.00", paidAmount: "12000.00" },
      ],
    },
  ];

  for (const inv of invoicesData) {
    const [exist] = await db.select().from(schema.feeInvoices).where(eq(schema.feeInvoices.id, inv.id)).limit(1);
    if (!exist) {
      await db.insert(schema.feeInvoices).values({
        id: inv.id,
        schoolId: inv.schoolId,
        academicYearId: inv.academicYearId,
        studentId: inv.studentId,
        enrollmentId: inv.enrollmentId,
        invoiceNo: inv.invoiceNo,
        installmentLabel: inv.installmentLabel,
        dueDate: inv.dueDate,
        baseAmount: inv.baseAmount,
        discountAmount: inv.discountAmount,
        lateFineAmount: inv.lateFineAmount,
        netAmount: inv.netAmount,
        paidAmount: inv.paidAmount,
        status: inv.status,
      });

      for (const it of inv.items) {
        await db.insert(schema.feeInvoiceItems).values({
          id: it.id,
          invoiceId: inv.id,
          feeHeadId: it.feeHeadId,
          amount: it.amount,
          paidAmount: it.paidAmount,
        });
      }
    }
  }

  // Receipts
  const receiptsData = [
    {
      id: "rec_kabir_001",
      schoolId,
      academicYearId: "ay_2026_2027",
      receiptNo: "REC-2026-0001",
      studentId: "stu_kapoor_kabir",
      amountReceived: "12000.00",
      paymentMode: "UPI" as const,
      chequeOrTxnRef: "UPI-4091823901",
      clearanceStatus: "CLEARED" as const,
      collectedById: "usr_accountant",
      idempotencyKey: "idemp_kabir_rec_001",
      allocationsJson: [
        { invoiceId: "inv_kabir_q1", invoiceItemId: "it_kabir_tuit", feeHeadName: "Tuition Fee", allocatedAmount: 12000 },
      ],
    },
    {
      id: "rec_ananya_001",
      schoolId,
      academicYearId: "ay_2026_2027",
      receiptNo: "REC-2026-0002",
      studentId: "stu_mehta_ananya",
      amountReceived: "5000.00",
      paymentMode: "CASH" as const,
      clearanceStatus: "CLEARED" as const,
      collectedById: "usr_accountant",
      idempotencyKey: "idemp_ananya_rec_001",
      allocationsJson: [
        { invoiceId: "inv_ananya_q1", invoiceItemId: "it_ananya_tuit", feeHeadName: "Tuition Fee", allocatedAmount: 5000 },
      ],
    },
  ];

  for (const r of receiptsData) {
    const [exist] = await db.select().from(schema.feeReceipts).where(eq(schema.feeReceipts.id, r.id)).limit(1);
    if (!exist) {
      await db.insert(schema.feeReceipts).values(r);
    }
  }
  console.log("✓ Fee Invoices (Overdue, Partial, Paid) and Receipts generated.");

  // 10. Exam Terms & Schedules
  const [existTerm] = await db.select().from(schema.examTerms).where(eq(schema.examTerms.id, "trm_term_1")).limit(1);
  if (!existTerm) {
    await db.insert(schema.examTerms).values({
      id: "trm_term_1",
      schoolId,
      academicYearId: "ay_2026_2027",
      name: "Term 1 Midterms",
      weightagePercent: "50.00",
      orderIndex: 1,
    });
  }

  const [existExam] = await db.select().from(schema.exams).where(eq(schema.exams.id, "ex_midterm_2026")).limit(1);
  if (!existExam) {
    await db.insert(schema.exams).values({
      id: "ex_midterm_2026",
      schoolId,
      termId: "trm_term_1",
      name: "Midterm Examinations",
      aggregationRule: "SUM",
      weightage: "100.00",
    });
  }

  const examSchedulesData = [
    {
      id: "esch_10a_math",
      examId: "ex_midterm_2026",
      classId: "cls_g10",
      subjectId: "subj_math",
      examDate: "2026-09-15",
      maxTheoryMarks: "80.00",
      maxPracticalMarks: "20.00",
      passMarks: "35.00",
    },
    {
      id: "esch_10a_sci",
      examId: "ex_midterm_2026",
      classId: "cls_g10",
      subjectId: "subj_sci",
      examDate: "2026-09-18",
      maxTheoryMarks: "70.00",
      maxPracticalMarks: "30.00",
      passMarks: "35.00",
    },
    {
      id: "esch_8a_math",
      examId: "ex_midterm_2026",
      classId: "cls_g8",
      subjectId: "subj_math",
      examDate: "2026-09-15",
      maxTheoryMarks: "80.00",
      maxPracticalMarks: "20.00",
      passMarks: "35.00",
    },
  ];

  for (const es of examSchedulesData) {
    const [exist] = await db.select().from(schema.examSchedules).where(eq(schema.examSchedules.id, es.id)).limit(1);
    if (!exist) {
      await db.insert(schema.examSchedules).values(es);
    }
  }

  // Exam Marks for Kabir Kapoor (Grade 10A)
  const examMarksData = [
    {
      id: "mrk_kabir_math",
      examScheduleId: "esch_10a_math",
      enrollmentId: "enr_stu_kapoor_kabir",
      theoryMarks: "72.00",
      practicalMarks: "19.00",
      graceMarks: "0.00",
      attendanceStatus: "PRESENT" as const,
      enteredById: "usr_teacher_1",
      remarks: "Excellent grasp of algebra and calculus concepts.",
    },
    {
      id: "mrk_kabir_sci",
      examScheduleId: "esch_10a_sci",
      enrollmentId: "enr_stu_kapoor_kabir",
      theoryMarks: "64.00",
      practicalMarks: "28.00",
      graceMarks: "0.00",
      attendanceStatus: "PRESENT" as const,
      enteredById: "usr_teacher_2",
      remarks: "Strong experimental and theoretical understanding.",
    },
    {
      id: "mrk_aarav_math",
      examScheduleId: "esch_8a_math",
      enrollmentId: "enr_stu_mehta_aarav",
      theoryMarks: "68.00",
      practicalMarks: "18.00",
      graceMarks: "0.00",
      attendanceStatus: "PRESENT" as const,
      enteredById: "usr_teacher_1",
      remarks: "Good work; needs practice in geometry proofs.",
    },
  ];

  for (const m of examMarksData) {
    const [exist] = await db.select().from(schema.examMarks).where(eq(schema.examMarks.id, m.id)).limit(1);
    if (!exist) {
      await db.insert(schema.examMarks).values(m);
    }
  }
  console.log("✓ Exam schedules & sample marks seeded.");

  // 11. Timetable Slots
  const timetableSlotsData = [
    // Mon - Grade 10A
    { id: "tt_10a_mon_1", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", dayOfWeek: 1, periodNo: 1, subjectId: "subj_math", teacherId: "usr_teacher_1", roomNo: "Room 101" },
    { id: "tt_10a_mon_2", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", dayOfWeek: 1, periodNo: 2, subjectId: "subj_sci", teacherId: "usr_teacher_2", roomNo: "Lab 2" },
    { id: "tt_10a_mon_3", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", dayOfWeek: 1, periodNo: 3, subjectId: "subj_eng", teacherId: "usr_teacher_2", roomNo: "Room 101" },
    // Mon - Grade 8A
    { id: "tt_8a_mon_1", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", dayOfWeek: 1, periodNo: 1, subjectId: "subj_sci", teacherId: "usr_teacher_2", roomNo: "Room 204" },
    { id: "tt_8a_mon_2", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", dayOfWeek: 1, periodNo: 2, subjectId: "subj_math", teacherId: "usr_teacher_1", roomNo: "Room 204" },
    { id: "tt_8a_mon_3", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", dayOfWeek: 1, periodNo: 3, subjectId: "subj_sst", teacherId: "usr_teacher_1", roomNo: "Room 204" },
  ];

  for (const slot of timetableSlotsData) {
    const [exist] = await db.select().from(schema.timetableSlots).where(eq(schema.timetableSlots.id, slot.id)).limit(1);
    if (!exist) {
      await db.insert(schema.timetableSlots).values(slot);
    }
  }
  console.log("✓ Timetable slots populated without teacher clashes.");

  // 12. Transport Fleet (Chennai Routes)
  const [existRoute] = await db.select().from(schema.transportRoutes).where(eq(schema.transportRoutes.id, "rt_102")).limit(1);
  if (!existRoute) {
    await db.insert(schema.transportRoutes).values({
      id: "rt_102",
      schoolId,
      routeName: "Route 01 - Anna Nagar to Central Campus Express",
      vehicleNo: "TN-09-CB-4821",
      driverName: "P. Manickam",
      driverPhone: "9840122334",
      capacity: 32,
    });
  }

  const transportStopsData = [
    { id: "stp_102_1", routeId: "rt_102", stopName: "Anna Nagar Roundtana", pickupTime: "07:15 AM", dropTime: "02:45 PM", monthlyFee: "2200.00", orderIndex: 1 },
    { id: "stp_102_2", routeId: "rt_102", stopName: "Shanti Colony, Anna Nagar", pickupTime: "07:30 AM", dropTime: "03:00 PM", monthlyFee: "2500.00", orderIndex: 2 },
    { id: "stp_102_3", routeId: "rt_102", stopName: "Kilpauk Medical College Station", pickupTime: "07:45 AM", dropTime: "03:15 PM", monthlyFee: "2800.00", orderIndex: 3 },
  ];

  for (const stop of transportStopsData) {
    const [exist] = await db.select().from(schema.transportStops).where(eq(schema.transportStops.id, stop.id)).limit(1);
    if (!exist) {
      await db.insert(schema.transportStops).values(stop);
    }
  }

  const [existStuTrans] = await db
    .select()
    .from(schema.studentTransport)
    .where(
      and(
        eq(schema.studentTransport.academicYearId, "ay_2026_2027"),
        eq(schema.studentTransport.studentId, "stu_mehta_aarav")
      )
    )
    .limit(1);

  if (!existStuTrans) {
    await db.insert(schema.studentTransport).values({
      id: "strans_aarav",
      academicYearId: "ay_2026_2027",
      studentId: "stu_mehta_aarav",
      pickupStopId: "stp_102_1",
      dropStopId: "stp_102_2",
      startDate: "2026-04-01",
    });
  }
  console.log("✓ Transport routes, stops, and student allocation configured.");

  console.log("\n=== DATABASE SEEDING COMPLETED SUCCESSFULLY! ===");
}

// Allow direct CLI execution: `npx tsx src/db/seed.ts`
if (require.main === module || process.argv[1]?.includes("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed with error:", err);
      process.exit(1);
    });
}
