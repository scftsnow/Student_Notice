import { ClassroomRoutine, LedgerRecord } from "@/types/classroom";

export interface RoutinePayPeriodStatus {
  isPaid: boolean;
  periodLabel: string; // "오늘" | "이번 주" | "이번 달" | "건당"
  paidAt?: string; // e.g. "2026-09-14 11:05"
  recordId?: number | string; // 원장 기록 식별자 (지급 취소용)
}

/** 주기 기본 라벨 */
function defaultPeriodLabel(payCycle?: string): string {
  return payCycle === "주당" ? "이번 주" : payCycle === "월당" ? "이번 달" : "오늘";
}

interface PayPeriodBounds {
  periodLabel: string;
  todayStr: string;
  monthStr: string;
  monday: Date;
  sunday: Date;
}

/** 지급 주기(일당/주당/월당/건당)에 맞춘 기간 경계 계산 */
function getPayPeriodBounds(cycle: string, now: Date = new Date()): PayPeriodBounds {
  // YYYY-MM-DD 및 YYYY-MM 산출
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`;

  // 이번 주 월요일 00:00:00 및 일요일 23:59:59 산출 (한국 표준 월~일 주차)
  const dayOfWeek = now.getDay(); // 0(일), 1(월) ... 6(토)
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  let periodLabel = "오늘";
  if (cycle === "주당") periodLabel = "이번 주";
  else if (cycle === "월당") periodLabel = "이번 달";

  return { periodLabel, todayStr, monthStr, monday, sunday };
}

/** 장부 기록이 특정 학생의 해당 업무 급여인지 (수신자 + 적요 검사) */
function isRoutineSalaryRecord(
  record: LedgerRecord,
  routine: ClassroomRoutine,
  studentName: string
): boolean {
  // 수신 학생 이름 검사
  const isTargetStudent =
    record.to === studentName ||
    record.targetDisplay === studentName ||
    (Array.isArray(record.targets) && record.targets.includes(studentName));
  if (!isTargetStudent) return false;

  // 해당 업무 루틴 급여인지 검사
  const desc = record.desc || "";
  return (
    desc.includes(`${routine.name} 당번 급여`) ||
    desc.includes(`${routine.name} 급여`) ||
    desc.includes(routine.name)
  );
}

/** 장부 기록이 지급 주기 범위 안에 있는지 */
function isInPayPeriod(
  record: LedgerRecord,
  cycle: string,
  bounds: PayPeriodBounds
): boolean {
  const recordDateStr = record.date || ""; // e.g. "2026-09-14 11:05"

  // 주기별 기간 범위 검사
  if (cycle === "일당" || cycle === "건당") {
    return recordDateStr.startsWith(bounds.todayStr);
  } else if (cycle === "주당") {
    const datePart = recordDateStr.split(" ")[0];
    if (datePart) {
      const [ry, rm, rd] = datePart.split("-").map(Number);
      if (ry && rm && rd) {
        const recordDate = new Date(ry, rm - 1, rd);
        return recordDate >= bounds.monday && recordDate <= bounds.sunday;
      }
    }
    return false;
  } else if (cycle === "월당") {
    return recordDateStr.startsWith(bounds.monthStr);
  }
  return false;
}

/**
 * 해당 주기에 특정 학생에게 지급된 횟수.
 * 대타 중복 등 한 명이 여러 몫을 맡은 경우, 맡은 횟수에서 이 횟수를 뺀 만큼만
 * 추가 지급하면 된다.
 */
export function countStudentRoutinePaid(
  routine: ClassroomRoutine,
  studentName: string,
  ledgerHistory: LedgerRecord[] = []
): number {
  if (!routine || !studentName || !ledgerHistory || ledgerHistory.length === 0) return 0;

  const cycle = routine.payCycle || "건당";
  const bounds = getPayPeriodBounds(cycle);
  let count = 0;
  for (const record of ledgerHistory) {
    if (record.type !== "입금") continue;
    if (!isRoutineSalaryRecord(record, routine, studentName)) continue;
    if (isInPayPeriod(record, cycle, bounds)) count++;
  }
  return count;
}

/**
 * 업무 루틴의 지급 주기(일당/주당/월당/건당)에 맞춰
 * 특정 학생에게 해당 업무 급여가 해당 기간 내에 지급되었는지 장부 기록(ledgerHistory)을 역추적합니다.
 *
 * - "일당": 오늘(YYYY-MM-DD) 지급 내역 매칭
 * - "주당": 이번 주(월요일 00:00:00 ~ 일요일 23:59:59) 지급 내역 매칭
 * - "월당": 이번 달(YYYY-MM) 지급 내역 매칭
 * - "건당" / 기타: 오늘(YYYY-MM-DD) 지급 내역 매칭
 */
export function checkStudentRoutinePaid(
  routine: ClassroomRoutine,
  studentName: string,
  ledgerHistory: LedgerRecord[] = []
): RoutinePayPeriodStatus {
  if (!routine || !studentName || !ledgerHistory || ledgerHistory.length === 0) {
    const defaultLabel = defaultPeriodLabel(routine?.payCycle);
    return { isPaid: false, periodLabel: defaultLabel };
  }

  const cycle = routine.payCycle || "건당";
  const bounds = getPayPeriodBounds(cycle);

  for (const record of ledgerHistory) {
    if (record.type !== "입금") continue;
    if (!isRoutineSalaryRecord(record, routine, studentName)) continue;
    if (!isInPayPeriod(record, cycle, bounds)) continue;

    const recordDateStr = record.date || ""; // e.g. "2026-09-14 11:05"
    return { isPaid: true, periodLabel: bounds.periodLabel, paidAt: recordDateStr, recordId: record.id };
  }

  return { isPaid: false, periodLabel: bounds.periodLabel };
}
