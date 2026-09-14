import { useState } from "react";
import type { PickStudent, SeatCellState, SeatConfig } from "@/types";
import { buildSeatCells, autoAssignSeats } from "@/lib/pickRandom";

const DEFAULT_CONFIG: SeatConfig = {
  divisions: 3,
  colsPerDivision: 2,
  fillFrom: "back",
  genderMode: "ignore",
};

function isValidCell(raw: unknown): raw is SeatCellState {
  if (typeof raw !== "object" || raw === null) return false;
  const c = raw as Record<string, unknown>;
  return (
    typeof c.key === "string" &&
    typeof c.row === "number" &&
    typeof c.col === "number" &&
    typeof c.division === "number" &&
    typeof c.enabled === "boolean"
  );
}

function normalizeCells(raw: unknown): SeatCellState[] | null {
  if (!Array.isArray(raw)) return null;
  const cells: SeatCellState[] = [];
  for (const item of raw) {
    if (!isValidCell(item)) return null;
    cells.push({
      key: item.key,
      row: item.row,
      col: item.col,
      division: item.division,
      enabled: item.enabled,
      lockedGender: item.lockedGender === "남" || item.lockedGender === "여" ? item.lockedGender : null,
      fixedStudentId: typeof item.fixedStudentId === "string" ? item.fixedStudentId : null,
      studentId: typeof item.studentId === "string" ? item.studentId : null,
    });
  }
  return cells;
}

export function useSeatPick() {
  const [config, setConfig] = useState<SeatConfig>(DEFAULT_CONFIG);
  const [cells, setCells] = useState<SeatCellState[]>([]);
  const [showFixed, setShowFixed] = useState(false);
  const [error, setError] = useState("");

  const patchConfig = (patch: Partial<SeatConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  /** 선택 인원수에 맞춰 빈 자리 틀 생성 */
  const buildCells = (studentCount: number): boolean => {
    setError("");
    try {
      setCells(buildSeatCells(config, studentCount));
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "자리 생성 실패");
      return false;
    }
  };

  /** 랜덤 배치 (고정 자리 유지). 성공 시 새 셀 배열, 실패 시 null */
  const randomAssign = (students: PickStudent[]): SeatCellState[] | null => {
    setError("");
    if (cells.length === 0) {
      setError("먼저 자리를 생성해 주세요.");
      return null;
    }
    try {
      const next = autoAssignSeats(cells, students, config.fillFrom, config.genderMode);
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

  const clearFixed = () => {
    setCells((prev) => prev.map((c) => ({ ...c, fixedStudentId: null })));
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

  /** 학생 풀에서 셀로 드래그: 몰래 고정 배치 */
  const dropStudentOnCell = (cellKey: string, studentId: string) => {
    setCells((prev) => {
      const without = prev.map((c) =>
        c.studentId === studentId || c.fixedStudentId === studentId
          ? { ...c, studentId: null, fixedStudentId: null }
          : c
      );
      return without.map((c) => {
        if (c.key !== cellKey || !c.enabled) return c;
        return { ...c, studentId, fixedStudentId: studentId };
      });
    });
  };

  /** 셀 간 드래그: 학생 교환 (고정 표식은 셀에 유지) */
  const moveCell = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setCells((prev) => {
      const from = prev.find((c) => c.key === fromKey);
      const to = prev.find((c) => c.key === toKey);
      if (!from || !to || !to.enabled || !from.studentId) return prev;
      return prev.map((c) => {
        if (c.key === fromKey) return { ...c, studentId: to.studentId, fixedStudentId: to.fixedStudentId };
        if (c.key === toKey) return { ...c, studentId: from.studentId, fixedStudentId: from.fixedStudentId };
        return c;
      });
    });
  };

  const clearCell = (key: string) => {
    setCells((prev) =>
      prev.map((c) => (c.key === key ? { ...c, studentId: null, fixedStudentId: null } : c))
    );
  };

  const unfixCell = (key: string) => {
    setCells((prev) =>
      prev.map((c) => (c.key === key ? { ...c, fixedStudentId: null } : c))
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
      cells.flatMap((c) => [c.studentId, c.fixedStudentId]).filter((id): id is string => id !== null)
    );
    return students.filter((s) => !placed.has(s.id));
  };

  const placedCount = cells.filter((c) => c.studentId !== null).length;
  const fixedCount = cells.filter((c) => c.fixedStudentId !== null).length;

  return {
    config,
    patchConfig,
    setConfig,
    cells,
    showFixed,
    setShowFixed,
    error,
    setError,
    buildCells,
    randomAssign,
    clearAssign,
    clearFixed,
    handleCellClick,
    cycleGender,
    dropStudentOnCell,
    moveCell,
    clearCell,
    unfixCell,
    loadCellsJson,
    loadCellsForRoster,
    unplacedIds,
    placedCount,
    fixedCount,
  };
}

export type SeatPickApi = ReturnType<typeof useSeatPick>;
