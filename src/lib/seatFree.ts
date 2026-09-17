import type { SeatCellsDocV2, SeatCellState, SeatFreeCell } from "@/types";
import { SEAT_CANVAS_ASPECT, SEAT_CELLS_JSON_VERSION } from "@/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** % 좌표 정규화. 유한수면 0~100으로 클램프, 아니면 null (마이그레이션 대상). */
export function clampPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return round2(value);
}

/** 버전 봉투(v2) 판별. 레거시(v1)는 최상위가 배열. */
export function isVersionedSeatDoc(raw: unknown): raw is SeatCellsDocV2 {
  if (typeof raw !== "object" || raw === null) return false;
  const doc = raw as Record<string, unknown>;
  return (
    doc.version === SEAT_CELLS_JSON_VERSION &&
    doc.kind === "free" &&
    Array.isArray(doc.cells)
  );
}

/** 단일 셀 정규화. 필수 필드 + lockedGender/fixed/studentId 검증, x/y는 보존(클램프). */
export function normalizeSeatCell(raw: unknown): SeatCellState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (
    typeof c.key !== "string" ||
    typeof c.row !== "number" ||
    !Number.isFinite(c.row) ||
    typeof c.col !== "number" ||
    !Number.isFinite(c.col) ||
    typeof c.division !== "number" ||
    !Number.isFinite(c.division) ||
    typeof c.enabled !== "boolean"
  ) {
    return null;
  }
  const cell: SeatCellState = {
    key: c.key,
    row: c.row,
    col: c.col,
    division: c.division,
    enabled: c.enabled,
    lockedGender: c.lockedGender === "남" || c.lockedGender === "여" ? c.lockedGender : null,
    fixedStudentId: typeof c.fixedStudentId === "string" ? c.fixedStudentId : null,
    studentId: typeof c.studentId === "string" ? c.studentId : null,
  };
  const x = clampPercent(c.x);
  const y = clampPercent(c.y);
  if (x !== null && y !== null) {
    cell.x = x;
    cell.y = y;
  }
  return cell;
}

/**
 * 격자(row/col) → 캔버스 % 좌표. 셀 중심 기준 균등 분할.
 * 분단 사이 여백(gutter)은 렌더링 관심사이므로 데이터에 포함하지 않는다.
 */
export function gridCellToPercent(args: {
  row: number;
  col: number;
  totalRows: number;
  totalCols: number;
}): { x: number; y: number } {
  const rows = Math.max(1, Math.floor(args.totalRows) || 1);
  const cols = Math.max(1, Math.floor(args.totalCols) || 1);
  return {
    x: round2(((args.col + 0.5) / cols) * 100),
    y: round2(((args.row + 0.5) / rows) * 100),
  };
}

function inferGridSize(cells: readonly SeatCellState[]): { totalRows: number; totalCols: number } {
  let maxRow = 0;
  let maxCol = 0;
  for (const c of cells) {
    if (c.row > maxRow) maxRow = c.row;
    if (c.col > maxCol) maxCol = c.col;
  }
  return { totalRows: maxRow + 1, totalCols: maxCol + 1 };
}

/**
 * x/y 누락 셀을 격자 위치에서 유도한 % 좌표로 채운다.
 * 기존 x/y는 유지(클램프만). 위치(틀) 자체는 바꾸지 않고 좌표만 보정.
 */
export function ensureFreeCoords<T extends SeatCellState>(
  cells: readonly T[]
): (T & { x: number; y: number })[] {
  if (cells.length === 0) return [];
  const { totalRows, totalCols } = inferGridSize(cells);
  return cells.map((c) => {
    const x = clampPercent(c.x);
    const y = clampPercent(c.y);
    if (x !== null && y !== null) {
      return x === c.x && y === c.y ? { ...c, x, y } : { ...c, x, y };
    }
    const p = gridCellToPercent({ row: c.row, col: c.col, totalRows, totalCols });
    return { ...c, x: p.x, y: p.y };
  });
}

/** 레거시 격자 배열 → 자유 좌표 배열로 명시적 마이그레이션. */
export function migrateGridCellsToFree(cells: readonly SeatCellState[]): SeatFreeCell[] {
  return ensureFreeCoords(cells);
}

/**
 * cellsJson 파싱. v1(배열) / v2(봉투) 모두 수용, 셀 단위 정규화.
 * 형식 오류 시 throw (호출자가 에러 메시지로 변환).
 */
export function parseSeatCellsJson(cellsJson: string): {
  version: 1 | 2;
  cells: SeatCellState[];
} {
  const raw: unknown = JSON.parse(cellsJson);
  if (Array.isArray(raw)) {
    const cells: SeatCellState[] = [];
    for (const item of raw) {
      const c = normalizeSeatCell(item);
      if (!c) throw new Error("invalid seat cells (v1)");
      cells.push(c);
    }
    if (cells.length === 0) throw new Error("empty seat cells");
    return { version: 1, cells };
  }
  if (isVersionedSeatDoc(raw)) {
    const cells: SeatCellState[] = [];
    for (const item of raw.cells) {
      const c = normalizeSeatCell(item);
      if (!c) throw new Error("invalid seat cells (v2)");
      cells.push(c);
    }
    if (cells.length === 0) throw new Error("empty seat cells");
    return { version: 2, cells };
  }
  throw new Error("unknown seat cells format");
}

/**
 * 로드용 파싱 + 마이그레이션. 항상 x/y가 채워진 자유 셀로 반환.
 * useSeatPick.loadCellsJson 계열과 캔버스 UI가 공통으로 사용.
 */
export function loadSeatCells(cellsJson: string): {
  version: 1 | 2;
  cells: SeatFreeCell[];
} {
  const parsed = parseSeatCellsJson(cellsJson);
  return { version: parsed.version, cells: ensureFreeCoords(parsed.cells) };
}

/** 저장용 직렬화. 항상 v2 봉투로 기록 (Prisma 스키마 변경 없음). */
export function serializeSeatCells(cells: readonly SeatCellState[]): string {
  const doc: SeatCellsDocV2 = {
    version: SEAT_CELLS_JSON_VERSION,
    kind: "free",
    canvas: { unit: "%", aspect: SEAT_CANVAS_ASPECT },
    cells: ensureFreeCoords(cells),
  };
  return JSON.stringify(doc);
}

/** 틀 저장용. occupant만 비우고 위치(x/y, enabled, lockedGender)는 유지. */
export function toSeatFrame<T extends SeatCellState>(cells: readonly T[]): T[] {
  return cells.map((c) => ({ ...c, studentId: null, fixedStudentId: null }));
}
