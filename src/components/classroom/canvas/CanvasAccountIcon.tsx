"use client";

import React, { useRef } from "react";
import { Rnd } from "react-rnd";
import { Coins } from "lucide-react";
import { ElementLayout } from "@/types/classroom";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";

interface CanvasAccountIconProps {
  layout?: ElementLayout;
  containerSize: { width: number; height: number };
  targetElement?: string;
  onSelectElement?: (elem: string) => void;
  onUpdateLayout: (updater: (prev: ElementLayout) => ElementLayout) => void;
}

export default function CanvasAccountIcon({
  layout,
  containerSize,
  targetElement,
  onSelectElement,
  onUpdateLayout,
}: CanvasAccountIconProps) {
  const isDragging = useRef(false);
  const dragStartTime = useRef(0);

  const parsePercent = (val: string | undefined, fallback: number) => {
    if (!val) return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  const leftPct = parsePercent(layout?.left, 93.0);
  const topPct = parsePercent(layout?.top, 3.0);

  const parseDimension = (val: string | undefined, totalPx: number, fallbackPx: number) => {
    if (!val) return fallbackPx;
    if (val.endsWith("%")) {
      const num = parseFloat(val);
      return (num / 100) * totalPx;
    }
    const num = parseFloat(val);
    return isNaN(num) ? fallbackPx : num;
  };

  const widthPx = parseDimension(layout?.width, containerSize.width, 50);
  const heightPx = parseDimension(layout?.height, containerSize.height, 50);

  const isSelected = targetElement === "accountBox";

  const handleOpenAccountBoard = () => {
    if (typeof window !== "undefined") {
      const width = 1100;
      const height = 750;
      const left = Math.max(0, Math.round((window.screen.width - width) / 2));
      const top = Math.max(0, Math.round((window.screen.height - height) / 2));
      window.open(
        "/economy/board",
        "StudentEconomyBoardWindow",
        `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
      );
    }
  };

  return (
    <Rnd
      position={{
        x: (leftPct / 100) * containerSize.width,
        y: (topPct / 100) * containerSize.height,
      }}
      size={{
        width: widthPx,
        height: heightPx,
      }}
      minWidth={28}
      minHeight={28}
      onDragStart={() => {
        isDragging.current = false;
        dragStartTime.current = Date.now();
      }}
      onDrag={() => {
        isDragging.current = true;
      }}
      onDragStop={(_e, d) => {
        const clampedX = Math.max(-widthPx + 28, Math.min(d.x, containerSize.width - 28));
        const clampedY = Math.max(-heightPx + 28, Math.min(d.y, containerSize.height - 28));
        const left = `${((clampedX / containerSize.width) * 100).toFixed(1)}%`;
        const top = `${((clampedY / containerSize.height) * 100).toFixed(1)}%`;
        onUpdateLayout((prev) => ({
          ...prev,
          left,
          top,
          width: `${Math.round(widthPx)}px`,
          height: `${Math.round(heightPx)}px`,
        }));
        setTimeout(() => {
          isDragging.current = false;
        }, 150);
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
        const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
        const width = `${Math.round(parseFloat(ref.style.width))}px`;
        const height = `${Math.round(parseFloat(ref.style.height))}px`;
        onUpdateLayout((prev) => ({
          ...prev,
          left,
          top,
          width,
          height,
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
        // 드래그 중이 아니며 짧은 탭/클릭일 때만 학생 계좌 창 오픈
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
