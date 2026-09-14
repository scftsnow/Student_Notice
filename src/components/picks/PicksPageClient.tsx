"use client";

import { useState } from "react";
import { Shuffle, ListOrdered, Users, Armchair } from "lucide-react";
import StudentPickPanel from "./StudentPickPanel";
import OrderPickPanel from "./OrderPickPanel";
import GroupPickPanel, { type GroupSetItem } from "./GroupPickPanel";
import SeatPickPanel from "./SeatPickPanel";
import type { PickStudent, SeatAssignmentItem, SeatLayoutItem } from "@/types";

interface PicksPageClientProps {
  students: PickStudent[];
  routines: { id: string; title: string }[];
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
  students,
  routines,
  initialLayouts,
  initialAssignments,
  initialSets,
}: PicksPageClientProps) {
  const [tab, setTab] = useState<Tab>("student");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Shuffle className="w-6 h-6 text-indigo-600" />
          뽑기
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          학생·순서·모둠·자리 추첨. 전체 또는 일부 학생 선택 가능.
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

      {tab === "student" && <StudentPickPanel students={students} />}
      {tab === "order" && <OrderPickPanel students={students} routines={routines} />}
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
