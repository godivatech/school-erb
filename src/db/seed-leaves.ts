import { db } from "./index";
import { staffLeaves } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  const [existing] = await db
    .select()
    .from(staffLeaves)
    .where(eq(staffLeaves.id, "stf_leave_anand"));

  const todayStr = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  if (!existing) {
    await db.insert(staffLeaves).values({
      id: "stf_leave_anand",
      schoolId: "sch_oxford_001",
      staffId: "stf_prof_003",
      startDate: todayStr,
      endDate: nextWeek,
      leaveType: "SL",
      daysCount: "3.0",
      reason: "Viral fever and throat infection",
      status: "APPROVED",
    });
    console.log("Seeded approved leave for teacher Anandakrishnan covering today!");
  } else {
    await db
      .update(staffLeaves)
      .set({
        startDate: todayStr,
        endDate: nextWeek,
        status: "APPROVED",
      })
      .where(eq(staffLeaves.id, "stf_leave_anand"));
    console.log("Updated approved leave for teacher Anandakrishnan covering today!");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

