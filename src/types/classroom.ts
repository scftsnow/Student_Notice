import type { SeatCellState } from "@/types";

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
