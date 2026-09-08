// Korean statutory holidays map for 2025-2027
export const KOREAN_HOLIDAYS_MAP: Record<string, string> = {
  // 2025
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "3·1절",
  "2025-03-03": "3·1절 대체공휴일",
  "2025-05-05": "어린이날",
  "2025-05-06": "부처님오신날",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "추석 대체공휴일",
  "2025-10-09": "한글날",
  "2025-12-25": "기독탄신일(성탄절)",

  // 2026
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "3·1절",
  "2026-03-02": "3·1절 대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "부처님오신날 대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",

  // 2027
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "설날 대체공휴일",
  "2027-03-01": "3·1절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-08-15": "광복절",
  "2027-08-16": "광복절 대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "개천절 대체공휴일",
  "2027-10-09": "한글날",
  "2027-10-11": "한글날 대체공휴일",
  "2027-12-25": "성탄절",
};

export interface HolidayCheckResult {
  isHoliday: boolean;
  reason?: string;
  isWeekend: boolean;
}

/**
 * Checks if a given YYYY-MM-DD string is a weekend, statutory holiday, or custom school holiday.
 */
export function checkIsHoliday(
  dateStr: string,
  customHolidays: string[] = []
): HolidayCheckResult {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    return {
      isHoliday: true,
      reason: dayOfWeek === 0 ? "일요일" : "토요일",
      isWeekend: true,
    };
  }

  // Check statutory public holidays
  if (KOREAN_HOLIDAYS_MAP[dateStr]) {
    return {
      isHoliday: true,
      reason: KOREAN_HOLIDAYS_MAP[dateStr],
      isWeekend: false,
    };
  }

  // Check custom school holidays (vacation, discretion holidays)
  if (customHolidays.includes(dateStr)) {
    return {
      isHoliday: true,
      reason: "학교 재량휴업일/방학",
      isWeekend: false,
    };
  }

  return {
    isHoliday: false,
    isWeekend: false,
  };
}

/**
 * Finds the next working day starting from the day after the given date
 */
export function getNextWorkingDay(
  currentDateStr: string,
  customHolidays: string[] = []
): string {
  const [year, month, day] = currentDateStr.split("-").map(Number);
  const cur = new Date(year, month - 1, day);

  while (true) {
    cur.setDate(cur.getDate() + 1);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const testDateStr = `${y}-${m}-${d}`;

    const check = checkIsHoliday(testDateStr, customHolidays);
    if (!check.isHoliday) {
      return testDateStr;
    }
  }
}
