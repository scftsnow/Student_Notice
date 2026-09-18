"use client";

import { CheckSquare, Bell } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import RoutineTab from "@/components/classroom/routines/RoutineTab";
import PageHeader from "@/components/layout/PageHeader";

export default function RoutinesPageClient() {
  const state = useClassroomState();

  if (!state.isLoaded) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 font-bold text-xs animate-pulse">학생 업무 불러오는 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* 학생 업무 상단 헤더 */}
        <PageHeader
          icon={<CheckSquare className="w-4 h-4" />}
          title="학급 학생 업무 및 순환 관리"
          description="1인1역 당번과 업무 순환 순서를 관리하고 당일 급여를 정산합니다."
        />

        <RoutineTab
          routines={state.routines}
          students={state.students}
          currencyName={state.currencyName}
          savedOrders={state.savedOrders}
          onAddRoutine={state.addRoutine}
          onDeleteRoutine={state.deleteRoutine}
          onAdvanceRoutine={state.advanceRoutine}
          onPayRoutineToday={state.payRoutineToday}
          onUpdateRoutineOrder={state.updateRoutineOrder}
          onUpdateRoutine={state.updateRoutine}
        />
      </div>

      {/* 토스트 알림 */}
      {state.toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{state.toastMessage}</span>
        </div>
      )}
    </>
  );
}
