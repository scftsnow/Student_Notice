"use client";

import { useEffect, useState, useRef, useCallback, useMemo, MouseEvent as ReactMouseEvent } from "react";
import { ClipboardList, FastForward, GripHorizontal, Minus, Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import FreeCardItem from "./FreeCardItem";
import RoutineElementInCanvas from "./RoutineElementInCanvas";
import CanvasClock from "./CanvasClock";
import CanvasAccountIcon from "./CanvasAccountIcon";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import {
  BoardTheme, NoticeFontSize, ClassroomRoutine,
  ClassroomStudent, FreeCardData, BoardElementLayouts,
  BoardTargetElement,
} from "@/types/classroom";
import { DEFAULT_LAYOUTS, isBoxVisibleToday } from "@/lib/boardDefaults";
import { parsePercent, makeDragSaveHandler, makeResizeSaveHandler, selectedBorderClass } from "@/lib/canvasUtils";

interface BoardCanvasProps {
  theme: BoardTheme;
  fontSize: NoticeFontSize;
  noticeText: string;
  onNoticeTextChange: (text: string) => void;
  routines: ClassroomRoutine[];
  freeCards: FreeCardData[];
  onAddFreeCard: () => void;
  onRemoveFreeCard: (id: string) => void;
  onUpdateFreeCard: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  students?: ClassroomStudent[];
  currencyName?: string;
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
  onPayAllRoutinesToday?: () => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
  onAdvanceAllRoutines?: () => void;
  onOpenRoutineNoticeSettings?: () => void;
  targetElement?: BoardTargetElement;
  onSelectElement?: (elem: BoardTargetElement) => void;
  onCurrentFontSize?: (size: number) => void;
  onCurrentLineHeight?: (lineHeight: number) => void;
  showEconomyShortcut?: boolean;
  layouts?: BoardElementLayouts;
  onUpdateLayouts?: (updater: (prev: BoardElementLayouts) => BoardElementLayouts) => void;
  appliedStyle?: {
    target: BoardTargetElement; color?: string; fontSize?: number; align?: "left" | "center" | "right";
    lineHeight?: number; fontFamily?: string; timestamp: number;
  } | null;
}

export default function BoardCanvas({
  theme, fontSize, noticeText, onNoticeTextChange,
  routines, freeCards, onAddFreeCard, onRemoveFreeCard, onUpdateFreeCard,
  students = [], currencyName = "원",
  onPayRoutineToday, onPayAllRoutinesToday, onUpdateRoutine,
  onAdvanceRoutine, onAdvanceAllRoutines, onOpenRoutineNoticeSettings,
  targetElement = "noticeBox", onSelectElement, onCurrentFontSize, onCurrentLineHeight,
  showEconomyShortcut = false, layouts: externalLayouts, onUpdateLayouts: externalUpdateLayouts, appliedStyle,
}: BoardCanvasProps) {
  const [liveDateStr, setLiveDateStr] = useState("");
  const [defaultFontFamily, setDefaultFontFamily] = useState<string>("");
  const [internalLayouts, setInternalLayouts] = useState<BoardElementLayouts>(DEFAULT_LAYOUTS);
  const layouts = externalLayouts ?? internalLayouts;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 1000, height: 562.5 });

  const [previewScale, setPreviewScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("classroom_preview_scale");
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 50 && n <= 100) return n;
      }
    } catch {}
    return 75;
  });
  const [scaleInput, setScaleInput] = useState<string>(String(previewScale));

  const updateScale = useCallback((next: number) => {
    const clamped = Math.max(50, Math.min(100, Math.round(next)));
    setPreviewScale(clamped);
    setScaleInput(String(clamped));
    try { localStorage.setItem("classroom_preview_scale", String(clamped)); } catch {}
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load layout and default font from localStorage
  useEffect(() => {
    try {
      const savedFont = localStorage.getItem("classroom_default_font_family");
      if (savedFont) setDefaultFontFamily(savedFont);
      if (!externalUpdateLayouts) {
        const saved = localStorage.getItem("classroom_board_layouts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.dateBox && parsed.clockBox && parsed.noticeBox && parsed.routineBox) {
            setInternalLayouts(parsed);
          }
        }
      }
      const ch = new BroadcastChannel("classroom_os_sync");
      ch.onmessage = (e) => {
        if (e.data?.defaultFontFamily) setDefaultFontFamily(e.data.defaultFontFamily);
        if (!externalUpdateLayouts && e.data?.layouts) {
          setInternalLayouts(e.data.layouts);
        }
      };
      return () => ch.close();
    } catch {
      // Ignore parse errors
    }
  }, [externalUpdateLayouts]);

  // Save layout changes and broadcast to student window
  const updateLayouts = useCallback((updater: (prev: BoardElementLayouts) => BoardElementLayouts) => {
    if (externalUpdateLayouts) {
      externalUpdateLayouts(updater);
      return;
    }
    setInternalLayouts((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem("classroom_board_layouts", JSON.stringify(next));
        const channel = new BroadcastChannel("classroom_os_sync");
        channel.postMessage({ layouts: next });
        channel.close();
      } catch {
        // Ignore channel errors
      }
      return next;
    });
  }, [externalUpdateLayouts]);

  // 외부 툴바 스타일(크기, 색상, 정렬, 줄간격) 변경 적용
  useEffect(() => {
    if (!appliedStyle?.timestamp) return;
    const { target, color, fontSize: styleFontSize, align, lineHeight, fontFamily } = appliedStyle;
    const parsedLh = lineHeight !== undefined ? (lineHeight > 10 ? lineHeight / 100 : lineHeight) : undefined;
    const stylePatch = {
      ...(color && { color }),
      ...(styleFontSize && { fontSize: styleFontSize }),
      ...(align && { align }),
      ...(parsedLh !== undefined && { lineHeight: parsedLh }),
      ...(fontFamily && { fontFamily }),
    };

    updateLayouts((prev) => {
      if (target === "all") {
        return {
          dateBox: { ...prev.dateBox, ...stylePatch },
          clockBox: { ...prev.clockBox, ...stylePatch },
          noticeBox: { ...prev.noticeBox, ...stylePatch },
          routineBox: { ...prev.routineBox, ...stylePatch },
        };
      }
      if (target === "noticeBox" || target === "dateBox" || target === "clockBox" || target === "routineBox") {
        return { ...prev, [target]: { ...prev[target as keyof BoardElementLayouts], ...stylePatch } };
      }
      return prev;
    });

    if (target === "all" || target === "freeCard") {
      freeCards.forEach((c) => onUpdateFreeCard(c.id, c.html, stylePatch));
    } else {
      const fc = freeCards.find((c) => c.id === target);
      if (fc) onUpdateFreeCard(fc.id, fc.html, stylePatch);
    }
  }, [appliedStyle, updateLayouts, freeCards, onUpdateFreeCard]);

  // 선택 요소 변경 시 해당 요소의 실제 fontSize 및 lineHeight를 부모 툴바로 전달
  const targetFontSize = useMemo(() => {
    const fontPxCurrent = Number(fontSize) || 42;
    if (targetElement === "all" || targetElement === "noticeBox") return layouts.noticeBox.fontSize || fontPxCurrent;
    if (targetElement === "dateBox") return layouts.dateBox.fontSize || fontPxCurrent;
    if (targetElement === "clockBox") return layouts.clockBox.fontSize || fontPxCurrent;
    if (targetElement === "routineBox") return layouts.routineBox.fontSize || fontPxCurrent;
    if (targetElement && targetElement.startsWith("free-")) {
      return freeCards.find((c) => c.id === targetElement)?.fontSize || fontPxCurrent;
    }
    return fontPxCurrent;
  }, [targetElement, layouts.noticeBox.fontSize, layouts.dateBox.fontSize, layouts.clockBox.fontSize, layouts.routineBox.fontSize, freeCards, fontSize]);

  const targetLineHeight = useMemo(() => {
    const getLh = (lh: number | string | undefined) => {
      if (!lh) return 140;
      const n = typeof lh === "number" ? lh : parseFloat(lh);
      return isNaN(n) ? 140 : n < 10 ? Math.round(n * 100) : Math.round(n);
    };
    if (targetElement === "all" || targetElement === "noticeBox") return getLh(layouts.noticeBox.lineHeight);
    if (targetElement === "routineBox") return getLh(layouts.routineBox.lineHeight);
    if (targetElement && targetElement.startsWith("free-")) {
      return getLh(freeCards.find((c) => c.id === targetElement)?.lineHeight);
    }
    return 140;
  }, [targetElement, layouts.noticeBox.lineHeight, layouts.routineBox.lineHeight, freeCards]);

  useEffect(() => { onCurrentFontSize?.(targetFontSize); }, [targetFontSize, onCurrentFontSize]);
  useEffect(() => { onCurrentLineHeight?.(targetLineHeight); }, [targetLineHeight, onCurrentLineHeight]);

  // Live date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      setLiveDateStr(`${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  const themeBg = theme === "chalkboard" ? "bg-[#1a382b] text-white" : theme === "white" ? "bg-white text-slate-900" : theme === "navy" ? "bg-[#0b132b] text-white" : "bg-[#faf5ea] text-amber-950";
  const fontPx = Number(fontSize) || 42;
  const scaleFont = (size: number) => Math.round(size * (previewScale / 100));

  return (
    <div className="space-y-2">
      {/* 미리보기 배율 조절 바 (최소 50%, 최대 100%) */}
      <div className="flex items-center justify-between px-2 text-xs text-slate-500 max-w-[1200px] mx-auto">
        <span className="font-semibold text-slate-600">미리보기 (학생 화면 대비)</span>
        <div className="flex items-center gap-1 bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80 select-none">
          <button
            type="button"
            onClick={() => updateScale(previewScale - 5)}
            disabled={previewScale <= 50}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-white active:scale-95 disabled:opacity-30 text-slate-700 font-bold transition-all cursor-pointer"
            title="배율 축소 (-5%)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center">
            <input
              type="text"
              value={scaleInput}
              onChange={(e) => setScaleInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(scaleInput, 10);
                isNaN(n) ? setScaleInput(String(previewScale)) : updateScale(n);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setScaleInput(String(previewScale)); (e.target as HTMLInputElement).blur(); }
                if (e.key === "ArrowUp") { e.preventDefault(); updateScale(previewScale + 5); }
                if (e.key === "ArrowDown") { e.preventDefault(); updateScale(previewScale - 5); }
              }}
              className="w-9 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-indigo-500 font-mono"
            />
            <span className="text-[11px] font-bold text-slate-500 ml-0.5 mr-1">%</span>
          </div>
          <button
            type="button"
            onClick={() => updateScale(previewScale + 5)}
            disabled={previewScale >= 100}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-white active:scale-95 disabled:opacity-30 text-slate-700 font-bold transition-all cursor-pointer"
            title="배율 확대 (+5%)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-300 mx-0.5" />
          <button
            type="button"
            onClick={() => updateScale(75)}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${previewScale === 75 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`}
            title="기본 배율 (75%) 복원"
          >
            기본
          </button>
          <button
            type="button"
            onClick={() => updateScale(100)}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${previewScale === 100 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`}
            title="100% 원본 배율"
          >
            100%
          </button>
        </div>
      </div>

      {/* 16:9 캔버스 본체 */}
      <div className="flex justify-center w-full">
        <div
          ref={containerRef}
          id="preview-16-9-wrapper"
          className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-300 aspect-video select-none"
          style={{
            width: `${previewScale}%`,
            fontFamily: defaultFontFamily || "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            className={`absolute inset-0 ${themeBg}`}
            onClick={() => onSelectElement?.("all")}
          >

          {/* 요소 1: 날짜 글상자 */}
          {isBoxVisibleToday(layouts.dateBox.visible, layouts.dateBox.visibleDays) && (
          <Rnd
            cancel="#canvas-date-text, .canvas-text-content"
            enableUserSelectHack={false}
            position={{
              x: (parsePercent(layouts.dateBox.left, 2.5) / 100) * containerSize.width,
              y: (parsePercent(layouts.dateBox.top, 3.0) / 100) * containerSize.height,
            }}
            size={{
              width: layouts.dateBox.width ? (parsePercent(layouts.dateBox.width, 20) / 100) * containerSize.width : "auto",
              height: layouts.dateBox.height ? (parsePercent(layouts.dateBox.height, 10) / 100) * containerSize.height : "auto",
            }}
            onDragStop={makeDragSaveHandler(containerSize, containerSize.width * 0.2, 40, (left, top) => updateLayouts((p) => ({ ...p, dateBox: { ...p.dateBox, left, top } })))}
            onResizeStop={makeResizeSaveHandler(containerSize, (width, height, left, top) => updateLayouts((p) => ({ ...p, dateBox: { ...p.dateBox, width, height, left, top } })))}
            enableResizing={RESIZE_ENABLE}
            resizeHandleComponent={RESIZE_HANDLES}
            onClick={(e: ReactMouseEvent<HTMLElement>) => {
              const prev = targetElement;
              onSelectElement?.("dateBox");
              const el = document.getElementById("canvas-date-text");
              if (!el || (e.target !== el && !el.contains(e.target as Node))) return;
              const sel = window.getSelection();
              const isRangeInThis = sel && !sel.isCollapsed && sel.toString().length > 0 && Boolean(el.contains(sel.anchorNode) || el.contains(sel.focusNode));
              if (!isRangeInThis && prev !== "dateBox") {
                const range = document.createRange();
                range.selectNodeContents(el);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
            className={`z-10 group rounded-xl border transition-all font-extrabold tracking-tight whitespace-nowrap cursor-grab active:cursor-grabbing flex flex-col ${selectedBorderClass(targetElement === "dateBox")}`}
            style={{
              fontSize: `${scaleFont(layouts.dateBox.fontSize || fontPx)}px`,
              color: layouts.dateBox.color || "inherit",
              textAlign: layouts.dateBox.align || "left",
              fontFamily: layouts.dateBox.fontFamily || undefined,
            }}
          >
            {/* 날짜 상단바 */}
            <div
              className={`transition-opacity flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/40 rounded-t-xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
                targetElement === "dateBox" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <GripHorizontal className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[10px] font-bold tracking-tight text-white/70">날짜</span>
            </div>
            <div className="px-2 py-1 cursor-grab active:cursor-grabbing">
              <span
                id="canvas-date-text"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const txt = e.currentTarget.innerText.trim();
                  if (txt) setLiveDateStr(txt);
                }}
                className="inline-block cursor-text focus:outline-hidden focus:ring-1 focus:ring-indigo-400/60 rounded px-0.5"
              >
                {liveDateStr || "오늘의 날짜"}
              </span>
            </div>
          </Rnd>
          )}

          {/* 요소 2: 시각 글상자 (우클릭 모양/표시제 토글 지원) */}
          {isBoxVisibleToday(layouts.clockBox.visible, layouts.clockBox.visibleDays) && (
          <CanvasClock
            layout={layouts.clockBox}
            containerSize={containerSize}
            targetElement={targetElement}
            onSelectElement={onSelectElement}
            onUpdateLayout={(updater) => updateLayouts((p) => ({ ...p, clockBox: updater(p.clockBox) }))}
            scaleFont={scaleFont}
            fontPx={fontPx}
          />
          )}

          {/* 요소 3: 알림장 본문 — 자유 글상자(FreeCardItem) 컴포넌트로 완전 일원화 */}
          {isBoxVisibleToday(layouts.noticeBox.visible, layouts.noticeBox.visibleDays) && (
          <FreeCardItem
            card={{
              id: "noticeBox",
              html: noticeText,
              left: layouts.noticeBox.left,
              top: layouts.noticeBox.top,
              width: layouts.noticeBox.width || "95.0%",
              height: layouts.noticeBox.height || "62.0%",
              fontSize: scaleFont(layouts.noticeBox.fontSize || fontPx),
              color: layouts.noticeBox.color,
              align: layouts.noticeBox.align,
              fontFamily: layouts.noticeBox.fontFamily,
            }}
            containerSize={containerSize}
            isSelected={targetElement === "noticeBox"}
            onSelect={() => onSelectElement?.("noticeBox")}
            onUpdate={(_id, html, updates) => {
              if (html !== undefined && html !== noticeText) onNoticeTextChange(html);
              if (updates) updateLayouts((p) => ({ ...p, noticeBox: { ...p.noticeBox, ...updates } }));
            }}
            onRemove={() => onNoticeTextChange("")}
            placeholder="전달할 알림장 내용을 입력하세요..."
            isMainNotice
          />
          )}

          {/* 요소 4: 루틴 당번 목록 글상자 */}
          {isBoxVisibleToday(layouts.routineBox.visible, layouts.routineBox.visibleDays) && (
          <Rnd
            cancel="button, select, input, [contenteditable='true'], [role='dialog'], .routine-text-editor, .canvas-text-content"
            enableUserSelectHack={false}
            position={{
              x: (parsePercent(layouts.routineBox.left, 2.5) / 100) * containerSize.width,
              y: (parsePercent(layouts.routineBox.top, 82.0) / 100) * containerSize.height,
            }}
            size={{
              width: (parsePercent(layouts.routineBox.width, 95.0) / 100) * containerSize.width,
              height: layouts.routineBox.height ? (parsePercent(layouts.routineBox.height, 10) / 100) * containerSize.height : "auto",
            }}
            onDragStop={makeDragSaveHandler(containerSize, containerSize.width * 0.5, 40, (left, top) => updateLayouts((p) => ({ ...p, routineBox: { ...p.routineBox, left, top } })))}
            onResizeStop={makeResizeSaveHandler(containerSize, (width, height, left, top) => updateLayouts((p) => ({ ...p, routineBox: { ...p.routineBox, width, height, left, top } })))}
            enableResizing={RESIZE_ENABLE}
            resizeHandleComponent={RESIZE_HANDLES}
            onClick={() => onSelectElement?.("routineBox")}
            className={`group rounded-xl border transition-all font-bold opacity-95 leading-snug cursor-grab active:cursor-grabbing flex flex-col ${
              targetElement === "routineBox" ? "z-30" : "z-10"
            } ${selectedBorderClass(targetElement === "routineBox")}`}
            style={{
              fontSize: `${scaleFont(layouts.routineBox.fontSize || fontPx)}px`,
              color: layouts.routineBox.color || "inherit",
              textAlign: layouts.routineBox.align || "left",
              fontFamily: layouts.routineBox.fontFamily || undefined,
              lineHeight: layouts.routineBox.lineHeight ? `${layouts.routineBox.lineHeight}` : "1.4",
            }}
          >
            {/* 루틴 상단바 */}
            <div
              className={`transition-opacity flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/40 rounded-t-xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
                targetElement === "routineBox" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <GripHorizontal className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[10px] font-bold tracking-tight text-white/70">학생 업무</span>
            </div>
            <div
              id="canvas-routine-container"
              className="flex items-center gap-3 sm:gap-5 flex-wrap w-full px-2 py-1"
              style={{ fontSize: "inherit" }}
            >
              {routines.filter((r) => r.visibleInNotice !== false).length === 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="opacity-50 italic text-xs">
                    {routines.length === 0 ? "등록된 학생 업무가 없습니다." : "알림장에 표시 중인 학생 업무가 없습니다."}
                  </span>
                  {routines.length > 0 && onOpenRoutineNoticeSettings && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRoutineNoticeSettings();
                      }}
                      className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold border border-white/25 cursor-pointer transition-all shadow-2xs inline-flex items-center gap-1"
                    >
                      <ClipboardList className="w-3 h-3" />
                      <span>칠판 표시 업무 선택</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {routines.filter((r) => r.visibleInNotice !== false).map((r) => (
                    <RoutineElementInCanvas
                      key={r.id} routine={r} students={students} currencyName={currencyName}
                      theme={theme} customColor={layouts.routineBox.color}
                      onPayRoutineToday={onPayRoutineToday} onPayAllRoutinesToday={onPayAllRoutinesToday}
                      onUpdateRoutine={onUpdateRoutine} onAdvanceRoutine={onAdvanceRoutine}
                      onSelect={() => onSelectElement?.("routineBox")}
                    />
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {onAdvanceAllRoutines && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAdvanceAllRoutines(); }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 text-white/90 hover:text-white transition-all font-bold select-none border border-white/20 leading-tight shrink-0 shadow-xs cursor-pointer inline-flex items-center gap-1"
                        title="모든 학생 업무의 순번을 다음으로 일괄 넘기기"
                      >
                        <span>전체 넘기기</span>
                        <FastForward className="w-3 h-3" />
                      </button>
                    )}
                    {onOpenRoutineNoticeSettings && routines.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenRoutineNoticeSettings(); }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 text-white/90 hover:text-white transition-all font-bold select-none border border-white/20 leading-tight shadow-xs cursor-pointer inline-flex items-center gap-1"
                        title="알림장 칠판에 노출할 학생 업무 및 표시 문구 서식 설정"
                      >
                        <ClipboardList className="w-3 h-3" />
                        <span>칠판 표시 업무</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Rnd>
          )}

          {freeCards.filter((card) => isBoxVisibleToday(card.visible, card.visibleDays)).map((card) => (
            <FreeCardItem
              key={card.id}
              card={{ ...card, fontSize: scaleFont(card.fontSize || fontPx) }}
              containerSize={containerSize}
              isSelected={targetElement === card.id}
              onSelect={() => onSelectElement?.(card.id)}
              onUpdate={onUpdateFreeCard}
              onRemove={onRemoveFreeCard}
            />
          ))}
          {showEconomyShortcut && (
            <CanvasAccountIcon
              layout={layouts.accountBox}
              containerSize={containerSize}
              targetElement={targetElement}
              onSelectElement={onSelectElement}
              scaleFont={scaleFont}
              onUpdateLayout={(updater) => updateLayouts((p) => ({ ...p, accountBox: updater(p.accountBox ?? DEFAULT_LAYOUTS.accountBox!) }))}
            />
          )}
        </div>
      </div>
    </div>
  </div>
);
}
