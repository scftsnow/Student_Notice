import { prisma } from "@/lib/prisma";
import PicksPageClient from "@/components/picks/PicksPageClient";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  // 학생·업무는 실명단(localStorage 교실 상태)에서 클라이언트가 직접 읽음.
  // 서버에서는 저장된 틀/배치/모둠 목록만 조회.
  const [layouts, assignments, sets] = await Promise.all([
    prisma.seatLayout.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.seatAssignment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.groupSet.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <PicksPageClient
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
