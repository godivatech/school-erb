import { db } from "./index";
import {
  schools,
  users,
  staffProfiles,
  families,
  students,
  subjects,
  classSubjects,
  transportRoutes,
  transportStops,
  holidays,
  notices,
} from "./schema";
import { eq, and } from "drizzle-orm";

export async function updateDatabaseToTamilNadu() {
  console.log("=== Migrating Crescent School ERP Dataset to Tamil Nadu Context ===");

  const schoolId = "sch_oxford_001";

  // 1. Update School Details
  await db
    .update(schools)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));
  console.log("✓ School updated: Crescent Matriculation Higher Secondary School, Chennai (CMS-CHENNAI)");

  // 2. Update Staff Users
  const staffUpdates = [
    { id: "usr_superadmin", name: "Super Administrator (K. Rajasekaran)" },
    { id: "usr_principal", name: "Dr. K. Senthil Kumar, M.Sc., M.Ed., Ph.D." },
    { id: "usr_accountant", name: "R. Meenakshi Sundaram" },
    { id: "usr_teacher_1", name: "V. Anandakrishnan" },
    { id: "usr_teacher_2", name: "Dr. Subbulakshmi Ramanathan" },
    { id: "usr_parent_mehta", name: "S. Karthikeyan Sundaram" },
  ];

  for (const u of staffUpdates) {
    await db
      .update(users)
      .set({ name: u.name, updatedAt: new Date() })
      .where(eq(users.id, u.id));
  }
  console.log("✓ Staff and parent users updated with Tamil names.");

  // 3. Update Staff Profiles designations
  const profileUpdates = [
    { id: "stf_prof_001", designation: "Chief System Administrator" },
    { id: "stf_prof_002", designation: "Head of School / Principal" },
    { id: "stf_prof_003", designation: "Senior Bursar / Cashier" },
    { id: "stf_prof_004", designation: "Senior Mathematics Faculty" },
    { id: "stf_prof_005", designation: "Senior Science & English Faculty" },
  ];

  for (const sp of profileUpdates) {
    await db
      .update(staffProfiles)
      .set({ designation: sp.designation })
      .where(eq(staffProfiles.id, sp.id));
  }

  // 4. Update Parent Families
  await db
    .update(families)
    .set({
      primaryParentName: "S. Karthikeyan & Deepa Sundaram",
      secondaryParentName: "Deepa Sundaram",
      email: "karthik.sundaram@gmail.com",
      address: "12/4, 4th Main Road, Anna Nagar West, Chennai - 600040",
      occupation: "Chartered Accountant / Financial Consultant",
      updatedAt: new Date(),
    })
    .where(eq(families.id, "fam_mehta"));

  await db
    .update(families)
    .set({
      primaryParentName: "Saravanan & Priya Rajan",
      secondaryParentName: "Priya Rajan",
      email: "saravanan.rajan@gmail.com",
      address: "78, 1st Cross Street, T. Nagar, Chennai - 600017",
      occupation: "Software Architect (Tidel Park)",
      updatedAt: new Date(),
    })
    .where(eq(families.id, "fam_kapoor"));

  await db
    .update(families)
    .set({
      primaryParentName: "Senthil Nathan & Bhuvana",
      secondaryParentName: "Bhuvana Nathan",
      email: "senthil.nathan@gmail.com",
      address: "23, Velachery Main Road, Velachery, Chennai - 600042",
      occupation: "Civil Engineer",
      updatedAt: new Date(),
    })
    .where(eq(families.id, "fam_gupta"));
  console.log("✓ Parent families updated with Tamil names and Chennai addresses.");

  // 5. Update Key Students
  await db
    .update(students)
    .set({ firstName: "Kavin", lastName: "Kumar", updatedAt: new Date() })
    .where(eq(students.id, "stu_mehta_aarav"));

  await db
    .update(students)
    .set({ firstName: "Harini", lastName: "Sundaram", updatedAt: new Date() })
    .where(eq(students.id, "stu_mehta_ananya"));

  await db
    .update(students)
    .set({ firstName: "Anirudh", lastName: "Saravanan", updatedAt: new Date() })
    .where(eq(students.id, "stu_kapoor_kabir"));

  await db
    .update(students)
    .set({ firstName: "Dharanidharan", lastName: "Nathan", updatedAt: new Date() })
    .where(eq(students.id, "stu_gupta_rohan"));

  // 6. Update Generated 26 Students
  const tamilMaleNames = [
    "Vetrivel",
    "Ashwin",
    "Pranav",
    "Madhavan",
    "Siddharth",
    "Mukilan",
    "Dharun",
    "Sanjay",
    "Aakash",
    "Vignesh",
    "Naveen",
    "Iniyan",
    "Sabarish",
  ];
  const tamilFemaleNames = [
    "Yazhini",
    "Keerthana",
    "Divya",
    "Sneha",
    "Nandhini",
    "Subhadra",
    "Varsha",
    "Janani",
    "Pavithra",
    "Swetha",
    "Kavya",
    "Rakshitha",
    "Deepika",
  ];
  const tamilSurnames = [
    "Sundaram",
    "Subramanian",
    "Natarajan",
    "Balasubramanian",
    "Ramaswamy",
    "Krishnan",
    "Venkatesan",
    "Swaminathan",
    "Ganesan",
    "Rajendran",
    "Selvam",
    "Chandrasekar",
    "Murugesan",
  ];

  for (let i = 1; i <= 26; i++) {
    const isMale = i % 2 === 0;
    const fn = isMale
      ? tamilMaleNames[(i - 1) % tamilMaleNames.length]
      : tamilFemaleNames[(i - 1) % tamilFemaleNames.length];
    const ln = tamilSurnames[(i - 1) % tamilSurnames.length];

    await db
      .update(students)
      .set({ firstName: fn, lastName: ln, updatedAt: new Date() })
      .where(eq(students.id, `stu_gen_${i}`));
  }
  console.log("✓ 30 Students updated with authentic Tamil names & surnames.");

  // 7. Transport Routes & Stops (Chennai Routes)
  await db
    .update(transportRoutes)
    .set({
      routeName: "Route 01 - Anna Nagar to Central Campus Express",
      vehicleNo: "TN-09-CB-4821",
      driverName: "P. Manickam",
      driverPhone: "9840122334",
    })
    .where(eq(transportRoutes.id, "rt_102"));

  await db
    .update(transportStops)
    .set({ stopName: "Anna Nagar Roundtana" })
    .where(eq(transportStops.id, "stp_102_1"));

  await db
    .update(transportStops)
    .set({ stopName: "Shanti Colony, Anna Nagar" })
    .where(eq(transportStops.id, "stp_102_2"));

  await db
    .update(transportStops)
    .set({ stopName: "Kilpauk Medical College Station" })
    .where(eq(transportStops.id, "stp_102_3"));

  // Check and insert Route 02
  const [existRoute2] = await db
    .select()
    .from(transportRoutes)
    .where(eq(transportRoutes.id, "rt_103"))
    .limit(1);

  if (!existRoute2) {
    await db.insert(transportRoutes).values({
      id: "rt_103",
      schoolId,
      routeName: "Route 02 - Velachery & OMR Shuttle",
      vehicleNo: "TN-07-AL-6192",
      driverName: "M. Selvakumar",
      driverPhone: "9840233445",
      capacity: 35,
    });

    const stopsRoute2 = [
      { id: "stp_103_1", routeId: "rt_103", stopName: "Velachery Vijayanagar Bus Terminus", pickupTime: "07:15 AM", dropTime: "02:45 PM", monthlyFee: "2400.00", orderIndex: 1 },
      { id: "stp_103_2", routeId: "rt_103", stopName: "SRP Tools, OMR IT Corridor", pickupTime: "07:30 AM", dropTime: "03:00 PM", monthlyFee: "2600.00", orderIndex: 2 },
      { id: "stp_103_3", routeId: "rt_103", stopName: "Adyar Signal (Near Shastri Nagar)", pickupTime: "07:45 AM", dropTime: "03:15 PM", monthlyFee: "2800.00", orderIndex: 3 },
    ];

    for (const s of stopsRoute2) {
      await db.insert(transportStops).values(s);
    }
  }
  console.log("✓ Transport routes updated with Tamil Nadu registration (TN-09, TN-07) & Chennai waypoints.");

  // 8. Add Tamil (Part I Language) Subject if not exists
  const [existTamil] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, "subj_tamil"))
    .limit(1);

  if (!existTamil) {
    await db.insert(subjects).values({
      id: "subj_tamil",
      schoolId,
      name: "Tamil (Part I Language / தமிழ் மொழி)",
      code: "TAM-01",
      type: "CORE",
      includeInCgpa: true,
    });

    // Link to classes
    const classSubs = [
      { id: "cs_10a_tam", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_10a", subjectId: "subj_tamil", teacherId: "usr_teacher_2" },
      { id: "cs_8a_tam", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_8a", subjectId: "subj_tamil", teacherId: "usr_teacher_2" },
      { id: "cs_4b_tam", schoolId, academicYearId: "ay_2026_2027", sectionId: "sec_4b", subjectId: "subj_tamil", teacherId: "usr_teacher_2" },
    ];

    for (const cs of classSubs) {
      const [exist] = await db.select().from(classSubjects).where(eq(classSubjects.id, cs.id)).limit(1);
      if (!exist) {
        await db.insert(classSubjects).values(cs);
      }
    }
  }
  console.log("✓ Tamil (Part I Language - TAM-01) added as Core subject with class assignments.");

  // 9. Add Tamil Nadu Holidays
  const holidaysData = [
    {
      id: "hol_pongal_2027",
      schoolId,
      academicYearId: "ay_2026_2027",
      date: "2027-01-15",
      title: "Pongal & Thiruvalluvar Day (பொங்கல் பண்டிகை)",
      isEmergencyHoliday: false,
    },
    {
      id: "hol_puthandu_2026",
      schoolId,
      academicYearId: "ay_2026_2027",
      date: "2026-04-14",
      title: "Tamil New Year / Puthandu (தமிழ்ப் புத்தாண்டு)",
      isEmergencyHoliday: false,
    },
    {
      id: "hol_rain_2026",
      schoolId,
      academicYearId: "ay_2026_2027",
      date: "2026-11-20",
      title: "Heavy Rain & Cyclone Alert (Holiday declared by Chennai District Collector)",
      isEmergencyHoliday: true,
    },
  ];

  for (const h of holidaysData) {
    const [exist] = await db.select().from(holidays).where(eq(holidays.id, h.id)).limit(1);
    if (!exist) {
      await db.insert(holidays).values(h);
    }
  }
  console.log("✓ Tamil Nadu holidays added (Pongal, Puthandu, District Collector Rain Holiday).");

  // 10. Add Tamil Nadu Notices
  const noticesData = [
    {
      id: "not_rain_alert",
      schoolId,
      academicYearId: "ay_2026_2027",
      authorId: "usr_principal",
      title: "🔴 School Holiday Notice: Chennai District Collector Rain Advisory",
      content: "As per the official notification issued by the Chennai District Collector due to heavy cyclone rainfall and IMD Red Alert, school will remain closed today. Online revision classes will be conducted for Grades 8 and 10 via the Parent Portal.",
      targetAudience: "ALL" as const,
      priority: "URGENT" as const,
      attachmentUrl: "Chennai_Collector_Rain_Advisory.pdf",
    },
    {
      id: "not_pongal_celebs",
      schoolId,
      academicYearId: "ay_2026_2027",
      authorId: "usr_teacher_2",
      title: "Traditional Pongal & Tamil Ilakkiya Mandram Celebrations",
      content: "The annual traditional Pongal festival and Tamil Literary Association (தமிழ் இலக்கிய மன்றம்) competitions will be celebrated in the main auditorium. Students are encouraged to wear traditional Tamil ethnic attire (Veshti/Pavadai).",
      targetAudience: "STUDENTS" as const,
      priority: "NORMAL" as const,
      attachmentUrl: "Pongal_Festival_Schedule.pdf",
    },
    {
      id: "not_exam_timetable",
      schoolId,
      academicYearId: "ay_2026_2027",
      authorId: "usr_principal",
      title: "Term 1 Midterm Examination Schedule (Classes 4, 8 & 10)",
      content: "The Midterm examinations will commence next month. Examinations cover Part I Tamil, English Language, Mathematics, General Science, and Social Studies. Syllabus portions are available in the Exam portal.",
      targetAudience: "PARENTS" as const,
      priority: "NORMAL" as const,
      attachmentUrl: "Midterm_Exam_Timetable_2026.pdf",
    },
  ];

  for (const n of noticesData) {
    const [exist] = await db.select().from(notices).where(eq(notices.id, n.id)).limit(1);
    if (!exist) {
      await db.insert(notices).values(n);
    }
  }
  console.log("✓ Tamil Nadu school notices added to announcement board.");

  console.log("\n=== ALL DATABASE ROWS SUCCESSFULLY MIGRATED TO TAMIL NADU DATA! ===");
}

updateDatabaseToTamilNadu()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  });
