import { prisma } from "@/lib/prisma";
import PicksPageClient from "@/components/picks/PicksPageClient";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  const [students, routines, layouts, assignments, sets] = await Promise.all([
    prisma.student.findMany({
      orderBy: { studentNumber: "asc" },
      select: { id: true, studentNumber: true, name: true, gender: true, status: true },
    }),
    prisma.routine.findMany({
      orderBy: { order: "asc" },
      select: { id: true, title: true },
    }),
    prisma.seatLayout.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.seatAssignment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.groupSet.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <PicksPageClient
      students={students}
      routines={routines}
      initialLayouts={layouts.map((l) => ({
        id: l.id,
        name: l.name,
        divisions: l.divisions,
        colsPerDivision: l.colsPerDivision,
        fillFrom: l.fillFrom,
        cellsJson: l.cellsJson,
      }))}
      initialAssignments={assignments.map((a) => ({
        id: a.id,
        name: a.name,
        layoutId: a.layoutId,
        configJson: a.configJson,
        cellsJson: a.cellsJson,
        namesJson: a.namesJson,
      }))}
      initialSets={sets.map((s) => ({
        id: s.id,
        name: s.name,
        mode: s.mode,
        genderMode: s.genderMode,
        groupsJson: s.groupsJson,
        namesJson: s.namesJson,
      }))}
    />
  );
}
