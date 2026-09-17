import type { PickStudent } from "@/types";
import type { ClassroomStudent } from "@/types/classroom";

/** 이름 표시명 */
export function formatPickName(s: PickStudent): string {
  return s.name;
}

/**
 * 실명단(ClassroomStudent) → 뽑기용 변환.
 * 명단은 이름 중복 등록을 막으므로 이름이 식별 키. 번호 미지정 시 명단 순서.
 */
export function toPickStudents(roster: ClassroomStudent[]): PickStudent[] {
  return roster.map((s, idx) => ({
    id: s.name,
    studentNumber: s.no ?? idx + 1,
    name: s.name,
    gender: s.gender ?? null,
    status: "ACTIVE",
  }));
}
