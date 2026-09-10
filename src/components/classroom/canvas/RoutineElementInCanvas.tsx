"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { EyeOff, RefreshCw, X, Coins, ArrowRight, CheckSquare, User, ChevronRight } from "lucide-react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat } from "@/lib/routineUtils";

interface RoutineElementInCanvasProps {
  routine: ClassroomRoutine;
  students: ClassroomStudent[];
  currencyName?: string;
  theme?: BoardTheme;
  customColor?: string;
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
  onPayAllRoutinesToday?: () => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
  onSelect?: () => void;
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
  onSelect,
}: RoutineElementInCanvasProps) {
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const [workerPopupPos, setWorkerPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pinchSubmenuOpen, setPinchSubmenuOpen] = useState(false);
  const [applyTax, setApplyTax] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const workerColor = theme === "white" ? "text-indigo-700" : theme === "warm" ? "text-rose-700" : "text-amber-300";
  const routineTextColor = theme === "white" ? "text-slate-900" : theme === "warm" ? "text-amber-950" : theme === "navy" ? "text-slate-200" : "text-white/90";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePopupIndex(null);
    setWorkerPopupPos(null);
    setPinchSubmenuOpen(false);
    const menuWidth = 240;
    const menuHeight = 280;
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
      onUpdateRoutine(routine.id, { pinchHitterStudent: val === "none" ? undefined : val });
    }
    setActivePopupIndex(null);
    setWorkerPopupPos(null);
    setPinchSubmenuOpen(false);
  };

  const handlePayWorker = (workerName: string) => {
    if (onPayRoutineToday && workerName) {
      onPayRoutineToday(routine.id, [workerName], applyTax);
    }
    setActivePopupIndex(null);
    setWorkerPopupPos(null);
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

  const isFocusedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const routineHtml = useMemo(() => {
    return segments
      .map((seg) => {
        if (seg.type === "text") {
          return `<span class="whitespace-pre">${escapeHtml(seg.text)}</span>`;
        }
        const workerIdx = seg.workerIndex ?? 0;
        const originalName = rawWorkers[workerIdx] || "";
        const isSubstituted = Boolean(pinchHitter && workerIdx === 0);
        const currentWorker = isSubstituted ? pinchHitter : originalName;
        const colorCls = isSubstituted
          ? "text-amber-400 decoration-amber-400"
          : customColor
          ? ""
          : workerColor;
        const style = customColor && !isSubstituted ? `style="color:${customColor};"` : "";
        return `<span data-worker-index="${workerIdx}" class="font-black underline decoration-2 cursor-pointer select-none whitespace-nowrap transition-all ${colorCls}" ${style} title="${escapeHtml(
          currentWorker || "당번"
        )} — 클릭: 급여·대타 메뉴">${escapeHtml(seg.text)}</span>`;
      })
      .join("");
  }, [segments, rawWorkers, pinchHitter, customColor, workerColor]);

  // 포커스 해제 상태일 때만 DOM innerHTML 동기화 (React 가상 DOM 충돌 방지)
  useEffect(() => {
    if (editableRef.current && !isFocusedRef.current) {
      editableRef.current.innerHTML = routineHtml;
    }
  }, [routineHtml]);

  const extractTemplateFromDOM = (container: HTMLElement): string => {
    let result = "";
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? "";
      } else if (node instanceof HTMLElement && node.dataset.workerIndex !== undefined) {
        result += "?";
      } else if (node instanceof HTMLElement) {
        if (node.querySelector("[data-worker-index]")) {
          result += "?";
        } else {
          result += node.innerText ?? node.textContent ?? "";
        }
      }
    }
    return result.replace(/\u200B/g, "").trim();
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    setIsEditing(false);
    if (!editableRef.current || !onUpdateRoutine) return;
    const newTemplate = extractTemplateFromDOM(editableRef.current);
    if (newTemplate && newTemplate !== (routine.displayFormat ?? "")) {
      onUpdateRoutine(routine.id, { displayFormat: newTemplate });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editableRef.current?.blur();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    document.execCommand("insertText", false, text);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const workerSpan = target.closest("[data-worker-index]") as HTMLElement | null;
    if (workerSpan) {
      e.stopPropagation();
      const workerIdx = parseInt(workerSpan.dataset.workerIndex || "0", 10);
      handleWorkerSpanClick(e, workerIdx);
      return;
    }

    const sel = window.getSelection();
    const hasRangeSelection = sel && !sel.isCollapsed && (sel.toString().length > 0);

    // 비연속 클릭: 미포커스 상태에서 첫 진입 시 편집 모드 + 전체 블록 선택
    // (단, 사용자가 드래그하여 일부 텍스트 블록을 지정한 경우 전체 선택으로 덮어쓰지 않음)
    if (!hasRangeSelection && !isFocusedRef.current) {
      onSelect?.();
      setIsEditing(true);
      isFocusedRef.current = true;
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.focus();
          const range = document.createRange();
          range.selectNodeContents(editableRef.current);
          const sel2 = window.getSelection();
          sel2?.removeAllRanges();
          sel2?.addRange(range);
        }
      }, 30);
    }
    // 연속 클릭: 이미 포커스된 상태에서는 브라우저 기본 커서 이동
  };

  // 이름 세그먼트 클릭 시 팝오버 열기 (포털 뷰포트 좌표 산출)
  const handleWorkerSpanClick = (e: React.MouseEvent, workerIdx: number) => {
    e.stopPropagation();
    if (activePopupIndex === workerIdx) {
      setActivePopupIndex(null);
      setWorkerPopupPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const popupWidth = 240;
      const popupHeight = 290;
      let top = rect.top - popupHeight - 8;
      if (top < 10) {
        top = Math.min(window.innerHeight - popupHeight - 10, rect.bottom + 8);
      }
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - popupWidth - 10));
      setWorkerPopupPos({ x: left, y: Math.max(10, top) });
      setActivePopupIndex(workerIdx);
    }
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className="relative inline-flex items-center leading-snug group"
      style={{ fontSize: "inherit" }}
    >
      <div
        ref={editableRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onFocus={() => {
          isFocusedRef.current = true;
          setIsEditing(true);
        }}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`outline-none rounded px-0.5 inline-flex items-center flex-wrap gap-0 transition-all cursor-text select-text routine-text-editor ${customColor ? "" : routineTextColor}`}
        style={customColor ? { color: customColor } : undefined}
        title={isEditing ? "텍스트 수정 중 (Enter로 완료)" : "클릭: 서식 전체 선택 / 당번 클릭: 급여·대타 메뉴"}
      />

      {/* 우클릭 최상위 포털 컨텍스트 메뉴 */}
      {mounted && contextMenu && createPortal(
        <>
          {/* 전체화면 투명 백드롭 (뒤쪽 알림장 및 글상자 클릭 차단) */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); setPinchSubmenuOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); setPinchSubmenuOpen(false); }}
          />

          {/* 컨텍스트 메뉴 창 */}
          <div
            className="fixed z-[99999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-white text-xs overflow-hidden select-none"
            style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 210 }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {/* 헤더 */}
            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold text-white/90 truncate">{routine.name}</span>
            </div>

            <div className="p-1.5 space-y-0.5">
              {/* 이 업무 급여 지급 */}
              {onPayRoutineToday && (
                <button
                  type="button"
                  disabled={routine.pay <= 0 || rawWorkers.length === 0}
                  onClick={() => { onPayRoutineToday(routine.id, undefined, false); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold">이 업무 급여 지급</span>
                  {routine.pay > 0 && <span className="ml-auto text-amber-300 font-bold">{routine.pay.toLocaleString()}{currencyName}</span>}
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
                  <Coins className="w-3.5 h-3.5" />
                  <span>전체 업무 급여 일괄 지급</span>
                </button>
              )}

              <div className="h-px bg-white/10 my-0.5" />

              {/* 다음 순서로 */}
              {onAdvanceRoutine && (
                <button
                  type="button"
                  onClick={() => {
                    onAdvanceRoutine(routine.id);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 transition-colors text-left font-medium"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="font-semibold">다음 순서로</span>
                </button>
              )}

              {/* 대타 지정 / 대타 취소 / 대타 변경 */}
              {onUpdateRoutine && students.length > 0 && (
                <div className="space-y-1">
                  {pinchHitter && (
                    <button
                      type="button"
                      onClick={() => {
                        handlePinchChange("none");
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors text-left font-medium"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="font-semibold">대타 취소 ({pinchHitter})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPinchSubmenuOpen(!pinchSubmenuOpen)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-left font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                      <span className="font-semibold">{pinchHitter ? "대타 변경" : "대타 지정"}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${pinchSubmenuOpen ? "rotate-90" : ""}`} />
                  </button>
                  {pinchSubmenuOpen && (
                    <div className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {students.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => {
                            handlePinchChange(s.name);
                            setContextMenu(null);
                            setPinchSubmenuOpen(false);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                            pinchHitter === s.name ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="h-px bg-white/10 my-0.5" />

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
        </>,
        document.body
      )}

      {/* 당번 클릭 급여/대타 최상위 포털 팝오버 */}
      {mounted && activePopupIndex !== null && workerPopupPos && createPortal(
        (() => {
          const workerIdx = activePopupIndex;
          const originalName = rawWorkers[workerIdx] || "";
          const isSubstituted = Boolean(pinchHitter && workerIdx === 0);
          const currentWorker = isSubstituted ? pinchHitter : originalName;

          return (
            <>
              {/* 전체화면 투명 백드롭 (외부 클릭 시 팝업 닫기) */}
              <div
                className="fixed inset-0 z-[99998]"
                onClick={(e) => { e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }}
              />

              {/* 당번 급여 및 대타 팝오버 창 */}
              <div
                className="fixed z-[99999] min-w-[220px] max-w-[280px] bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl text-xs space-y-2.5 text-white select-none"
                style={{ left: workerPopupPos.x, top: workerPopupPos.y }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                  <span className="font-extrabold text-white flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-amber-300">{currentWorker}</span>
                    {isSubstituted && <span className="text-[10px] text-amber-400 font-bold">(대타)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePopupIndex(null);
                      setWorkerPopupPos(null);
                    }}
                    className="text-white/40 hover:text-white p-0.5 leading-none"
                    title="닫기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {onUpdateRoutine && students.length > 0 && (
                  <div className="space-y-1.5 pb-2 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        <span>{isSubstituted ? "대타 변경" : "대타 지정"}</span>
                      </span>
                      {isSubstituted && (
                        <button
                          type="button"
                          onClick={() => handlePinchChange("none")}
                          className="text-[10px] text-rose-300 hover:text-rose-200 underline font-bold flex items-center gap-0.5"
                        >
                          <X className="w-2.5 h-2.5" /><span>대타 취소</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {students.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => handlePinchChange(s.name)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                            currentWorker === s.name
                              ? "bg-amber-400 text-slate-900 shadow-xs"
                              : "bg-white/10 hover:bg-white/20 text-white/90"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onAdvanceRoutine && (
                  <div className="pt-0.5 pb-1 border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        onAdvanceRoutine(routine.id);
                        setActivePopupIndex(null);
                        setWorkerPopupPos(null);
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /><span>다음 순서로</span>
                    </button>
                  </div>
                )}

                <div className="pt-0.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 px-0.5 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded text-indigo-500 w-3 h-3" />
                    <span>세금 공제</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePayWorker(currentWorker)}
                    disabled={routine.pay <= 0 || !onPayRoutineToday}
                    className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>급여 지급 ({routine.pay.toLocaleString()}{currencyName})</span>
                  </button>
                </div>
              </div>
            </>
          );
        })(),
        document.body
      )}
    </div>
  );
}
