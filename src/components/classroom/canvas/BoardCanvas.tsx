"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import FreeCardItem from "./FreeCardItem";
import RoutineElementInCanvas from "./RoutineElementInCanvas";
import {
  BoardTheme,
  NoticeFontSize,
  ClassroomRoutine,
  ClassroomStudent,
  FreeCardData,
  BoardElementLayouts,
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
  onPayRoutineToday?: (id: string, workers?: string[]) => void;
  onPayAllRoutinesToday?: () => void;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onAdvanceRoutine?: (id: string) => void;
  onAdvanceAllRoutines?: () => void;
  targetElement?: import("@/types/classroom").BoardTargetElement;
  onSelectElement?: (target: import("@/types/classroom").BoardTargetElement) => void;
  onCurrentFontSize?: (size: number) => void;
  appliedStyle?: {
    target: import("@/types/classroom").BoardTargetElement;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    timestamp: number;
  } | null;
}

const DEFAULT_LAYOUTS: BoardElementLayouts = {
  dateBox: { left: "2.5%", top: "3.0%", fontSize: 42 },
  clockBox: { left: "68.0%", top: "3.0%", fontSize: 42 },
  noticeBox: { left: "2.5%", top: "16.0%", width: "95.0%", height: "62.0%" },
  routineBox: { left: "2.5%", top: "82.0%", width: "95.0%", fontSize: 42 },
};

const RESIZE_ENABLE = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
};

const RESIZE_HANDLES = {
  top: <div title="크기 조절 핸들" data-handle="top" className="w-full h-full" />,
  right: <div title="크기 조절 핸들" data-handle="right" className="w-full h-full" />,
  bottom: <div title="크기 조절 핸들" data-handle="bottom" className="w-full h-full" />,
  left: <div title="크기 조절 핸들" data-handle="left" className="w-full h-full" />,
  topLeft: <div title="크기 조절 핸들" data-handle="topLeft" className="w-full h-full" />,
  topRight: <div title="크기 조절 핸들" data-handle="topRight" className="w-full h-full" />,
  bottomLeft: <div title="크기 조절 핸들" data-handle="bottomLeft" className="w-full h-full" />,
  bottomRight: <div title="크기 조절 핸들" data-handle="bottomRight" className="w-full h-full" />,
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
  targetElement = "noticeBox",
  onSelectElement,
  onCurrentFontSize,
  appliedStyle,
}: BoardCanvasProps) {
  const [clockStr, setClockStr] = useState("14:00:00");
  const [liveDateStr, setLiveDateStr] = useState("");
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

  // Load layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("classroom_board_layouts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dateBox && parsed.clockBox && parsed.noticeBox && parsed.routineBox) {
          setLayouts(parsed);
        }
      }
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

  // 외부 툴바 스타일(크기, 색상, 정렬) 변경 적용
  useEffect(() => {
    if (!appliedStyle?.timestamp) return;
    const { target, color, fontSize: styleFontSize, align } = appliedStyle;
    updateLayouts((prev) => {
      if (target === "all") {
        return {
          dateBox: { ...prev.dateBox, ...(color && { color }), ...(styleFontSize && { fontSize: styleFontSize }) },
          clockBox: { ...prev.clockBox, ...(color && { color }), ...(styleFontSize && { fontSize: styleFontSize }) },
          noticeBox: { ...prev.noticeBox, ...(color && { color }), ...(styleFontSize && { fontSize: styleFontSize }), ...(align && { align }) },
          routineBox: { ...prev.routineBox, ...(color && { color }), ...(styleFontSize && { fontSize: styleFontSize }) },
        };
      }
      if (target === "noticeBox" || target === "dateBox" || target === "clockBox" || target === "routineBox") {
        const current = prev[target as keyof BoardElementLayouts];
        return {
          ...prev,
          [target]: {
            ...current,
            ...(color && { color }),
            ...(styleFontSize && { fontSize: styleFontSize }),
            ...(align && { align }),
          },
        };
      }
      return prev;
    });

    if (target === "all" || target === "freeCard") {
      freeCards.forEach((c) => {
        onUpdateFreeCard(c.id, c.html, {
          ...(color && { color }),
          ...(styleFontSize && { fontSize: styleFontSize }),
          ...(align && { align }),
        });
      });
    } else {
      const fc = freeCards.find((c) => c.id === target);
      if (fc) {
        onUpdateFreeCard(fc.id, fc.html, {
          ...(color && { color }),
          ...(styleFontSize && { fontSize: styleFontSize }),
          ...(align && { align }),
        });
      }
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

  // 선택 요소 변경 시 해당 요소의 실제 fontSize를 부모 툴바로 전달
  useEffect(() => {
    if (!onCurrentFontSize) return;
    const fontPxCurrent = Number(fontSize) || 42;
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
  }, [targetElement, layouts, freeCards, fontSize, onCurrentFontSize]);

  // Live clock and date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setClockStr(`${h}:${m}:${s}`);
      const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      setLiveDateStr(`${mo}월 ${d}일 ${days[now.getDay()]}`);
    };
    update();
    const timer = setInterval(update, 1000);
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

  return (
    <div className="space-y-2">
      {/* 상단 툴바 안내 */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700">🖥️ 전자칠판 판서 화면</span>
        <button
          type="button"
          onClick={onAddFreeCard}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors border border-indigo-200"
        >
          <Plus className="w-3.5 h-3.5" />
          자유 글상자 추가
        </button>
      </div>

      {/* 16:9 캔버스 본체 */}
      <div
        ref={containerRef}
        id="preview-16-9-wrapper"
        className="relative w-full overflow-hidden rounded-2xl shadow-lg border border-slate-300 aspect-video select-none"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}
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
            onClick={() => onSelectElement?.("dateBox")}
            className={`z-10 group rounded-xl border transition-colors font-extrabold tracking-tight whitespace-nowrap cursor-grab active:cursor-grabbing bg-transparent ${
              targetElement === "dateBox"
                ? "border-transparent hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30"
                : "border-transparent hover:border-white/30"
            }`}
            style={{
              fontSize: `${layouts.dateBox.fontSize || fontPx}px`,
              color: layouts.dateBox.color || "inherit",
              textAlign: layouts.dateBox.align || "left",
            }}
          >
            <span id="canvas-date-text">
              {liveDateStr || "오늘 날짜"}
            </span>
          </Rnd>

          {/* 요소 2: 시각 글상자 */}
          <Rnd
            bounds="parent"
            cancel="button"
            position={{
              x: (parsePercent(layouts.clockBox.left, 68.0) / 100) * containerSize.width,
              y: (parsePercent(layouts.clockBox.top, 3.0) / 100) * containerSize.height,
            }}
            size={{
              width: layouts.clockBox.width
                ? (parsePercent(layouts.clockBox.width, 18) / 100) * containerSize.width
                : "auto",
              height: layouts.clockBox.height
                ? (parsePercent(layouts.clockBox.height, 10) / 100) * containerSize.height
                : "auto",
            }}
            onDragStop={(_e, d) => {
              const left = `${((d.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((d.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, clockBox: { ...p.clockBox, left, top } }));
            }}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
              const width = `${((parseFloat(ref.style.width) / containerSize.width) * 100).toFixed(1)}%`;
              const height = `${((parseFloat(ref.style.height) / containerSize.height) * 100).toFixed(1)}%`;
              const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
              const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
              updateLayouts((p) => ({ ...p, clockBox: { ...p.clockBox, width, height, left, top } }));
            }}
            enableResizing={RESIZE_ENABLE}
            resizeHandleComponent={RESIZE_HANDLES}
            onClick={() => onSelectElement?.("clockBox")}
            className={`z-10 group rounded-xl border transition-colors font-mono font-black tracking-wider whitespace-nowrap opacity-90 cursor-grab active:cursor-grabbing bg-transparent ${
              targetElement === "clockBox"
                ? "border-transparent hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30"
                : "border-transparent hover:border-white/30"
            }`}
            style={{
              fontSize: `${layouts.clockBox.fontSize || fontPx}px`,
              color: layouts.clockBox.color || "inherit",
              textAlign: layouts.clockBox.align || "right",
            }}
          >
            <span id="canvas-clock-text">
              {clockStr}
            </span>
          </Rnd>

          {/* 요소 3: 알림장 본문 — 자유 글상자(FreeCardItem) 컴포넌트로 완전 일원화 */}
          <FreeCardItem
            card={{
              id: "noticeBox",
              html: noticeText,
              left: layouts.noticeBox.left,
              top: layouts.noticeBox.top,
              width: layouts.noticeBox.width || "95.0%",
              height: layouts.noticeBox.height || "62.0%",
              fontSize: layouts.noticeBox.fontSize || fontPx,
              color: layouts.noticeBox.color,
              align: layouts.noticeBox.align,
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
            cancel="button, select, input, [role='dialog']"
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
            className={`z-10 group rounded-xl border transition-colors font-bold opacity-95 leading-snug cursor-grab active:cursor-grabbing bg-transparent ${
              targetElement === "routineBox"
                ? "border-transparent hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30"
                : "border-transparent hover:border-white/30"
            }`}
            style={{
              fontSize: `${layouts.routineBox.fontSize || fontPx}px`,
              color: layouts.routineBox.color || "inherit",
              textAlign: layouts.routineBox.align || "left",
            }}
          >
            <div
              id="canvas-routine-container"
              className="flex items-center gap-4 sm:gap-6 flex-wrap w-full"
              style={{ fontSize: "inherit" }}
            >
              {routines.length === 0 ? (
                <span className="opacity-50 italic text-xs">등록된 학생 업무가 없습니다.</span>
              ) : (
                <>
                  {routines.map((r) => (
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
                  {onAdvanceAllRoutines && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdvanceAllRoutines();
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 text-white/90 hover:text-white transition-all font-bold select-none border border-white/20 ml-auto leading-tight shrink-0 shadow-xs cursor-pointer"
                      title="모든 학생 업무의 순번을 다음으로 일괄 넘기기"
                    >
                      전체 넘기기 ⏩
                    </button>
                  )}
                </>
              )}
            </div>
          </Rnd>

          {/* 요소 5: 추가 자유 글상자 레이어 */}
          {freeCards.map((card) => (
            <FreeCardItem
              key={card.id}
              card={card}
              containerSize={containerSize}
              isSelected={targetElement === card.id}
              onSelect={() => onSelectElement?.(card.id)}
              onUpdate={onUpdateFreeCard}
              onRemove={onRemoveFreeCard}
            />
          ))}

        </div>
      </div>
    </div>
  );
}
