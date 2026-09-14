import { ClassroomStudent, ClassroomRoutine } from "@/types/classroom";

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

export interface PinchHitterEntry {
  name: string;
  isSkip?: boolean;
}

/**
 * pinchHitterStudent 문자열을 슬롯별 대타 상세 맵(Record<number, PinchHitterEntry>)으로 파싱합니다.
 */
export function parsePinchHitterDetails(pinchHitterStudent?: string): Record<number, PinchHitterEntry> {
  if (!pinchHitterStudent || pinchHitterStudent === "none") return {};
  if (pinchHitterStudent.startsWith("{")) {
    try {
      const parsed = JSON.parse(pinchHitterStudent);
      const res: Record<number, PinchHitterEntry> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!v || v === "none") continue;
        if (typeof v === "string") {
          res[Number(k)] = { name: v, isSkip: false };
        } else if (typeof v === "object" && v !== null && (v as { name?: string }).name) {
          const entry = v as { name: string; isSkip?: boolean };
          res[Number(k)] = { name: entry.name, isSkip: Boolean(entry.isSkip) };
        }
      }
      return res;
    } catch {
      return {};
    }
  }
  return { 0: { name: pinchHitterStudent, isSkip: false } };
}

/**
 * pinchHitterStudent 문자열을 슬롯별 대타 맵(Record<number, string>)으로 파싱합니다.
 * 하위 호환성: 학생 이름만 필요한 곳에서 호출합니다.
 */
export function parsePinchHitters(pinchHitterStudent?: string): Record<number, string> {
  const details = parsePinchHitterDetails(pinchHitterStudent);
  const res: Record<number, string> = {};
  for (const [k, v] of Object.entries(details)) {
    res[Number(k)] = v.name;
  }
  return res;
}

/**
 * 슬롯별 대타 맵을 pinchHitterStudent 문자열로 직렬화합니다.
 * 슬롯 0만 단순 문자열(isSkip 없음)인 경우 하위 호환 단일 문자열로 저장하고, 그 외에는 JSON 문자열로 저장합니다.
 */
export function serializePinchHitters(
  record: Record<number, string | PinchHitterEntry>
): string | undefined {
  const validEntries = Object.entries(record).filter(([_, v]) => {
    if (!v || v === "none") return false;
    if (typeof v === "object" && (!v.name || v.name === "none")) return false;
    return true;
  });
  if (validEntries.length === 0) return undefined;
  if (validEntries.length === 1 && validEntries[0][0] === "0") {
    const v = validEntries[0][1];
    if (typeof v === "string") return v;
    if (typeof v === "object" && !v.isSkip) return v.name;
  }
  const obj: Record<string, string | PinchHitterEntry> = {};
  validEntries.forEach(([k, v]) => { obj[k] = v; });
  return JSON.stringify(obj);
}

/**
 * 루틴의 현재 당번 목록을 계산합니다.
 * 1. skipHistory (건너뛰기된 학생 이름/번호 목록)에 있는 학생은 건너뛰고,
 *    다음 순번 학생들로 당겨서 r.slots 명을 채웁니다. (대타 표시 없음)
 * 2. 수동 대타(pinchHitterStudent)가 지정된 슬롯이 있다면 해당 슬롯을 치환합니다.
 *    (includePinchTag=true 인 경우 '홍길동 (대타)' 형식으로 반환)
 */
export function getActiveRoutineWorkers(
  routine: ClassroomRoutine,
  students: ClassroomStudent[] = [],
  includePinchTag: boolean = false
): string[] {
  if (!routine.order || routine.order.length === 0) return [];

  // 건너뛰기 목록을 학생 이름으로 정규화 (문자열 또는 기존 숫자 인덱스 지원)
  const skipNames = (routine.skipHistory || []).map((item) => {
    if (typeof item === "number") {
      const raw = routine.order[item % routine.order.length];
      return resolveStudentName(raw, students);
    }
    return resolveStudentName(item, students);
  });

  const slotsTarget = Math.max(1, routine.slots || 1);
  const total = routine.order.length;
  const activeWorkers: string[] = [];

  let idx = routine.currentIdx || 0;
  let inspectedCount = 0;
  // 순환 목록을 돌면서 스킵되지 않은 학생을 slotsTarget 만큼 차례대로 수집
  while (activeWorkers.length < Math.min(slotsTarget, total) && inspectedCount < total * 2) {
    const rawStudent = routine.order[idx % total];
    const studentName = resolveStudentName(rawStudent, students);

    // 스킵 목록에 없고, 전체 인원이 slots 이상인 경우 active에 중복되지 않는 학생만 추가
    if (!skipNames.includes(studentName)) {
      if (!activeWorkers.includes(studentName) || total <= activeWorkers.length) {
        activeWorkers.push(studentName);
      }
    }
    idx++;
    inspectedCount++;
  }

  // 수동 대타 지정(pinchHitterStudent) 치환 적용
  const pinchMap = parsePinchHitters(routine.pinchHitterStudent);
  return activeWorkers.map((name, slotIdx) => {
    const manualSub = pinchMap[slotIdx];
    if (manualSub && manualSub !== "none") {
      const subName = resolveStudentName(manualSub, students);
      return includePinchTag ? `${subName} (대타)` : subName;
    }
    return name;
  });
}
