"use client";

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { seatCanvasHeightPx, seatGridRowCount, SEAT_DIVISION_GUTTER } from "@/lib/seatFree";
import type { PickStudent, SeatCellState } from "@/types";

interface SeatGridProps {
  cells: SeatCellState[];
  divisions: number;
  lookup: (studentId: string | null) => PickStudent | null;
  displayName: (studentId: string | null) => string;
  onCellClick: (key: string) => void;
  onCycleGender: (key: string) => void;
  onDropStudent: (cellKey: string, studentId: string) => void;
  onMoveCell: (fromKey: string, toKey: string) => void;
  /** 카드 자유 이동 확정 (캔버스 % 좌표). 위치만 바뀌고 occupant는 유지. */
  onPositionChange: (key: string, x: number, y: number) => void;
  /** 보기 방향. teacher면 칠판이 아래(뒷줄이 위)에 오도록 상하 반전. 기본 student(칠판 위). */
  orientation?: "student" | "teacher";
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
  lookup,
  displayName,
  onCellClick,
  onCycleGender,
  onDropStudent,
  onMoveCell,
  onPositionChange,
  orientation = "student",
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

  const boardRef = useRef<HTMLDivElement>(null);

  /**
   * 자리판 자신의 실제 폭을 CSS 변수로 넘긴다.
   * 카드 좌표가 화면 측정 px이라 인쇄 폭이 이 값과 같아야 우측 여백이 생기지 않는다.
   * (패딩/border를 식으로 계산하면 어긋나므로 실제 측정값을 그대로 쓴다)
   * 이 변수는 @media print 안에서만 적용되므로 측정→반영이 순환하지 않는다.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.style.setProperty("--seat-board-w", `${el.offsetWidth}px`);
  }, [size.w, cells.length]);

  if (cells.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        표시할 자리가 없습니다. 이름 선택 패널에서 학생을 선택해 주세요.
      </div>
    );
  }

  const maxCol = cells.reduce((m, c) => (c.col > m ? c.col : m), 0);
  // 열 간격에 맞춰 카드 너비 결정 (겹침·넘침 방지). 분단 통로 포함 단위 수 기준.
  const colUnits = maxCol + 1 + SEAT_DIVISION_GUTTER * Math.max(0, divisions - 1);
  const stepPx = colUnits > 0 ? size.w / colUnits : size.w;
  const cardW = Math.max(48, Math.min(96, Math.floor(stepPx - 8)));
  const cardH = 48;

  const centerToTopLeft = (cx: number, cy: number): { x: number; y: number } =>
    seatDropCenterToTopLeft(cx, cy, size.w, size.h, cardW, cardH);

  /** 표시용 y (teacher 보기면 상하 반전). 드롭 좌표(표시 기준)도 같은 공간. */
  const toDisplayY = (y: number): number => (orientation === "teacher" ? 100 - y : y);
  const dxOf = (c: SeatCellState): number => cxOf(c);
  const dyOf = (c: SeatCellState): number => toDisplayY(cyOf(c));

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
      const ccx = (dxOf(c) / 100) * size.w;
      const ccy = (dyOf(c) / 100) * size.h;
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
    onCellClick(cell.key);
  };

  /** 단일 클릭은 더블클릭과 구분하기 위해 지연 실행 (더블클릭=성별 지정이 비우기/닫기를 유발하지 않도록). */
  const queueCardClick = (cell: SeatCellState) => {
    // Rnd 드래그 직후 딸려오는 click 무시
    if (Date.now() - dragEndAtRef.current < 250) return;
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
    const genderColor =
      student?.gender === "남"
        ? "border-blue-300 bg-blue-50"
        : student?.gender === "여"
          ? "border-rose-300 bg-rose-50"
          : "border-slate-200 bg-white";
    const pos = centerToTopLeft(dxOf(cell), dyOf(cell));

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
          // react-rnd가 반환하는 top-left 픽셀 → 카드 중심 % (centerToTopLeft의 정확한 역변환).
          // 표시 공간 기준이므로 데이터 공간으로 되돌려 저장 (teacher 보기는 상하 반전).
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
          onPositionChange(cell.key, cx, toDisplayY(cy));
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
            cell.studentId
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
          }`}
        >
          {!cell.enabled ? (
            <span className="text-[10px] text-slate-400 leading-4">닫힘</span>
          ) : (
            // 성별 기호를 먼저, 그 뒤에 이름을 한 줄에 나란히 배치한다.
            // h-full + items-center 로 카드 높이를 꽉 채워 세로 가운데 정렬한다.
            <div className="w-full h-full flex items-center justify-center gap-1 leading-none">
              {cell.lockedGender && (
                <span
                  className={`text-[20px] font-bold shrink-0 ${
                    cell.lockedGender === "남" ? "text-blue-500" : "text-rose-500"
                  }`}
                >
                  {cell.lockedGender === "남" ? "♂" : "♀"}
                </span>
              )}
              <span
                className={`truncate ${
                  cell.studentId
                    ? "text-[20px] font-bold text-slate-800"
                    : "text-[18px] text-slate-300"
                }`}
              >
                {cell.studentId ? displayName(cell.studentId) : "빈자리"}
              </span>
            </div>
          )}
        </div>
      </Rnd>
    );
  };

  const isTeacher = orientation === "teacher";
  const chalkboardBar = (
    <div className="flex items-stretch gap-2">
      <div className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-center text-sm font-bold tracking-[0.5em]">
        칠판
      </div>
    </div>
  );

  return (
    <div
      ref={boardRef}
      data-seat-print
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2"
    >
      {!isTeacher && chalkboardBar}
      <div
        ref={canvasRef}
        title="카드를 드래그해 자유롭게 배치하세요"
        style={{ height: seatCanvasHeightPx(seatGridRowCount(cells)) }}
        className="relative w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
      >
        {cells.map((cell) => renderCard(cell))}
      </div>
      {isTeacher && chalkboardBar}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{isTeacher ? "앞 ↓ (아랫쪽이 앞자리)" : "앞 ↑ (윗쪽이 앞자리)"}</span>
        <span>{divisions}분단 · {cells.length}석</span>
      </div>
    </div>
  );
}
