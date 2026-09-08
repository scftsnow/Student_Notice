import { ClassroomStudent } from "@/types/classroom";

/**
 * 루틴 담당자 항목(번호, 번호+이름, 또는 이름)을 실제 학생 이름으로 변환합니다.
 * 알림장 판서 화면에서 번호(예: "1", "1번") 대신 학생 이름이 표시되도록 보장합니다.
 */
export function resolveStudentName(worker: string | number, students: ClassroomStudent[]): string {
  if (worker === undefined || worker === null) return "";
  const rawStr = String(worker).trim();
  if (!rawStr) return "";

  // 1. 이름이 일치하는 경우 우선 반환
  const directMatch = students.find((s) => s.name === rawStr);
  if (directMatch) return directMatch.name;

  // 2. "1", "1번" 등 번호 형태 매칭
  const numOnlyMatch = rawStr.match(/^(\d+)(?:번)?$/);
  if (numOnlyMatch) {
    const num = parseInt(numOnlyMatch[1], 10);
    const byNo = students.find((s) => s.no === num);
    if (byNo) return byNo.name;
  }

  // 3. "1번 김철수" 또는 "1 김철수" 형태 매칭
  const prefixMatch = rawStr.match(/^\d+번?\s*(.+)$/);
  if (prefixMatch) {
    const extractedName = prefixMatch[1].trim();
    const bySubName = students.find((s) => s.name === extractedName);
    if (bySubName) return bySubName.name;
    return extractedName;
  }

  return rawStr;
}
