import { TaxConfig } from "@/types/classroom";

export function getEffectiveTaxRate(config: TaxConfig): number {
  if (config.taxMethod === "TAX_FREE") return 0;
  if (typeof config.taxRate === "number") return Math.max(0, config.taxRate);
  return config.incomeTaxValue ?? config.txTaxValue ?? 10;
}

export function calculateTax(
  type: "transaction" | "income" | "other" | "penalty",
  amount: number,
  config: TaxConfig
): number {
  if (amount <= 0 && type !== "penalty") return 0;
  if (config.taxMethod === "TAX_FREE" && type !== "penalty") return 0;
  let tax = 0;

  if (type === "penalty") {
    tax = config.penaltyDisposition === "void" ? 0 : Math.abs(amount);
  } else {
    // 단일 학급 기본 세율 적용 (기본 10%)
    const rate = getEffectiveTaxRate(config);
    tax = amount * (rate / 100);
  }

  // 세금 반올림 단위 처리 (정수 단위: 1/10/100, 소수 단위: 0.1/0.01/0.001)
  const unit = config.taxRoundingUnit || 1;
  tax = Math.round(tax / unit) * unit;

  return Math.max(0, tax);
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  taxRate: 10,
  txTaxType: "rate",
  txTaxValue: 10,
  incomeTaxType: "rate",
  incomeTaxValue: 10,
  otherTaxType: "rate",
  otherTaxValue: 10,
  penaltyDisposition: "void",
  taxRoundingUnit: 1,
  salaryPayoutMode: "MANUAL_APPROVAL",
  taxMethod: "WITHHOLDING",
};
