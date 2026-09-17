export type StudentStatus = "ACTIVE" | "ABSENT";
export type Gender = "남" | "여";
export type AccountType = "STUDENT" | "CLASS_TREASURY";
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RoutineHistoryStatus = "PENDING" | "CONFIRMED" | "SKIPPED_HOLIDAY";

export interface StudentAccount {
  id: string;
  studentId: string | null;
  accountType: AccountType | string;
  name: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  studentNumber: number;
  name: string;
  gender: string | null;
  status: StudentStatus | string;
  memo: string | null;
  account?: StudentAccount | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClassSetting {
  id: string;
  className: string;
  currencyName: string;
  defaultTaxRate: number;
  taxMethod: "WITHHOLDING" | "ADDITION" | "TAX_FREE" | string;
  absencePolicy: "PINCH_HITTER" | "DEFER" | "PASS" | string;
  salaryPayoutMode: "MANUAL_APPROVAL" | "AUTO_ON_CONFIRM" | string;
  allowNegativeBalance: boolean;
  themeColor: string;
  schoolHolidays: string;
  updatedAt?: Date;
}

export interface Notice {
  id?: string;
  date: string;
  content: string;
  includeRoutines: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RoutineWorkerInfo {
  id: string;
  studentNumber: number;
  name: string;
  isPinchHitter?: boolean;
}

export interface DailyRoutineAssignment {
  routineId: string;
  routineTitle: string;
  workersPerCycle: number;
  salaryAmount: number;
  isHoliday: boolean;
  holidayReason?: string;
  isConfirmed: boolean;
  assignedStudents: RoutineWorkerInfo[];
  actualStudents: RoutineWorkerInfo[];
}

export interface RoutineMemberWithStudent {
  id: string;
  routineId: string;
  studentId: string;
  orderIndex: number;
  student: Student;
}

export interface Routine {
  id: string;
  title: string;
  description: string | null;
  workersPerCycle: number;
  cycleDays: number;
  salaryAmount: number;
  salaryCycle: string;
  active: boolean;
  order: number;
  members: RoutineMemberWithStudent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingPayment {
  id: string;
  title: string;
  studentId: string;
  routineId: string | null;
  amount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  status: PaymentStatus | string;
  date: string;
  student: Student;
  createdAt: Date;
}

export interface LedgerEntryItem {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;
  entryType?: "CREDIT" | "DEBIT" | string;
  memo: string | null;
  balanceAfter?: number;
  account?: StudentAccount;
  createdAt: Date;
}

// --- Pick (뽑기 메뉴) 공용 타입 ---

export interface PickStudent {
  id: string;
  studentNumber: number;
  name: string;
  gender: string | null;
  status: string;
}

export type SeatFillFrom = "front" | "back";
export type SeatGenderMode = "ignore" | "pair" | "separate";

export interface SeatConfig {
  divisions: number;
  colsPerDivision: number;
  fillFrom: SeatFillFrom;
  genderMode: SeatGenderMode;
}

export interface SeatCellState {
  key: string;
  row: number;
  col: number;
  division: number;
  enabled: boolean;
  lockedGender: "남" | "여" | null;
  fixedStudentId: string | null;
  studentId: string | null;
  /** 자유 배치 X 좌표 (0~100, % 단위, 교실 캔버스 기준). 없으면 레거시 격자 셀로 취급. */
  x?: number;
  /** 자유 배치 Y 좌표 (0~100, % 단위, 교실 캔버스 기준). 없으면 레거시 격자 셀로 취급. */
  y?: number;
}

// --- Seat 자유 배치 (v2, 교실 캔버스 % 좌표) ---

/** 위치(x/y)가 확정된 자유 배치 셀. 캔버스 UI는 이 타입을 사용한다. */
export type SeatFreeCell = SeatCellState & { x: number; y: number };

/** cellsJson 버전 태그. 1 = 레거시 배열, 2 = 버전 봉투(free). */
export const SEAT_CELLS_JSON_VERSION = 2 as const;

/** 교실 캔버스 고정 종횡비. CSS `aspect-[4/3]`과 대응. */
export const SEAT_CANVAS_ASPECT = "4:3" as const;

export interface SeatCanvasMeta {
  unit: "%";
  aspect: string;
}

/** cellsJson v2 봉투. DB(Prisma) 변경 없이 JSON 안에서 버전 관리. */
export interface SeatCellsDocV2 {
  version: typeof SEAT_CELLS_JSON_VERSION;
  kind: "free";
  canvas: SeatCanvasMeta;
  cells: SeatCellState[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SeatLayoutItem {
  id: string;
  name: string;
  divisions: number;
  colsPerDivision: number;
  fillFrom: string;
  cellsJson: string;
}

export interface SeatAssignmentItem {
  id: string;
  name: string;
  layoutId: string | null;
  configJson: string;
  cellsJson: string;
  namesJson: string;
}
