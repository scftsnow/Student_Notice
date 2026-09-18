"use client";

import { Users, Bell } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import StudentTab from "@/components/classroom/students/StudentTab";
import PageHeader from "@/components/layout/PageHeader";

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
    <>
      <div className="space-y-4">
        {/* 학생 관리 상단 헤더 */}
        <PageHeader
          icon={<Users className="w-4 h-4" />}
          title="학급 학생 명단 관리"
          description="학급 학생을 등록하고 계좌 및 번호를 관리합니다."
        />

        <StudentTab
          students={state.students}
          onAddStudents={state.addStudents}
          onDeleteStudent={state.deleteStudent}
          onUpdateGender={state.updateStudentGender}
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
