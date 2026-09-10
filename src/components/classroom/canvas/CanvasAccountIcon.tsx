"use client";

import React, { useRef } from "react";
import { Rnd } from "react-rnd";
import { Coins } from "lucide-react";
import { ElementLayout, BoardTargetElement } from "@/types/classroom";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import { parsePercent, parseDimension, toPct, clampPos } from "@/lib/canvasUtils";

interface CanvasAccountIconProps {
  layout?: ElementLayout;
  containerSize: { width: number; height: number };
  targetElement?: BoardTargetElement;
  onSelectElement?: (elem: BoardTargetElement) => void;
  onUpdateLayout: (updater: (prev: ElementLayout) => ElementLayout) => void;
  scaleFont?: (size: number) => number;
}

export default function CanvasAccountIcon({
  layout,
  containerSize,
  targetElement,
  onSelectElement,
  onUpdateLayout,
  scaleFont,
}: CanvasAccountIconProps) {
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);

  const leftPct = parsePercent(layout?.left, 93.0);
  const topPct = parsePercent(layout?.top, 3.0);
  const defaultSize = scaleFont ? scaleFont(50) : 50;
  const widthPx = parseDimension(layout?.width, containerSize.width, defaultSize);
  const heightPx = parseDimension(layout?.height, containerSize.height, defaultSize);
  const isSelected = targetElement === "accountBox";

  const handleOpenAccountBoard = () => {
    if (typeof window !== "undefined") {
      const w = 1100;
      const h = 750;
      const left = Math.max(0, Math.round((window.screen.width - w) / 2));
      const top = Math.max(0, Math.round((window.screen.height - h) / 2));
      window.open(
        "/economy/board",
        "StudentEconomyBoardWindow",
        `width=${w},height=${h},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`,
      );
    }
  };

  return (
    <Rnd
      position={{
        x: (leftPct / 100) * containerSize.width,
        y: (topPct / 100) * containerSize.height,
      }}
      size={{ width: widthPx, height: heightPx }}
      minWidth={28}
      minHeight={28}
      onDragStart={() => {
        isDragging.current = false;
        dragStartTime.current = Date.now();
      }}
      onDrag={() => { isDragging.current = true; }}
      onDragStop={(_e, d) => {
        const clamped = clampPos(d, containerSize, widthPx - 12, heightPx - 12);
        onUpdateLayout((prev) => ({
          ...prev,
          left: toPct(clamped.x, containerSize.width),
          top: toPct(clamped.y, containerSize.height),
          width: `${Math.round(widthPx)}px`,
          height: `${Math.round(heightPx)}px`,
        }));
        setTimeout(() => { isDragging.current = false; }, 150);
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onUpdateLayout((prev) => ({
          ...prev,
          left: toPct(position.x, containerSize.width),
          top: toPct(position.y, containerSize.height),
          width: `${Math.round(parseFloat(ref.style.width))}px`,
          height: `${Math.round(parseFloat(ref.style.height))}px`,
        }));
      }}
      enableResizing={RESIZE_ENABLE}
      resizeHandleComponent={RESIZE_HANDLES}
      className={`z-20 group rounded-2xl transition-all cursor-grab active:cursor-grabbing select-none flex items-center justify-center p-1.5 ${
        isSelected
          ? "ring-2 ring-amber-400 bg-amber-400/20 shadow-lg"
          : "hover:ring-1 hover:ring-white/40 hover:bg-white/10"
      }`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectElement?.("accountBox");
        if (!isDragging.current && Date.now() - dragStartTime.current < 300) {
          handleOpenAccountBoard();
        }
      }}
      title="학생 계좌(화폐 전광판) 창 열기 (드래그하여 이동, 모서리로 크기 조절)"
    >
      <div className="w-full h-full flex items-center justify-center pointer-events-none">
        <Coins
          className="w-full h-full text-amber-300 drop-shadow-md transition-transform group-hover:scale-105"
          style={layout?.color ? { color: layout.color } : undefined}
        />
      </div>
    </Rnd>
  );
}
