"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import type { RndResizeCallback, RndResizeStartCallback } from "react-rnd";
import { Clock, Check, GripHorizontal, Hash } from "lucide-react";
import { ElementLayout, BoardTargetElement } from "@/types/classroom";
import AnalogClock from "./AnalogClock";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import {
  parsePercent,
  toPct,
  makeDragSaveHandler,
  makeResizeSaveHandler,
  selectedBorderClass,
} from "@/lib/canvasUtils";

interface CanvasClockProps {
  layout: ElementLayout;
  containerSize: { width: number; height: number };
  targetElement?: BoardTargetElement;
  onSelectElement?: (elem: BoardTargetElement) => void;
  onUpdateLayout: (updater: (prev: ElementLayout) => ElementLayout) => void;
  scaleFont: (size: number) => number;
  fontPx: number;
  scale?: number;
}

export default function CanvasClock({
  layout,
  containerSize,
  targetElement,
  onSelectElement,
  onUpdateLayout,
  scaleFont,
  fontPx,
  scale,
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

  const analogClockPx = Math.round(scaleFont(layout.fontSize || fontPx) * 2.2);

  // --- 아날로그 시계: 모서리 드래그 시 가로세로 비율 고정 ---
  const MIN_ANALOG_PX = 60;
  const ratioRef = useRef(1);
  const baseRef = useRef<{ w: number; h: number; left: number; top: number } | null>(null);

  const currentLeftPx = (parsePercent(layout.left, 68.0) / 100) * containerSize.width;
  const currentTopPx = (parsePercent(layout.top, 3.0) / 100) * containerSize.height;

  /** 드래그 시작 시점의 비율·크기 기억 (스케일된 화면 좌표가 아닌 실제 CSS 픽셀 사용) */
  const handleAnalogResizeStart: RndResizeStartCallback = (_e, _dir, ref) => {
    const w = ref.offsetWidth || 1;
    const h = ref.offsetHeight || 1;
    ratioRef.current = w / h;
    baseRef.current = { w, h, left: currentLeftPx, top: currentTopPx };
  };

  /** 크기 변경량을 비율에 맞춰 한 축으로 통일 (클릭한 모서리의 반대편 고정) */
  const handleAnalogResize: RndResizeCallback = (_e, dir, ref, delta) => {
    const base = baseRef.current;
    if (!base) return;
    const byWidth = Math.abs(delta.width - base.w) >= Math.abs(delta.height - base.h);
    let nextW = byWidth ? delta.width : delta.height * ratioRef.current;
    let nextH = byWidth ? nextW / ratioRef.current : delta.height;
    if (nextW < MIN_ANALOG_PX) nextW = MIN_ANALOG_PX;
    if (nextH < MIN_ANALOG_PX) nextH = MIN_ANALOG_PX;
    ref.style.width = `${Math.round(nextW)}px`;
    ref.style.height = `${Math.round(nextH)}px`;
    ref.style.left = `${Math.round(base.left + (dir.includes("w") ? base.w - nextW : 0))}px`;
    ref.style.top = `${Math.round(base.top + (dir.includes("n") ? base.h - nextH : 0))}px`;
  };

  /** 비율 고정 결과를 레이아웃에 저장 (반대편 모서리는 그대로) */
  const handleAnalogResizeStop: RndResizeCallback = (_e, dir, ref) => {
    const base = baseRef.current;
    baseRef.current = null;
    const nextW = parseFloat(ref.style.width) || base?.w || 0;
    const nextH = parseFloat(ref.style.height) || base?.h || 0;
    const left = base && dir.includes("w") ? base.left + base.w - nextW : (base?.left ?? currentLeftPx);
    const top = base && dir.includes("n") ? base.top + base.h - nextH : (base?.top ?? currentTopPx);
    onUpdateLayout((p) => ({
      ...p,
      width: toPct(nextW, containerSize.width),
      height: toPct(nextH, containerSize.height),
      left: toPct(left, containerSize.width),
      top: toPct(top, containerSize.height),
    }));
  };

  return (
    <>
      <Rnd
        scale={scale}
        cancel="button"
        position={{
          x: (parsePercent(layout.left, 68.0) / 100) * containerSize.width,
          y: (parsePercent(layout.top, 3.0) / 100) * containerSize.height,
        }}
        size={{
          width: layout.width
            ? (parsePercent(layout.width, isAnalog ? 10 : 22) / 100) * containerSize.width
            : isAnalog
            ? analogClockPx
            : "auto",
          height: layout.height
            ? (parsePercent(layout.height, isAnalog ? 18 : 10) / 100) * containerSize.height
            : isAnalog
            ? analogClockPx + 24
            : "auto",
        }}
        onDragStop={makeDragSaveHandler(
          containerSize,
          isAnalog ? analogClockPx : 120,
          isAnalog ? analogClockPx : 40,
          (left, top) => onUpdateLayout((p) => ({ ...p, left, top })),
        )}
        onResizeStart={isAnalog ? handleAnalogResizeStart : undefined}
        onResize={isAnalog ? handleAnalogResize : undefined}
        onResizeStop={
          isAnalog
            ? handleAnalogResizeStop
            : makeResizeSaveHandler(
                containerSize,
                (width, height, left, top) => onUpdateLayout((p) => ({ ...p, width, height, left, top })),
              )
        }
        enableResizing={RESIZE_ENABLE}
        resizeHandleComponent={RESIZE_HANDLES}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelectElement?.("clockBox"); }}
        onContextMenu={handleContextMenu}
        className={`z-10 group rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col ${
          isAnalog ? "" : "font-mono font-black tracking-wider whitespace-nowrap opacity-90"
        } ${selectedBorderClass(targetElement === "clockBox")}`}
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
          {/* 모양 전환 토글 (현재 모양 아이콘 클릭 시 반대 모양으로 전환) */}
          <div className="ml-auto flex items-center" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              title={isAnalog ? "숫자 시계로 전환" : "아날로그 시계로 전환"}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateLayout((p) => ({ ...p, clockType: isAnalog ? "digital" : "analog" }));
              }}
              className="p-0.5 rounded text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            >
              {isAnalog ? <Hash className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          {isAnalog ? (
            <div
              className="aspect-square flex items-center justify-center pointer-events-none p-1"
              style={{
                width: layout.width ? "100%" : `${analogClockPx}px`,
                height: "auto",
              }}
            >
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
