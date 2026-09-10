"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ClipboardList, FastForward } from "lucide-react";
import { Rnd } from "react-rnd";
import FreeCardItem from "./FreeCardItem";
import RoutineElementInCanvas from "./RoutineElementInCanvas";
import CanvasClock from "./CanvasClock";
import CanvasAccountIcon from "./CanvasAccountIcon";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import {
  BoardTheme, NoticeFontSize, ClassroomRoutine,
  ClassroomStudent, FreeCardData, BoardElementLayouts,
} from "@/types/classroom";

interface BoardCanvasProps {
  theme: BoardTheme;
  fontSize: NoticeFontSize;
  noticeText: string;
  onNoticeTextChange: (text: string) => void;
  routines: ClassroomRoutine[];
  freeCards: FreeCardData[];
  onAddFreeCard: () => void;
  onRemoveFreeCard: (id: string) => void;
  onUpdateFreeCard: (
    id: string,
    html: string,
    updates?: Partial<FreeCardData>
  ) => void;
  students?: ClassroomStudent[];
  currencyName?: string;
  onPayRoutineToday?: (id: string, workers?: string[], applyTax?: boolean) => void;
  onPayAllRoutinesToday?: () => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
  onAdvanceAllRoutines?: () => void;
  onOpenRoutineNoticeSettings?: () => void;
  targetElement?: string;
  onSelectElement?: (elem: string) => void;
  onCurrentFontSize?: (size: number) => void;
  onCurrentLineHeight?: (lineHeight: number) => void;
  showEconomyShortcut?: boolean;
  appliedStyle?: {
    target: string;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    fontFamily?: string;
    timestamp: number;
  } | null;
}

const DEFAULT_LAYOUTS: BoardElementLayouts = {
  dateBox: { left: "2.5%", top: "3.0%", fontSize: 42, lineHeight: 1.4 },
  clockBox: { left: "81.0%", top: "3.0%", fontSize: 32, lineHeight: 1.4 },
  noticeBox: { left: "2.5%", top: "15.0%", width: "95%", height: "64%", fontSize: 42, lineHeight: 1.4 },
  routineBox: { left: "2.5%", top: "82.0%", width: "95%", height: "12%", fontSize: 34, lineHeight: 1.4 },
  accountBox: { left: "93.0%", top: "3.0%", width: "48px", height: "48px", fontSize: 32 },
};

export default function BoardCanvas({
  theme,
  fontSize,
  noticeText,
  onNoticeTextChange,
  routines,
  freeCards,
  onAddFreeCard,
  onRemoveFreeCard,
  onUpdateFreeCard,
  students = [],
  currencyName = "원",
  onPayRoutineToday,
  onPayAllRoutinesToday,
  onUpdateRoutine,
  onAdvanceRoutine,
  onAdvanceAllRoutines,
  onOpenRoutineNoticeSettings,
  targetElement = "noticeBox",
  onSelectElement,
  onCurrentFontSize,
  onCurrentLineHeight,
  showEconomyShortcut = false,
  appliedStyle,
}: BoardCanvasProps) {
  const [liveDateStr, setLiveDateStr] = useState("");
  const [defaultFontFamily, setDefaultFontFamily] = useState<string>("");
  const [layouts, setLayouts] = useState<BoardElementLayouts>(DEFAULT_LAYOUTS);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 562.5,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const parsePercent = (val: string | undefined, fallback: number) => {
    if (!val) return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  // Load layout and default font from localStorage
  useEffect(() => {
    try {
      const savedFont = localStorage.getItem("classroom_default_font_family");
      if (savedFont) setDefaultFontFamily(savedFont);
      const saved = localStorage.getItem("classroom_board_layouts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dateBox && parsed.clockBox && parsed.noticeBox && parsed.routineBox) {
          setLayouts(parsed);
        }
      }
      const ch = new BroadcastChannel("classroom_os_sync");
      ch.onmessage = (e) => {
        if (e.data?.defaultFontFamily) setDefaultFontFamily(e.data.defaultFontFamily);
      };
      return () => ch.close();
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save layout changes and broadcast to student window
  const updateLayouts = useCallback((updater: (prev: BoardElementLayouts) => BoardElementLayouts) => {
    setLayouts((prev) => {
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
  }, []);

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
        const current = prev[target as keyof BoardElementLayouts];
        return { ...prev, [target]: { ...current, ...stylePatch } };
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

  // 상단 툴바 fontSize prop 변경 시 noticeBox 기본 크기 동기화
  useEffect(() => {
    const num = Number(fontSize);
    if (!isNaN(num) && num > 0) {
      updateLayouts((prev) => ({
        ...prev,
        noticeBox: { ...prev.noticeBox, fontSize: num },
      }));
    }
  }, [fontSize, updateLayouts]);

  // 선택 요소 변경 시 해당 요소의 실제 fontSize 및 lineHeight를 부모 툴바로 전달
  useEffect(() => {
    const fontPxCurrent = Number(fontSize) || 42;
    if (onCurrentFontSize) {
      if (targetElement === "noticeBox") {
        onCurrentFontSize(layouts.noticeBox.fontSize || fontPxCurrent);
      } else if (targetElement === "dateBox") {
        onCurrentFontSize(layouts.dateBox.fontSize || fontPxCurrent);
      } else if (targetElement === "clockBox") {
        onCurrentFontSize(layouts.clockBox.fontSize || fontPxCurrent);
      } else if (targetElement === "routineBox") {
        onCurrentFontSize(layouts.routineBox.fontSize || fontPxCurrent);
      } else if (targetElement && targetElement.startsWith("free-")) {
        const card = freeCards.find((c) => c.id === targetElement);
        onCurrentFontSize(card?.fontSize || fontPxCurrent);
      }
    }

    if (onCurrentLineHeight) {
      const getLh = (lh: number | string | undefined) => {
        if (!lh) return 140;
        const n = typeof lh === "number" ? lh : parseFloat(lh);
        if (isNaN(n)) return 140;
        return n < 10 ? Math.round(n * 100) : Math.round(n);
      };
      if (targetElement === "noticeBox") onCurrentLineHeight(getLh(layouts.noticeBox.lineHeight));
      else if (targetElement === "routineBox") onCurrentLineHeight(getLh(layouts.routineBox.lineHeight));
      else if (targetElement && targetElement.startsWith("free-")) {
        const card = freeCards.find((c) => c.id === targetElement);
        onCurrentLineHeight(getLh(card?.lineHeight));
      } else {
        onCurrentLineHeight(140);
      }
    }
  }, [targetElement, layouts, freeCards, fontSize, onCurrentFontSize, onCurrentLineHeight]);

  // Live date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      setLiveDateStr(`${mo}월 ${d}일 ${days[now.getDay()]}`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  const themeBg =
    theme === "chalkboard"
      ? "bg-[#1a382b] text-white"
      : theme === "white"
      ? "bg-white text-slate-900"
      : theme === "navy"
      ? "bg-[#0b132b] text-white"
      : "bg-[#faf5ea] text-amber-950";

  const fontPx = Number(fontSize) || 42;
  const scaleFont = (size: number) => Math.round(size * 0.75);

  return (
    <div className="space-y-2">
      {/* 16:9 캔버스 본체 (학생 전체창 대비 75% 비율) */}
      <div className="flex justify-center w-full">
        <div
          ref={containerRef}
          id="preview-16-9-wrapper"
          className="relative w-[75%] overflow-hidden rounded-2xl shadow-lg border border-slate-300 aspect-video select-none"
          style={{ fontFamily: defaultFontFamily || "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          <div className={`absolute inset-0 ${themeBg}`}>

          {/* 요소 1: 날짜 글상자 */}
          <Rnd
            bounds="parent"
            position={{
              x: (parsePercent(layouts.dateBox.left, 2.5) / 100) * containerSize.width,
              y: (parsePercent(layouts.dateBox.top, 3.0) / 100) * containerSize.height,
            }}
            size={{
              width: layouts.dateBox.width
                ? (parsePercent(layouts.dateBox.width, 20) / 100) * containerSize.width
                : "auto",
              height: layouts.dateBox.height
                ? (parsePercent(layouts.dateBox.height, 10) / 100) * containerSize.height
                : "auto",
            }}
            onDragStop={(_e, d) => {
              const left = `${((d.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((d.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, dateBox: { ...p.dateBox, left, top } }));
            }}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              const width = `${((parseFloat(ref.style.width) / containerSize.width) * 100).toFixed(1)}%`;
              const height = `${((parseFloat(ref.style.height) / containerSize.height) * 100).toFixed(1)}%`;
              const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, dateBox: { ...p.dateBox, width, height, left, top } }));
            }}
            enableResizing={RESIZE_ENABLE}
            resizeHandleComponent={RESIZE_HANDLES}
            onClick={() => {
              onSelectElement?.("dateBox");
              const el = document.getElementById("canvas-date-text");
              if (el) {
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
            className={`z-10 group rounded-xl border transition-all font-extrabold tracking-tight whitespace-nowrap cursor-grab active:cursor-grabbing ${
              targetElement === "dateBox"
                ? "border-indigo-400/90 ring-2 ring-indigo-400/40 bg-white/5"
                : "border-transparent hover:border-white/30 bg-transparent"
            }`}
            style={{
              fontSize: `${scaleFont(layouts.dateBox.fontSize || fontPx)}px`,
              color: layouts.dateBox.color || "inherit",
              textAlign: layouts.dateBox.align || "left",
              fontFamily: layouts.dateBox.fontFamily || undefined,
            }}
          >
            <span id="canvas-date-text">
              {liveDateStr || "오늘 날짜"}
            </span>
          </Rnd>

          {/* 요소 2: 시각 글상자 (우클릭 모양/표시제 토글 지원) */}
          <CanvasClock
            layout={layouts.clockBox}
            containerSize={containerSize}
            targetElement={targetElement}
            onSelectElement={onSelectElement}
            onUpdateLayout={(updater) =>
              updateLayouts((p) => ({ ...p, clockBox: updater(p.clockBox) }))
            }
            scaleFont={scaleFont}
            fontPx={fontPx}
          />

          {/* 요소 3: 알림장 본문 — 자유 글상자(FreeCardItem) 컴포넌트로 완전 일원화 */}
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
              if (html !== undefined && html !== noticeText) {
                onNoticeTextChange(html);
              }
              if (updates) {
                updateLayouts((p) => ({
                  ...p,
                  noticeBox: {
                    ...p.noticeBox,
                    ...updates,
                  },
                }));
              }
            }}
            onRemove={() => onNoticeTextChange("")}
            placeholder="전달할 알림장 내용을 입력하세요..."
            isMainNotice
          />

          {/* 요소 4: 루틴 당번 목록 글상자 */}
          <Rnd
            bounds="parent"
            cancel="button, select, input, [contenteditable='true'], [role='dialog']"
            position={{
              x: (parsePercent(layouts.routineBox.left, 2.5) / 100) * containerSize.width,
              y: (parsePercent(layouts.routineBox.top, 82.0) / 100) * containerSize.height,
            }}
            size={{
              width: (parsePercent(layouts.routineBox.width, 95.0) / 100) * containerSize.width,
              height: layouts.routineBox.height
                ? (parsePercent(layouts.routineBox.height, 10) / 100) * containerSize.height
                : "auto",
            }}
            onDragStop={(_e, d) => {
              const left = `${((d.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((d.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, routineBox: { ...p.routineBox, left, top } }));
            }}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              const width = `${((parseFloat(ref.style.width) / containerSize.width) * 100).toFixed(1)}%`;
              const height = `${((parseFloat(ref.style.height) / containerSize.height) * 100).toFixed(1)}%`;
              const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, routineBox: { ...p.routineBox, width, height, left, top } }));
            }}
            enableResizing={RESIZE_ENABLE}
            resizeHandleComponent={RESIZE_HANDLES}
            onClick={() => onSelectElement?.("routineBox")}
            className={`z-10 group rounded-xl border transition-all font-bold opacity-95 leading-snug cursor-grab active:cursor-grabbing ${
              targetElement === "routineBox"
                ? "border-indigo-400/90 ring-2 ring-indigo-400/40 bg-white/5"
                : "border-transparent hover:border-white/30 bg-transparent"
            }`}
            style={{
              fontSize: `${scaleFont(layouts.routineBox.fontSize || fontPx)}px`,
              color: layouts.routineBox.color || "inherit",
              textAlign: layouts.routineBox.align || "left",
              fontFamily: layouts.routineBox.fontFamily || undefined,
              lineHeight: layouts.routineBox.lineHeight ? `${layouts.routineBox.lineHeight}` : "1.4",
            }}
          >
            <div
              id="canvas-routine-container"
              className="flex items-center gap-4 sm:gap-6 flex-wrap w-full"
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
                  {routines
                    .filter((r) => r.visibleInNotice !== false)
                    .map((r) => (
                    <RoutineElementInCanvas
                      key={r.id}
                      routine={r}
                      students={students}
                      currencyName={currencyName}
                      theme={theme}
                      customColor={layouts.routineBox.color}
                      onPayRoutineToday={onPayRoutineToday}
                      onPayAllRoutinesToday={onPayAllRoutinesToday}
                      onUpdateRoutine={onUpdateRoutine}
                      onAdvanceRoutine={onAdvanceRoutine}
                    />
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {onAdvanceAllRoutines && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdvanceAllRoutines();
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRoutineNoticeSettings();
                        }}
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

          {freeCards.map((card) => (
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
              onUpdateLayout={(updater) => updateLayouts((p) => ({ ...p, accountBox: updater(p.accountBox ?? DEFAULT_LAYOUTS.accountBox!) }))}
            />
          )}
        </div>
      </div>
    </div>
  </div>
);
}
