"use client";

import { useEffect, useState, useRef, useCallback, useMemo, MouseEvent as ReactMouseEvent } from "react";
import { ClipboardList, FastForward, GripHorizontal } from "lucide-react";
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
  routines: ClassroomRoutine[];
  freeCards: FreeCardData[];
  onAddFreeCard: () => void;
  onRemoveFreeCard: (id: string) => void;
  onUpdateFreeCard: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  students?: ClassroomStudent[];
  currencyName?: string;
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
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
  previewScale?: number;
}

export default function BoardCanvas({
  theme, fontSize,
  routines, freeCards, onAddFreeCard, onRemoveFreeCard, onUpdateFreeCard,
  students = [], currencyName = "원",
  onPayRoutineToday, onUpdateRoutine,
  onAdvanceRoutine, onAdvanceAllRoutines, onOpenRoutineNoticeSettings,
  targetElement = "noticeBox", onSelectElement, onCurrentFontSize, onCurrentLineHeight,
  showEconomyShortcut = false, layouts: externalLayouts, onUpdateLayouts: externalUpdateLayouts, appliedStyle,
  previewScale = 75,
}: BoardCanvasProps) {
  const [liveDateStr, setLiveDateStr] = useState("");
  const [defaultFontFamily, setDefaultFontFamily] = useState<string>("");
  const [internalLayouts, setInternalLayouts] = useState<BoardElementLayouts>(DEFAULT_LAYOUTS);
  const layouts = externalLayouts ?? internalLayouts;
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number>(1000);
  const containerSize = useMemo(() => ({ width: 1000, height: 562.5 }), []);

  useEffect(() => {
    if (!parentRef.current) return;
    const updateSize = () => {
      if (parentRef.current) {
        const w = parentRef.current.clientWidth;
        if (w > 0) setParentWidth(w);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(parentRef.current);
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
          if (parsed.dateBox && parsed.clockBox && parsed.routineBox) {
            setInternalLayouts({ ...DEFAULT_LAYOUTS, ...parsed, accountBox: parsed.accountBox || DEFAULT_LAYOUTS.accountBox });
          }
        }
      }
      const ch = new BroadcastChannel("classroom_os_sync");
      ch.onmessage = (e) => {
        if (e.data?.defaultFontFamily) setDefaultFontFamily(e.data.defaultFontFamily);
        if (!externalUpdateLayouts && e.data?.layouts) {
          setInternalLayouts({ ...DEFAULT_LAYOUTS, ...e.data.layouts, accountBox: e.data.layouts.accountBox || DEFAULT_LAYOUTS.accountBox });
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
          ...prev,
          dateBox: { ...prev.dateBox, ...stylePatch },
          clockBox: { ...prev.clockBox, ...stylePatch },
          routineBox: { ...prev.routineBox, ...stylePatch },
        };
      }
      if (target === "dateBox" || target === "clockBox" || target === "routineBox" || target === "accountBox") {
        return { ...prev, [target]: { ...prev[target as keyof BoardElementLayouts], ...stylePatch } };
      }
      return prev;
    });

    if (target === "all") {
      freeCards.forEach((c) => onUpdateFreeCard(c.id, c.html, stylePatch));
      if (onUpdateRoutine) {
        routines.forEach((r) => onUpdateRoutine(r.id, { layout: { ...r.layout, ...stylePatch } }));
      }
    } else if (target === "routineBox") {
      if (onUpdateRoutine) {
        routines.forEach((r) => onUpdateRoutine(r.id, { layout: { ...r.layout, ...stylePatch } }));
      }
    } else if (target === "noticeBox" || target.startsWith("free-")) {
      const fc = freeCards.find((c) => c.id === target);
      if (fc) onUpdateFreeCard(fc.id, fc.html, stylePatch);
    } else if (target.startsWith("routine-") && onUpdateRoutine) {
      const r = routines.find((item) => item.id === target);
      if (r) onUpdateRoutine(r.id, { layout: { ...r.layout, ...stylePatch } });
    }
  }, [appliedStyle, updateLayouts, freeCards, routines, onUpdateFreeCard, onUpdateRoutine]);

  // 선택 요소 변경 시 해당 요소의 실제 fontSize 및 lineHeight를 부모 툴바로 전달
  const targetFontSize = useMemo(() => {
    const fontPxCurrent = Number(fontSize) || 42;
    if (targetElement === "all" || targetElement === "noticeBox") {
      const nb = freeCards.find((c) => c.id === "noticeBox");
      return nb?.fontSize || fontPxCurrent;
    }
    if (targetElement === "dateBox") return layouts.dateBox.fontSize || fontPxCurrent;
    if (targetElement === "clockBox") return layouts.clockBox.fontSize || fontPxCurrent;
    if (targetElement === "routineBox") return layouts.routineBox.fontSize || fontPxCurrent;
    if (targetElement && targetElement.startsWith("free-")) {
      return freeCards.find((c) => c.id === targetElement)?.fontSize || fontPxCurrent;
    }
    if (targetElement && targetElement.startsWith("routine-")) {
      const r = routines.find((item) => item.id === targetElement);
      return r?.layout?.fontSize || layouts.routineBox.fontSize || fontPxCurrent;
    }
    return fontPxCurrent;
  }, [targetElement, layouts.dateBox.fontSize, layouts.clockBox.fontSize, layouts.routineBox.fontSize, freeCards, routines, fontSize]);

  const targetLineHeight = useMemo(() => {
    const getLh = (lh: number | string | undefined) => {
      if (!lh) return 140;
      const n = typeof lh === "number" ? lh : parseFloat(lh);
      return isNaN(n) ? 140 : n < 10 ? Math.round(n * 100) : Math.round(n);
    };
    if (targetElement === "all" || targetElement === "noticeBox") {
      const nb = freeCards.find((c) => c.id === "noticeBox");
      return getLh(nb?.lineHeight);
    }
    if (targetElement === "routineBox") return getLh(layouts.routineBox.lineHeight);
    if (targetElement && targetElement.startsWith("free-")) {
      return getLh(freeCards.find((c) => c.id === targetElement)?.lineHeight);
    }
    if (targetElement && targetElement.startsWith("routine-")) {
      const r = routines.find((item) => item.id === targetElement);
      return getLh(r?.layout?.lineHeight || layouts.routineBox.lineHeight);
    }
    return 140;
  }, [targetElement, layouts.routineBox.lineHeight, freeCards, routines]);

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
  const previewWidth = Math.max(320, Math.round(parentWidth * (previewScale / 100)));
  const previewHeight = Math.round(previewWidth * 0.5625);
  const scale = previewWidth / 1000;

  return (
    <div ref={parentRef} className="flex justify-center w-full">
      {/* 16:9 캔버스 본체 (가로/세로 비율 100% 고정 뷰포트) */}
      <div
        id="preview-16-9-wrapper"
        className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-300 select-none bg-slate-900"
        style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
        }}
      >
        <div
          style={{
            width: "1000px",
            height: "562.5px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            fontFamily: defaultFontFamily || "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
          className="relative"
        >
          <div
            className={`absolute inset-0 ${themeBg}`}
            onClick={(e) => { if (e.target === e.currentTarget) onSelectElement?.("all"); }}
          >

          {/* 요소 1: 날짜 글상자 */}
          {isBoxVisibleToday(layouts.dateBox.visible, layouts.dateBox.visibleDays) && (
          <Rnd
            scale={scale}
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
              e.stopPropagation();
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
            className={`z-10 group rounded-xl border transition-all font-extrabold tracking-tight whitespace-nowrap cursor-grab active:cursor-grabbing relative ${selectedBorderClass(targetElement === "dateBox")}`}
            style={{
              fontSize: `${layouts.dateBox.fontSize || fontPx}px`,
              color: layouts.dateBox.color || "inherit",
              textAlign: layouts.dateBox.align || "left",
              fontFamily: layouts.dateBox.fontFamily || undefined,
            }}
          >
            {/* 날짜 상단바 — absolute overlay (flex flow에서 제거하여 내용 Y위치 유지) */}
            <div
              className={`absolute top-0 left-0 right-0 z-20 transition-opacity flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/40 rounded-t-xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
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
            scale={scale}
            layout={layouts.clockBox}
            containerSize={containerSize}
            targetElement={targetElement}
            onSelectElement={onSelectElement}
            onUpdateLayout={(updater) => updateLayouts((p) => ({ ...p, clockBox: updater(p.clockBox) }))}
            scaleFont={(s) => s}
            fontPx={fontPx}
          />
          )}

          {/* 요소 4: 루틴 당번 목록 글상자 (각 업무별 독립 캔버스 요소) */}
          {isBoxVisibleToday(layouts.routineBox.visible, layouts.routineBox.visibleDays) && (
            <>
              {routines.filter((r) => r.visibleInNotice !== false).length === 0 ? (
                <div
                  className="absolute z-10 opacity-50 italic text-xs px-2 py-1 flex items-center gap-2"
                  style={{
                    left: `${parsePercent(layouts.routineBox.left, 2.5)}%`,
                    top: `${parsePercent(layouts.routineBox.top, 82.0)}%`,
                  }}
                >
                  <span>{routines.length === 0 ? "등록된 학생 업무가 없습니다." : "알림장에 표시 중인 학생 업무가 없습니다."}</span>
                  {routines.length > 0 && onOpenRoutineNoticeSettings && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenRoutineNoticeSettings(); }}
                      className="text-[11px] px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white font-bold border border-white/25 cursor-pointer"
                    >
                      칠판 표시 업무 선택
                    </button>
                  )}
                </div>
              ) : (
                routines.filter((r) => r.visibleInNotice !== false).map((r, idx) => {
                  const leftPct = parsePercent(r.layout?.left, 2.5 + ((idx * 26.0) % 75));
                  const topPct = parsePercent(r.layout?.top, 82.0 + Math.floor((idx * 26.0) / 75) * 8.0);
                  const widthPx = r.layout?.width
                    ? (parsePercent(r.layout.width, 24.0) / 100) * containerSize.width
                    : "auto";
                  const heightPx = r.layout?.height
                    ? (parsePercent(r.layout.height, 8.0) / 100) * containerSize.height
                    : "auto";
                  const isSelected = targetElement === r.id;

                  return (
                    <Rnd
                      key={r.id}
                      scale={scale}
                      cancel="button, select, input, [contenteditable='true'], [role='dialog'], .routine-text-editor, .canvas-text-content"
                      enableUserSelectHack={false}
                      position={{
                        x: (leftPct / 100) * containerSize.width,
                        y: (topPct / 100) * containerSize.height,
                      }}
                      size={{
                        width: widthPx,
                        height: heightPx,
                      }}
                      onDragStop={makeDragSaveHandler(
                        containerSize,
                        typeof widthPx === "number" ? widthPx : 160,
                        typeof heightPx === "number" ? heightPx : 40,
                        (left, top) => onUpdateRoutine?.(r.id, { layout: { ...r.layout, left, top } }),
                      )}
                      onResizeStop={makeResizeSaveHandler(
                        containerSize,
                        (width, height, left, top) =>
                          onUpdateRoutine?.(r.id, { layout: { ...r.layout, width, height, left, top } }),
                      )}
                      enableResizing={RESIZE_ENABLE}
                      resizeHandleComponent={RESIZE_HANDLES}
                      onClick={(e: ReactMouseEvent<HTMLElement>) => { e.stopPropagation(); onSelectElement?.(r.id); }}
                      className={`group rounded-xl border transition-all font-bold opacity-95 leading-snug cursor-grab active:cursor-grabbing relative ${
                        isSelected ? "z-30" : "z-10"
                      } ${selectedBorderClass(isSelected)}`}
                      style={{
                        fontSize: `${r.layout?.fontSize || layouts.routineBox.fontSize || fontPx}px`,
                        color: r.layout?.color || layouts.routineBox.color || "inherit",
                        textAlign: r.layout?.align || layouts.routineBox.align || "left",
                        fontFamily: r.layout?.fontFamily || layouts.routineBox.fontFamily || undefined,
                        lineHeight: r.layout?.lineHeight || layouts.routineBox.lineHeight || "1.4",
                      }}
                    >
                      {/* 루틴 개별 상단바 — absolute overlay (내용 Y 위치 유지) */}
                      <div
                        className={`absolute top-0 left-0 right-0 z-20 transition-opacity flex items-center justify-between px-2 py-0.5 bg-slate-900/40 rounded-t-xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-white/70">
                          <GripHorizontal className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold tracking-tight">{r.name}</span>
                        </div>
                        {onAdvanceRoutine && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAdvanceRoutine(r.id); }}
                            className="text-[10px] px-1.5 py-0.2 rounded bg-white/15 hover:bg-white/25 text-white/90 hover:text-white font-bold cursor-pointer"
                            title="다음 순서로 넘기기"
                          >
                            넘기기
                          </button>
                        )}
                      </div>

                      <div className="px-2 py-1 flex items-center">
                        <RoutineElementInCanvas
                          routine={r}
                          students={students}
                          currencyName={currencyName}
                          theme={theme}
                          customColor={r.layout?.color || layouts.routineBox.color}
                          onPayRoutineToday={onPayRoutineToday}
                          onUpdateRoutine={onUpdateRoutine}
                          onAdvanceRoutine={onAdvanceRoutine}
                          onSelect={() => onSelectElement?.(r.id)}
                        />
                      </div>
                    </Rnd>
                  );
                })
              )}
            </>
          )}

          {freeCards.filter((card) => isBoxVisibleToday(card.visible, card.visibleDays)).map((card) => (
            <FreeCardItem
              key={card.id}
              scale={scale}
              card={{ ...card, fontSize: card.fontSize || fontPx }}
              containerSize={containerSize}
              isSelected={targetElement === card.id}
              onSelect={() => onSelectElement?.(card.id)}
              onUpdate={onUpdateFreeCard}
              onRemove={onRemoveFreeCard}
              placeholder={card.id === "noticeBox" ? "전달할 알림장 내용을 입력하세요..." : "메모를 입력하세요..."}
            />
          ))}
          {showEconomyShortcut && (
            <CanvasAccountIcon
              scale={scale}
              layout={layouts.accountBox}
              containerSize={containerSize}
              targetElement={targetElement}
              onSelectElement={onSelectElement}
              onUpdateLayout={(updater) => updateLayouts((p) => ({ ...p, accountBox: updater(p.accountBox ?? DEFAULT_LAYOUTS.accountBox!) }))}
            />
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
