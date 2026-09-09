"use client";

import { useState } from "react";
import { Settings, X, Plus, ClipboardList, ArrowRight, CheckSquare } from "lucide-react";
import { ClassroomStudent, ClassroomRoutine } from "@/types/classroom";
import AddRoutineModal from "./AddRoutineModal";

interface RoutineTabProps {
  routines: ClassroomRoutine[];
  students: ClassroomStudent[];
  currencyName?: string;
  onAddRoutine: (routine: Omit<ClassroomRoutine, "id" | "currentIdx">) => void;
  onDeleteRoutine: (id: string) => void;
  onAdvanceRoutine?: (id: string) => void;
  onPayRoutineToday?: (id: string, customWorkerNames?: string[]) => void;
  onUpdateRoutineOrder?: (id: string, newOrder: string[]) => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
}

export default function RoutineTab({
  routines,
  students,
  currencyName = "원",
  onAddRoutine,
  onDeleteRoutine,
  onUpdateRoutine,
}: RoutineTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ClassroomRoutine | null>(null);

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
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-xs hover:bg-indigo-700 flex items-center gap-1.5 transition-all text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>새 학생 업무 등록</span>
        </button>
      </div>

      {/* 루틴 카드 그리드 */}
      {routines.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="font-semibold text-base">등록된 학생 업무가 없습니다.</div>
          <div className="text-xs mt-1">새 학생 업무 등록 버튼으로 1인 1역 당번을 추가하세요.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map((r) => {
            // 오늘 담당 인덱스 집합 (r.currentIdx부터 slots개)
            const activeIndices = new Set<number>();
            if (r.order.length > 0) {
              const count = Math.min(r.slots, r.order.length);
              for (let i = 0; i < count; i++) {
                activeIndices.add((r.currentIdx + i) % r.order.length);
              }
            }
            const cycleLabel = r.payCycle || "1회";

            return (
              <div
                key={r.id}
                className={`p-4 rounded-2xl bg-white border transition-all flex flex-col justify-between space-y-3.5 shadow-xs ${
                  r.visibleInNotice !== false
                    ? "border-slate-200 hover:border-indigo-300 hover:shadow-md"
                    : "border-dashed border-slate-300 bg-slate-50/60 opacity-85"
                }`}
              >
                {/* 카드 상단: 아이콘, 이름, 삭제 버튼 (중복 설정 버튼 제거) */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      </div>
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
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`"${r.name}" 업무를 삭제하시겠습니까?`)) {
                            onDeleteRoutine(r.id);
                          }
                        }}
                        className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors font-bold text-xs"
                        title="업무 삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
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

                {/* 카드 중단: 순환 순번만 남기고 오늘 담당만 볼드 + 색상 강조 */}
                <div className="py-2.5 border-y border-slate-100 text-xs">
                  <div className="bg-slate-50/80 border border-slate-200/70 p-3 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-bold">순환 순번</span>
                      <span className="text-indigo-600 font-bold text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        오늘 담당: 색상 강조
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-y-1.5 text-xs leading-relaxed">
                      {r.order.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">순환 순서가 설정되지 않았습니다.</span>
                      ) : (
                        r.order.map((name, idx) => {
                          const isTodayWorker = activeIndices.has(idx);
                          return (
                            <span key={`${name}-${idx}`} className="inline-flex items-center">
                              {idx > 0 && (
                                <ArrowRight className="w-3 h-3 text-slate-300 mx-1 shrink-0" />
                              )}
                              <span
                                className={
                                  isTodayWorker
                                    ? "font-extrabold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs"
                                    : "font-medium text-slate-600 px-1 py-0.5"
                                }
                              >
                                {name}
                              </span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* 카드 하단 액션: 단일 설정 버튼 (다음 순번 제거, 루시드 아이콘 사용) */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingRoutine(r)}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors text-center flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-600" />
                    <span>설정</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 업무 신규 등록 모달 */}
      <AddRoutineModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        students={students}
        currencyName={currencyName}
        onSave={onAddRoutine}
      />

      {/* 업무 설정(수정) 모달 - 등록 모달과 동일한 화면 */}
      <AddRoutineModal
        isOpen={Boolean(editingRoutine)}
        onClose={() => setEditingRoutine(null)}
        students={students}
        currencyName={currencyName}
        initialRoutine={editingRoutine}
        onUpdateRoutine={onUpdateRoutine}
      />
    </div>
  );
}
