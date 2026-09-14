import { ClassroomStudent, LedgerRecord } from "@/types/classroom";

export interface NormalizedLedgerRecord {
  id: number | string;
  date: string;
  type: string;
  targetDisplay: string;
  desc: string;
  amount: number;
  originalId: number | string;
  balanceAfter?: number;
}

export function formatLedgerDateTime(dateStr?: string): { date: string; time: string } {
  if (!dateStr) return { date: "-", time: "" };
  const parts = dateStr.trim().split(" ");
  if (parts.length >= 2) {
    const [d, t] = parts;
    const formattedDate = d.length >= 10 ? d.slice(2).replace(/-/g, ".") : d;
    return { date: formattedDate, time: t };
  }
  return { date: dateStr, time: "" };
}

export function normalizeLedgerRecords(
  ledgerHistory: LedgerRecord[],
  studentFilter: string,
  treasuryBalance: number,
  students: ClassroomStudent[],
  currencyName: string
): NormalizedLedgerRecord[] {
  const displayRecords: NormalizedLedgerRecord[] = [];

  for (const item of ledgerHistory) {
    if (studentFilter === "treasury") {
      // 국고 관점: 국고 잔액이 실제로 변동한 내역만 추출
      if (item.targets.includes("treasury")) {
        if (item.type === "입금") {
          if (item.from.includes("국고")) {
            // 국고에서 학생에게 세금 환급
            displayRecords.push({
              id: `${item.id}-refund`,
              date: item.date,
              type: "출금",
              targetDisplay: `${item.to || item.targetDisplay} (환급)`,
              desc: item.desc || "세금 환급 출금",
              amount: -Math.abs(item.amount),
              originalId: item.id,
            });
          } else {
            // 국고 세수 직접 입금
            displayRecords.push({
              id: `${item.id}-deposit`,
              date: item.date,
              type: "입금",
              targetDisplay: "학급 국고",
              desc: item.desc || "국고 세수 편입",
              amount: Math.abs(item.amount),
              originalId: item.id,
            });
          }
        } else if (item.type === "차감") {
          // 국고 공동 지출
          displayRecords.push({
            id: `${item.id}-withdraw`,
            date: item.date,
            type: "출금",
            targetDisplay: "공동 지출",
            desc: item.desc || "학급 공동 지출",
            amount: -Math.abs(item.amount),
            originalId: item.id,
          });
        } else if (item.type === "거래") {
          if (item.to.includes("국고") || item.targets[1] === "treasury") {
            displayRecords.push({
              id: `${item.id}-tx-in`,
              date: item.date,
              type: "입금",
              targetDisplay: `${item.from} → 국고`,
              desc: item.desc || "국고 송금",
              amount: Math.abs(item.amount),
              originalId: item.id,
            });
          } else if (item.from.includes("국고") || item.targets[0] === "treasury") {
            displayRecords.push({
              id: `${item.id}-tx-out`,
              date: item.date,
              type: "출금",
              targetDisplay: `국고 → ${item.to}`,
              desc: item.desc || "국고 출금",
              amount: -Math.abs(item.amount),
              originalId: item.id,
            });
          }
        }
      } else if (item.tax && item.tax > 0) {
        // 급여 지급 또는 거래 시 원천징수되어 국고로 실제 유입된 세금만 반영
        displayRecords.push({
          id: `${item.id}-tax`,
          date: item.date,
          type: "세금",
          targetDisplay: `세수 편입 (${item.targetDisplay})`,
          desc: `[세금 징수] ${item.desc || item.targetDisplay}`,
          amount: item.tax,
          originalId: item.id,
        });
      }
    } else if (studentFilter === "all") {
      displayRecords.push({
        id: item.id,
        date: item.date,
        type: item.type,
        targetDisplay: item.targetDisplay,
        desc: item.desc,
        amount: item.amount,
        originalId: item.id,
      });
    } else {
      // 특정 학생 관점
      if (item.targets.includes(studentFilter)) {
        if (item.type === "입금") {
          const net = item.amount - (item.tax || 0);
          displayRecords.push({
            id: item.id,
            date: item.date,
            type: "입금",
            targetDisplay: item.targetDisplay,
            desc: item.tax && item.tax > 0 ? `${item.desc || "입금"} (세금 ${item.tax.toLocaleString()} ${currencyName} 원천징수)` : (item.desc || "입금"),
            amount: net,
            originalId: item.id,
          });
        } else if (item.type === "차감") {
          displayRecords.push({
            id: item.id,
            date: item.date,
            type: "출금",
            targetDisplay: item.targetDisplay,
            desc: item.desc || "차감",
            amount: -Math.abs(item.amount),
            originalId: item.id,
          });
        } else if (item.type === "거래") {
          if (item.to === studentFilter) {
            displayRecords.push({
              id: item.id,
              date: item.date,
              type: "입금",
              targetDisplay: `${item.from} → 나`,
              desc: item.desc ? `${item.from} 송금 (${item.desc})` : `${item.from} 송금`,
              amount: Math.abs(item.amount),
              originalId: item.id,
            });
          } else if (item.from === studentFilter) {
            displayRecords.push({
              id: item.id,
              date: item.date,
              type: "출금",
              targetDisplay: `나 → ${item.to}`,
              desc: item.desc ? `${item.to}에게 송금 (${item.desc})` : `${item.to}에게 송금`,
              amount: -Math.abs(item.amount),
              originalId: item.id,
            });
          } else {
            displayRecords.push({
              id: item.id,
              date: item.date,
              type: item.type,
              targetDisplay: item.targetDisplay,
              desc: item.desc,
              amount: item.amount,
              originalId: item.id,
            });
          }
        } else {
          displayRecords.push({
            id: item.id,
            date: item.date,
            type: item.type,
            targetDisplay: item.targetDisplay,
            desc: item.desc,
            amount: item.amount,
            originalId: item.id,
          });
        }
      }
    }
  }

  const isIndividualOrTreasury = studentFilter !== "all";

  // 단일 계정(국고 또는 개별 학생)인 경우 역산 방식으로 각 거래 후 잔액(balanceAfter) 계산
  if (isIndividualOrTreasury) {
    let currentStartingBalance = 0;
    if (studentFilter === "treasury") {
      currentStartingBalance = treasuryBalance;
    } else {
      const student = students.find((s) => s.name === studentFilter);
      currentStartingBalance = student ? student.balance : 0;
    }

    let runningBal = currentStartingBalance;
    for (let i = 0; i < displayRecords.length; i++) {
      displayRecords[i].balanceAfter = Math.max(0, runningBal);
      runningBal = runningBal - displayRecords[i].amount;
    }
  }

  return displayRecords;
}

export function filterLedgerByPeriod(
  records: NormalizedLedgerRecord[],
  periodPreset: "all" | "today" | "7d" | "30d" | "custom",
  startDate?: string,
  endDate?: string
): NormalizedLedgerRecord[] {
  return records.filter((item) => {
    if (periodPreset === "today") {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (!item.date.startsWith(today)) return false;
    } else if (periodPreset === "7d") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (new Date(item.date) < sevenDaysAgo) return false;
    } else if (periodPreset === "30d") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(item.date) < thirtyDaysAgo) return false;
    } else if (periodPreset === "custom") {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(item.date) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.date) > end) return false;
      }
    }
    return true;
  });
}
