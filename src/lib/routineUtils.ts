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

export interface RoutineFormatSegment {
  type: "text" | "worker";
  text: string;
  workerIndex?: number;
}

/**
 * 루틴의 사용자 정의 표시 형식(? 플레이스홀더 기반)을 파싱하여
 * 텍스트 세그먼트와 학생 이름 세그먼트의 배열로 변환합니다.
 * 템플릿이 없거나 빈 문자열인 경우 기본 형식(아이콘 + 이름: 당번1, 당번2...)을 반환합니다.
 */
export function parseRoutineFormat(
  template: string | undefined | null,
  routineName: string,
  workers: string[],
  routineIcon?: string
): RoutineFormatSegment[] {
  const trimmed = template?.trim();

  // 사용자 정의 템플릿이 없는 경우 기본 레이아웃 적용
  if (!trimmed) {
    const segments: RoutineFormatSegment[] = [];
    const prefix = `${routineIcon ? routineIcon + " " : ""}${routineName}: `;
    segments.push({ type: "text", text: prefix });

    if (workers.length === 0) {
      segments.push({ type: "text", text: "배정 없음" });
    } else {
      workers.forEach((w, idx) => {
        if (idx > 0) {
          segments.push({ type: "text", text: ", " });
        }
        segments.push({ type: "worker", text: w, workerIndex: idx });
      });
    }
    return segments;
  }

  // '?' 기호 기준으로 파싱
  const parts = trimmed.split("?");
  const segments: RoutineFormatSegment[] = [];

  let workerIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      segments.push({ type: "text", text: parts[i] });
    }

    // 마지막 조각 전에는 항상 '?'가 존재함
    if (i < parts.length - 1) {
      if (workerIdx < workers.length && workers[workerIdx]) {
        segments.push({
          type: "worker",
          text: workers[workerIdx],
          workerIndex: workerIdx,
        });
      } else {
        segments.push({
          type: "worker",
          text: "(미배정)",
          workerIndex: workerIdx,
        });
      }
      workerIdx++;
    }
  }

  // 템플릿의 '?' 개수보다 실제 당번 수가 더 많은 경우 잔여 인원 부가 표시
  if (workerIdx < workers.length) {
    segments.push({ type: "text", text: " (" });
    for (let j = workerIdx; j < workers.length; j++) {
      if (j > workerIdx) segments.push({ type: "text", text: ", " });
      segments.push({ type: "worker", text: workers[j], workerIndex: j });
    }
    segments.push({ type: "text", text: ")" });
  }

  return segments;
}
