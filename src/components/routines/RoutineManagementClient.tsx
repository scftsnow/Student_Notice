"use client";

import { useState } from "react";
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Coins,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sparkles,
  CheckCircle,
  CalendarCheck,
  X,
} from "lucide-react";
import { createRoutine, updateRoutine, deleteRoutine } from "@/app/actions";
import DailyCheckInModal from "./DailyCheckInModal";
import type { Routine, Student, DailyRoutineAssignment } from "@/types";

interface RoutineManagementClientProps {
  initialRoutines: Routine[];
  allStudents: Student[];
  currencyName: string;
  initialDate: string;
  initialAssignments: DailyRoutineAssignment[];
}

export default function RoutineManagementClient({
  initialRoutines,
  allStudents,
  currencyName,
  initialDate,
  initialAssignments,
}: RoutineManagementClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [activeModalRoutine, setActiveModalRoutine] = useState<DailyRoutineAssignment | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workersPerCycle, setWorkersPerCycle] = useState(1);
  const [cycleDays, setCycleDays] = useState(1);
  const [salaryAmount, setSalaryAmount] = useState(200);
  const [salaryCycle, setSalaryCycle] = useState("DAILY");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleOpenAddModal = () => {
    setTitle("");
    setDescription("");
    setWorkersPerCycle(2);
    setCycleDays(1);
    setSalaryAmount(200);
    setSalaryCycle("DAILY");
    setErrorMsg("");
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (routine: Routine) => {
    setEditingRoutine(routine);
    setTitle(routine.title);
    setDescription(routine.description || "");
    setWorkersPerCycle(routine.workersPerCycle);
    setCycleDays(routine.cycleDays);
    setSalaryAmount(routine.salaryAmount);
    setSalaryCycle(routine.salaryCycle);
    setErrorMsg("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("업무명을 입력해 주세요.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await createRoutine({
        title: title.trim(),
        description: description.trim(),
        workersPerCycle,
        cycleDays,
        salaryAmount,
        salaryCycle,
      });
      setIsAddModalOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류 발생";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("업무명을 입력해 주세요.");
      return;
    }
    if (!editingRoutine) return;
    setLoading(true);
    try {
      await updateRoutine(editingRoutine.id, {
        title: title.trim(),
        description: description.trim(),
        workersPerCycle,
        cycleDays,
        salaryAmount,
        salaryCycle,
        active: editingRoutine.active,
      });
      setEditingRoutine(null);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류 발생";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, rTitle: string) => {
    if (!confirm(`'${rTitle}' 업무를 삭제하시겠습니까?`)) return;
    try {
      await deleteRoutine(id);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "삭제 실패";
      alert(msg);
    }
  };

  const shiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const nd = String(dateObj.getDate()).padStart(2, "0");
    const newDate = `${ny}-${nm}-${nd}`;
    setSelectedDate(newDate);
    // Reload page with date query param
    window.location.href = `/routines?date=${newDate}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
            학생 업무 관리
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            업무명, 1회 투입 인원, 순환 주기, 급여액을 설정하고 결석생 대응 및 알림장과 자동 연동합니다.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-200 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          신규 업무 등록
        </button>
      </div>

      {/* Date Navigation Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-bold text-slate-800">조회 및 당번 점검 일자:</span>
          <span className="font-mono text-sm px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
            {selectedDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="하루 전"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              window.location.href = `/routines?date=${initialDate}`;
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            오늘로 이동
          </button>
          <button
            onClick={() => shiftDate(1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="다음 날"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Routine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialRoutines.map((routine) => {
          const assignment = initialAssignments.find((a) => a.routineId === routine.id);
          const isHoliday = assignment?.isHoliday;

          return (
            <div
              key={routine.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      {routine.cycleDays}일마다 {routine.workersPerCycle}명 순환
                    </span>
                    <h3 className="text-base font-bold text-slate-800 mt-2">{routine.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {routine.description || "설명 없음"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(routine)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(routine.id, routine.title)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Salary Info */}
                <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-amber-800 flex items-center gap-1 font-medium">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    지급 급여:
                  </span>
                  <span className="font-bold text-amber-900 font-mono">
                    {routine.salaryAmount.toLocaleString()} {currencyName} /{" "}
                    {routine.salaryCycle === "DAILY" ? "회당" : "주기별"}
                  </span>
                </div>

                {/* Assigned Students for Selected Date */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      선택 일자 배정 당번 ({selectedDate})
                    </span>
                    {assignment?.isConfirmed && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> 확정됨
                      </span>
                    )}
                  </div>

                  {isHoliday ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      주말/공휴일 ({assignment?.holidayReason || "휴일"})로 순환 제외
                    </div>
                  ) : assignment && assignment.actualStudents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.actualStudents.map((s) => (
                        <span
                          key={s.id}
                          className={`text-xs px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 ${
                            s.isPinchHitter
                              ? "bg-violet-100 text-violet-800 border border-violet-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white text-[10px] font-bold flex items-center justify-center">
                            {s.studentNumber}
                          </span>
                          <span>{s.name}</span>
                          {s.isPinchHitter && (
                            <span className="text-[9px] bg-violet-600 text-white px-1 rounded">
                              대타
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center">
                      배정된 인원이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action: Daily Check-in Modal */}
              {!isHoliday && assignment && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModalRoutine(assignment)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CalendarCheck className="w-4 h-4 text-indigo-600" />
                    {assignment.isConfirmed
                      ? "당번 재확인 및 대타 변경"
                      : "당번 확정 및 결석 체크"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Routine Modal */}
      {(isAddModalOpen || editingRoutine) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingRoutine ? "업무 정보 수정" : "새로운 학생 업무 등록"}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingRoutine(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingRoutine ? handleUpdate : handleCreate} className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  업무명 (예: 교실 바닥 청소, 우유 배부, 분리수거)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="예: 칠판 및 스마트보드 관리"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  업무 설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="당번이 수행해야 할 상세 작업 내용"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    1회 업무자 수
                  </label>
                  <input
                    type="number"
                    value={workersPerCycle}
                    onChange={(e) => setWorkersPerCycle(Number(e.target.value))}
                    min={1}
                    max={10}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    한 번에 투입될 학생 수
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    업무 주기 (일 단위)
                  </label>
                  <input
                    type="number"
                    value={cycleDays}
                    onChange={(e) => setCycleDays(Number(e.target.value))}
                    min={1}
                    max={30}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    1일: 매일 교대, 5일: 1주일 교대
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    회당 급여액 ({currencyName})
                  </label>
                  <input
                    type="number"
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(Number(e.target.value))}
                    min={0}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    급여 주기
                  </label>
                  <select
                    value={salaryCycle}
                    onChange={(e) => setSalaryCycle(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="DAILY">매일 (수행 시마다)</option>
                    <option value="WEEKLY">주간 정산</option>
                    <option value="MONTHLY">월간 정산</option>
                  </select>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {errorMsg}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRoutine(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "저장 중..." : editingRoutine ? "수정 완료" : "업무 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Check-in Modal */}
      {activeModalRoutine && (
        <DailyCheckInModal
          routine={{
            id: activeModalRoutine.routineId,
            title: activeModalRoutine.routineTitle,
            salaryAmount: activeModalRoutine.salaryAmount,
          }}
          date={selectedDate}
          assignedStudents={activeModalRoutine.assignedStudents}
          allActiveStudents={allStudents
            .filter((s) => s.status === "ACTIVE")
            .map((s) => ({
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
