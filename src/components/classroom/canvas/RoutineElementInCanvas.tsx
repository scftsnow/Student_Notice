"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { EyeOff, RefreshCw, Coins, FastForward, RotateCcw, CheckSquare, Copy } from "lucide-react";
import { ClassroomRoutine, ClassroomStudent, BoardTheme, TaxConfig, LedgerRecord } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat, parsePinchHitterDetails, serializePinchHitters, getActiveRoutineWorkers } from "@/lib/routineUtils";
import { checkStudentRoutinePaid } from "@/lib/routinePayStatus";
import {
  BOARD_NAME_SPAN_CLASS,
  boardNameColor,
  boardTextColor,
  contextMenuPos,
  copyToClipboard,
  editableKeyGuard,
  editablePasteGuard,
  escapeHtml,
  extractTemplateFromDOM,
  popupAnchorFrom,
  BoardContextMenu,
  BoardElementShell,
  BoardItemPopup,
  BoardItemPopupHeader,
  useMounted,
  type ContextMenuItem,
  type PopupAnchor,
} from "./boardElementShared";

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
  routine, students, currencyName = "원", theme = "chalkboard", customColor,
  taxConfig, ledgerHistory, onPayRoutineToday, onUpdateRoutine, onAdvanceRoutine,
  onSkipRoutineWorker, onCancelSkipRoutineWorker, onUndoLedgerEntry, onSelect,
}: RoutineElementInCanvasProps) {
  const [activePopupIndex, setActivePopupIndex] = useState<number | null>(null);
  const [workerAnchor, setWorkerAnchor] = useState<PopupAnchor | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isTaxOn = taxConfig
    ? taxConfig.taxMethod !== "TAX_FREE" && (taxConfig.taxRate ?? taxConfig.incomeTaxValue ?? 10) > 0
    : true;
  const [applyTax, setApplyTax] = useState(isTaxOn);

  useEffect(() => {
    setApplyTax(isTaxOn);
  }, [isTaxOn]);
  const mounted = useMounted();
  const containerRef = useRef<HTMLDivElement>(null);

  const workerColor = boardNameColor(theme);
  const routineTextColor = boardTextColor(theme);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setActivePopupIndex(null); setWorkerAnchor(null);
    setContextMenu(contextMenuPos(e));
  };

  // 현재 활성 당번 목록 (건너뛰기 반영, 대타 태그 미포함)
  const rawWorkers = useMemo(
    () => getActiveRoutineWorkers(routine, students, false),
    [routine, students]
  );
  // 표시용 당번 목록 (대타 지정 시 대타 이름만 표시, '(대타)' 태그 없음)
  const workerList = useMemo(
    () => getActiveRoutineWorkers(routine, students, false),
    [routine, students]
  );

  const pinchDetails = useMemo(() => parsePinchHitterDetails(routine.pinchHitterStudent), [routine.pinchHitterStudent]);

  const handlePinchChange = (val: string) => {
    if (onUpdateRoutine && activePopupIndex !== null) {
      const updated = { ...pinchDetails };
      if (val === "none") delete updated[activePopupIndex];
      else updated[activePopupIndex] = { name: val, isSkip: false };
      onUpdateRoutine(routine.id, { pinchHitterStudent: serializePinchHitters(updated) });
    }
    setActivePopupIndex(null); setWorkerAnchor(null);
  };

  const handleSkipWorker = (workerIdx: number | null) => {
    if (workerIdx === null) return;
    if (onSkipRoutineWorker) {
      onSkipRoutineWorker(routine.id, workerIdx);
    } else if (onUpdateRoutine && rawWorkers[workerIdx]) {
      onUpdateRoutine(routine.id, {
        skipHistory: [...(routine.skipHistory || []), rawWorkers[workerIdx]],
      });
    }
    setActivePopupIndex(null); setWorkerAnchor(null);
  };

  const handleCancelSkip = () => {
    if (onCancelSkipRoutineWorker) {
      onCancelSkipRoutineWorker(routine.id);
    } else if (onUpdateRoutine && routine.skipHistory && routine.skipHistory.length > 0) {
      const hist = [...routine.skipHistory];
      hist.pop();
      onUpdateRoutine(routine.id, { skipHistory: hist.length > 0 ? hist : undefined });
    }
    setActivePopupIndex(null); setWorkerAnchor(null);
  };

  const handleCancelPinch = (workerIdx: number | null) => {
    if (workerIdx !== null && onUpdateRoutine) {
      const updated = { ...pinchDetails };
      delete updated[workerIdx];
      onUpdateRoutine(routine.id, { pinchHitterStudent: serializePinchHitters(updated) });
    }
    setActivePopupIndex(null); setWorkerAnchor(null);
  };

  const handlePayWorker = (workerName: string) => {
    if (onPayRoutineToday && workerName) onPayRoutineToday(routine.id, [workerName], applyTax);
    setActivePopupIndex(null); setWorkerAnchor(null);
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
  setWorkerAnchor(null);
  };

  const segments = parseRoutineFormat(routine.displayFormat, routine.name, workerList, routine.icon);

  const routinePlainText = useMemo(
    () => segments.map((seg) => seg.text).join(""),
    [segments]
  );

  const handleCopyContent = async () => {
    const text = routinePlainText.trim();
    if (!text) {
      setContextMenu(null);
      return;
    }
    await copyToClipboard(text);
    setContextMenu(null);
  };

  const isFocusedRef = useRef(false);
  const wasFocusedRef = useRef(false);
  const lastGoodHtmlRef = useRef<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  const ZWSP = "\u200B";

  const routineHtml = useMemo(() => {
    const parts: string[] = [ZWSP];
    segments.forEach((seg) => {
      if (seg.type === "text") {
        parts.push(escapeHtml(seg.text));
      } else {
        const workerIdx = seg.workerIndex ?? 0;
        const currentWorker = rawWorkers[workerIdx] || "";
        const detail = pinchDetails[workerIdx];
        const isSubstituted = Boolean(detail && detail.name && detail.name !== "none");
        const payStatus = checkStudentRoutinePaid(routine, currentWorker, ledgerHistory);
        const colorCls = payStatus.isPaid
          ? theme === "white"
            ? "text-lime-700 bg-lime-100/90 px-1 rounded font-black decoration-lime-600"
            : "text-lime-300 font-extrabold decoration-lime-300 drop-shadow-[0_0_8px_rgba(163,230,53,0.85)]"
          : isSubstituted ? "text-amber-400 decoration-amber-400" : customColor ? "" : workerColor;
        const style = customColor && !isSubstituted && !payStatus.isPaid ? `style="color:${customColor};"` : "";
        const titleText = payStatus.isPaid
          ? `${escapeHtml(currentWorker || "당번")} — ${payStatus.periodLabel} 지급 완료 (${payStatus.paidAt || "방금"}) · 클릭: 메뉴`
          : `${escapeHtml(currentWorker || "당번")} — 클릭: 메뉴`;
        parts.push(
          `<span data-worker-index="${workerIdx}" contenteditable="false" class="font-black underline decoration-2 cursor-pointer select-none whitespace-nowrap transition-all ${colorCls}" ${style} title="${titleText}">${escapeHtml(seg.text)}</span>`,
          ZWSP
        );
      }
    });
    return parts.join("");
  }, [segments, rawWorkers, pinchDetails, customColor, workerColor, routine, ledgerHistory, theme]);

  const expectedWorkerCount = segments.filter((s) => s.type === "worker").length;

  useEffect(() => {
    if (editableRef.current && !isFocusedRef.current) {
      editableRef.current.innerHTML = routineHtml;
      lastGoodHtmlRef.current = routineHtml;
    }
  }, [routineHtml]);


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
      setActivePopupIndex(null); setWorkerAnchor(null);
    } else {
      // 위치는 팝오버가 자기 높이를 재서 붙인다 (과제 요소와 동일)
      setWorkerAnchor(popupAnchorFrom(targetEl));
      setActivePopupIndex(workerIdx);
    }
  };

  /** 우클릭 컨텍스트 메뉴 항목 (공용 셸이 그린다) */
  const routineMenuItems: ContextMenuItem[] = [
    ...(onPayRoutineToday
      ? [
          {
            key: "pay",
            label: "이 업무 급여 지급",
            icon: <Coins className="w-3.5 h-3.5 text-amber-400" />,
            disabled: routine.pay <= 0 || rawWorkers.length === 0,
            trailing: routine.pay > 0 ? (
              <span className="text-amber-300 font-bold">
                {routine.pay.toLocaleString()}
                {currencyName}
              </span>
            ) : null,
            onClick: () => {
              onPayRoutineToday(routine.id, undefined, false);
              setContextMenu(null);
            },
          } satisfies ContextMenuItem,
        ]
      : []),
    ...(routine.skipHistory && routine.skipHistory.length > 0
      ? [
          {
            key: "cancelSkip",
            label: `건너뛰기 취소 (${routine.skipHistory.length})`,
            icon: <RotateCcw className="w-3.5 h-3.5" />,
            labelClass: "text-rose-300 hover:text-rose-200",
            onClick: () => {
              handleCancelSkip();
              setContextMenu(null);
            },
          } satisfies ContextMenuItem,
        ]
      : []),
    { key: "d1", divider: true },
    ...(onAdvanceRoutine
      ? [
          {
            key: "advance",
            label: "다음 순서로",
            icon: <FastForward className="w-3.5 h-3.5 text-indigo-300" />,
            onClick: () => {
              onAdvanceRoutine(routine.id);
              setContextMenu(null);
            },
          } satisfies ContextMenuItem,
        ]
      : []),
    { key: "d2", divider: true },
    {
      key: "copy",
      label: "내용 복사",
      icon: <Copy className="w-3.5 h-3.5 text-slate-300" />,
      onClick: handleCopyContent,
    },
    ...(onUpdateRoutine
      ? [
          {
            key: "hide",
            label: "알림장에서 숨기기",
            icon: <EyeOff className="w-3.5 h-3.5 text-slate-400" />,
            labelClass: "text-slate-300 hover:text-white",
            onClick: () => {
              onUpdateRoutine(routine.id, { visibleInNotice: false });
              setContextMenu(null);
            },
          } satisfies ContextMenuItem,
        ]
      : []),
  ];

  return (
    <BoardElementShell onSelect={onSelect} onContextMenu={handleContextMenu}>
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
        onKeyDown={(e) => editableKeyGuard(e, editableRef.current)}
        onInput={handleInput}
        onPaste={editablePasteGuard}
          className={`outline-none rounded inline-block transition-all cursor-text select-text routine-text-editor ${customColor ? "" : routineTextColor}`}
          style={customColor ? { color: customColor, whiteSpace: "pre-wrap", letterSpacing: "-0.02em" } : { whiteSpace: "pre-wrap", letterSpacing: "-0.02em" }}
        title={isEditing ? "텍스트 수정 중 (Enter로 완료)" : "클릭: 서식 편집 / 당번 클릭: 급여·대타 메뉴"}
      />

      {/* 우클릭 컨텍스트 메뉴 (공용 셸 — 과제 요소와 동일) */}
      {mounted && contextMenu && (
        <BoardContextMenu
          pos={contextMenu}
          title={routine.name}
          icon={<CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />}
          items={routineMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 당번 클릭 급여/대타 최상위 포털 팝오버 (공용 셸) */}
      {mounted && activePopupIndex !== null && workerAnchor && (() => {
        const workerIdx = activePopupIndex;
        const currentWorker = rawWorkers[workerIdx] || "";
        const detail = pinchDetails[workerIdx];
        const isSubstituted = Boolean(detail && detail.name && detail.name !== "none");
        const payStatus = checkStudentRoutinePaid(routine, currentWorker, ledgerHistory);
        const isPaid = payStatus.isPaid;

        return (
          <BoardItemPopup
          anchor={workerAnchor}
            onClose={() => { setActivePopupIndex(null); setWorkerAnchor(null); }}
            header={
              <BoardItemPopupHeader
                name={currentWorker || "당번"}
                nameClass={isPaid ? "text-lime-300 font-black" : "text-amber-300"}
                tag={isSubstituted ? <span className="text-[10px] text-amber-400 font-bold">(대타)</span> : null}
              />
            }
          >
            {/* 건너뛰기 및 취소 버튼 */}
                <div className="pt-0.5 pb-1 border-b border-white/10 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSkipWorker(workerIdx)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30"
                    title="이 학생을 건너뛰고 다음 순번 학생으로 당깁니다"
                  >
                    <FastForward className="w-3.5 h-3.5" /><span>이 학생 건너뛰기</span>
                  </button>
                  {isSubstituted && (
                    <button
                      type="button"
                      onClick={() => handleCancelPinch(workerIdx)}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-rose-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-rose-500/30 cursor-pointer"
                      title="대타 지정을 취소하고 원래 당번 학생으로 복원합니다"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>대타 취소</span>
                    </button>
                  )}
                  {Boolean(routine.skipHistory && routine.skipHistory.length > 0) && (
                    <button
                      type="button"
                      onClick={handleCancelSkip}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-rose-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-rose-500/30 cursor-pointer"
                      title={`가장 최근 건너뛴 학생부터 복원합니다 (${routine.skipHistory?.length || 0}회 남음)`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>건너뛰기 취소 ({routine.skipHistory?.length || 0})</span>
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
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${currentWorker === s.name ? (isPaid ? "bg-lime-400 text-slate-900 font-black shadow-sm" : "bg-amber-400 text-slate-900 shadow-sm") : "bg-white/10 hover:bg-white/20 text-white/90"}`}
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
                      className="w-full py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
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
                      className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>급여 지급 ({routine.pay.toLocaleString()}{currencyName})</span>
                    </button>
                  )}
                </div>
          </BoardItemPopup>
        );
      })()}
    </BoardElementShell>
  );
}
