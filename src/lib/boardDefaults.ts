import { BoardElementLayouts } from "@/types/classroom";

export const DEFAULT_LAYOUTS: BoardElementLayouts = {
  dateBox: { left: "2.5%", top: "3.0%", align: "left", visible: true },
  clockBox: { left: "75.0%", top: "3.0%", align: "right", clockType: "digital", clockFormat: "24h", visible: true },
  noticeBox: { left: "2.5%", top: "15.0%", width: "95.0%", height: "62.0%", align: "left", visible: true },
  routineBox: { left: "2.5%", top: "82.0%", width: "95.0%", height: "10.0%", align: "left", visible: true },
  accountBox: { left: "93.0%", top: "89.0%", width: "5.0%", height: "8.0%", align: "center", visible: false },
};

export const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function isBoxVisibleToday(visible?: boolean, visibleDays?: number[]): boolean {
  if (visible === false) return false;
  if (!visibleDays || visibleDays.length === 0) return true;
  const currentDay = new Date().getDay();
  return visibleDays.includes(currentDay);
}

export function formatVisibleDays(days?: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return "";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return "평일";
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return "주말";
  return sorted.map((d) => DAY_LABELS[d]).join(",");
}
