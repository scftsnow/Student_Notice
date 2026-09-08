"use client";

import { useState, useRef, useEffect } from "react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme } from "@/types/classroom";
import { resolveStudentName } from "@/lib/routineUtils";

interface RoutineElementInCanvasProps {
  routine: ClassroomRoutine;
  students: ClassroomStudent[];
  currencyName?: string;
  theme?: BoardTheme;
  customColor?: string;
  onPayRoutineToday?: (id: string, workers?: string[]) => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
}

export default function RoutineElementInCanvas({
  routine,
  students,
  currencyName = "원",
  theme = "chalkboard",
  customColor,
  onPayRoutineToday,
  onUpdateRoutine,
  onAdvanceRoutine,
}: RoutineElementInCanvasProps) {
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const workerColor =
    theme === "white"
      ? "text-indigo-700"
      : theme === "warm"
      ? "text-rose-700"
      : "text-amber-300";

  const routineTextColor =
    theme === "white"
      ? "text-slate-900"
      : theme === "warm"
      ? "text-amber-950"
      : theme === "navy"
      ? "text-slate-200"
      : "text-white/90";

  // Close popup on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePopupIndex(null);
      }
    };
    if (activePopupIndex !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [activePopupIndex]);

  // 원본 루틴 배정자 (번호일 경우 학생 이름으로 자동 변환)
  const rawWorkers =
    routine.order.length > 0
      ? Array.from(
          { length: routine.slots },
          (_, i) => {
            const raw = routine.order[(routine.currentIdx + i) % routine.order.length];
            return resolveStudentName(raw, students);
          }
        )
      : [];

  const pinchHitter =
    routine.pinchHitterStudent && routine.pinchHitterStudent !== "none"
      ? resolveStudentName(routine.pinchHitterStudent, students)
      : "";

  const handlePinchChange = (val: string) => {
    if (onUpdateRoutine) {
      onUpdateRoutine(routine.id, { pinchHitterStudent: val });
    }
    setActivePopupIndex(null);
  };

  const handlePayWorker = (workerName: string) => {
    if (onPayRoutineToday && workerName) {
      onPayRoutineToday(routine.id, [workerName]);
    }
    setActivePopupIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2 leading-snug"
      style={{ fontSize: "inherit" }}
    >
      {/* 루틴 아이콘 및 이름 */}
      <span
        className={`opacity-80 whitespace-nowrap ${customColor ? "" : routineTextColor}`}
        style={customColor ? { color: customColor } : undefined}
      >
        {routine.icon} {routine.name}:
      </span>

      {/* 루틴 당번 표시: 클릭 시 지급 및 대타 팝오버 노출 */}
      <div className="flex items-center gap-2 font-black">
        {rawWorkers.length === 0 ? (
          <span className="opacity-40 italic">배정 없음</span>
        ) : (
          rawWorkers.map((originalName, idx) => {
            const isSubstituted = Boolean(pinchHitter && idx === 0);
            const currentWorker = isSubstituted ? pinchHitter : originalName;
            const isPopupOpen = activePopupIndex === idx;

            return (
              <div key={`${originalName}-${idx}`} className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setActivePopupIndex(isPopupOpen ? null : idx)}
                  className={`font-black ${workerColor} drop-shadow-xs hover:underline cursor-pointer select-none inline-flex items-center bg-transparent border-none p-0 outline-none`}
                  style={{ fontSize: "inherit" }}
                  title={`${currentWorker} 클릭 시 급여 지급 및 대타 변경 메뉴`}
                >
                  <span className="whitespace-nowrap">
                    {isSubstituted ? `${pinchHitter} (대타)` : currentWorker}
                  </span>
                </button>

                {/* 이름 클릭 시 뜨는 지급 / 대타 액션 팝오버 */}
                {isPopupOpen && (
                  <div className="absolute bottom-full left-0 mb-2 z-50 min-w-[210px] bg-slate-900/95 border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-2.5 text-white">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                      <span className="font-extrabold text-white flex items-center gap-1">
                        <span>👤</span>
                        <span className="text-amber-300">{currentWorker}</span>
                        {isSubstituted && <span className="text-[10px] text-amber-400 font-bold">(대타)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActivePopupIndex(null)}
                        className="text-white/40 hover:text-white font-bold p-0.5 leading-none"
                        title="닫기"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 1. 대타 지정 및 변경 (상단 배치: 이름 배지 선택) */}
                    {onUpdateRoutine && students.length > 0 && (
                      <div className="space-y-1.5 pb-2 border-b border-white/10">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-white/80 block">
                            🔄 대타 지정
                          </label>
                          {isSubstituted && (
                            <button
                              type="button"
                              onClick={() => handlePinchChange("")}
                              className="text-[10px] text-rose-300 hover:text-rose-200 underline font-semibold transition-colors"
                              title="대타 해제"
                            >
                              ✕ 대타 해제
                            </button>
                          )}
                        </div>

                        {/* 이름 배지 칩 목록 */}
                        <div
                          className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-0.5"
                          aria-label={`${routine.name} 대타 지정`}
                        >
                          {students.map((s) => {
                            const isSelected = isSubstituted && pinchHitter === s.name;
                            return (
                              <button
                                key={s.no}
                                type="button"
                                onClick={() => handlePinchChange(isSelected ? "" : s.name)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                  isSelected
                                    ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-xs"
                                    : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                                }`}
                                title={`${s.name} 대타 지정`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. 대타 대신 건너뛰기 선택 버튼 */}
                    {onAdvanceRoutine && (
                      <div className="pt-0.5 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            onAdvanceRoutine(routine.id);
                            setActivePopupIndex(null);
                          }}
                          className="w-full py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white font-bold text-xs flex items-center justify-center gap-1 transition-all border border-white/10"
                          title="이 차례를 건너뛰고 다음 학생 순번으로 넘깁니다"
                        >
                          <span>⏭️</span>
                          <span>순번 건너뛰기</span>
                        </button>
                      </div>
                    )}

                    {/* 3. 즉시 급여 지급 버튼 (하단 배치) */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => handlePayWorker(currentWorker)}
                        disabled={routine.pay <= 0 || !onPayRoutineToday}
                        className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <span>💰</span>
                        <span>급여 지급 ({routine.pay.toLocaleString()}{currencyName})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 알림장 요소에 작게 노출되는 건너뛰기 버튼 */}
        {onAdvanceRoutine && rawWorkers.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdvanceRoutine(routine.id);
            }}
            className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all font-semibold select-none border border-white/10 ml-0.5 leading-tight shrink-0"
            title="다음 순번으로 건너뛰기"
          >
            건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}
