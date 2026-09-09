export interface ClassroomStudent {
  no: number;
  name: string;
  balance: number;
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
  displayFormat?: string;
}

export interface TaxConfig {
  txTaxType: "rate" | "fixed";
  txTaxValue: number;
  incomeTaxType: "rate" | "fixed";
  incomeTaxValue: number;
  otherTaxType: "rate" | "fixed";
  otherTaxValue: number;
  penaltyDisposition: "treasury" | "void"; // "treasury": 국고 세수 귀속, "void": 화폐 소각(소멸)
  taxRoundingUnit?: number; // 세금 반올림 단위 (1단위, 10단위, 100단위 등)
  salaryPayoutMode?: "MANUAL_APPROVAL" | "AUTO_ON_CONFIRM";
  taxMethod?: "WITHHOLDING" | "TAX_FREE";
  penaltyType?: "rate" | "fixed";
  penaltyValue?: number;
}

export interface BundleAction {
  type: "deposit" | "deduct";
  target: "all" | "selected" | "treasury" | "specific" | string;
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
}

export interface ElementLayout {
  left: string;
  top: string;
  width?: string;
  height?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface BoardElementLayouts {
  dateBox: ElementLayout;
  clockBox: ElementLayout;
  noticeBox: ElementLayout;
  routineBox: ElementLayout;
}

export type BoardTargetElement =
  | "all"
  | "noticeBox"
  | "dateBox"
  | "clockBox"
  | "routineBox"
  | "freeCard"
  | string;
export type BoardTheme = "chalkboard" | "white" | "navy" | "warm";
export type NoticeFontSize = "34" | "42" | "50" | "58";
