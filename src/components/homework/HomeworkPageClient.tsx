"use client";

import { Bell, BookOpenCheck } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import HomeworkTab from "@/components/classroom/homework/HomeworkTab";
import PageHeader from "@/components/layout/PageHeader";
import { homeworkUnsubmitted, resolveHomeworkStatus } from "@/types/classroom";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeworkPageClient() {
  const state = useClassroomState();

  if (!state.isLoaded) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 font-bold text-xs animate-pulse">과제 불러오는 중...</div>
      </div>
    );
  }

  const today = todayStr();
  const activeHomeworks = state.homeworks.filter(
    (h) => resolveHomeworkStatus(h, today) === "ACTIVE"
  );
  const totalUnsubmitted = activeHomeworks.reduce(
    (n, h) => n + homeworkUnsubmitted(h, state.students).length,
    0
  );

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          icon={<BookOpenCheck className="w-4 h-4" />}
          title="학생 과제 제출 관리"
          description={`숙제 제출 현황을 학생 명단 기준으로 빠르게 확인합니다. 미제출 ${totalUnsubmitted}명 (진행 중 과제 ${activeHomeworks.length}개)`}
        />

        <HomeworkTab
          homeworks={state.homeworks}
          students={state.students}
          onAdd={state.addHomework}
          onUpdate={state.updateHomework}
          onToggleSubmitted={state.toggleHomeworkSubmitted}
          onToggleExempt={state.toggleHomeworkExempt}
          onSetAllSubmitted={state.setAllHomeworkSubmitted}
          onDelete={state.deleteHomework}
        />
      </div>

      {state.toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{state.toastMessage}</span>
        </div>
      )}
    </>
  );
}
