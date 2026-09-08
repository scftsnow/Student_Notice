"use client";

import React, { RefObject } from "react";

export function useCanvasDrag(containerRef: RefObject<HTMLDivElement>) {
  const handleMoveStart = (
    e: React.MouseEvent,
    currentLeftStr: string,
    currentTopStr: string,
    onMove: (left: string, top: string) => void,
    onClick?: () => void
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseFloat(currentLeftStr) || 0;
    const startTop = parseFloat(currentTopStr) || 0;
    let hasDragged = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasDragged && dist > 4) {
        hasDragged = true;
      }
      if (hasDragged) {
        const dxPercent = ((moveEvent.clientX - startX) / rect.width) * 100;
        const dyPercent = ((moveEvent.clientY - startY) / rect.height) * 100;
        const nextLeft = Math.max(0, Math.min(95, startLeft + dxPercent));
        const nextTop = Math.max(0, Math.min(95, startTop + dyPercent));
        onMove(`${nextLeft.toFixed(1)}%`, `${nextTop.toFixed(1)}%`);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (!hasDragged && onClick) {
        onClick();
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    currentWidthStr: string,
    currentHeightStr: string,
    onResize: (width: string, height: string) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseFloat(currentWidthStr) || 30;
    const startHeight = parseFloat(currentHeightStr) || 20;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dxPercent = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dyPercent = ((moveEvent.clientY - startY) / rect.height) * 100;
      const nextWidth = Math.max(10, Math.min(100, startWidth + dxPercent));
      const nextHeight = Math.max(5, Math.min(100, startHeight + dyPercent));
      onResize(`${nextWidth.toFixed(1)}%`, `${nextHeight.toFixed(1)}%`);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return { handleMoveStart, handleResizeStart };
}
