"use client";

import { useClassroomState } from "@/hooks/useClassroomState";
import RoutineTab from "@/components/classroom/routines/RoutineTab";

export default function RoutinesPageClient() {
  const state = useClassroomState();

  if (!state.isMounted) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-sm animate-pulse">학생 업무 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 학생 업무 상단 헤더 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            🧹
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">학급 학생 업무 및 순환 관리</h1>
            <p className="text-xs text-slate-500">
              1인1역 당번과 업무 순환 순서를 관리하고 당일 급여를 정산합니다.
            </p>
          </div>
        </div>
      </div>

      <RoutineTab
        routines={state.routines}
        students={state.students}
        currencyName={state.currencyName}
        onAddRoutine={state.addRoutine}
        onDeleteRoutine={state.deleteRoutine}
        onAdvanceRoutine={state.advanceRoutine}
        onPayRoutineToday={state.payRoutineToday}
        onUpdateRoutineOrder={state.updateRoutineOrder}
        onUpdateRoutine={state.updateRoutine}
      />
    </div>
  );
}
