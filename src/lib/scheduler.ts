import { prisma } from "./prisma";
import { checkIsHoliday } from "./holidays";

export interface RoutineAssignmentResult {
  routineId: string;
  routineTitle: string;
  date: string;
  isHoliday: boolean;
  holidayReason?: string;
  workersPerCycle: number;
  salaryAmount: number;
  assignedStudents: {
    id: string;
    studentNumber: number;
    name: string;
    isAbsent: boolean;
  }[];
  actualStudents: {
    id: string;
    studentNumber: number;
    name: string;
    isPinchHitter?: boolean;
    replacedStudentName?: string;
  }[];
  isConfirmed: boolean;
  isPaid: boolean;
}

/**
 * Calculates working days count between an anchor date (e.g. 2026-03-01) and targetDate.
 * Skips weekends, statutory holidays, and custom school holidays.
 */
export function getWorkingDayIndex(
  targetDateStr: string,
  customHolidays: string[] = []
): number {
  const [targetY, targetM, targetD] = targetDateStr.split("-").map(Number);
  const targetDate = new Date(targetY, targetM - 1, targetD);

  // Use base anchor: beginning of target's year (Jan 1)
  const cur = new Date(targetY, 0, 1);
  let workingDays = 0;

  while (cur <= targetDate) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    const holidayCheck = checkIsHoliday(dateStr, customHolidays);
    if (!holidayCheck.isHoliday) {
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return workingDays;
}

/**
 * Computes duty assignments for all active routines for a given target date.
 */
export async function getDailyRoutineAssignments(
  targetDateStr: string
): Promise<RoutineAssignmentResult[]> {
  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  const customHolidays: string[] = setting?.schoolHolidays
    ? JSON.parse(setting.schoolHolidays)
    : [];

  const holidayCheck = checkIsHoliday(targetDateStr, customHolidays);

  const routines = await prisma.routine.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      members: {
        orderBy: { orderIndex: "asc" },
        include: { student: true },
      },
      histories: {
        where: { date: targetDateStr },
      },
    },
  });

  const workingDayIdx = getWorkingDayIndex(targetDateStr, customHolidays);

  const results: RoutineAssignmentResult[] = [];

  for (const routine of routines) {
    const members = routine.members.map((m) => m.student);
    const memberCount = members.length;

    if (memberCount === 0) {
      results.push({
        routineId: routine.id,
        routineTitle: routine.title,
        date: targetDateStr,
        isHoliday: holidayCheck.isHoliday,
        holidayReason: holidayCheck.reason,
        workersPerCycle: routine.workersPerCycle,
        salaryAmount: routine.salaryAmount,
        assignedStudents: [],
        actualStudents: [],
        isConfirmed: false,
        isPaid: false,
      });
      continue;
    }

    // Check if there is already a confirmed history for this routine on this date
    const history = routine.histories[0];

    if (history && history.status === "CONFIRMED") {
      const assignedIds: string[] = JSON.parse(history.assignedStudentIds || "[]");
      const actualIds: string[] = JSON.parse(history.actualStudentIds || "[]");

      const assignedStudents = assignedIds
        .map((id) => members.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({
          id: s!.id,
          studentNumber: s!.studentNumber,
          name: s!.name,
          isAbsent: s!.status === "ABSENT",
        }));

      // Fetch students for actualIds (which might include substitute students not originally in assigned list)
      const allActualStudents = await prisma.student.findMany({
        where: { id: { in: actualIds } },
      });

      const actualStudents = actualIds
        .map((id) => allActualStudents.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => {
          const isOriginal = assignedIds.includes(s!.id);
          return {
            id: s!.id,
            studentNumber: s!.studentNumber,
            name: s!.name,
            isPinchHitter: !isOriginal,
          };
        });

      results.push({
        routineId: routine.id,
        routineTitle: routine.title,
        date: targetDateStr,
        isHoliday: holidayCheck.isHoliday,
        holidayReason: holidayCheck.reason,
        workersPerCycle: routine.workersPerCycle,
        salaryAmount: routine.salaryAmount,
        assignedStudents,
        actualStudents,
        isConfirmed: true,
        isPaid: history.isPaid,
      });
      continue;
    }

    // If it's a holiday or weekend and no manual override history exists
    if (holidayCheck.isHoliday) {
      results.push({
        routineId: routine.id,
        routineTitle: routine.title,
        date: targetDateStr,
        isHoliday: true,
        holidayReason: holidayCheck.reason,
        workersPerCycle: routine.workersPerCycle,
        salaryAmount: routine.salaryAmount,
        assignedStudents: [],
        actualStudents: [],
        isConfirmed: false,
        isPaid: false,
      });
      continue;
    }

    // Calculate default rotation based on cycleDays and workersPerCycle
    // Cycle unit index = Math.floor((workingDayIdx - 1) / cycleDays)
    const cycleUnit = Math.floor(Math.max(0, workingDayIdx - 1) / routine.cycleDays);
    const startIndex = (cycleUnit * routine.workersPerCycle) % memberCount;

    const assignedStudentsList = [];
    for (let i = 0; i < routine.workersPerCycle; i++) {
      const student = members[(startIndex + i) % memberCount];
      if (student) {
        assignedStudentsList.push({
          id: student.id,
          studentNumber: student.studentNumber,
          name: student.name,
          isAbsent: student.status === "ABSENT",
        });
      }
    }

    results.push({
      routineId: routine.id,
      routineTitle: routine.title,
      date: targetDateStr,
      isHoliday: false,
      workersPerCycle: routine.workersPerCycle,
      salaryAmount: routine.salaryAmount,
      assignedStudents: assignedStudentsList,
      actualStudents: assignedStudentsList.map((s) => ({
        id: s.id,
        studentNumber: s.studentNumber,
        name: s.name,
        isPinchHitter: false,
      })),
      isConfirmed: false,
      isPaid: false,
    });
  }

  return results;
}
