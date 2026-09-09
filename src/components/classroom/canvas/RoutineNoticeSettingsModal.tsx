"use client";

import { Eye, EyeOff, ClipboardList, CheckSquare, X } from "lucide-react";
import { ClassroomRoutine } from "@/types/classroom";

interface RoutineNoticeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  routines: ClassroomRoutine[];
  onUpdateRoutine: (id: string, patch: Partial<ClassroomRoutine>) => void;
}

export default function RoutineNoticeSettingsModal({
  isOpen,
  onClose,
  routines,
  onUpdateRoutine,
}: RoutineNoticeSettingsModalProps) {
  if (!isOpen) return null;

  const handleToggleAll = (show: boolean) => {
    routines.forEach((r) => {
      onUpdateRoutine(r.id, { visibleInNotice: show });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-extrabold text-slate-800 text-base">
                칠판 표시 학생 업무 설정
              </h2>
              <p className="text-[11px] text-slate-500">
                알림장 칠판에 노출할 업무와 칠판 전용 문구 서식을 편집합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors leading-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 일괄 제어 버튼 */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-medium">
            총 {routines.length}개 업무 중{" "}
            <strong className="text-indigo-600 font-bold">
              {routines.filter((r) => r.visibleInNotice !== false).length}개
            </strong>{" "}
            칠판 표시 중
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleToggleAll(true)}
              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-colors"
            >
              모두 표시
            </button>
            <button
              type="button"
              onClick={() => handleToggleAll(false)}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] border border-slate-200 transition-colors"
            >
              모두 숨김
            </button>
          </div>
        </div>

        {/* 루틴 목록 */}
        <div className="space-y-2.5">
          {routines.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              등록된 학생 업무가 없습니다. [학생 업무] 탭에서 먼저 업무를 등록하세요.
            </p>
          ) : (
            routines.map((r) => {
              const isVisible = r.visibleInNotice !== false;
              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border transition-all space-y-2 ${
                    isVisible
                      ? "bg-indigo-50/40 border-indigo-200/80 shadow-2xs"
                      : "bg-slate-50/60 border-slate-200 opacity-75"
                  }`}
                >
                  {/* 상단: 표시 토글 + 업무명 */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) =>
                          onUpdateRoutine(r.id, { visibleInNotice: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                      <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-extrabold text-slate-800 text-xs">
                        {r.name}
                      </span>
                    </label>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isVisible
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isVisible ? (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>칠판 표시 중</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>칠판 숨김</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* 칠판 표시 서식 입력칸 */}
                  <div className="space-y-1 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold">
                        칠판 표시 문구 서식
                      </span>
                      {r.displayFormat && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRoutine(r.id, { displayFormat: undefined })
                          }
                          className="text-slate-400 hover:text-rose-500 underline text-[10px]"
                        >
                          기본 서식으로 초기화
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={r.displayFormat || ""}
                      onChange={(e) =>
                        onUpdateRoutine(r.id, {
                          displayFormat: e.target.value === "" ? undefined : e.target.value,
                        })
                      }
                      placeholder={`기본 서식: ${r.name}: 당번 학생 이름`}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-400"
                    />
                    <p className="text-[10px] text-slate-400">
                      당번 학생 이름이 들어갈 자리에{" "}
                      <strong className="text-indigo-600">?</strong> 기호를 사용하세요. (예: 오늘 칠판은 ? 당번!)
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
