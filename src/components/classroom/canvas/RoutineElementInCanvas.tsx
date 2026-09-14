"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { EyeOff, RefreshCw, X, Coins, FastForward, RotateCcw, CheckSquare, User } from "lucide-react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme, TaxConfig, LedgerRecord } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat, parsePinchHitters, parsePinchHitterDetails, serializePinchHitters } from "@/lib/routineUtils";
import { checkStudentRoutinePaid } from "@/lib/routinePayStatus";

interface RoutineElementInCanvasProps {
  routine: ClassroomRoutine;
  students: ClassroomStudent[];
  currencyName?: string;
  theme?: BoardTheme;
  customColor?: string;
  taxConfig?: TaxConfig;
  ledgerHistory?: LedgerRecord[];
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
  onSkipRoutineWorker?: (id: string, workerIndex: number) => void;
  onCancelSkipRoutineWorker?: (id: string) => void;
  onUndoLedgerEntry?: (id?: number | string) => void;
  onSelect?: () => void;
}

export default function RoutineElementInCanvas({
  routine,
  students,
  currencyName = "원",
  theme = "chalkboard",
  customColor,
  taxConfig,
  ledgerHistory,
  onPayRoutineToday,
  onUpdateRoutine,
  onAdvanceRoutine,
  onSkipRoutineWorker,
  onCancelSkipRoutineWorker,
  onUndoLedgerEntry,
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
    e.preventDefault(); e.stopPropagation();
    setActivePopupIndex(null); setWorkerPopupPos(null);
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - 250));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - 290));
    setContextMenu({ x, y });
  };

  // 원본 루틴 배정자 (번호일 경우 학생 이름으로 자동 변환)
  const rawWorkers = routine.order.length > 0
    ? Array.from({ length: routine.slots }, (_, i) => resolveStudentName(routine.order[(routine.currentIdx + i) % routine.order.length], students))
    : [];

  const pinchDetails = useMemo(() => parsePinchHitterDetails(routine.pinchHitterStudent), [routine.pinchHitterStudent]);
  const pinchMap = useMemo(() => parsePinchHitters(routine.pinchHitterStudent), [routine.pinchHitterStudent]);

  const handlePinchChange = (val: string) => {
    if (onUpdateRoutine && activePopupIndex !== null) {
      const updated = { ...pinchDetails };
      if (val === "none") delete updated[activePopupIndex];
      else updated[activePopupIndex] = { name: val, isSkip: false };
      onUpdateRoutine(routine.id, { pinchHitterStudent: serializePinchHitters(updated) });
    }
    setActivePopupIndex(null); setWorkerPopupPos(null);
  };

  const handleSkipWorker = (workerIdx: number | null) => {
    if (workerIdx === null) return;
    if (onSkipRoutineWorker) {
      onSkipRoutineWorker(routine.id, workerIdx);
    } else if (onUpdateRoutine && routine.order.length > 1) {
      const nextIdx = (routine.currentIdx + 1) % routine.order.length;
      onUpdateRoutine(routine.id, {
        currentIdx: nextIdx,
        prevIdxBeforeSkip: routine.currentIdx,
        pinchHitterStudent: undefined,
      });
    }
    setActivePopupIndex(null); setWorkerPopupPos(null);
  };

  const handleCancelSkip = (workerIdx: number | null) => {
    if (routine.prevIdxBeforeSkip !== undefined) {
      if (onCancelSkipRoutineWorker) onCancelSkipRoutineWorker(routine.id);
      else if (onUpdateRoutine) onUpdateRoutine(routine.id, { currentIdx: routine.prevIdxBeforeSkip, prevIdxBeforeSkip: undefined });
    } else if (workerIdx !== null && onUpdateRoutine) {
      const updated = { ...pinchDetails };
      delete updated[workerIdx];
      onUpdateRoutine(routine.id, { pinchHitterStudent: serializePinchHitters(updated) });
    }
    setActivePopupIndex(null); setWorkerPopupPos(null);
  };

  const handlePayWorker = (workerName: string) => {
    if (onPayRoutineToday && workerName) onPayRoutineToday(routine.id, [workerName], applyTax);
    setActivePopupIndex(null); setWorkerPopupPos(null);
  };

  const handleCancelPay = (recordId?: number | string) => {
    if (onUndoLedgerEntry && recordId !== undefined) {
      onUndoLedgerEntry(recordId);
    } else {
      try {
        const ch = new BroadcastChannel("classroom_os_sync");
        ch.postMessage({ action: "undo_ledger", id: recordId });
        ch.close();
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("classroom_undo_ledger", { detail: { id: recordId } }));
    }
    setActivePopupIndex(null);
    setWorkerPopupPos(null);
  };

  const workerList = rawWorkers.map((originalName, idx) => {
    const sub = pinchMap[idx];
    const isSub = Boolean(sub && sub !== "none");
    const subName = isSub ? resolveStudentName(sub, students) : "";
    return isSub ? `${subName} (대타)` : originalName;
  });

  const segments = parseRoutineFormat(routine.displayFormat, routine.name, workerList, routine.icon);

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
        parts.push(escapeHtml(seg.text));
      } else {
        const workerIdx = seg.workerIndex ?? 0;
        const originalName = rawWorkers[workerIdx] || "";
        const sub = pinchMap[workerIdx];
        const isSubstituted = Boolean(sub && sub !== "none");
        const currentWorker = isSubstituted ? resolveStudentName(sub, students) : originalName;
        const payStatus = checkStudentRoutinePaid(routine, currentWorker, ledgerHistory);
        let colorCls = "";
        if (payStatus.isPaid) {
          colorCls = theme === "white"
            ? "text-lime-700 bg-lime-100/90 px-1 rounded font-black decoration-lime-600"
            : "text-lime-300 font-extrabold decoration-lime-300 drop-shadow-[0_0_8px_rgba(163,230,53,0.85)]";
        } else if (isSubstituted) {
          colorCls = "text-amber-400 decoration-amber-400";
        } else {
          colorCls = customColor ? "" : workerColor;
        }
        const style = customColor && !isSubstituted && !payStatus.isPaid ? `style="color:${customColor};"` : "";
        const titleText = payStatus.isPaid
          ? `${escapeHtml(currentWorker || "당번")} — ${payStatus.periodLabel} 지급 완료 (${payStatus.paidAt || "방금"}) · 클릭: 급여·대타 메뉴`
          : `${escapeHtml(currentWorker || "당번")} — 클릭: 급여·대타 메뉴`;
        parts.push(
          `<span data-worker-index="${workerIdx}" contenteditable="false" class="font-black underline decoration-2 cursor-pointer select-none whitespace-nowrap transition-all ${colorCls}" ${style} title="${titleText}">${escapeHtml(seg.text)}</span>`
        );
        parts.push(ZWSP);
      }
    });
    return parts.join("");
  }, [segments, rawWorkers, pinchMap, students, customColor, workerColor, routine, ledgerHistory, theme]);

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
    if (!newTemplate) { editableRef.current.innerHTML = routineHtml; return; }
    const defaultTemplate = `${routine.icon ? routine.icon + " " : ""}${routine.name}: ${Array(expectedWorkerCount || 1).fill("?").join(", ")}`.trim();
    const currentEffective = routine.displayFormat?.trim() || defaultTemplate;
    if (newTemplate !== currentEffective) onUpdateRoutine(routine.id, { displayFormat: newTemplate });
    else editableRef.current.innerHTML = routineHtml;
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
    const { startContainer: node, startOffset: offset } = range;
    if (direction === "before") {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").slice(0, offset).replace(/\u200B/g, "").length > 0) return false;
      let curr: Node | null = node.nodeType === Node.TEXT_NODE && node.parentElement !== editableRef.current ? node.parentElement : node;
      if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
        curr = node.childNodes[offset - 1];
        if (curr instanceof HTMLElement && curr.dataset.workerIndex !== undefined) return true;
      }
      let prev = curr?.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? "").replace(/\u200B/g, "") === "") prev = prev.previousSibling;
      return Boolean(prev instanceof HTMLElement && prev.dataset.workerIndex !== undefined);
    }
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").slice(offset).replace(/\u200B/g, "").length > 0) return false;
    let curr: Node | null = node.nodeType === Node.TEXT_NODE && node.parentElement !== editableRef.current ? node.parentElement : node;
    if (node.nodeType === Node.ELEMENT_NODE && offset < node.childNodes.length) {
      curr = node.childNodes[offset];
      if (curr instanceof HTMLElement && curr.dataset.workerIndex !== undefined) return true;
    }
    let next = curr?.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "").replace(/\u200B/g, "") === "") next = next.nextSibling;
    return Boolean(next instanceof HTMLElement && next.dataset.workerIndex !== undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") { e.preventDefault(); editableRef.current?.blur(); return; }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    if (isSelectionDamagingWorkers(sel) && (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1)) {
      e.preventDefault(); return;
    }
    if (sel.isCollapsed && ((e.key === "Backspace" && isWorkerAdjacent("before", sel)) || (e.key === "Delete" && isWorkerAdjacent("after", sel)))) {
      e.preventDefault();
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
      setActivePopupIndex(null); setWorkerPopupPos(null);
    } else {
      const rect = targetEl.getBoundingClientRect();
      let top = rect.top - 298;
      if (top < 10) top = Math.min(window.innerHeight - 300, rect.bottom + 8);
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - 250));
      setWorkerPopupPos({ x: left, y: Math.max(10, top) });
      setActivePopupIndex(workerIdx);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
      onContextMenu={handleContextMenu}
      className="relative w-full leading-snug group"
      style={{ fontSize: "inherit" }}
    >
      <div
        ref={editableRef}
        contentEditable={true}
        suppressContentEditableWarning
        onMouseDown={(e) => {
          e.stopPropagation(); onSelect?.();
          const workerSpan = (e.target as HTMLElement).closest("[data-worker-index]") as HTMLElement | null;
          if (workerSpan) {
            e.preventDefault();
            handleWorkerSpanClick(workerSpan, parseInt(workerSpan.dataset.workerIndex || "0", 10));
            return;
          }
          wasFocusedRef.current = document.activeElement === editableRef.current;
        }}
        onFocus={() => { isFocusedRef.current = true; setIsEditing(true); onSelect?.(); }}
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
                  <FastForward className="w-3.5 h-3.5 text-indigo-300" />
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
          const detail = pinchDetails[workerIdx];
          const isSubstituted = Boolean(detail && detail.name && detail.name !== "none");
          const isSkipped = Boolean(detail?.isSkip);
          const currentWorker = isSubstituted ? resolveStudentName(detail.name, students) : originalName;
          const payStatus = checkStudentRoutinePaid(routine, currentWorker, ledgerHistory);
          const isPaid = payStatus.isPaid;

          return (
            <>
              <div className="fixed inset-0 z-[99998]" onClick={(e) => { e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActivePopupIndex(null); setWorkerPopupPos(null); }} />
              <div
                className="fixed z-[99999] min-w-[220px] max-w-[280px] bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl text-xs space-y-2.5 text-white select-none"
                style={{ left: workerPopupPos.x, top: workerPopupPos.y }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                  <span className="font-extrabold text-white flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span className={isPaid ? "text-lime-300 font-black" : "text-amber-300"}>{currentWorker}</span>
                    {isSubstituted && <span className="text-[10px] text-amber-400 font-bold">({isSkipped ? "건너뜀" : "대타"})</span>}
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

                {/* 건너뛰기 및 취소 버튼 */}
                <div className="pt-0.5 pb-1 border-b border-white/10 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSkipWorker(workerIdx)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30"
                    title={isSubstituted ? "다음 순번 학생으로 다시 건너뜁니다" : "이 학생을 건너뛰고 다음 순번 학생을 대타로 지정합니다"}
                  >
                    <FastForward className="w-3.5 h-3.5" /><span>이 학생 건너뛰기</span>
                  </button>
                  {(isSubstituted || routine.prevIdxBeforeSkip !== undefined) && (
                    <button
                      type="button"
                      onClick={() => handleCancelSkip(workerIdx)}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-rose-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-rose-500/30"
                      title={routine.prevIdxBeforeSkip !== undefined || isSkipped ? "건너뛰기를 취소하고 원래 순번으로 복원합니다" : "대타 지정을 취소하고 원래 당번 학생으로 복원합니다"}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /><span>{routine.prevIdxBeforeSkip !== undefined || isSkipped ? "건너뛰기 취소" : "대타 취소"}</span>
                    </button>
                  )}
                </div>

                {onUpdateRoutine && students.length > 0 && (
                  <div className="space-y-1.5 pb-2 border-b border-white/10">
                    <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      <span>{isSubstituted ? "대타 변경" : "대타 직접 지정"}</span>
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {students.map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => handlePinchChange(s.name)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${currentWorker === s.name ? (isPaid ? "bg-lime-400 text-slate-900 font-black shadow-xs" : "bg-amber-400 text-slate-900 shadow-xs") : "bg-white/10 hover:bg-white/20 text-white/90"}`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-0.5 space-y-1.5">
                  {!isPaid && (
                    <label className="flex items-center gap-1.5 px-0.5 text-[11px] text-slate-300 cursor-pointer select-none">
                      <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded text-indigo-500 w-3 h-3" />
                      <span>세금 부과</span>
                    </label>
                  )}
                  {isPaid ? (
                    <button
                      type="button"
                      onClick={() => handleCancelPay(payStatus.recordId)}
                      className="w-full py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      title="이 당번의 급여 지급을 취소하고 원래 잔액으로 복원합니다"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>지급 취소</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePayWorker(currentWorker)}
                      disabled={routine.pay <= 0 || !onPayRoutineToday}
                      className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>급여 지급 ({routine.pay.toLocaleString()}{currencyName})</span>
                    </button>
                  )}
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
