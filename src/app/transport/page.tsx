import * as React from "react";
import { db } from "@/db";
import {
  transportRoutes,
  transportStops,
  studentTransport,
  students,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getActiveContext } from "@/lib/context";
import {
  TransportClient,
  RouteItem,
  StopItem,
  AssignmentItem,
  StudentOption,
} from "./transport-client";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const context = await getActiveContext();
  const schoolId = context.schoolId;
  const yearId = context.academicYearId;

  // 1. Fetch routes
  const rawRoutes = await db
    .select({
      id: transportRoutes.id,
      routeName: transportRoutes.routeName,
      vehicleNo: transportRoutes.vehicleNo,
      driverName: transportRoutes.driverName,
      driverPhone: transportRoutes.driverPhone,
      capacity: transportRoutes.capacity,
    })
    .from(transportRoutes)
    .where(eq(transportRoutes.schoolId, schoolId))
    .orderBy(desc(transportRoutes.createdAt));

  const routes: RouteItem[] = rawRoutes;

  // 2. Fetch stops belonging to school's routes
  const rawStops = await db
    .select({
      id: transportStops.id,
      routeId: transportStops.routeId,
      stopName: transportStops.stopName,
      pickupTime: transportStops.pickupTime,
      dropTime: transportStops.dropTime,
      monthlyFee: transportStops.monthlyFee,
      orderIndex: transportStops.orderIndex,
    })
    .from(transportStops)
    .innerJoin(transportRoutes, eq(transportStops.routeId, transportRoutes.id))
    .where(eq(transportRoutes.schoolId, schoolId))
    .orderBy(transportStops.orderIndex);

  const stops: StopItem[] = rawStops;

  // 3. Fetch active student transport assignments with joined student and stop names
  const rawAssignments = await db
    .select({
      id: studentTransport.id,
      studentId: studentTransport.studentId,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
      pickupStopId: studentTransport.pickupStopId,
      dropStopId: studentTransport.dropStopId,
      startDate: studentTransport.startDate,
    })
    .from(studentTransport)
    .innerJoin(students, eq(studentTransport.studentId, students.id))
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(studentTransport.academicYearId, yearId)
      )
    );

  const stopMap = new Map<string, { name: string; fee: number; routeId: string }>();
  for (const st of stops) {
    stopMap.set(st.id, {
      name: st.stopName,
      fee: parseFloat(st.monthlyFee),
      routeId: st.routeId,
    });
  }

  const routeStudentCount: Record<string, number> = {};

  const assignments: AssignmentItem[] = rawAssignments.map((a) => {
    const pickupInfo = a.pickupStopId ? stopMap.get(a.pickupStopId) : undefined;
    const dropInfo = a.dropStopId ? stopMap.get(a.dropStopId) : undefined;

    const pickupFee = pickupInfo?.fee || 0;
    const dropFee = dropInfo?.fee || 0;
    const appliedFee = Math.max(pickupFee, dropFee);

    // Track count per route
    const rId = pickupInfo?.routeId || dropInfo?.routeId;
    if (rId) {
      routeStudentCount[rId] = (routeStudentCount[rId] || 0) + 1;
    }

    return {
      id: a.id,
      studentId: a.studentId,
      studentName: `${a.firstName} ${a.lastName}`,
      admissionNo: a.admissionNo,
      pickupStopName: pickupInfo?.name || null,
      dropStopName: dropInfo?.name || null,
      appliedFee,
      startDate: a.startDate,
    };
  });

  // 4. Fetch all active students for the assignment dropdown
  const allStudents = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      admissionNo: students.admissionNo,
    })
    .from(students)
    .where(eq(students.schoolId, schoolId))
    .orderBy(students.firstName);

  const studentsList: StudentOption[] = allStudents.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    admissionNo: s.admissionNo,
  }));

  return (
    <TransportClient
      schoolId={schoolId}
      academicYearId={yearId}
      academicYearName={context.academicYearName}
      isLocked={context.isLocked}
      routes={routes}
      stops={stops}
      assignments={assignments}
      routeStudentCount={routeStudentCount}
      studentsList={studentsList}
    />
  );
}
