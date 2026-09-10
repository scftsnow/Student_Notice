"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { Clock, Check, GripHorizontal } from "lucide-react";
import { ElementLayout } from "@/types/classroom";
import AnalogClock from "./AnalogClock";

interface CanvasClockProps {
  layout: ElementLayout;
  containerSize: { width: number; height: number };
  targetElement?: string;
  onSelectElement?: (elem: string) => void;
  onUpdateLayout: (updater: (prev: ElementLayout) => ElementLayout) => void;
  scaleFont: (size: number) => number;
  fontPx: number;
}

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

export default function CanvasClock({
  layout,
  containerSize,
  targetElement,
  onSelectElement,
  onUpdateLayout,
  scaleFont,
  fontPx,
}: CanvasClockProps) {
  const [now, setNow] = useState<Date>(new Date());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => setNow(new Date());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const parsePercent = (val: string | undefined, fallback: number) => {
    if (!val) return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  const isAnalog = layout.clockType === "analog";
  const is12h = layout.clockFormat === "12h";

  // 디지털 시계 문자열 생성
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  let digitalStr = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;

  if (is12h) {
    const period = hours < 12 ? "오전" : "오후";
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    digitalStr = `${period} ${h12}:${minutes}:${seconds}`;
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = isAnalog ? 140 : 220;
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
    setContextMenu({ x, y });
  };

  return (
    <>
      <Rnd
        cancel="button"
        position={{
          x: (parsePercent(layout.left, 68.0) / 100) * containerSize.width,
          y: (parsePercent(layout.top, 3.0) / 100) * containerSize.height,
        }}
        size={{
          width: layout.width
            ? (parsePercent(layout.width, isAnalog ? 10 : 22) / 100) * containerSize.width
            : "auto",
          height: layout.height
            ? (parsePercent(layout.height, isAnalog ? 18 : 10) / 100) * containerSize.height
            : "auto",
        }}
        onDragStop={(_e, d) => {
          const clockW = isAnalog ? 80 : 120;
          const clockH = isAnalog ? 80 : 40;
          const clampedX = Math.max(-clockW + 40, Math.min(d.x, containerSize.width - 40));
          const clampedY = Math.max(-clockH + 40, Math.min(d.y, containerSize.height - 40));
          const left = `${((clampedX / containerSize.width) * 100).toFixed(1)}%`;
          const top = `${((clampedY / containerSize.height) * 100).toFixed(1)}%`;
          onUpdateLayout((p) => ({ ...p, left, top }));
        }}
        onResizeStop={(_e, _dir, ref, _delta, position) => {
          const width = `${((parseFloat(ref.style.width) / containerSize.width) * 100).toFixed(1)}%`;
          const height = `${((parseFloat(ref.style.height) / containerSize.height) * 100).toFixed(1)}%`;
          const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
          const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
          onUpdateLayout((p) => ({ ...p, width, height, left, top }));
        }}
        enableResizing={RESIZE_ENABLE}
        resizeHandleComponent={RESIZE_HANDLES}
        onClick={() => onSelectElement?.("clockBox")}
        onContextMenu={handleContextMenu}
        className={`z-10 group rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col ${
          isAnalog ? "" : "font-mono font-black tracking-wider whitespace-nowrap opacity-90"
        } ${
          targetElement === "clockBox"
            ? "border-indigo-400/90 ring-2 ring-indigo-400/40 bg-white/5"
            : "border-transparent hover:border-white/30 bg-transparent"
        }`}
        style={{
          fontSize: `${scaleFont(layout.fontSize || fontPx)}px`,
          color: layout.color || "inherit",
          textAlign: layout.align || (isAnalog ? "center" : "right"),
        }}
      >
        {/* 시계 상단바 */}
        <div
          className={`transition-opacity flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/40 rounded-t-xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
            targetElement === "clockBox" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onContextMenu={handleContextMenu}
        >
          <GripHorizontal className="w-3.5 h-3.5 text-white/70" />
          <span className="text-[10px] font-bold tracking-tight text-white/70">시계</span>
        </div>
        <div className="flex items-center justify-center flex-1">
          {isAnalog ? (
            <div className="w-full h-full aspect-square flex items-center justify-center pointer-events-none">
              <AnalogClock color={layout.color || "currentColor"} size="100%" />
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 px-2 py-1">
              <span id="canvas-clock-text">{digitalStr}</span>
            </div>
          )}
        </div>
      </Rnd>

      {/* 우클릭 최상위 포털 컨텍스트 메뉴 */}
      {mounted && contextMenu && createPortal(
        <>
          {/* 전체화면 투명 백드롭 (뒤쪽 글상자 클릭 차단) */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
            }}
          />

          {/* 컨텍스트 메뉴 창 */}
          <div
            className="fixed z-[99999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-white text-xs p-2 space-y-2 min-w-[210px] select-none"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="px-1.5 py-1 text-[11px] font-bold text-slate-400 border-b border-white/10 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>시계 설정</span>
            </div>

            {/* 시계 모양 토글 */}
            <div className="space-y-0.5">
              <span className="px-1.5 text-[10px] text-slate-400 font-semibold block">시계 모양</span>
              <button
                type="button"
                onClick={() => {
                  onUpdateLayout((p) => ({ ...p, clockType: "digital" }));
                  setContextMenu(null);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs transition-colors ${
                  !isAnalog ? "bg-white/15 text-white font-bold" : "text-slate-300 font-medium"
                }`}
              >
                <span>숫자 시계</span>
                {!isAnalog && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateLayout((p) => ({ ...p, clockType: "analog" }));
                  setContextMenu(null);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs transition-colors ${
                  isAnalog ? "bg-white/15 text-white font-bold" : "text-slate-300 font-medium"
                }`}
              >
                <span>아날로그 시계</span>
                {isAnalog && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>

            {/* 시간 표시제 토글 — 아날로그 시계면 표시 안 함 */}
            {!isAnalog && (
              <div className="space-y-0.5 pt-1.5 border-t border-white/10">
                <span className="px-1.5 text-[10px] text-slate-400 font-semibold block">시간 표시제</span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateLayout((p) => ({ ...p, clockFormat: "24h" }));
                    setContextMenu(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs transition-colors ${
                    !is12h ? "bg-white/15 text-white font-bold" : "text-slate-300 font-medium"
                  }`}
                >
                  <span>24시간제</span>
                  {!is12h && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateLayout((p) => ({ ...p, clockFormat: "12h" }));
                    setContextMenu(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs transition-colors ${
                    is12h ? "bg-white/15 text-white font-bold" : "text-slate-300 font-medium"
                  }`}
                >
                  <span>12시간제 (오전/오후)</span>
                  {is12h && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
