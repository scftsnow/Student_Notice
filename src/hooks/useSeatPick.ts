import { useEffect, useState } from "react";
import type { PickStudent, SeatAvoidGroup, SeatCellState, SeatConfig } from "@/types";
import { buildSeatCells, autoAssignSeats } from "@/lib/pickRandom";
import { ensureFreeCoords, isVersionedSeatDoc, normalizeSeatCell } from "@/lib/seatFree";

const DEFAULT_CONFIG: SeatConfig = {
  divisions: 3,
  colsPerDivision: 2,
  fillFrom: "back",
  genderMode: "ignore",
};

/** 최근 생성 시점의 분단 구성 기억용 키 (분단 수·분단당 열수만, 나머지는 기본값). */
const GRID_CONFIG_STORAGE_KEY = "classroom_seat_grid_config";

function loadInitialConfig(): SeatConfig {
  try {
    const raw = localStorage.getItem(GRID_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SeatConfig>;
    const divisions =
      typeof parsed.divisions === "number" &&
      Number.isInteger(parsed.divisions) &&
      parsed.divisions >= 1 &&
      parsed.divisions <= 8
        ? parsed.divisions
        : DEFAULT_CONFIG.divisions;
    const colsPerDivision =
      typeof parsed.colsPerDivision === "number" &&
      Number.isInteger(parsed.colsPerDivision) &&
      parsed.colsPerDivision >= 1 &&
      parsed.colsPerDivision <= 8
        ? parsed.colsPerDivision
        : DEFAULT_CONFIG.colsPerDivision;
    return { ...DEFAULT_CONFIG, divisions, colsPerDivision };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** 자리 생성 성공 시 분단 구성을 기억 (다음 진입 시 디폴트). */
function persistGridConfig(config: SeatConfig): void {
  try {
    localStorage.setItem(
      GRID_CONFIG_STORAGE_KEY,
      JSON.stringify({ divisions: config.divisions, colsPerDivision: config.colsPerDivision })
    );
  } catch {
    // ignore
  }
}

/** 만나지 말아야 할 학생 그룹 저장 키. */
export const SEAT_AVOID_STORAGE_KEY = "classroom_seat_avoid_groups";

/** 저장된 분리 그룹 읽기 (형식 검증 포함). */
function loadAvoidGroups(): SeatAvoidGroup[] {
  try {
    const raw = localStorage.getItem(SEAT_AVOID_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SeatAvoidGroup[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Record<string, unknown>;
      if (typeof r.id !== "string") continue;
      const members = Array.isArray(r.members)
        ? Array.from(new Set(r.members.filter((m): m is string => typeof m === "string")))
        : [];
      out.push({
        id: r.id,
        mode: r.mode === "around" ? "around" : "side",
        members,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * cellsJson 파싱용 정규화. v1(배열) / v2(봉투) 모두 수용.
 * x/y 누락분은 격자 위치에서 유도한 % 좌표로 채워 항상 자유 좌표로 반환.
 */
function normalizeCells(raw: unknown): SeatCellState[] | null {
  const arr = isVersionedSeatDoc(raw) ? raw.cells : raw;
  if (!Array.isArray(arr)) return null;
  const cells: SeatCellState[] = [];
  for (const item of arr) {
    const c = normalizeSeatCell(item);
    if (!c) return null;
    cells.push(c);
  }
  return ensureFreeCoords(cells);
}

export function useSeatPick() {
  const [config, setConfig] = useState<SeatConfig>(loadInitialConfig);
  const [cells, setCells] = useState<SeatCellState[]>([]);
  const [error, setError] = useState("");
  const [avoidGroups, setAvoidGroups] = useState<SeatAvoidGroup[]>(loadAvoidGroups);

  // 분리 그룹 변경 시 즉시 저장
  useEffect(() => {
    try {
      localStorage.setItem(SEAT_AVOID_STORAGE_KEY, JSON.stringify(avoidGroups));
    } catch {
      // ignore
    }
  }, [avoidGroups]);

  const patchConfig = (patch: Partial<SeatConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  /** 선택 인원수에 맞춰 빈 자리 틀 생성 */
  const buildCells = (studentCount: number): boolean => {
    setError("");
    try {
      setCells(buildSeatCells(config, studentCount));
      persistGridConfig(config);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "자리 생성 실패");
      return false;
    }
  };

  /** 랜덤 배치 (배치된 학생은 유지, 빈자리에만 미배치 학생 채움). 성공 시 새 셀 배열, 실패 시 null */
  const randomAssign = (students: PickStudent[]): SeatCellState[] | null => {
    setError("");
    if (cells.length === 0) {
      setError("먼저 자리를 생성해 주세요.");
      return null;
    }
    try {
      const next = autoAssignSeats(cells, students, config.fillFrom, config.genderMode, avoidGroups);
      setCells(next);
      return next;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "자리 배치 실패");
      return null;
    }
  };

  const clearAssign = () => {
    setCells((prev) => prev.map((c) => ({ ...c, studentId: null, fixedStudentId: null })));
  };

  /** 빈 셀 클릭: 열고/닫기. 찬 셀 클릭: 배치 지우기 */
  const handleCellClick = (key: string) => {
    setCells((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        if (c.studentId) return { ...c, studentId: null, fixedStudentId: null };
        return { ...c, enabled: !c.enabled };
      })
    );
  };

  /** 우클릭: 성별 지정 순환 (없음 → 남 → 여 → 없음) */
  const cycleGender = (key: string) => {
    setCells((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const next =
          c.lockedGender === null ? "남" : c.lockedGender === "남" ? "여" : null;
        return { ...c, lockedGender: next as SeatCellState["lockedGender"] };
      })
    );
  };

  /** 학생 풀에서 셀로 드래그: 해당 자리에 고정 배치 (배치되면 고정 취급) */
  const dropStudentOnCell = (cellKey: string, studentId: string) => {
    setCells((prev) => {
      const without = prev.map((c) =>
        c.studentId === studentId
          ? { ...c, studentId: null, fixedStudentId: null }
          : c
      );
      return without.map((c) => {
        if (c.key !== cellKey || !c.enabled) return c;
        return { ...c, studentId, fixedStudentId: null };
      });
    });
  };

  /** 셀 간 드래그: 학생 교환 */
  const moveCell = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setCells((prev) => {
      const from = prev.find((c) => c.key === fromKey);
      const to = prev.find((c) => c.key === toKey);
      if (!from || !to || !to.enabled || !from.studentId) return prev;
      return prev.map((c) => {
        if (c.key === fromKey) return { ...c, studentId: to.studentId };
        if (c.key === toKey) return { ...c, studentId: from.studentId };
        return c;
      });
    });
  };

  const clearCell = (key: string) => {
    setCells((prev) =>
      prev.map((c) => (c.key === key ? { ...c, studentId: null, fixedStudentId: null } : c))
    );
  };

  /** 저장된 틀/결과 불러오기 (배치 포함). 형식 오류 시 false */
  const loadCellsJson = (cellsJson: string): boolean => {
    setError("");
    try {
      const cells = normalizeCells(JSON.parse(cellsJson));
      if (!cells || cells.length === 0) throw new Error("invalid");
      setCells(cells);
      return true;
    } catch {
      setError("저장된 자리 데이터를 읽지 못했습니다.");
      return false;
    }
  };

  /**
   * 배치 결과 불러오기 + 명단에 없는 이름의 배치 정리.
   * 성공 시 정리된 명수 반환, 형식 오류 시 null.
   */
  const loadCellsForRoster = (
    cellsJson: string,
    validIds: Set<string>
  ): { dropped: number } | null => {
    setError("");
    try {
      const cells = normalizeCells(JSON.parse(cellsJson));
      if (!cells || cells.length === 0) throw new Error("invalid");
      let dropped = 0;
      const cleaned = cells.map((c) => {
        const keep = (id: string | null): string | null =>
          id !== null && validIds.has(id) ? id : null;
        const studentId = keep(c.studentId);
        const fixedStudentId = keep(c.fixedStudentId);
        if ((c.studentId && !studentId) || (c.fixedStudentId && !fixedStudentId)) {
          dropped++;
        }
        return { ...c, studentId, fixedStudentId };
      });
      setCells(cleaned);
      return { dropped };
    } catch {
      setError("저장된 자리 데이터를 읽지 못했습니다.");
      return null;
    }
  };

  const unplacedIds = (students: PickStudent[]): PickStudent[] => {
    const placed = new Set(
      cells.map((c) => c.studentId).filter((id): id is string => id !== null)
    );
    return students.filter((s) => !placed.has(s.id));
  };

  const placedCount = cells.filter((c) => c.studentId !== null).length;

  /** 분리 그룹 추가 (빈 그룹 반환 후 편집은 호출자가). */
  const addAvoidGroup = (): string => {
    const id = `avoid-${Date.now()}`;
    setAvoidGroups((prev) => [...prev, { id, mode: "side", members: [] }]);
    return id;
  };

  const deleteAvoidGroup = (id: string) => {
    setAvoidGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const updateAvoidGroupMode = (id: string, mode: "side" | "around") => {
    setAvoidGroups((prev) => prev.map((g) => (g.id === id ? { ...g, mode } : g)));
  };

  const addAvoidMember = (id: string, studentId: string) => {
    setAvoidGroups((prev) =>
      prev.map((g) =>
        g.id === id && !g.members.includes(studentId)
          ? { ...g, members: [...g.members, studentId] }
          : g
      )
    );
  };

  const removeAvoidMember = (id: string, studentId: string) => {
    setAvoidGroups((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, members: g.members.filter((m) => m !== studentId) } : g
      )
    );
  };

  return {
    config,
    patchConfig,
    setConfig,
    cells,
    error,
    setError,
    buildCells,
    randomAssign,
    clearAssign,
    handleCellClick,
    cycleGender,
    dropStudentOnCell,
    moveCell,
    clearCell,
    loadCellsJson,
    loadCellsForRoster,
    unplacedIds,
    placedCount,
    avoidGroups,
    addAvoidGroup,
    deleteAvoidGroup,
    updateAvoidGroupMode,
    addAvoidMember,
    removeAvoidMember,
  };
}

export type SeatPickApi = ReturnType<typeof useSeatPick>;
