"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { CornerDownLeft } from "lucide-react";
import { TaxConfig } from "@/types/classroom";
import { isTaxEnabled } from "@/lib/taxEngine";

interface QuickDepositBarProps {
  checkedNames: string[];
  currencyName: string;
  taxConfig: TaxConfig;
  onExecuteBatchDeposit: (targetNames: string[], amount: number, desc: string, applyTax: boolean) => void;
  onOpenDepositModal: () => void;
  onClearSelection: () => void;
}

export default function QuickDepositBar({
  checkedNames,
  currencyName,
  taxConfig,
  onExecuteBatchDeposit,
  onOpenDepositModal,
  onClearSelection,
}: QuickDepositBarProps) {
  const [amountInput, setAmountInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  const isTaxOn = isTaxEnabled(taxConfig);
  const [applyTax, setApplyTax] = useState(isTaxOn);

  useEffect(() => {
    setApplyTax(isTaxOn);
  }, [isTaxOn]);

  const resetInputs = () => {
    setAmountInput("");
    setDescInput("");
  };

  // 학생 선택 시 자동으로 금액 입력창에 포커스
  useEffect(() => {
    if (checkedNames.length > 0) {
      amountRef.current?.focus();
      amountRef.current?.select();
    }
  }, [checkedNames]);

  const handleExecute = () => {
    const rawVal = amountInput.trim();
    if (!rawVal) return;

    const sanitized = rawVal.replace(/[－—–]/g, "-");
    const num = parseInt(sanitized.replace(/[^0-9-]/g, ""), 10);
    if (isNaN(num) || num === 0) return;

    const isDeduct = num < 0 || sanitized.startsWith("-");
    const finalAmount = isDeduct ? -Math.abs(num) : Math.abs(num);
    const customDesc = descInput.trim();
    const finalDesc = customDesc || (isDeduct ? "빠른 특별 차감" : "빠른 특별 입금");
    const shouldTax = !isDeduct && applyTax;

    onExecuteBatchDeposit(checkedNames, finalAmount, finalDesc, shouldTax);
    resetInputs();
    onClearSelection();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    } else if (e.key === "Escape") {
      e.preventDefault();
      resetInputs();
      onClearSelection();
    }
  };

  if (checkedNames.length === 0) return null;

  const isNegative = amountInput.trim().replace(/[－—–]/g, "-").startsWith("-");

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-indigo-50/95 border border-indigo-200 shadow-2xs flex-wrap">
      <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0 select-none">
        {checkedNames.length}명
      </span>

      {/* 1. 금액 입력창 (음수 입력 시 자동 차감) */}
      <div className="relative flex items-center shrink-0">
        <input
          ref={amountRef}
          type="text"
          inputMode="numeric"
          tabIndex={1}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="금액(+/-)"
          className={`w-24 px-2 py-0.5 bg-white border rounded-lg text-xs font-extrabold focus:outline-none focus:ring-2 placeholder:text-slate-400 placeholder:font-normal transition-colors ${
            isNegative
              ? "border-rose-300 text-rose-700 focus:ring-rose-400"
              : "border-indigo-200 text-slate-800 focus:ring-indigo-400"
          }`}
        />
        <span className="ml-1 text-[11px] font-bold text-slate-500">{currencyName}</span>
      </div>

      {/* 2. 사유 입력창 (Tab 이동 대상) */}
      <div className="relative flex items-center shrink-0">
        <input
          ref={descRef}
          type="text"
          tabIndex={2}
          value={descInput}
          onChange={(e) => setDescInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="사유(Tab 이동, Enter 실행)"
          className="w-36 px-2 py-0.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
        />
      </div>

      {/* 세금 부과 여부 (양수 입금일 때만 표시) */}
      {!isNegative && (
        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            tabIndex={3}
            checked={applyTax}
            onChange={(e) => setApplyTax(e.target.checked)}
            className="rounded text-indigo-600 w-3.5 h-3.5 accent-indigo-600"
          />
          <span className={applyTax ? "text-indigo-700" : "text-slate-400"}>
            세금
          </span>
        </label>
      )}

      {/* 실행 버튼 */}
      <button
        type="button"
        tabIndex={4}
        onClick={handleExecute}
        className={`px-2 py-0.5 rounded-lg text-white font-bold text-xs flex items-center gap-1 transition-all shadow-2xs shrink-0 cursor-pointer ${
          isNegative
            ? "bg-rose-600 hover:bg-rose-700 active:scale-95"
            : "bg-indigo-600 hover:bg-indigo-700 active:scale-95"
        }`}
        title="입력한 금액 및 사유로 즉시 실행 (Enter)"
      >
        <span>실행</span>
        <CornerDownLeft className="w-3 h-3 opacity-80" />
      </button>

      <span className="text-slate-300 text-xs select-none">|</span>

      {/* 상세 모달 버튼 */}
      <button
        type="button"
        tabIndex={5}
        onClick={onOpenDepositModal}
        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
        title="상세 모달 열기"
      >
        상세
      </button>
    </div>
  );
}
