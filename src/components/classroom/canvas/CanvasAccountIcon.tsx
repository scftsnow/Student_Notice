"use client";

import React from "react";
import { Rnd } from "react-rnd";
import { Coins } from "lucide-react";
import { ElementLayout, BoardTargetElement } from "@/types/classroom";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import {
  parsePercent,
  parseDimension,
  makeDragSaveHandler,
  makeResizeSaveHandler,
} from "@/lib/canvasUtils";

interface CanvasAccountIconProps {
  layout?: ElementLayout;
  containerSize: { width: number; height: number };
  targetElement?: BoardTargetElement;
  onSelectElement?: (elem: BoardTargetElement) => void;
  onUpdateLayout: (updater: (prev: ElementLayout) => ElementLayout) => void;
  scaleFont?: (size: number) => number;
  scale?: number;
}

export default function CanvasAccountIcon({
  layout,
  containerSize,
  targetElement,
  onSelectElement,
  onUpdateLayout,
  scale,
}: CanvasAccountIconProps) {
  const leftPct = parsePercent(layout?.left, 93.0);
  const topPct = parsePercent(layout?.top, 89.0);
  const widthPx = layout?.width
    ? parseDimension(layout.width, containerSize.width, 50)
    : 50;
  const heightPx = layout?.height
    ? parseDimension(layout.height, containerSize.height, 50)
    : 50;
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
      scale={scale}
      position={{
        x: (leftPct / 100) * containerSize.width,
        y: (topPct / 100) * containerSize.height,
      }}
      size={{ width: widthPx, height: heightPx }}
      minWidth={28}
      minHeight={28}
      onDragStop={makeDragSaveHandler(
        containerSize,
        widthPx,
        heightPx,
        (left, top) => onUpdateLayout((prev) => ({ ...prev, left, top })),
      )}
      onResizeStop={makeResizeSaveHandler(
        containerSize,
        (width, height, left, top) =>
          onUpdateLayout((prev) => ({ ...prev, width, height, left, top })),
      )}
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
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        handleOpenAccountBoard();
      }}
      title="학생 계좌 아이콘 (클릭: 선택, 더블클릭: 전광판 열기, 드래그: 이동, 모서리: 크기 조절)"
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
