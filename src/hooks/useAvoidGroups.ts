import { useEffect, useState } from "react";
import type { AvoidGroup } from "@/types";

/**
 * 만나지 말아야 할 학생 그룹 저장 키.
 * 자리 뽑기·모둠 뽑기가 같은 키를 공유하므로 한 번만 정하면 양쪽에 적용된다.
 * (기존 자리 키 문자열 그대로 — localStorage·백업 호환 유지)
 */
export const AVOID_GROUPS_STORAGE_KEY = "classroom_seat_avoid_groups";

/** 자리 키 이름 유지용 별칭. */
export const SEAT_AVOID_STORAGE_KEY = AVOID_GROUPS_STORAGE_KEY;

/** 저장된 분리 그룹 읽기 (형식 검증 포함). */
function loadAvoidGroups(storageKey: string): AvoidGroup[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: AvoidGroup[] = [];
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
 * 만나지 말아야 할 학생 묶음(분리 그룹) 공용 상태.
 * 자리 뽑기(useSeatPick)·모둠 뽑기(GroupPickPanel)가 같은 저장 키로 공유한다.
 */
export function useAvoidGroups(storageKey: string) {
  const [avoidGroups, setAvoidGroups] = useState<AvoidGroup[]>(() =>
    loadAvoidGroups(storageKey)
  );

  // 분리 그룹 변경 시 즉시 저장
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(avoidGroups));
    } catch {
      // ignore
    }
  }, [storageKey, avoidGroups]);

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
    avoidGroups,
    addAvoidGroup,
    deleteAvoidGroup,
    updateAvoidGroupMode,
    addAvoidMember,
    removeAvoidMember,
  };
}

export type AvoidGroupsApi = ReturnType<typeof useAvoidGroups>;
