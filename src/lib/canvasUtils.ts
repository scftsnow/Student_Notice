/**
 * canvasUtils.ts
 * 캔버스 요소(BoardCanvas, FreeCardItem, CanvasClock, CanvasAccountIcon) 공통 유틸리티.
 * 위치/크기 퍼센트 변환, 드래그·리사이즈 핸들러 팩토리, 선택 상태 클래스 문자열을 제공.
 */

import type { RndDragEvent, DraggableData, RndResizeCallback } from "react-rnd";

// ── 1. 기본 퍼센트/치수 파서 ──────────────────────────────────────────────

/** "%12.5" 또는 "12.5%" → number. 파싱 실패 시 fallback 반환. */
export function parsePercent(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

/**
 * px 또는 % 문자열을 픽셀 수치로 변환.
 * "50%" → totalPx * 0.5 / "120px" 또는 "120" → 120.
 */
export function parseDimension(
  val: string | undefined,
  totalPx: number,
  fallbackPx: number,
): number {
  if (!val) return fallbackPx;
  if (val.endsWith("%")) {
    const num = parseFloat(val);
    return isNaN(num) ? fallbackPx : (num / 100) * totalPx;
  }
  const num = parseFloat(val);
  return isNaN(num) ? fallbackPx : num;
}

// ── 2. 퍼센트 문자열 생성 ──────────────────────────────────────────────────

/** px 좌표를 컨테이너 기준 "12.3%" 형식 문자열로 변환. */
export function toPct(px: number, total: number): string {
  return `${((px / total) * 100).toFixed(1)}%`;
}

// ── 3. 좌표 클램핑 ────────────────────────────────────────────────────────

export interface ContainerSize {
  width: number;
  height: number;
}

/**
 * 드래그 후 {x, y} 좌표를 컨테이너 경계 안으로 클램핑.
 * elW / elH 는 요소의 픽셀 크기 (최소 가시 영역 확보에 사용).
 */
export function clampPos(
  pos: { x: number; y: number },
  container: ContainerSize,
  elW = 40,
  elH = 40,
): { x: number; y: number } {
  return {
    x: Math.max(-elW + 40, Math.min(pos.x, container.width - 40)),
    y: Math.max(-elH + 40, Math.min(pos.y, container.height - 40)),
  };
}

// ── 4. 드래그/리사이즈 핸들러 팩토리 ──────────────────────────────────────

type DragSaveFn = (left: string, top: string) => void;
type ResizeSaveFn = (width: string, height: string, left: string, top: string) => void;

/**
 * react-rnd onDragStop 핸들러를 생성.
 * 드래그 완료 좌표를 % 문자열로 변환해 onSave 에 전달.
 */
export function makeDragSaveHandler(
  container: ContainerSize,
  elW: number,
  elH: number,
  onSave: DragSaveFn,
): (_e: RndDragEvent, d: DraggableData) => void {
  return (_e, d) => {
    const clamped = clampPos(d, container, elW, elH);
    onSave(toPct(clamped.x, container.width), toPct(clamped.y, container.height));
  };
}

/**
 * react-rnd onResizeStop 핸들러를 생성.
 * 리사이즈 완료 크기와 위치를 % 문자열로 변환해 onSave 에 전달.
 */
export function makeResizeSaveHandler(
  container: ContainerSize,
  onSave: ResizeSaveFn,
): RndResizeCallback {
  return (_e, _dir, ref, _delta, position) => {
    const width = toPct(parseFloat(ref.style.width), container.width);
    const height = toPct(parseFloat(ref.style.height), container.height);
    const left = toPct(position.x, container.width);
    const top = toPct(position.y, container.height);
    onSave(width, height, left, top);
  };
}

// ── 5. 선택 상태 테두리 클래스 ────────────────────────────────────────────

/**
 * 요소 선택 여부에 따른 Tailwind 테두리/링 클래스 문자열 반환.
 * BoardCanvas 내 날짜·루틴·시계 박스에 일관 적용.
 */
export function selectedBorderClass(isSelected: boolean): string {
  return isSelected
    ? "border-indigo-400/90 ring-2 ring-indigo-400/40 bg-white/5"
    : "border-transparent hover:border-white/30 bg-transparent";
}
