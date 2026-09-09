"use client";

import { useState, useRef, useEffect } from "react";
import { EyeOff } from "lucide-react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat } from "@/lib/routineUtils";

interface RoutineElementInCanvasProps {
  routine: ClassroomRoutine;
  students: ClassroomStudent[];
  currencyName?: string;
  theme?: BoardTheme;
  customColor?: string;
  onPayRoutineToday?: (id: string, workers?: string[]) => void;
  onPayAllRoutinesToday?: () => void;
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
  onPayAllRoutinesToday,
  onUpdateRoutine,
  onAdvanceRoutine,
}: RoutineElementInCanvasProps) {
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const [isFormatEditing, setIsFormatEditing] = useState(false);
  const [formatInput, setFormatInput] = useState(routine.displayFormat || "");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormatInput(routine.displayFormat || "");
  }, [routine.displayFormat]);

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
        setIsFormatEditing(false);
      }
    };
    if (activePopupIndex !== null || isFormatEditing) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [activePopupIndex, isFormatEditing]);

  // Close context menu on any outside click or context menu elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePopupIndex(null);
    setIsFormatEditing(false);
    const menuWidth = 240;
    const menuHeight = 180;
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
    setContextMenu({ x, y });
  };

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

  const workerList = rawWorkers.map((originalName, idx) => {
    const isSubstituted = Boolean(pinchHitter && idx === 0);
    return isSubstituted ? `${pinchHitter} (대타)` : originalName;
  });

  const segments = parseRoutineFormat(
    routine.displayFormat,
    routine.name,
    workerList,
    routine.icon
  );

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className="relative inline-flex items-center gap-1 leading-snug flex-wrap group"
      style={{ fontSize: "inherit" }}
    >
      {segments.map((seg, sIdx) => {
        if (seg.type === "text") {
          return (
            <span
              key={`seg-text-${sIdx}`}
              className={`opacity-80 whitespace-pre ${customColor ? "" : routineTextColor}`}
              style={customColor ? { color: customColor } : undefined}
            >
              {seg.text}
            </span>
          );
        }

        const workerIdx = seg.workerIndex ?? 0;
        const originalName = rawWorkers[workerIdx] || "";
        const isSubstituted = Boolean(pinchHitter && workerIdx === 0);
        const currentWorker = isSubstituted ? pinchHitter : originalName;
        const isPopupOpen = activePopupIndex === workerIdx;

        return (
          <div key={`seg-worker-${workerIdx}-${sIdx}`} className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setActivePopupIndex(isPopupOpen ? null : workerIdx)}
              className={`font-black ${workerColor} drop-shadow-xs hover:underline cursor-pointer select-none inline-flex items-center bg-transparent border-none p-0 outline-none`}
              style={{ fontSize: "inherit" }}
              title={`${currentWorker || "당번"} 클릭 시 급여 지급 및 대타 변경 메뉴`}
            >
              <span className="whitespace-nowrap">
                {seg.text}
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
                            key={s.name}
                            type="button"
                            onClick={() => handlePinchChange(isSelected ? "" : s.name)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-amber-400 text-slate-950 shadow-xs"
                                : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. 업무 순서 순환 넘기기 */}
                {onAdvanceRoutine && (
                  <div className="pt-0.5 pb-1 border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        onAdvanceRoutine(routine.id);
                        setActivePopupIndex(null);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>⏭️</span>
                      <span>다음 순번으로 넘기기</span>
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
      })}

      {/* 알림장 요소에 작게 노출되는 건너뛰기 버튼 */}
      {onAdvanceRoutine && rawWorkers.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdvanceRoutine(routine.id);
          }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 active:scale-95 text-white hover:text-white transition-all font-bold select-none border border-white/20 ml-1 leading-tight shrink-0 cursor-pointer shadow-2xs"
          title="이 업무의 다음 당번 순번으로 넘기기"
        >
          넘기기 ➡️
        </button>
      )}

      {/* 문구 형식 편집 버튼 */}
      {onUpdateRoutine && (
        <div className="relative inline-flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFormatInput(routine.displayFormat || "");
              setIsFormatEditing(!isFormatEditing);
            }}
            className="opacity-30 hover:opacity-100 hover:scale-110 p-0.5 text-xs transition-all cursor-pointer inline-flex items-center leading-none ml-0.5"
            title="학생 업무 문구 서식 편집 (? 기호로 당번 배치)"
          >
            ✏️
          </button>

          {/* 문구 형식 편집 팝오버 */}
          {isFormatEditing && (
            <div
              className="absolute bottom-full left-0 mb-2 z-50 min-w-[300px] sm:min-w-[360px] bg-slate-900/95 border border-white/20 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-3 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                <span className="font-extrabold text-white flex items-center gap-1.5 text-xs">
                  <span>✏️</span>
                  <span>학생 업무 표시 문구 서식 편집</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormatEditing(false)}
                  className="text-white/40 hover:text-white font-bold p-0.5 leading-none"
                  title="닫기"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-300 block font-semibold">
                  표시 문구 서식 (? 기호 자리에 당번 학생 이름 자동 배치):
                </label>
                <input
                  type="text"
                  value={formatInput}
                  onChange={(e) => setFormatInput(e.target.value)}
                  placeholder="비워둘 경우 기본 형식(업무명: 당번 이름들)으로 표시"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white font-semibold focus:outline-none focus:border-indigo-400 text-xs"
                />
                <p className="text-[10px] text-slate-400">
                  각 당번 학생 이름이 들어갈 자리에 <strong className="text-amber-300">?</strong> 기호를 입력하세요.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setFormatInput("");
                    onUpdateRoutine(routine.id, { displayFormat: "" });
                    setIsFormatEditing(false);
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-300 underline font-medium"
                >
                  기본 형식 복원
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsFormatEditing(false)}
                    className="px-2.5 py-1 rounded-md text-slate-300 hover:bg-white/10 font-bold"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateRoutine(routine.id, { displayFormat: formatInput.trim() });
                      setIsFormatEditing(false);
                    }}
                    className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-slate-900/96 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-md text-white text-xs overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 200 }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {/* 헤더 */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
            <span className="text-amber-300 font-extrabold">{routine.icon || "📋"}</span>
            <span className="font-bold text-white/90 truncate">{routine.name}</span>
          </div>

          <div className="p-1.5 space-y-0.5">
            {/* 이 업무 급여 지급 */}
            {onPayRoutineToday && (
              <button
                type="button"
                disabled={routine.pay <= 0 || rawWorkers.length === 0}
                onClick={() => {
                  onPayRoutineToday(routine.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
              >
                <span>💰</span>
                <span className="font-semibold">이 업무 급여 지급</span>
                {routine.pay > 0 && (
                  <span className="ml-auto text-amber-300 font-bold">
                    {routine.pay.toLocaleString()}{currencyName}
                  </span>
                )}
              </button>
            )}

            {/* 전체 업무 급여 일괄 지급 */}
            {onPayAllRoutinesToday && (
              <button
                type="button"
                onClick={() => {
                  onPayAllRoutinesToday();
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-emerald-700/60 hover:bg-emerald-600/80 transition-colors text-left font-bold"
              >
                <span>💵</span>
                <span>전체 업무 급여 일괄 지급</span>
              </button>
            )}

            <div className="h-px bg-white/10 my-0.5" />

            {/* 다음 순번 넘기기 */}
            {onAdvanceRoutine && (
              <button
                type="button"
                onClick={() => {
                  onAdvanceRoutine(routine.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <span>➡️</span>
                <span className="font-semibold">이 업무 다음 순번 넘기기</span>
              </button>
            )}

            {/* 알림장에서 숨기기 */}
            {onUpdateRoutine && (
              <button
                type="button"
                onClick={() => {
                  onUpdateRoutine(routine.id, { visibleInNotice: false });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 transition-colors text-left text-slate-300 hover:text-white"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">알림장에서 숨기기</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
