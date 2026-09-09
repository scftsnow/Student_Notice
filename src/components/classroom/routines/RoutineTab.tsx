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

  // displayFormat 인라인 편집 상태: { [routineId]: { open: boolean, value: string } }
  const [formatEdits, setFormatEdits] = useState<Record<string, { open: boolean; value: string }>>({});

  const handlePinchHitterChange = (routineId: string, studentName: string) => {
    setPinchHitters((prev) => ({ ...prev, [routineId]: studentName }));
    if (onUpdateRoutine) {
      onUpdateRoutine(routineId, { pinchHitterStudent: studentName });
    }
  };

  const openFormatEdit = (r: ClassroomRoutine) => {
    setFormatEdits((prev) => ({ ...prev, [r.id]: { open: true, value: r.displayFormat ?? "" } }));
  };

  const closeFormatEdit = (routineId: string) => {
    setFormatEdits((prev) => ({ ...prev, [routineId]: { ...prev[routineId], open: false } }));
  };

  const saveFormatEdit = (routineId: string) => {
    const val = formatEdits[routineId]?.value ?? "";
    if (onUpdateRoutine) {
      onUpdateRoutine(routineId, { displayFormat: val.trim() || undefined });
    }
    closeFormatEdit(routineId);
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
          <span>새 학생 업무 등록</span>
        </button>
      </div>

      {/* 루틴 카드 그리드 */}
      {routines.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <div className="text-3xl mb-2">📋</div>
          <div className="font-semibold text-base">등록된 학생 업무가 없습니다.</div>
          <div className="text-xs mt-1">새 학생 업무 등록 버튼으로 1인 1역 당번을 추가하세요.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map((r) => {
            const currentPinchHitter = pinchHitters[r.id] ?? r.pinchHitterStudent ?? "";

            // 기본 원 담당자 목록
            const rawWorkers =
              r.order.length > 0
                ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + i) % r.order.length])
                : [];

            const nextWorkers =
              r.order.length > 0
                ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + r.slots + i) % r.order.length]).join(", ")
                : "—";

            const orderPreview = r.order.length > 0 ? r.order.join(" → ") : "순환 순서 미설정";
            const cycleLabel = r.payCycle || "1회";

            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 shadow-xs"
              >
                {/* 카드 상단: 아이콘, 이름, 급여/정원 배지, 삭제 버튼 */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl shrink-0">{r.icon || "📋"}</span>
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                          {r.name}
                        </h4>
                        {r.memo && (
                          <p className="text-xs text-slate-400 font-medium line-clamp-1 mt-0.5">
                            {r.memo}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${r.name}" 업무를 삭제하시겠습니까?`)) {
                          onDeleteRoutine(r.id);
                        }
                      }}
                      className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors font-bold text-xs shrink-0"
                      title="업무 삭제"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {r.pay > 0 ? (
                      <span className="text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        {r.pay.toLocaleString()} {currencyName} / {cycleLabel}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">
                        무급
                      </span>
                    )}
                    <span className="text-slate-600 font-semibold bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg">
                      정원 {r.slots}명
                    </span>
                  </div>
                </div>

                {/* 카드 중단: 오늘 담당, 다음 차례, 순환 순서 요약 */}
                <div className="space-y-2.5 py-2.5 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block mb-1">오늘 담당</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {rawWorkers.length === 0 ? (
                        <span className="text-slate-400 italic">담당자 미지정</span>
                      ) : (
                        rawWorkers.map((workerName, i) => {
                          const isSubstituted = Boolean(currentPinchHitter && currentPinchHitter !== "none" && i === 0);
                          return (
                            <span
                              key={`${workerName}-${i}`}
                              className={`font-bold px-2 py-1 rounded-lg ${
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
                        <span className="font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
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

                  <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400 font-medium">다음 차례:</span>
                    <span className="font-semibold text-slate-700">{nextWorkers}</span>
                  </div>

                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg leading-relaxed">
                    <span className="text-slate-400 font-medium block mb-0.5">순환 순서</span>
                    <span className="font-medium text-slate-700 break-all">{orderPreview}</span>
                  </div>

                  {/* 알림장 표시 문구 서식 */}
                  <div className="text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 font-medium">알림장 표시 문구</span>
                      {onUpdateRoutine && !formatEdits[r.id]?.open && (
                        <button
                          type="button"
                          onClick={() => openFormatEdit(r)}
                          className="text-indigo-500 hover:text-indigo-700 font-bold text-[11px] underline"
                        >
                          {r.displayFormat ? "서식 수정" : "서식 설정"}
                        </button>
                      )}
                    </div>
                    {formatEdits[r.id]?.open ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={formatEdits[r.id]?.value ?? ""}
                          onChange={(e) =>
                            setFormatEdits((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], value: e.target.value },
                            }))
                          }
                          placeholder="비워둘 경우 기본 형식(업무명: 당번 이름들)으로 표시"
                          className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-[11px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400">
                          당번 이름 자리에 <span className="font-bold text-indigo-500">?</span> 기호를 입력하세요.
                        </p>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setFormatEdits((prev) => ({ ...prev, [r.id]: { open: true, value: "" } }))
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-500 underline"
                          >
                            기본 형식 복원
                          </button>
                          <button
                            type="button"
                            onClick={() => closeFormatEdit(r.id)}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => saveFormatEdit(r.id)}
                            className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className={`font-medium ${r.displayFormat ? "text-indigo-700" : "text-slate-400 italic"}`}>
                        {r.displayFormat || "기본 형식 (업무명: 당번 이름들)"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 카드 하단 액션 버튼들 */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingRoutine(r)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors text-center"
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
                      className="flex-1 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition-colors text-center"
                      title="오늘 담당자에게 급여 지급"
                    >
                      급여 지급
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdvanceRoutine(r.id)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors text-center"
                    title="다음 순번으로 1회 진행"
                  >
                    다음 순번 →
                  </button>
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
