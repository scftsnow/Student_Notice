"use client";

import { useMemo, useState } from "react";
import { Shuffle, ListOrdered, Users, Armchair } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import StudentPickPanel from "./StudentPickPanel";
import OrderPickPanel from "./OrderPickPanel";
import GroupPickPanel, { type GroupSetItem } from "./GroupPickPanel";
import SeatPickPanel from "./SeatPickPanel";
import { toPickStudents } from "@/lib/pickFormat";
import type { SeatAssignmentItem, SeatLayoutItem } from "@/types";

interface PicksPageClientProps {
  initialLayouts: SeatLayoutItem[];
  initialAssignments: SeatAssignmentItem[];
  initialSets: GroupSetItem[];
}

type Tab = "student" | "order" | "group" | "seat";

const TABS: { value: Tab; label: string; icon: typeof Shuffle }[] = [
  { value: "student", label: "학생 뽑기", icon: Shuffle },
  { value: "order", label: "순서 뽑기", icon: ListOrdered },
  { value: "group", label: "모둠 뽑기", icon: Users },
  { value: "seat", label: "자리 뽑기", icon: Armchair },
];

export default function PicksPageClient({
  initialLayouts,
  initialAssignments,
  initialSets,
}: PicksPageClientProps) {
  const [tab, setTab] = useState<Tab>("student");
  // 실명단(localStorage 교실 상태)과 동일한 출처 사용 — 명단 변경이 즉시 반영됨
  const classroom = useClassroomState();

  const students = useMemo(
    () => toPickStudents(classroom.students),
    [classroom.students]
  );
  const routines = useMemo(
    () =>
      classroom.routines.map((r) => ({
        id: r.id,
        title: r.name,
        order: [...r.order],
      })),
    [classroom.routines]
  );

  if (!classroom.isLoaded) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 font-bold text-xs animate-pulse">뽑기 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Shuffle className="w-6 h-6 text-indigo-600" />
          뽑기
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          학생·순서·모둠·자리 추첨. 학생 명단과 바로 연동됩니다 ({students.length}명).
        </p>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                tab === t.value
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {students.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
          등록된 학생이 없습니다. 먼저 <span className="font-bold text-slate-600">학생 명단</span>에서
          학생을 등록해 주세요.
        </div>
      )}

      {tab === "student" && <StudentPickPanel students={students} />}
      {tab === "order" && (
        <OrderPickPanel
          students={students}
          routines={routines}
          onApplyOrder={(routineId, orderedNames) =>
            classroom.updateRoutineOrder(routineId, orderedNames)
          }
        />
      )}
      {tab === "group" && <GroupPickPanel students={students} initialSets={initialSets} />}
      {tab === "seat" && (
        <SeatPickPanel
          students={students}
          initialLayouts={initialLayouts}
          initialAssignments={initialAssignments}
        />
      )}
    </div>
  );
}
