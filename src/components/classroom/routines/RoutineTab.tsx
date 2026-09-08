"use client";

import { useState } from "react";
import { ClassroomStudent, ClassroomRoutine } from "@/types/classroom";
import AddRoutineModal from "./AddRoutineModal";
import RoutineOrderModal from "./RoutineOrderModal";

interface RoutineTabProps {
  routines: ClassroomRoutine[];
  students: ClassroomStudent[];
  currencyName?: string;
  onAddRoutine: (routine: Omit<ClassroomRoutine, "id" | "currentIdx">) => void;
  onDeleteRoutine: (id: string) => void;
  onAdvanceRoutine: (id: string) => void;
  onPayRoutineToday: (id: string, customWorkerNames?: string[]) => void;
  onUpdateRoutineOrder: (id: string, newOrder: string[]) => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
}

export default function RoutineTab({
  routines,
  students,
  currencyName = "원",
  onAddRoutine,
  onDeleteRoutine,
  onAdvanceRoutine,
  onPayRoutineToday,
  onUpdateRoutineOrder,
  onUpdateRoutine,
}: RoutineTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ClassroomRoutine | null>(null);

  // 로컬 대타 지정 상태: { [routineId]: pinchHitterStudentName }
  const [pinchHitters, setPinchHitters] = useState<Record<string, string>>({});
  // 결석 정책 상태: { [routineId]: "manual" | "next" | "defer" | "pass" }
  const [absenceModes, setAbsenceModes] = useState<Record<string, "manual" | "next" | "defer" | "pass">>({});

  const handlePinchHitterChange = (routineId: string, studentName: string) => {
    setPinchHitters((prev) => ({ ...prev, [routineId]: studentName }));
    if (onUpdateRoutine) {
      onUpdateRoutine(routineId, { pinchHitterStudent: studentName });
    }
  };

  const handleAbsenceModeChange = (routineId: string, mode: "manual" | "next" | "defer" | "pass") => {
    setAbsenceModes((prev) => ({ ...prev, [routineId]: mode }));
    if (onUpdateRoutine) {
      onUpdateRoutine(routineId, { absenceMode: mode });
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* 액션 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-base">학급 정기 업무 및 순환 관리</span>
          <span className="text-slate-400 text-xs">
            (총 <span className="font-bold text-indigo-600">{routines.length}</span>개)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-xs hover:bg-indigo-700 flex items-center gap-1.5 transition-all"
        >
          <span>＋</span>
          <span>새 루틴 등록</span>
        </button>
      </div>

      {/* 루틴 카드 목록 */}
      {routines.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <div className="text-3xl mb-2">📋</div>
          <div className="font-semibold text-base">등록된 업무 루틴이 없습니다.</div>
          <div className="text-xs mt-1">새 루틴 등록 버튼으로 1인1역 당번을 추가하세요.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((r) => {
            const currentAbsenceMode = absenceModes[r.id] || r.absenceMode || "manual";
            const currentPinchHitter = pinchHitters[r.id] ?? r.pinchHitterStudent ?? "";

            // 기본 원 담당자 목록
            const rawWorkers =
              r.order.length > 0
                ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + i) % r.order.length])
                : [];

            // 대타 지정 및 정책에 따른 실제 당일 수행자 목록
            let activeWorkers: string[] = [...rawWorkers];
            if (currentPinchHitter && currentPinchHitter !== "none") {
              // 대타가 지정된 경우 첫 번째 담당자를 대타로 교체
              if (activeWorkers.length > 0) {
                activeWorkers[0] = currentPinchHitter;
              } else {
                activeWorkers = [currentPinchHitter];
              }
            } else if (currentAbsenceMode === "next" && r.order.length > r.slots) {
              // 다음 순번 대타 모드인 경우
              // 첫 번째 결석 대타 자리에 다음 순번 투입
              const nextCandidate = r.order[(r.currentIdx + r.slots) % r.order.length];
              if (activeWorkers.length > 0) {
                activeWorkers[0] = `${activeWorkers[0]} (대타: ${nextCandidate})`;
              }
            } else if (currentAbsenceMode === "pass") {
              activeWorkers = activeWorkers.slice(1);
            }

            const nextWorkers =
              r.order.length > 0
                ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + r.slots + i) % r.order.length]).join(", ")
                : "—";

            const orderPreview = r.order.length > 0 ? r.order.join(" → ") : "순환 순서 미설정";
            const cycleLabel = r.payCycle || "1회";

            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 hover:border-indigo-300 transition-all shadow-xs"
              >
                {/* 상단 루틴 정보 및 조작 버튼 */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-extrabold text-base text-slate-900">
                      {r.name}
                    </span>
                    {r.pay > 0 ? (
                      <span className="text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                        {r.pay.toLocaleString()} {currencyName} / {cycleLabel}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-lg text-xs">
                        무급
                      </span>
                    )}
                    <span className="text-slate-500 font-semibold text-xs">정원 {r.slots}명</span>
                    {r.memo && <span className="text-slate-400 text-xs">· {r.memo}</span>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingRoutine(r)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      순번 편집
                    </button>
                    {r.pay > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const actualPaid = currentPinchHitter && currentPinchHitter !== "none"
                            ? [currentPinchHitter, ...rawWorkers.slice(1)]
                            : rawWorkers;
                          onPayRoutineToday(r.id, actualPaid);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors"
                        title="오늘 담당자에게 급여 지급"
                      >
                        급여 지급
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAdvanceRoutine(r.id)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors"
                      title="다음 순번으로 1회 진행"
                    >
                      다음 순번 →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${r.name}" 루틴을 삭제하시겠습니까?`)) {
                          onDeleteRoutine(r.id);
                        }
                      }}
                      className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors font-bold"
                      title="루틴 삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 오늘 담당 및 다음 순번 */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-bold shrink-0">오늘 담당:</span>
                    <div className="flex items-center gap-1.5">
                      {rawWorkers.length === 0 ? (
                        <span className="text-slate-400 italic text-xs">담당자 미지정</span>
                      ) : (
                        rawWorkers.map((workerName, i) => {
                          const isSubstituted = currentPinchHitter && currentPinchHitter !== "none" && i === 0;
                          return (
                            <span
                              key={`${workerName}-${i}`}
                              className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                                isSubstituted
                                  ? "bg-amber-100 text-amber-900 border border-amber-300 line-through opacity-60"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}
                            >
                              {workerName}
                            </span>
                          );
                        })
                      )}
                      {currentPinchHitter && currentPinchHitter !== "none" && (
                        <span className="font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs flex items-center gap-1">
                          <span>대타:</span>
                          <span className="underline">{currentPinchHitter}</span>
                          <button
                            type="button"
                            onClick={() => handlePinchHitterChange(r.id, "")}
                            className="ml-0.5 text-amber-500 hover:text-rose-600 font-bold"
                            title="대타 해제"
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-slate-400">다음 차례: {nextWorkers}</span>
                </div>

                {/* 대타 및 결석 정책 제어 (설정이 아니라 업무 루틴에서 직접 관리) */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-700">결석 시 대타 정책:</span>
                    <select
                      value={currentAbsenceMode}
                      onChange={(e) => handleAbsenceModeChange(r.id, e.target.value as "manual" | "next" | "defer" | "pass")}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="manual">임의 대타 지정 (교사 직접 선택)</option>
                      <option value="next">다음 순번 대타 (자동 투입)</option>
                      <option value="defer">순번 이월 (다음 등교일로 연기)</option>
                      <option value="pass">차례 패스 (출석 인원만 수행)</option>
                    </select>
                  </div>

                  {/* 임의 대타 학생 선택 드롭다운 */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">오늘 대타 학생:</span>
                    <select
                      value={currentPinchHitter}
                      onChange={(e) => handlePinchHitterChange(r.id, e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="">대타 없음 (원래 순번대로)</option>
                      {students.map((s) => (
                        <option key={s.no} value={s.name}>
                          {s.no}번 {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 전체 순환 순서 요약 */}
                <div className="text-xs text-slate-600 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg">
                  <span className="text-slate-400 font-semibold shrink-0">순환 순서:</span>
                  <span className="font-medium text-slate-700 break-all">{orderPreview}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 모달 렌더링 */}
      <AddRoutineModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        students={students}
        currencyName={currencyName}
        onSave={onAddRoutine}
      />

      <RoutineOrderModal
        routine={editingRoutine}
        students={students}
        isOpen={Boolean(editingRoutine)}
        onClose={() => setEditingRoutine(null)}
        onSave={onUpdateRoutineOrder}
      />
    </div>
  );
}
