"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Rnd } from "react-rnd";
import { seatCanvasHeightPx, seatGridRowCount } from "@/lib/seatFree";
import type { PickStudent, SeatCellState } from "@/types";

interface SeatGridProps {
  cells: SeatCellState[];
  divisions: number;
  showFixed: boolean;
  lookup: (studentId: string | null) => PickStudent | null;
  displayName: (studentId: string | null) => string;
  onCellClick: (key: string) => void;
  onCycleGender: (key: string) => void;
  onDropStudent: (cellKey: string, studentId: string) => void;
  onMoveCell: (fromKey: string, toKey: string) => void;
  onClearCell: (key: string) => void;
  onUnfix: (key: string) => void;
  /** 카드 자유 이동 확정 (캔버스 % 좌표). 위치만 바뀌고 occupant는 유지. */
  onPositionChange: (key: string, x: number, y: number) => void;
  /** 풀 학생을 빈 캔버스 지점에 드롭/탭 → 가장 가까운 빈자리 셀에 고정 배치 + 해당 셀을 지점으로 이동. */
  onCanvasDropStudent: (studentId: string, x: number, y: number) => void;
  /** 터치 대응: 풀에서 탭으로 집어든 학생 id. 있으면 카드/캔버스 탭으로 배치. */
  selectedPoolId: string | null;
  onSelectPool: (id: string | null) => void;
}

const clamp100 = (n: number): number => {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
};

/**
 * 카드 중심 % 좌표 → 캔버스 픽셀(top-left) 좌표.
 * 캔버스 폭/높이는 getBoundingClientRect 기준 (테두리 포함) — Rnd 좌표계와 동일한 원본을 사용해야 역변환(드롭)이 일치한다.
 */
export function seatDropCenterToTopLeft(
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
  cardW: number,
  cardH: number
): { x: number; y: number } {
  return {
    x: (clamp100(cx) / 100) * canvasW - cardW / 2,
    y: (clamp100(cy) / 100) * canvasH - cardH / 2,
  };
}

/**
 * react-rnd onDragStop의 top-left 픽셀 좌표 → 카드 중심 % 좌표 (반대 방향 역함수).
 * 드롭 시점의 d.x/d.y는 Rnd가 반환하는 실제 카드 top-left 위치이므로,
 * 렌더링(centerToTopLeft)과 동일한 canvasW/H·cardW/H로 나누어야 드롭 위치 = 카드 위치가 된다.
 */
export function seatTopLeftToDropCenter(
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
  cardW: number,
  cardH: number
): { x: number; y: number } {
  return {
    x: clamp100(((x + cardW / 2) / canvasW) * 100),
    y: clamp100(((y + cardH / 2) / canvasH) * 100),
  };
}

const cxOf = (c: SeatCellState): number =>
  typeof c.x === "number" && Number.isFinite(c.x) ? c.x : 50;
const cyOf = (c: SeatCellState): number =>
  typeof c.y === "number" && Number.isFinite(c.y) ? c.y : 50;

export default function SeatGrid({
  cells,
  divisions,
  showFixed,
  lookup,
  displayName,
  onCellClick,
  onCycleGender,
  onDropStudent,
  onMoveCell,
  onClearCell,
  onUnfix,
  onPositionChange,
  onCanvasDropStudent,
  selectedPoolId,
  onSelectPool,
}: SeatGridProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragStartRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const dragEndAtRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    };
  }, []);

  /**
   * 캔버스 실제 크기 측정. mount 시점엔 cells가 비어 있어 canvas div가 없으므로
   * (자리 생성/불러오기로 0 → N)이 된 시점에 재실행되어야 size가 실제 캔버스와 일치한다.
   * size가 800×600 기본값에 머물면 카드 배치·드롭 % 변환이 실제 픽셀과 어긋나 순간이동이 발생한다.
   */
  const hasCanvas = cells.length > 0;
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasCanvas]);

  if (cells.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        인원수에 맞춰 `자리 생성`을 눌러 자리를 만드세요.
      </div>
    );
  }

  const cardW = Math.max(72, Math.min(104, Math.floor(size.w / 8)));
  const cardH = 48;

  const pointToPercent = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 50, y: 50 };
    return {
      x: clamp100(((clientX - rect.left) / rect.width) * 100),
      y: clamp100(((clientY - rect.top) / rect.height) * 100),
    };
  };

  const centerToTopLeft = (cx: number, cy: number): { x: number; y: number } =>
    seatDropCenterToTopLeft(cx, cy, size.w, size.h, cardW, cardH);

  /** 드롭 지점(중심 % 좌표)이 다른 카드 안에 떨어졌는지 판정. occupant 교환 대상 탐색. */
  const findSwapTarget = (
    selfKey: string,
    selfHasStudent: boolean,
    cx: number,
    cy: number
  ): SeatCellState | null => {
    if (!selfHasStudent) return null;
    const px = (cx / 100) * size.w;
    const py = (cy / 100) * size.h;
    let best: SeatCellState | null = null;
    let bestDist = Infinity;
    for (const c of cells) {
      if (c.key === selfKey || !c.enabled) continue;
      const ccx = (cxOf(c) / 100) * size.w;
      const ccy = (cyOf(c) / 100) * size.h;
      if (Math.abs(px - ccx) <= cardW / 2 && Math.abs(py - ccy) <= cardH / 2) {
        const dist = Math.hypot(px - ccx, py - ccy);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
    }
    return best;
  };

  const handleCardClick = (cell: SeatCellState) => {
    if (selectedPoolId) {
      onDropStudent(cell.key, selectedPoolId);
      onSelectPool(null);
      return;
    }
    onCellClick(cell.key);
  };

  /** 단일 클릭은 더블클릭과 구분하기 위해 지연 실행 (더블클릭=성별 지정이 비우기/닫기를 유발하지 않도록). */
  const queueCardClick = (cell: SeatCellState) => {
    // Rnd 드래그 직후 딸려오는 click 무시
    if (Date.now() - dragEndAtRef.current < 250) return;
    // 풀 선택 배치(탭)는 즉시 실행. 더블클릭 구분이 필요 없음.
    if (selectedPoolId) {
      handleCardClick(cell);
      return;
    }
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      handleCardClick(cell);
    }, 260);
  };

  const handleCardDoubleClick = (cell: SeatCellState) => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onCycleGender(cell.key);
  };

  const renderCard = (cell: SeatCellState) => {
    const student = lookup(cell.studentId);
    const isFixed = cell.fixedStudentId !== null;
    const genderColor =
      student?.gender === "남"
        ? "border-blue-300 bg-blue-50"
        : student?.gender === "여"
          ? "border-rose-300 bg-rose-50"
          : "border-slate-200 bg-white";
    const pos = centerToTopLeft(cxOf(cell), cyOf(cell));

    return (
      <Rnd
        key={cell.key}
        size={{ width: cardW, height: cardH }}
        position={pos}
        bounds="parent"
        enableResizing={false}
        cancel="button"
        enableUserSelectHack={false}
        onDragStart={(_e, d) => {
          dragStartRef.current = { key: cell.key, x: d.x, y: d.y };
          setDraggingKey(cell.key);
        }}
        onDragStop={(_e, d) => {
          setDraggingKey(null);
          const start = dragStartRef.current;
          dragStartRef.current = null;
          const moved = start
            ? Math.hypot(d.x - start.x, d.y - start.y)
            : Infinity;
          if (moved < 6) return; // 클릭으로 처리
          dragEndAtRef.current = Date.now();
          // react-rnd가 반환하는 top-left 픽셀 → 카드 중심 % (centerToTopLeft의 정확한 역변환)
          const { x: cx, y: cy } = seatTopLeftToDropCenter(
            d.x,
            d.y,
            size.w,
            size.h,
            cardW,
            cardH
          );
          const target = findSwapTarget(cell.key, cell.studentId !== null, cx, cy);
          if (target) {
            // occupant 교환, 위치는 유지
            onMoveCell(cell.key, target.key);
            return;
          }
          onPositionChange(cell.key, cx, cy);
        }}
        className="touch-none"
        style={{ zIndex: draggingKey === cell.key ? 30 : 10 }}
      >
        <div
          data-seat-card={cell.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const studentId = e.dataTransfer.getData("text/student-id");
            if (studentId) onDropStudent(cell.key, studentId);
          }}
          onClick={() => queueCardClick(cell)}
          onDoubleClick={() => handleCardDoubleClick(cell)}
          onContextMenu={(e) => {
            e.preventDefault();
            onCycleGender(cell.key);
          }}
          title={
            selectedPoolId
              ? "탭: 선택한 학생을 이 자리에 배치"
              : cell.studentId
                ? "클릭: 비우기 / 드래그: 이동·교환 / 우클릭·더블클릭: 성별 지정"
                : cell.enabled
                  ? "클릭: 닫기 / 우클릭·더블클릭: 성별 지정 / 드래그: 이동"
                  : "클릭: 열기 / 드래그: 이동"
          }
          className={`relative w-full h-full rounded-xl border-2 px-1 py-1 text-center cursor-grab active:cursor-grabbing select-none overflow-hidden ${
            !cell.enabled
              ? "border-dashed border-slate-300 bg-slate-100"
              : cell.studentId
                ? genderColor
                : "border-slate-200 bg-white hover:border-indigo-300"
          } ${selectedPoolId ? "ring-2 ring-indigo-300" : ""}`}
        >
          {!cell.enabled ? (
            <span className="text-[10px] text-slate-400 leading-4">닫힘</span>
          ) : cell.studentId ? (
            <>
              <div className="text-[11px] font-bold text-slate-800 truncate leading-4">
                {displayName(cell.studentId)}
              </div>
              {cell.lockedGender && (
                <span
                  className={`text-[9px] font-bold leading-3 ${
                    cell.lockedGender === "남" ? "text-blue-500" : "text-rose-500"
                  }`}
                >
                  {cell.lockedGender === "남" ? "♂" : "♀"}
                </span>
              )}
              {showFixed && isFixed && (
                <span className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                  <span className="p-0.5 rounded-full bg-amber-400 text-white" title="고정 배치됨">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnfix(cell.key);
                    }}
                    className="px-1 rounded-full bg-slate-600 text-white text-[8px] leading-3"
                    title="고정 해제 (배치는 유지)"
                  >
                    해제
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCell(cell.key);
                    }}
                    className="px-1 rounded-full bg-rose-500 text-white text-[8px] leading-3"
                    title="비우기"
                  >
                    ✕
                  </button>
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-[10px] text-slate-300 leading-4">빈자리</span>
              {cell.lockedGender && (
                <span
                  className={`block text-[9px] font-bold leading-3 ${
                    cell.lockedGender === "남" ? "text-blue-500" : "text-rose-500"
                  }`}
                >
                  {cell.lockedGender === "남" ? "♂ 지정" : "♀ 지정"}
                </span>
              )}
            </>
          )}
        </div>
      </Rnd>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-stretch gap-2">
        <div className="w-16 shrink-0 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center">
          교탁
        </div>
        <div className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-center text-sm font-bold tracking-[0.5em]">
          칠판
        </div>
      </div>
      <div
        ref={canvasRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const studentId = e.dataTransfer.getData("text/student-id");
          if (!studentId) return;
          const p = pointToPercent(e.clientX, e.clientY);
          onCanvasDropStudent(studentId, p.x, p.y);
        }}
        onClick={(e) => {
          if (!selectedPoolId) return;
          const target = e.target as HTMLElement | null;
          if (target && typeof target.closest === "function" && target.closest("[data-seat-card]")) return;
          const p = pointToPercent(e.clientX, e.clientY);
          onCanvasDropStudent(selectedPoolId, p.x, p.y);
        }}
        title={
          selectedPoolId
            ? "탭한 위치에 선택한 학생을 배치합니다"
            : "카드를 드래그해 자유롭게 배치하세요"
        }
        style={{ height: seatCanvasHeightPx(seatGridRowCount(cells)) }}
        className={`relative w-full rounded-xl border bg-slate-50 overflow-hidden ${
          selectedPoolId ? "border-indigo-400 ring-2 ring-indigo-200 cursor-copy" : "border-slate-200"
        }`}
      >
        {cells.map((cell) => renderCard(cell))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>앞 ↑ (윗쪽이 앞자리)</span>
        <span>{divisions}분단 · {cells.length}석</span>
      </div>
    </div>
  );
}
