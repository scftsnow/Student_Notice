import type { PickStudent, SeatCellState, SeatFillFrom } from "@/types";

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
 */
export function dealGroups<T>(
  input: readonly T[],
  sizes: number[],
  getGender: (item: T) => string | null,
  separateGender: boolean,
  rand: Rand = Math.random
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
  if (separateGender) {
    const groups: T[][] = [];
    let offset = 0;
    for (const size of sizes) {
      groups.push(ordered.slice(offset, offset + size));
      offset += size;
    }
    return groups;
  }
  const groups: T[][] = sizes.map(() => []);
  let gi = 0;
  for (const item of ordered) {
    while (groups[gi].length >= sizes[gi]) {
      gi = (gi + 1) % groups.length;
    }
    groups[gi].push(item);
    gi = (gi + 1) % groups.length;
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

export interface SeatGridConfig {
  divisions: number;
  colsPerDivision: number;
}

/**
 * 인원수에 맞춰 자리 틀 생성. 행수 = ceil(인원 / (분단수×열수)).
 * key는 `분단-행-열` 형식. row 0 = 가장 앞줄.
 */
export function buildSeatCells(
  config: SeatGridConfig,
  studentCount: number
): SeatCellState[] {
  const { divisions, colsPerDivision } = config;
  if (divisions < 1 || colsPerDivision < 1) {
    throw new Error("분단 수와 분단당 열수는 1 이상이어야 합니다.");
  }
  const perRow = divisions * colsPerDivision;
  const rows = Math.max(1, Math.ceil(studentCount / perRow));
  const cells: SeatCellState[] = [];
  for (let row = 0; row < rows; row++) {
    for (let division = 0; division < divisions; division++) {
      for (let c = 0; c < colsPerDivision; c++) {
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
        });
      }
    }
  }
  return cells;
}

function orderForFill<T extends SeatCellState>(cells: T[], fillFrom: SeatFillFrom): T[] {
  return [...cells].sort((a, b) => {
    if (a.row !== b.row) return fillFrom === "back" ? b.row - a.row : a.row - b.row;
    if (a.division !== b.division) return a.division - b.division;
    return a.col - b.col;
  });
}

function genderOf(student: PickStudent): string | null {
  return student.gender === "남" || student.gender === "여" ? student.gender : null;
}

/**
 * 자동 배치 (원본 불변, 복사본 반환).
 * 1) 고정 배치 확정 2) 성별 지정 자리 우선 충족
 * 3) 성별 모드 적용 (pair=남녀 교대, separate=동성 결집, ignore=셔플)
 * 학생 수 > 사용 가능 자리 수면 throw (호출자가 먼저 차단).
 */
export function autoAssignSeats(
  cells: SeatCellState[],
  students: PickStudent[],
  fillFrom: SeatFillFrom = "back",
  genderMode: "ignore" | "pair" | "separate" = "ignore"
): SeatCellState[] {
  const result = cells.map((c) => ({ ...c }));
  const byKey = new Map(result.map((c) => [c.key, c]));

  const fixedIds = new Set<string>();
  for (const cell of result) {
    if (cell.fixedStudentId) {
      cell.studentId = cell.fixedStudentId;
      fixedIds.add(cell.fixedStudentId);
    } else {
      cell.studentId = null;
    }
  }

  const remaining = shuffle(
    students.filter((s) => !fixedIds.has(s.id))
  );
  const usable = orderForFill(
    result.filter((c) => c.enabled && !c.fixedStudentId),
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

  return result;
}
