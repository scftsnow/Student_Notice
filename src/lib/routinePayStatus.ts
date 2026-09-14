import { ClassroomRoutine, LedgerRecord } from "@/types/classroom";

export interface RoutinePayPeriodStatus {
  isPaid: boolean;
  periodLabel: string; // "오늘" | "이번 주" | "이번 달" | "건당"
  paidAt?: string; // e.g. "2026-09-14 11:05"
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
    const defaultLabel = routine?.payCycle === "주당" ? "이번 주" : routine?.payCycle === "월당" ? "이번 달" : "오늘";
    return { isPaid: false, periodLabel: defaultLabel };
  }

  const cycle = routine.payCycle || "건당";
  const now = new Date();

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

  for (const record of ledgerHistory) {
    if (record.type !== "입금") continue;

    // 수신 학생 이름 검사
    const isTargetStudent =
      record.to === studentName ||
      record.targetDisplay === studentName ||
      (Array.isArray(record.targets) && record.targets.includes(studentName));
    if (!isTargetStudent) continue;

    // 해당 업무 루틴 급여인지 검사
    const desc = record.desc || "";
    const isRoutineSalary =
      desc.includes(`${routine.name} 당번 급여`) ||
      desc.includes(`${routine.name} 급여`) ||
      desc.includes(routine.name);
    if (!isRoutineSalary) continue;

    const recordDateStr = record.date || ""; // e.g. "2026-09-14 11:05"

    // 주기별 기간 범위 검사
    if (cycle === "일당" || cycle === "건당") {
      if (recordDateStr.startsWith(todayStr)) {
        return { isPaid: true, periodLabel, paidAt: recordDateStr };
      }
    } else if (cycle === "주당") {
      const datePart = recordDateStr.split(" ")[0];
      if (datePart) {
        const [ry, rm, rd] = datePart.split("-").map(Number);
        if (ry && rm && rd) {
          const recordDate = new Date(ry, rm - 1, rd);
          if (recordDate >= monday && recordDate <= sunday) {
            return { isPaid: true, periodLabel, paidAt: recordDateStr };
          }
        }
      }
    } else if (cycle === "월당") {
      if (recordDateStr.startsWith(monthStr)) {
        return { isPaid: true, periodLabel, paidAt: recordDateStr };
      }
    }
  }

  return { isPaid: false, periodLabel };
}
