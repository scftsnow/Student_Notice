"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { EyeOff, RefreshCw, X, Coins, ArrowRight, CheckSquare, User } from "lucide-react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme, TaxConfig } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat } from "@/lib/routineUtils";

interface RoutineElementInCanvasProps {
  routine: ClassroomRoutine;
  students: ClassroomStudent[];
  currencyName?: string;
  theme?: BoardTheme;
  customColor?: string;
  taxConfig?: TaxConfig;
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
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
  taxConfig,
  onPayRoutineToday,
  onUpdateRoutine,
  onAdvanceRoutine,
  onSelect,
}: RoutineElementInCanvasProps) {
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const [workerPopupPos, setWorkerPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isTaxOn = taxConfig
    ? taxConfig.taxMethod !== "TAX_FREE" && (taxConfig.taxRate ?? taxConfig.incomeTaxValue ?? 10) > 0
    : true;
  const [applyTax, setApplyTax] = useState(isTaxOn);

  useEffect(() => {
    setApplyTax(isTaxOn);
  }, [isTaxOn]);
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
  const wasFocusedRef = useRef(false);
  const lastGoodHtmlRef = useRef<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  const escapeHtml = (str: string): string =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const ZWSP = "\u200B";

  const routineHtml = useMemo(() => {
    const parts: string[] = [ZWSP];
    segments.forEach((seg) => {
      if (seg.type === "text") {
        // NOTE: plain text node (HTML-escaped). 컨테이너에 white-space: pre-wrap을 적용하므로
        // span.whitespace-pre 래핑 불필요. Chromium/Edge에서 white-space:pre span이
        // contenteditable 편집 진입 시 width:0으로 collapse되는 버그를 우회.
        parts.push(escapeHtml(seg.text));
      } else {
        const workerIdx = seg.workerIndex ?? 0;
        const originalName = rawWorkers[workerIdx] || "";
        const isSubstituted = Boolean(pinchHitter && workerIdx === 0);
        const currentWorker = isSubstituted ? pinchHitter : originalName;
        const colorCls = isSubstituted ? "text-amber-400 decoration-amber-400" : customColor ? "" : workerColor;
        const style = customColor && !isSubstituted ? `style="color:${customColor};"` : "";
        parts.push(
          `<span data-worker-index="${workerIdx}" contenteditable="false" class="font-black underline decoration-2 cursor-pointer select-none whitespace-nowrap transition-all ${colorCls}" ${style} title="${escapeHtml(
            currentWorker || "당번"
          )} — 클릭: 급여·대타 메뉴">${escapeHtml(seg.text)}</span>`
        );
        parts.push(ZWSP);
      }
    });
    return parts.join("");
  }, [segments, rawWorkers, pinchHitter, customColor, workerColor]);

  const expectedWorkerCount = segments.filter((s) => s.type === "worker").length;

  useEffect(() => {
    if (editableRef.current && !isFocusedRef.current) {
      editableRef.current.innerHTML = routineHtml;
      lastGoodHtmlRef.current = routineHtml;
    }
  }, [routineHtml]);

  // 재귀적 노드 탐색으로 래핑 태그에 상관없이 안전하게 ? 플레이스홀더 템플릿 추출
  const extractTemplateFromNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node instanceof HTMLElement) {
      if (node.dataset.workerIndex !== undefined || node.getAttribute("data-worker-index") !== null) return "?";
      let acc = "";
      for (const child of Array.from(node.childNodes)) acc += extractTemplateFromNode(child);
      return acc;
    }
    return "";
  };

  const extractTemplateFromDOM = (container: HTMLElement): string =>
    extractTemplateFromNode(container).replace(/\u200B/g, "").trim();

  const handleBlur = () => {
    isFocusedRef.current = false;
    wasFocusedRef.current = false;
    setIsEditing(false);
    if (!editableRef.current || !onUpdateRoutine) return;

    const newTemplate = extractTemplateFromDOM(editableRef.current);
    if (!newTemplate) {
      editableRef.current.innerHTML = routineHtml;
      return;
    }

    const defaultTemplate = `${routine.icon ? routine.icon + " " : ""}${routine.name}: ${Array(expectedWorkerCount || 1).fill("?").join(", ")}`.trim();
    const currentEffective = routine.displayFormat?.trim() || defaultTemplate;

    if (newTemplate !== currentEffective) {
      onUpdateRoutine(routine.id, { displayFormat: newTemplate });
    } else {
      editableRef.current.innerHTML = routineHtml;
    }
  };

  // 선택 영역에 worker span이 포함되어 있는지 확인
  const isSelectionDamagingWorkers = (sel: Selection): boolean => {
    if (!sel.rangeCount || sel.isCollapsed) return false;
    return Boolean(sel.getRangeAt(0).cloneContents().querySelector("[data-worker-index]"));
  };

  // 커서 바로 앞/뒤에 worker span이 맞닿아 있는지 정확하게 검사 (Backspace/Delete 키용)
  const isWorkerAdjacent = (direction: "before" | "after", sel: Selection): boolean => {
    if (!sel.rangeCount || !editableRef.current) return false;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;

    if (direction === "before") {
      if (node.nodeType === Node.TEXT_NODE) {
        const textBefore = (node.textContent ?? "").slice(0, offset).replace(/\u200B/g, "");
        if (textBefore.length > 0) return false;
      }
      let curr: Node | null = node.nodeType === Node.TEXT_NODE && node.parentElement !== editableRef.current
        ? node.parentElement
        : node;
      if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
        curr = node.childNodes[offset - 1];
        if (curr instanceof HTMLElement && curr.dataset.workerIndex !== undefined) return true;
      }
      let prev = curr?.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? "").replace(/\u200B/g, "") === "") {
        prev = prev.previousSibling;
      }
      return Boolean(prev instanceof HTMLElement && prev.dataset.workerIndex !== undefined);
    } else {
      if (node.nodeType === Node.TEXT_NODE) {
        const textAfter = (node.textContent ?? "").slice(offset).replace(/\u200B/g, "");
        if (textAfter.length > 0) return false;
      }
      let curr: Node | null = node.nodeType === Node.TEXT_NODE && node.parentElement !== editableRef.current
        ? node.parentElement
        : node;
      if (node.nodeType === Node.ELEMENT_NODE && offset < node.childNodes.length) {
        curr = node.childNodes[offset];
        if (curr instanceof HTMLElement && curr.dataset.workerIndex !== undefined) return true;
      }
      let next = curr?.nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "").replace(/\u200B/g, "") === "") {
        next = next.nextSibling;
      }
      return Boolean(next instanceof HTMLElement && next.dataset.workerIndex !== undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editableRef.current?.blur();
      return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    if (isSelectionDamagingWorkers(sel)) {
      if (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1) {
        e.preventDefault();
        return;
      }
    }

    if (sel.isCollapsed) {
      if ((e.key === "Backspace" && isWorkerAdjacent("before", sel)) || (e.key === "Delete" && isWorkerAdjacent("after", sel))) {
        e.preventDefault();
      }
    }
  };

  const handleInput = () => {
    if (!editableRef.current) return;
    const currentCount = editableRef.current.querySelectorAll("[data-worker-index]").length;
    if (currentCount < expectedWorkerCount) {
      // 학생 이름 span 삭제 감지 -> 즉각 백업 복원
      editableRef.current.innerHTML = lastGoodHtmlRef.current;
      return;
    }
    lastGoodHtmlRef.current = editableRef.current.innerHTML;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && isSelectionDamagingWorkers(sel)) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    document.execCommand("insertText", false, text);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
    const target = e.target as HTMLElement;
    const workerSpan = target.closest("[data-worker-index]") as HTMLElement | null;

    if (workerSpan) {
      handleWorkerSpanClick(workerSpan, parseInt(workerSpan.dataset.workerIndex || "0", 10));
      return;
    }

    setIsEditing(true);
    isFocusedRef.current = true;
    wasFocusedRef.current = true;
  };

  // 이름 세그먼트 클릭 시 팝오버 열기 (포털 뷰포트 좌표 산출)
  const handleWorkerSpanClick = (targetEl: HTMLElement, workerIdx: number) => {
    if (activePopupIndex === workerIdx) {
      setActivePopupIndex(null);
      setWorkerPopupPos(null);
    } else {
      const rect = targetEl.getBoundingClientRect();
      const popupWidth = 240;
      const popupHeight = 290;
      let top = rect.top - popupHeight - 8;
      if (top < 10) top = Math.min(window.innerHeight - popupHeight - 10, rect.bottom + 8);
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - popupWidth - 10));
      setWorkerPopupPos({ x: left, y: Math.max(10, top) });
      setActivePopupIndex(workerIdx);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onContextMenu={handleContextMenu}
      className="relative inline-flex items-center leading-snug group"
      style={{ fontSize: "inherit" }}
    >
      <div
        ref={editableRef}
        contentEditable={true}
        suppressContentEditableWarning
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect?.();
          const workerSpan = (e.target as HTMLElement).closest("[data-worker-index]") as HTMLElement | null;
          if (workerSpan) {
            e.preventDefault();
            const workerIdx = parseInt(workerSpan.dataset.workerIndex || "0", 10);
            handleWorkerSpanClick(workerSpan, workerIdx);
            return;
          }
          wasFocusedRef.current = document.activeElement === editableRef.current;
        }}
        onFocus={() => {
          isFocusedRef.current = true;
          setIsEditing(true);
          onSelect?.();
        }}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        className={`outline-none rounded px-1 inline-block transition-all cursor-text select-text routine-text-editor ${customColor ? "" : routineTextColor}`}
        style={customColor ? { color: customColor, whiteSpace: "pre-wrap" } : { whiteSpace: "pre-wrap" }}
        title={isEditing ? "텍스트 수정 중 (Enter로 완료)" : "클릭: 서식 편집 / 당번 클릭: 급여·대타 메뉴"}
      />

      {/* 우클릭 최상위 포털 컨텍스트 메뉴 */}
      {mounted && contextMenu && createPortal(
        <>
          {/* 전체화면 투명 백드롭 (뒤쪽 알림장 및 글상자 클릭 차단) */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); }}
          />

          {/* 컨텍스트 메뉴 창 */}
          <div
            className="fixed z-[99999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-white text-xs overflow-hidden select-none"
            style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 210 }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold text-white/90 truncate">{routine.name}</span>
            </div>

            <div className="p-1.5 space-y-0.5">
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

              <div className="h-px bg-white/10 my-0.5" />

              {onAdvanceRoutine && (
                <button
                  type="button"
                  onClick={() => { onAdvanceRoutine(routine.id); setContextMenu(null); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 transition-colors text-left font-medium"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="font-semibold">다음 순서로</span>
                </button>
              )}

              <div className="h-px bg-white/10 my-0.5" />

              {onUpdateRoutine && (
                <button
                  type="button"
                  onClick={() => { onUpdateRoutine(routine.id, { visibleInNotice: false }); setContextMenu(null); }}
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
              <div
                className="fixed inset-0 z-[99998]"
                onClick={(e) => { e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }}
              />
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
                    onClick={() => { setActivePopupIndex(null); setWorkerPopupPos(null); }}
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
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${currentWorker === s.name ? "bg-amber-400 text-slate-900 shadow-xs" : "bg-white/10 hover:bg-white/20 text-white/90"}`}
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
                      onClick={() => { onAdvanceRoutine(routine.id); setActivePopupIndex(null); setWorkerPopupPos(null); }}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /><span>다음 순서로</span>
                    </button>
                  </div>
                )}

                <div className="pt-0.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 px-0.5 text-[11px] text-slate-300 cursor-pointer select-none">
                    <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded text-indigo-500 w-3 h-3" />
                    <span>세금 부과</span>
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
