import { TaxConfig } from "@/types/classroom";

export function calculateTax(
  type: "transaction" | "income" | "other" | "penalty",
  amount: number,
  config: TaxConfig
): number {
  if (amount <= 0 && type !== "penalty") return 0;
  let tax = 0;

  if (type === "transaction") {
    if (config.txTaxType === "rate") {
      tax = amount * (config.txTaxValue / 100);
    } else {
      tax = Math.min(amount, config.txTaxValue);
    }
  } else if (type === "income") {
    if (config.incomeTaxType === "rate") {
      tax = amount * (config.incomeTaxValue / 100);
    } else {
      tax = Math.min(amount, config.incomeTaxValue);
    }
  } else if (type === "other") {
    if (config.otherTaxType === "rate") {
      tax = amount * (config.otherTaxValue / 100);
    } else {
      tax = Math.min(amount, config.otherTaxValue);
    }
  } else if (type === "penalty") {
    if (config.penaltyDisposition === "void") {
      tax = 0;
    } else {
      tax = Math.abs(amount);
    }
  }

  // 세금 반올림 단위 처리 (1단위, 10단위, 100단위)
  const unit = config.taxRoundingUnit || 1;
  if (unit > 1) {
    tax = Math.round(tax / unit) * unit;
  } else {
    tax = Math.round(tax);
  }

  return Math.max(0, tax);
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  txTaxType: "rate",
  txTaxValue: 10,
  incomeTaxType: "rate",
  incomeTaxValue: 10,
  otherTaxType: "rate",
  otherTaxValue: 5,
  penaltyDisposition: "treasury",
  taxRoundingUnit: 1,
  salaryPayoutMode: "MANUAL_APPROVAL",
  taxMethod: "WITHHOLDING",
};
