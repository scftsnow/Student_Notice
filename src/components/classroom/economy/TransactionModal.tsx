"use client";

import { useState, useEffect } from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { ClassroomStudent, TaxConfig } from "@/types/classroom";
import { calculateTax, getEffectiveTaxRate, isTaxEnabled } from "@/lib/taxEngine";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  treasuryBalance: number;
  currencyName?: string;
  taxConfig?: TaxConfig;
  onExecute: (from: string, to: string, amount: number, desc: string, applyTax: boolean) => void;
}

export default function TransactionModal({
  isOpen,
  onClose,
  students,
  currencyName = "원",
  taxConfig,
  onExecute,
}: TransactionModalProps) {
  const [fromVal, setFromVal] = useState(students[0]?.name || "");
  const [toVal, setToVal] = useState(students[1]?.name || students[0]?.name || "");
  const [amount, setAmount] = useState(100);
  const [desc, setDesc] = useState("학생 간 거래");
  const isTaxOn = isTaxEnabled(taxConfig);
  const [applyTax, setApplyTax] = useState(isTaxOn);

  // 명단 변경 시 보내는/받는 학생이 유효한 학생으로 유지되도록 보정 (국고는 취급하지 않음)
  useEffect(() => {
    const names = students.map((s) => s.name);
    if (names.length === 0) return;
    if (!names.includes(fromVal)) setFromVal(names[0]);
    if (!names.includes(toVal)) {
      setToVal(names.find((n) => n !== fromVal) ?? names[0]);
    }
  }, [students, fromVal, toVal]);

  useEffect(() => {
    if (isOpen) {
      setApplyTax(isTaxOn);
    }
  }, [isOpen, isTaxOn]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (students.length < 2) {
      alert("학생 간 거래에는 학생이 2명 이상 필요합니다.");
      return;
    }
    if (fromVal === toVal) {
      alert("송금자와 수취인이 같을 수 없습니다.");
      return;
    }
    if (amount <= 0) {
      alert("올바른 금액을 입력하세요.");
      return;
    }
    try {
      onExecute(fromVal, toVal, amount, desc.trim() || "학생 간 거래", applyTax);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "거래 실행 실패";
      alert(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            <h2 className="font-extrabold text-slate-800 text-base">학생 간 거래</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            학생끼리 주고받는 거래만 처리합니다. 국고 입금·출금과 국고→학생 전송은 [국고 입·출금]에서
            처리해 주세요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-slate-600">보내는 학생</label>
              <select
                value={fromVal}
                onChange={(e) => setFromVal(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.balance.toLocaleString()} {currencyName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-semibold text-slate-600">받는 학생</label>
              <select
                value={toVal}
                onChange={(e) => setToVal(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.balance.toLocaleString()} {currencyName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">거래 금액 ({currencyName})</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">거래 내용</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={applyTax}
              onChange={(e) => setApplyTax(e.target.checked)}
              className="rounded text-indigo-600"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-slate-700">
                세금 부과 ({taxConfig ? getEffectiveTaxRate(taxConfig) : 10}% 국고 귀속)
              </span>
              {applyTax && taxConfig && amount > 0 && (
                <span className="text-[11px] text-emerald-600 font-bold mt-0.5">
                  수취인 세금 부과: {calculateTax("transaction", amount, taxConfig).toLocaleString()} {currencyName} (실수령: {Math.max(0, amount - calculateTax("transaction", amount, taxConfig)).toLocaleString()} {currencyName})
                </span>
              )}
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
          >
            거래 완료
          </button>
        </div>
      </div>
    </div>
  );
}
