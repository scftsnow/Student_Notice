"use client";

import { Users } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import StudentTab from "@/components/classroom/students/StudentTab";

export default function StudentsPageClient() {
  const state = useClassroomState();

  if (!state.isLoaded) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 font-bold text-xs animate-pulse">학생 명단 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 학생 관리 상단 헤더 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Users className="w-4 h-4" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">학급 학생 명단 관리</h1>
            <p className="text-xs text-slate-500">
              학급 학생을 등록하고 계좌 및 번호를 관리합니다.
            </p>
          </div>
        </div>
      </div>

      <StudentTab
        students={state.students}
        onAddStudents={state.addStudents}
        onDeleteStudent={state.deleteStudent}
      />
    </div>
  );
}
