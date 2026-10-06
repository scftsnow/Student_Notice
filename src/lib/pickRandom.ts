import type { AvoidGroup, PickStudent, SeatAvoidGroup, SeatCellState, SeatFillFrom } from "@/types";
import { SEAT_DIVISION_GUTTER, gridCellToPercent, seatRowCenterY } from "./seatFree";

type Rand = () => number;

/** Fisher-Yates 셔플 (원본 불변) */
export function shuffle<T>(input: readonly T[], rand: Rand = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 비복원 n개 추출. count가 범위를 벗어나면 throw */
export function sampleCount<T>(
  input: readonly T[],
  count: number,
  rand: Rand = Math.random
): T[] {
  if (count < 0 || count > input.length) {
    throw new Error(`추첨 인원(${count}명)이 선택 인원(${input.length}명) 범위를 벗어났습니다.`);
  }
  return shuffle(input, rand).slice(0, count);
}

/** 여러 회차 뽑기. 중복 불허 시 전체 필요 인원 초과하면 throw */
export function dealRounds<T>(
  input: readonly T[],
  count: number,
  rounds: number,
  allowDuplicate: boolean,
  rand: Rand = Math.random
): T[][] {
  if (count < 1) throw new Error("뽑는 명수는 1명 이상이어야 합니다.");
  if (rounds < 1) throw new Error("회차 수는 1회 이상이어야 합니다.");
  if (count > input.length) {
    throw new Error(`뽑는 명수(${count}명)가 선택 인원(${input.length}명)보다 많습니다.`);
  }
  if (!allowDuplicate) {
    if (count * rounds > input.length) {
      throw new Error(
        `중복 없이 ${rounds}회 × ${count}명을 뽑으려면 ${count * rounds}명이 필요하지만 ${input.length}명만 선택됐습니다.`
      );
    }
    const pool = shuffle(input, rand);
    const result: T[][] = [];
    for (let r = 0; r < rounds; r++) {
      result.push(pool.slice(r * count, (r + 1) * count));
    }
    return result;
  }
  const result: T[][] = [];
  for (let r = 0; r < rounds; r++) {
    result.push(sampleCount(input, count, rand));
  }
  return result;
}

function splitByGender<T>(
  input: readonly T[],
  getGender: (item: T) => string | null
): { males: T[]; females: T[]; others: T[] } {
  const males: T[] = [];
  const females: T[] = [];
  const others: T[] = [];
  for (const item of input) {
    const g = getGender(item);
    if (g === "남") males.push(item);
    else if (g === "여") females.push(item);
    else others.push(item);
  }
  return { males, females, others };
}

/** 성별 풀을 남→여→미지정 순으로 라운드로빈 병합 (분리 모드용) */
function interleaveByGender<T>(pools: T[][], rand: Rand): T[] {
  const copies = pools.map((p) => shuffle(p, rand));
  const merged: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const pool of copies) {
      const item = pool.shift();
      if (item !== undefined) {
        merged.push(item);
        added = true;
      }
    }
  }
  return merged;
}

/**
 * 모둠 분배. sizes 합계가 인원과 다르면 throw.
 * - 무관: 전체 셔플 후 라운드로빈으로 한 명씩 배분
 * - 분리: 성별 풀을 번갈아 병합한 뒤 라운드로빈 배분 (각 모둠에 남녀가 균등 분산)
 * - avoidGroups가 있으면 같은 분리 그룹 학생이 같은 모둠에 들지 않게 best-effort 교환
 */
export function dealGroups<T>(
  input: readonly T[],
  sizes: number[],
  getGender: (item: T) => string | null,
  separateGender: boolean,
  rand: Rand = Math.random,
  avoidGroups: readonly AvoidGroup[] = [],
  getId: (item: T) => string = (item: T) => (item as unknown as { id: string }).id
): T[][] {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total !== input.length) {
    throw new Error(`모둠 인원 합계(${total}명)가 선택 인원(${input.length}명)과 일치해야 합니다.`);
  }
  if (sizes.some((s) => s < 1)) {
    throw new Error("각 모둠 인원은 1명 이상이어야 합니다.");
  }
  const ordered = separateGender
    ? interleaveByGender(
        (() => {
          const { males, females, others } = splitByGender(input, getGender);
          return [males, females, others];
        })(),
        rand
      )
    : shuffle(input, rand);
  // 분리 모드: 성별 교대 순서를 그대로 잘라 각 모둠에 비율대로 분배
  // 무관 모드: 라운드로빈으로 한 명씩 배분
  let groups: T[][];
  if (separateGender) {
    groups = [];
    let offset = 0;
    for (const size of sizes) {
      groups.push(ordered.slice(offset, offset + size));
      offset += size;
    }
  } else {
    groups = sizes.map(() => []);
    let gi = 0;
    for (const item of ordered) {
      while (groups[gi].length >= sizes[gi]) {
        gi = (gi + 1) % groups.length;
      }
      groups[gi].push(item);
      gi = (gi + 1) % groups.length;
    }
  }

  // 만나지 말아야 할 학생 분리 (best-effort 모둠 간 교환, 모둠 인원 유지)
  if (avoidGroups.length > 0) {
    const idGroups = groups.map((g) => g.map(getId));
    const resolved = resolveGroupViolations(idGroups, avoidGroups, rand);
    const byId = new Map(input.map((item) => [getId(item), item]));
    return resolved.map((g) => g.map((id) => byId.get(id) as T));
  }
  return groups;
}

/** `4,4,5` 같은 모둠별 인원 문자열 파싱. 형식 오류 시 throw */
export function parseGroupSizes(text: string): number[] {
  const sizes = text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s));
  if (sizes.length === 0 || sizes.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new Error("모둠 인원을 `4,4,5` 형식의 1 이상 정수로 입력해 주세요.");
  }
  return sizes;
}

export interface GroupAvoidViolation {
  groupId: string;
  groupIndex: number;
  aId: string;
  bId: string;
}

/**
 * 모둠 분리 위반 쌍 목록 (같은 분리 그룹 학생이 같은 모둠에 배정된 경우).
 * 자리 뽑기의 findSeatViolations와 쌍을 이루는 모둠용 검사다.
 */
export function findGroupViolations(
  groups: readonly (readonly string[])[],
  avoidGroups: readonly AvoidGroup[]
): GroupAvoidViolation[] {
  const out: GroupAvoidViolation[] = [];
  for (const g of avoidGroups) {
    const memberSet = new Set(g.members);
    if (memberSet.size < 2) continue;
    groups.forEach((members, groupIndex) => {
      const present = members.filter((m) => memberSet.has(m));
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          out.push({ groupId: g.id, groupIndex, aId: present[i], bId: present[j] });
        }
      }
    });
  }
  return out;
}

/**
 * 위반이 줄도록 모둠 간 교환을 반복 (best-effort).
 * 자리 뽑기의 resolveSeatViolations와 같은 최급강하 + 흔들기 구조다.
 * 모둠 인원은 그대로 두고 사람만 교환한다.
 */
export function resolveGroupViolations(
  groups: readonly (readonly string[])[],
  avoidGroups: readonly AvoidGroup[],
  rand: Rand = Math.random,
  maxIters = 500
): string[][] {
  if (avoidGroups.length === 0) return groups.map((g) => [...g]);
  const countOf = (gs: readonly (readonly string[])[]): number =>
    findGroupViolations(gs, avoidGroups).length;

  let best = groups.map((g) => [...g]);
  let bestCount = countOf(best);
  if (bestCount === 0) return best;
  // 흔들기로 악화돼도 복원할 전역 최상 (흔들기는 무조건 덮어쓰므로 별도 보관)
  let gbest = best.map((g) => [...g]);
  let gbestCount = bestCount;

  const swapIn = (
    gs: string[][],
    a: { gi: number; ci: number },
    b: { gi: number; ci: number }
  ): string[][] => {
    const next = gs.map((g) => [...g]);
    const tmp = next[a.gi][a.ci];
    next[a.gi][a.ci] = next[b.gi][b.ci];
    next[b.gi][b.ci] = tmp;
    return next;
  };
  const pickCell = (gs: string[][]): { gi: number; ci: number } | null => {
    const nonEmpty = gs
      .map((g, gi) => ({ gi, n: g.length }))
      .filter((c) => c.n > 0);
    if (nonEmpty.length === 0) return null;
    const picked = nonEmpty[Math.floor(rand() * nonEmpty.length)];
    return { gi: picked.gi, ci: Math.floor(rand() * gs[picked.gi].length) };
  };

  let stagnant = 0;
  for (let iter = 0; iter < maxIters && bestCount > 0; iter++) {
    if (findGroupViolations(best, avoidGroups).length === 0) break;
    // 모든 모둠 간 교환 중 가장 좋아지는 수를 둔다 (최급강하).
    // 같은 모둠 안 교환은 위반 수를 바꾸지 않으므로 건너뛴다.
    let improved: string[][] | null = null;
    let improvedCount = bestCount;
    const order: { gi: number; ci: number }[] = [];
    best.forEach((g, gi) => g.forEach((_, ci) => order.push({ gi, ci })));
    for (let bi = order.length - 1; bi > 0; bi--) {
      const j = Math.floor(rand() * (bi + 1));
      [order[bi], order[j]] = [order[j], order[bi]];
    }
    outer: for (let bi = 0; bi < order.length; bi++) {
      for (let di = bi + 1; di < order.length; di++) {
        const b = order[bi];
        const d = order[di];
        if (b.gi === d.gi) continue;
        const next = swapIn(best, b, d);
        const nextCount = countOf(next);
        if (nextCount < improvedCount) {
          improved = next;
          improvedCount = nextCount;
          if (nextCount === 0) break outer;
        }
      }
    }
    if (improved) {
      best = improved;
      bestCount = improvedCount;
      if (bestCount < gbestCount) {
        gbest = best.map((g) => [...g]);
        gbestCount = bestCount;
      }
      stagnant = 0;
    } else {
      stagnant++;
      // 막히면 무작위 교환 몇 번으로 흔들고 계속 (재시작)
      if (stagnant >= 20) {
        stagnant = 0;
        let shaken = best;
        for (let k = 0; k < 5; k++) {
          const x = pickCell(shaken);
          const y = pickCell(shaken);
          if (!x || !y || x.gi === y.gi) continue;
          shaken = swapIn(shaken, x, y);
        }
        best = shaken;
        bestCount = countOf(best);
      }
    }
  }
  return gbest;
}

/**
 * 분리 위반 쌍 요약문 ("분리 불가 2쌍 (a–b, c–d)"). 자리·모둠 공용.
 * 같은 쌍이 여러 곳에서 걸려도 한 번만 센다.
 */
export function summarizeAvoidPairs(
  pairs: readonly (readonly [string, string])[],
  maxShown = 5
): string {
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const [a, b] of pairs) {
    const key = [a, b].sort().join("–");
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(key);
    }
  }
  return `분리 불가 ${uniq.length}쌍 (${uniq.slice(0, maxShown).join(", ")}${
    uniq.length > maxShown ? " 외" : ""
  })`;
}

export interface SeatGridConfig {
  divisions: number;
  colsPerDivision: number;
}

/**
 * 인원수에 맞춰 자리 틀 생성. 칠판 앞줄(0행)부터 행 우선으로 인원수만큼만 만든다.
 * 빈자리는 만들지 않는다 (마지막 행은 필요한 열까지만).
 * key는 `분단-행-열` 형식. row 0 = 가장 앞줄.
 * 자유 배치 호환용 x/y(% 좌표, 셀 중심)도 함께 부여. row/col/division은 유지.
 */
export function buildSeatCells(
  config: SeatGridConfig,
  studentCount: number
): SeatCellState[] {
  const { divisions, colsPerDivision } = config;
  if (divisions < 1 || colsPerDivision < 1) {
    throw new Error("분단 수와 분단당 열수는 1 이상이어야 합니다.");
  }
  const count = Math.max(0, Math.floor(studentCount) || 0);
  if (count === 0) return [];
  const perRow = divisions * colsPerDivision;
  const rows = Math.max(1, Math.ceil(count / perRow));
  const totalCols = perRow;
  // 분단 사이 통로: 분단 경계마다 여백을 두어 분단 블록끼리 붙어 보이게 한다.
  // (분단 내 열 간격은 그대로 유지)
  const units = totalCols + SEAT_DIVISION_GUTTER * Math.max(0, divisions - 1);
  const cells: SeatCellState[] = [];
  let made = 0;
  for (let row = 0; row < rows && made < count; row++) {
    for (let division = 0; division < divisions && made < count; division++) {
      for (let c = 0; c < colsPerDivision && made < count; c++) {
        const col = division * colsPerDivision + c;
        cells.push({
          key: `${division}-${row}-${col}`,
          row,
          col,
          division,
          enabled: true,
          lockedGender: null,
          fixedStudentId: null,
          studentId: null,
          x: Math.round(((col + 0.5 + division * SEAT_DIVISION_GUTTER) / units) * 100 * 100) / 100,
          y: seatRowCenterY(row, rows),
        });
        made++;
      }
    }
  }
  return cells;
}

function hasFreeCoords(c: SeatCellState): c is SeatCellState & { x: number; y: number } {
  return (
    typeof c.x === "number" &&
    Number.isFinite(c.x) &&
    typeof c.y === "number" &&
    Number.isFinite(c.y)
  );
}

function orderForFill<T extends SeatCellState>(cells: T[], fillFrom: SeatFillFrom): T[] {
  return [...cells].sort((a, b) => {
    // 자유 좌표가 모두 있으면 y(앞/뒤) → x(좌→우) 순. 위치 자체는 건드리지 않음.
    if (hasFreeCoords(a) && hasFreeCoords(b)) {
      if (a.y !== b.y) return fillFrom === "back" ? b.y - a.y : a.y - b.y;
      return a.x - b.x;
    }
    if (a.row !== b.row) return fillFrom === "back" ? b.row - a.row : a.row - b.row;
    if (a.division !== b.division) return a.division - b.division;
    return a.col - b.col;
  });
}

function genderOf(student: PickStudent): string | null {
  return student.gender === "남" || student.gender === "여" ? student.gender : null;
}

/**
 * 자동 배치 (원본 불변, 복사본 반환). 위치(틀: row/col/division/x/y)는 유지하고
 * occupant(studentId)만 셔플한다.
 * 1) 배치된 학생은 모두 유지 (미리보기에 있으면 고정 취급)
 * 2) 성별 지정 자리 우선 충족
 * 3) 성별 모드 적용 (pair=남녀 교대, separate=동성 결집, ignore=셔플)
 * 미배치 학생 수 > 빈자리 수면 throw (호출자가 먼저 차단).
 */
export function autoAssignSeats<T extends SeatCellState>(
  cells: T[],
  students: PickStudent[],
  fillFrom: SeatFillFrom = "back",
  genderMode: "ignore" | "pair" | "separate" = "ignore",
  avoidGroups: readonly SeatAvoidGroup[] = []
): T[] {
  const result = cells.map((c) => ({ ...c }));
  const byKey = new Map(result.map((c) => [c.key, c]));

  // 배치된 학생은 모두 유지
  const placedIds = new Set<string>();
  for (const cell of result) {
    if (cell.studentId) placedIds.add(cell.studentId);
  }

  const remaining = shuffle(
    students.filter((s) => !placedIds.has(s.id))
  );
  const usable = orderForFill(
    result.filter((c) => c.enabled && !c.studentId),
    fillFrom
  );
  if (remaining.length > usable.length) {
    throw new Error(
      `사용 가능한 자리(${usable.length}석)보다 배치할 학생(${remaining.length}명)이 많습니다. 자리를 열거나 학생 선택을 줄여 주세요.`
    );
  }

  // 성별 지정 자리 수요가 해당 성별 공급보다 많으면 실행 차단
  // (통과 시 아래 1순위 단계에서 지정 자리가 항상 충족되므로 폴백이 지정을 깨지 않음)
  const demandMale = usable.filter((c) => c.lockedGender === "남").length;
  const demandFemale = usable.filter((c) => c.lockedGender === "여").length;
  const supplyMale = remaining.filter((s) => genderOf(s) === "남").length;
  const supplyFemale = remaining.filter((s) => genderOf(s) === "여").length;
  if (demandMale > supplyMale) {
    throw new Error(
      `♂ 지정 자리(${demandMale}석)에 배치할 남학생(${supplyMale}명)이 부족합니다. 지정을 풀거나 대상을 추가해 주세요.`
    );
  }
  if (demandFemale > supplyFemale) {
    throw new Error(
      `♀ 지정 자리(${demandFemale}석)에 배치할 여학생(${supplyFemale}명)이 부족합니다. 지정을 풀거나 대상을 추가해 주세요.`
    );
  }

  // 1순위: 성별 지정 자리
  const pool = [...remaining];
  const takeByGender = (gender: "남" | "여"): PickStudent | null => {
    const idx = pool.findIndex((s) => genderOf(s) === gender);
    if (idx === -1) return null;
    const [found] = pool.splice(idx, 1);
    return found;
  };
  const genderLocked = usable.filter((c) => c.lockedGender !== null);
  for (const cell of genderLocked) {
    const target = byKey.get(cell.key);
    if (!target || !target.enabled) continue;
    const picked = takeByGender(cell.lockedGender as "남" | "여");
    if (picked) target.studentId = picked.id;
  }

  // 2순위: 나머지 자리 + 성별 모드
  const openCells = usable.filter((c) => {
    const target = byKey.get(c.key);
    return target && !target.studentId;
  });
  let ordered = [...pool];
  if (genderMode === "pair") {
    const males = shuffle(pool.filter((s) => genderOf(s) === "남"));
    const females = shuffle(pool.filter((s) => genderOf(s) === "여"));
    const others = shuffle(pool.filter((s) => genderOf(s) === null));
    const first = males.length >= females.length ? [males, females] : [females, males];
    ordered = interleaveByGender([first[0], first[1], others], Math.random);
  } else if (genderMode === "separate") {
    const males = shuffle(pool.filter((s) => genderOf(s) === "남"));
    const females = shuffle(pool.filter((s) => genderOf(s) === "여"));
    const others = shuffle(pool.filter((s) => genderOf(s) === null));
    ordered = [...males, ...females, ...others];
  } else {
    ordered = shuffle(pool);
  }
  openCells.forEach((cell, idx) => {
    const target = byKey.get(cell.key);
    if (target && ordered[idx]) target.studentId = ordered[idx].id;
  });

  // 3순위: 만나지 말아야 할 학생 분리 (best-effort 자리 교환)
  if (avoidGroups.length > 0) {
    const genderOfAll = new Map(students.map((s) => [s.id, genderOf(s)]));
    return resolveSeatViolations(result, avoidGroups, (id) => genderOfAll.get(id) ?? null);
  }

  return result;
}

export interface SeatAvoidViolation {
  groupId: string;
  aKey: string;
  bKey: string;
  aName: string;
  bName: string;
}

/** 두 셀이 이웃인지 (옆자리, around면 앞뒤 포함). 격자 기준. */
function seatCellsAdjacent(
  a: SeatCellState,
  b: SeatCellState,
  mode: "side" | "around"
): boolean {
  if (!a.enabled || !b.enabled) return false;
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) return true;
  if (mode === "around" && a.col === b.col && Math.abs(a.row - b.row) === 1) return true;
  return false;
}

/**
 * 분리 위반 쌍 목록 (같은 그룹 학생이 이웃 자리에 배치된 경우).
 * occupant 기준이므로 배치 후 검사·안내용으로도 사용한다.
 */
export function findSeatViolations<T extends SeatCellState>(
  cells: readonly T[],
  groups: readonly SeatAvoidGroup[]
): SeatAvoidViolation[] {
  const byStudent = new Map<string, T>();
  for (const c of cells) {
    if (c.studentId) byStudent.set(c.studentId, c);
  }
  const out: SeatAvoidViolation[] = [];
  for (const g of groups) {
    const members = g.members.filter((m) => byStudent.has(m));
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = byStudent.get(members[i])!;
        const b = byStudent.get(members[j])!;
        if (seatCellsAdjacent(a, b, g.mode)) {
          out.push({ groupId: g.id, aKey: a.key, bKey: b.key, aName: members[i], bName: members[j] });
        }
      }
    }
  }
  return out;
}

/**
 * 위반이 줄도록 occupant 교환을 반복 (best-effort).
 * 매 반복마다 위반 쌍 하나를 골라 모든 교환 후보 중 가장 좋아지는 수를 둔다
 * (최급강하). 막히면 무작위 흔들기로 탈출해 다시 오른다 (재시작).
 * 성별 지정 자리는 지정 성별이 맞는 학생끼리만 교환한다.
 */
export function resolveSeatViolations<T extends SeatCellState>(
  cells: readonly T[],
  groups: readonly SeatAvoidGroup[],
  genderOf: (studentId: string) => string | null,
  maxIters = 500
): T[] {
  if (groups.length === 0) return cells.map((c) => ({ ...c }));
  const countOf = (cs: readonly T[]): number => findSeatViolations(cs, groups).length;

  let best = cells.map((c) => ({ ...c }));
  let bestCount = countOf(best);
  if (bestCount === 0) return best;
  // 흔들기로 악화돼도 복원할 전역 최상 (흔들기는 무조건 덮어쓰므로 별도 보관)
  let gbest = best;
  let gbestCount = bestCount;

  const canPlace = (cell: T, studentId: string | null): boolean => {
    if (!cell.enabled) return false;
    if (studentId === null) return true;
    if (cell.lockedGender === null) return true;
    return genderOf(studentId) === cell.lockedGender;
  };
  const swapIn = (cs: T[], keyB: string, keyD: string): T[] => {
    const next = cs.map((c) => ({ ...c }));
    const nb = next.find((c) => c.key === keyB)!;
    const nd = next.find((c) => c.key === keyD)!;
    const tmp = nb.studentId;
    nb.studentId = nd.studentId;
    nd.studentId = tmp;
    return next;
  };

  let stagnant = 0;
  for (let iter = 0; iter < maxIters && bestCount > 0; iter++) {
    const violations = findSeatViolations(best, groups);
    if (violations.length === 0) break;
    // 모든 occupant 쌍 교환 중 가장 좋아지는 수를 둔다 (최급강하)
    let improved: T[] | null = null;
    let improvedCount = bestCount;
    const order = [...best].sort(() => Math.random() - 0.5);
    outer: for (let bi = 0; bi < order.length; bi++) {
      for (let di = bi + 1; di < order.length; di++) {
        const b = order[bi];
        const d = order[di];
        if (!b.enabled || !d.enabled) continue;
        if (!canPlace(b, d.studentId) || !canPlace(d, b.studentId)) continue;
        const next = swapIn(best, b.key, d.key);
        const nextCount = countOf(next);
        if (nextCount < improvedCount) {
          improved = next;
          improvedCount = nextCount;
          if (nextCount === 0) break outer;
        }
      }
    }
    if (improved) {
      best = improved;
      bestCount = improvedCount;
      if (bestCount < gbestCount) {
        gbest = best;
        gbestCount = bestCount;
      }
      stagnant = 0;
    } else {
      stagnant++;
      // 막히면 무작위 교환 몇 번으로 흔들고 계속 (재시작)
      if (stagnant >= 20) {
        stagnant = 0;
        let shaken = best;
        for (let k = 0; k < 5; k++) {
          const movable = shaken.filter((c) => c.enabled);
          const x = movable[Math.floor(Math.random() * movable.length)];
          const y = movable[Math.floor(Math.random() * movable.length)];
          if (!x || !y || x.key === y.key) continue;
          if (!canPlace(x, y.studentId) || !canPlace(y, x.studentId)) continue;
          shaken = swapIn(shaken, x.key, y.key);
        }
        best = shaken;
        bestCount = countOf(best);
      }
    }
  }
  return gbest;
}
