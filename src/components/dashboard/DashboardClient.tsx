"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  CheckSquare,
  FileText,
  Coins,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  Clock,
  Send,
  CalendarCheck,
} from "lucide-react";
import DailyCheckInModal from "@/components/routines/DailyCheckInModal";
import { approvePayments } from "@/app/actions";
import type {
  ClassSetting,
  Student,
  DailyRoutineAssignment,
  Notice,
  StudentAccount,
  PendingPayment,
} from "@/types";

interface DashboardClientProps {
  initialDate: string;
  setting: ClassSetting;
  students: Student[];
  routinesData: DailyRoutineAssignment[];
  notice: Notice | null;
  treasury: StudentAccount | null;
  pendingPayments: PendingPayment[];
}

export default function DashboardClient({
  initialDate,
  setting,
  students,
  routinesData,
  notice,
  treasury,
  pendingPayments,
}: DashboardClientProps) {
  const [activeModalRoutine, setActiveModalRoutine] = useState<DailyRoutineAssignment | null>(null);
  const [approving, setApproving] = useState(false);

  const [liveStudentsCount, setLiveStudentsCount] = useState(students.length);
  const [liveRoutinesCount, setLiveRoutinesCount] = useState(routinesData.length);
  const [liveNoticeContent, setLiveNoticeContent] = useState(notice?.content || "");
  const [liveTreasury, setLiveTreasury] = useState(treasury?.balance ?? 0);
  const [liveClassName, setLiveClassName] = useState(setting.className);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("classroom_os_state_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.students)) setLiveStudentsCount(parsed.students.length);
        if (Array.isArray(parsed.routines)) setLiveRoutinesCount(parsed.routines.length);
        if (typeof parsed.noticeText === "string" && parsed.noticeText) setLiveNoticeContent(parsed.noticeText);
        if (typeof parsed.treasuryBalance === "number") setLiveTreasury(parsed.treasuryBalance);
        if (parsed.className) setLiveClassName(parsed.className);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const absentStudents = students.filter((s) => s.status === "ABSENT");
  const presentStudents = students.filter((s) => s.status === "ACTIVE");

  const handleBatchApprove = async () => {
    if (pendingPayments.length === 0) return;
    setApproving(true);
    try {
      await approvePayments(pendingPayments.map((p) => p.id));
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "승인 중 오류 발생";
      alert(msg);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/10">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-12 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-indigo-200 backdrop-blur-md mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>오늘의 학급 브리핑</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {liveClassName || setting.className}
            </h1>
            <p className="mt-1 text-sm text-indigo-200 max-w-xl">
              오늘 기준 일자: <strong className="text-white">{initialDate}</strong> | 현재 재적{" "}
              {liveStudentsCount}명 중 출석 {presentStudents.length}명, 결석 {absentStudents.length}명
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/notice"
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-xs sm:text-sm font-semibold backdrop-blur-md transition-all flex items-center gap-2 border border-white/10"
            >
              <FileText className="w-4 h-4 text-indigo-200" />
              알림장 쓰기
            </Link>
            <Link
              href="/economy"
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 text-white"
            >
              <Coins className="w-4 h-4" />
              송금 / 거래
            </Link>
          </div>
        </div>

        {/* Quick KPI Cards Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-md border border-white/5">
            <span className="text-[11px] font-medium text-indigo-200 block">학급 국고 잔액</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight">
                {liveTreasury.toLocaleString()}
              </span>
              <span className="text-xs text-indigo-200">{setting.currencyName}</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-md border border-white/5">
            <span className="text-[11px] font-medium text-indigo-200 block">오늘 당번 업무</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight">
                {liveRoutinesCount}
              </span>
              <span className="text-xs text-indigo-200">개 루틴</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-md border border-white/5">
            <span className="text-[11px] font-medium text-indigo-200 block">결석생 현황</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  absentStudents.length > 0 ? "text-rose-300" : "text-emerald-300"
                }`}
              >
                {absentStudents.length}
              </span>
              <span className="text-xs text-indigo-200">명</span>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-md border border-white/5">
            <span className="text-[11px] font-medium text-indigo-200 block">급여 승인 대기</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  pendingPayments.length > 0 ? "text-amber-300" : "text-indigo-200"
                }`}
              >
                {pendingPayments.length}
              </span>
              <span className="text-xs text-indigo-200">건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Routines & Notice */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Routines & Daily Check-in Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">오늘의 업무 루틴 & 당번</h2>
                  <p className="text-xs text-slate-500">
                    결석생에 대응할 수 있도록 매일 1회 확인하고 대타를 지정할 수 있습니다.
                  </p>
                </div>
              </div>

              <Link
                href="/routines"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                전체 관리 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {routinesData.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                등록된 활성 업무 루틴이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {routinesData.map((routine) => {
                  return (
                    <div
                      key={routine.routineId}
                      className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {routine.routineTitle}
                          </span>
                          {routine.isHoliday ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {routine.holidayReason || "휴일"}
                            </span>
                          ) : routine.isConfirmed ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> 확인 완료
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse-subtle flex items-center gap-1">
                              <Clock className="w-3 h-3" /> 일일 확인 필요
                            </span>
                          )}
                        </div>

                        {/* Workers list */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {routine.isHoliday ? (
                            <span className="text-xs text-slate-400">
                              주말 또는 공휴일로 당번이 진행되지 않습니다.
                            </span>
                          ) : routine.actualStudents.length > 0 ? (
                            routine.actualStudents.map((s) => (
                              <span
                                key={s.id}
                                className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 ${
                                  s.isPinchHitter
                                    ? "bg-violet-100 text-violet-800 font-semibold border border-violet-200"
                                    : "bg-white border border-slate-200 text-slate-700"
                                }`}
                              >
                                {s.studentNumber}번 {s.name}
                                {s.isPinchHitter && (
                                  <span className="text-[9px] bg-violet-600 text-white px-1 rounded">
                                    대타
                                  </span>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">배정된 인원 없음</span>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      {!routine.isHoliday && (
                        <button
                          type="button"
                          onClick={() => setActiveModalRoutine(routine)}
                          className="self-end sm:self-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                        >
                          <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                          {routine.isConfirmed ? "당번 재확인/수정" : "당번 확인 및 대타 설정"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Notice Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">오늘의 알림장</h2>
                  <p className="text-xs text-slate-500">교사 작성 내용 및 당번 자동 연동</p>
                </div>
              </div>
              <Link
                href="/notice"
                className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"
              >
                알림장 편집 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 font-sans space-y-3">
              <div className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                📌 알림장 내용 ({initialDate})
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {liveNoticeContent || notice?.content || "오늘 등록된 일반 알림장 내용이 없습니다."}
              </div>

              {/* Routine section inside notice if enabled */}
              {notice?.includeRoutines && (
                <div className="mt-4 pt-3 border-t border-amber-200/50">
                  <span className="text-xs font-bold text-indigo-700 block mb-1.5">
                    🔔 오늘의 담당 당번 안내:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {routinesData
                      .filter((r) => !r.isHoliday)
                      .map((r) => (
                        <div
                          key={r.routineId}
                          className="bg-white/90 p-2.5 rounded-xl border border-indigo-100 text-xs text-slate-700 flex justify-between items-center"
                        >
                          <span className="font-semibold text-indigo-900">{r.routineTitle}</span>
                          <span className="text-slate-600 font-medium">
                            {r.actualStudents.map((s) => s.name).join(", ") || "없음"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Economy, Approvals, Absences */}
        <div className="space-y-6">
          {/* Pending Salary Approval Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">급여 지급 대기</h3>
                  <p className="text-xs text-slate-500">당번 활동 완료 급여 검토 및 승인</p>
                </div>
              </div>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                현재 대기 중인 급여 지급 건이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex justify-between items-center">
                  <span>총 {pendingPayments.length}건 지급 대기</span>
                  <span className="font-bold">
                    {pendingPayments
                      .reduce((sum, p) => sum + p.netAmount, 0)
                      .toLocaleString()}{" "}
                    {setting.currencyName}
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {pendingPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{p.student.name}</span>
                        <span className="text-[11px] text-slate-500 block">{p.title}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-600">
                          +{p.netAmount.toLocaleString()} {setting.currencyName}
                        </span>
                        {p.taxAmount > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            (세금 -{p.taxAmount})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={approving}
                  className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {approving ? "승인 처리 중..." : "전체 일괄 승인 및 즉시 입금"}
                </button>
              </div>
            )}
          </div>

          {/* Absent Students Notice Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    absentStudents.length > 0 ? "text-rose-500" : "text-emerald-500"
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-800">결석생 체크</h3>
              </div>
              <Link
                href="/students"
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600"
              >
                명단 관리
              </Link>
            </div>

            {absentStudents.length === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-800 font-medium text-center">
                👏 오늘 결석생이 없습니다. 전원 출석!
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-rose-50 border border-rose-200/60 rounded-xl text-xs text-rose-800">
                  <span className="font-bold">{absentStudents.length}명 결석: </span>
                  {absentStudents.map((s) => `${s.studentNumber}번 ${s.name}`).join(", ")}
                </div>
                <p className="text-[11px] text-slate-400">
                  업무 루틴에서 해당 학생의 당번 차례를 대타로 변경해 주세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Check-in Modal */}
      {activeModalRoutine && (
        <DailyCheckInModal
          routine={{
            id: activeModalRoutine.routineId,
            title: activeModalRoutine.routineTitle,
            salaryAmount: activeModalRoutine.salaryAmount,
          }}
          date={initialDate}
          assignedStudents={activeModalRoutine.assignedStudents}
          allActiveStudents={presentStudents.map((s) => ({
            id: s.id,
            studentNumber: s.studentNumber,
            name: s.name,
          }))}
          isConfirmed={activeModalRoutine.isConfirmed}
          onClose={() => setActiveModalRoutine(null)}
          onSuccess={() => {
            setActiveModalRoutine(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
