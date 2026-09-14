import type { PickStudent } from "@/types";

/** `3번 김철수` 형식 표시명 */
export function formatPickName(s: PickStudent): string {
  return `${s.studentNumber}번 ${s.name}`;
}

/** 스냅샷 이름 (전학/삭제된 학생 표시용 폴백 포함) */
export function snapshotName(
  studentId: string,
  live: Map<string, PickStudent>,
  snapshot: Record<string, string>
): string {
  const found = live.get(studentId);
  if (found) return formatPickName(found);
  return `${snapshot[studentId] ?? "알 수 없음"} (전학/삭제)`;
}
