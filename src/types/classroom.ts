import type { SeatCellState, SeatGenderMode } from "@/types";

export interface ClassroomStudent {
  no?: number;
  name: string;
  balance: number;
  gender?: "남" | "여";
}

export interface ClassroomRoutine {
  id: string;
  icon: string;
  name: string;
  slots: number;
  pay: number;
  payCycle?: "건당" | "일당" | "주당" | "월당" | string;
  memo: string;
  order: string[];
  currentIdx: number;
  absenceMode?: "next" | "defer" | "pass" | "manual";
  pinchHitterStudent?: string;
  skipHistory?: (string | number)[];
  displayFormat?: string;
  visibleInNotice?: boolean;
  layout?: Partial<ElementLayout>;
}

// --- 학생 과제 (숙제 제출 관리) ---

/** 과제 상태: 진행 중 / 완료 (마감일 지난 과제는 자동 완료) */
export type HomeworkStatus = "ACTIVE" | "DONE";

/**
 * 학생 과제.
 * - 제출 대상은 등록된 학생 전원(제외 대상은 exempt에 이름 저장)
 * - 제출 여부는 submitted에 이름 목록으로 보관 (미제출자 = 대상 - 제출)
 */
export interface Homework {
  id: string;
  /** 과제 제목 */
  title: string;
  /** 마감일 (YYYY-MM-DD). 빈 문자열이면 기한 없음 */
  dueDate: string;
  /** 제출한 학생 이름 목록 */
  submitted: string[];
  /** 사유로 제출 대상에서 제외한 학생 이름 목록 */
  exempt: string[];
  /** 생성일 (YYYY-MM-DD) */
  createdAt: string;
  /** 명시적 완료 처리 (마감일 대신 수동으로 끝낼 때) */
  status?: HomeworkStatus;
  // --- 칠판 요소 위치 (알림장 편집 화면에서 조절, % 문자열) ---
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  /** 칠판에 요일별로만 표시 (미지정이면 항상 표시). 업무 요소와 동일한 스케줄. */
  visibleDays?: number[];
  /**
   * 칠판 요소 본문 템플릿 (업무 요소의 displayFormat과 같은 개념).
   * `?` = 다음 미제출 학생 이름, `#` = 미제출 인원 수로 치환된다.
   * 미지정이면 기본 템플릿이 쓰인다.
   */
  displayTemplate?: string;
  /** 칠판 요소 서식 (알림장 편집 화면의 대상 선택으로 글꼴·크기·색상 등을 지정) */
  layout?: {
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    fontFamily?: string;
  };
}

/** 과제의 현재 상태: 마감일 또는 수동 완료 기준 */
export function resolveHomeworkStatus(hw: Homework, today: string): HomeworkStatus {
  if (hw.status === "DONE") return "DONE";
  if (hw.dueDate && hw.dueDate <= today) return "DONE";
  return "ACTIVE";
}

/** 과제의 제출 대상 학생 (전원 - 제외자) */
export function homeworkTargets(hw: Homework, students: ClassroomStudent[]): string[] {
  const exempt = new Set(hw.exempt);
  return students.filter((s) => !exempt.has(s.name)).map((s) => s.name);
}

/** 과제의 미제출자 목록 (제출 대상 - 제출자) */
export function homeworkUnsubmitted(hw: Homework, students: ClassroomStudent[]): string[] {
  const done = new Set(hw.submitted);
  return homeworkTargets(hw, students).filter((n) => !done.has(n));
}

export interface SavedOrderPreset {
  id: string;
  name: string;
  order: string[];
  createdAt: string;
  /** true면 뽑기 실행 시 자동 보관된 최근 기록 (최대 3개, 이름 지정 시 프리셋으로 승격) */
  auto?: boolean;
}

export interface SavedGroupPreset {
  id: string;
  name: string;
  groups: string[][];
  createdAt: string;
  /** true면 뽑기 실행 시 자동 보관된 최근 기록 (최대 3개, 이름 지정 시 프리셋으로 승격) */
  auto?: boolean;
}

export interface SavedSeatPreset {
  id: string;
  name: string;
  /** 자리배치 셀 배열 (자유 배치 % 좌표 x/y 포함. occupant/고정 포함 가능, 로드 시 seatFree 정규화) */
  cells: SeatCellState[];
  createdAt: string;
  /** true면 그리드 생성/변경 시 자동 보관된 최근 기록 (최대 3개, 이름 지정 시 프리셋으로 승격) */
  auto?: boolean;
  /** 저장 시점의 분단 설정 (불러오기에 그대로 적용. 구버전 프리셋은 없음) */
  config?: SeatPresetConfig;
}

/** 자리 프리셋에 함께 저장되는 분단 설정 (채우기는 항상 뒷줄 고정이라 제외). */
export interface SeatPresetConfig {
  divisions: number;
  colsPerDivision: number;
  genderMode: SeatGenderMode;
}

export interface TaxConfig {
  taxRate?: number; // 학급 통합 단일 기본 세율 (%) - 기본 10
  txTaxType?: "rate" | "fixed";
  txTaxValue?: number;
  incomeTaxType?: "rate" | "fixed";
  incomeTaxValue?: number;
  otherTaxType?: "rate" | "fixed";
  otherTaxValue?: number;
  penaltyDisposition: "treasury" | "void"; // "treasury": 국고 세수 귀속, "void": 화폐 소각(소멸)
  taxRoundingUnit?: number; // 세금 반올림 단위 (1단위, 10단위, 100단위 등)
  salaryPayoutMode?: "MANUAL_APPROVAL" | "AUTO_ON_CONFIRM";
  taxMethod?: "WITHHOLDING" | "TAX_FREE";
  penaltyType?: "rate" | "fixed";
  penaltyValue?: number;
}

export interface BundleAction {
  type: "deposit" | "deduct";
  target: "all" | "selected" | "unselected" | "treasury" | "specific" | string;
  specificTargets?: string[];
  amount: number;
  desc: string;
  applyTax: boolean;
  taxType?: "transaction" | "income" | "other" | "penalty";
}

export interface CustomBundle {
  id: string;
  name: string;
  desc: string;
  icon?: string;
  actions: BundleAction[];
}

export interface LedgerRecord {
  id: number | string;
  date: string;
  type: "입금" | "거래" | "차감" | string;
  from: string;
  to: string;
  targetDisplay: string;
  desc: string;
  amount: number;
  tax: number;
  targets: string[];
}

export interface FreeCardData {
  id: string;
  html: string;
  left: string;
  top: string;
  width?: string;
  height?: string;
  align?: "left" | "center" | "right";
  color?: string;
  fontSize?: number;
  lineHeight?: number | string;
  fontFamily?: string;
  visible?: boolean;
  label?: string;
  visibleDays?: number[];
}

export interface ElementLayout {
  left: string;
  top: string;
  width?: string;
  height?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number | string;
  fontFamily?: string;
  clockType?: "digital" | "analog";
  clockFormat?: "12h" | "24h";
  visible?: boolean;
  label?: string;
  visibleDays?: number[];
}

export interface BoardElementLayouts {
  dateBox: ElementLayout;
  clockBox: ElementLayout;
  routineBox: ElementLayout;
  accountBox?: ElementLayout;
}

export type BoardTargetElement =
  | "all"
  | "dateBox"
  | "clockBox"
  | "routineBox"
  | "accountBox"
  | "freeCard"
  | string;
export type BoardTheme = "chalkboard" | "white" | "navy" | "warm";
export type NoticeFontSize = "34" | "42" | "50" | "58" | (string & {});
