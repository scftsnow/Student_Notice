"use client";

import { useState, useEffect } from "react";
import { X, Coins } from "lucide-react";
import { ClassroomStudent, TaxConfig } from "@/types/classroom";
import { calculateTax, getEffectiveTaxRate } from "@/lib/taxEngine";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  initialSelectedNames: string[];
  currencyName?: string;
  taxConfig?: TaxConfig;
  onExecute: (targetNames: string[], amount: number, desc: string, applyTax: boolean) => void;
}

export default function DepositModal({
  isOpen,
  onClose,
  students,
  initialSelectedNames,
  currencyName = "원",
  taxConfig,
  onExecute,
}: DepositModalProps) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [amount, setAmount] = useState(200);
  const [desc, setDesc] = useState("담임 특별 입금");
  const [applyTax, setApplyTax] = useState(taxConfig ? taxConfig.taxMethod !== "TAX_FREE" : false);

  useEffect(() => {
    if (initialSelectedNames.length > 0) {
      setSelectedNames(initialSelectedNames);
    } else {
      setSelectedNames(students.map((s) => s.name));
    }
  }, [initialSelectedNames, students]);

  useEffect(() => {
    if (isOpen) {
      setApplyTax(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleStudent = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    if (selectedNames.length === students.length) {
      setSelectedNames([]);
    } else {
      setSelectedNames(students.map((s) => s.name));
    }
  };

  const handleSubmit = (isDeduct = false) => {
    if (selectedNames.length === 0) {
      alert("입금/차감 대상 학생을 한 명 이상 선택하세요.");
      return;
    }
    const finalAmount = isDeduct ? -Math.abs(amount) : Math.abs(amount);
    onExecute(selectedNames, finalAmount, desc.trim() || (isDeduct ? "특별 차감" : "특별 입금"), applyTax);
    onClose();
  };

  // 예상 세금 계산
  const effectiveRate = taxConfig ? getEffectiveTaxRate(taxConfig) : 10;
  const previewTax = (applyTax && taxConfig && amount > 0)
    ? calculateTax("income", amount, taxConfig)
    : 0;
  const netAmount = Math.max(0, amount - previewTax);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-slate-800 text-base">학생 화폐 입금 및 차감</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* 학생 선택 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">
                대상 학생 선택 ({selectedNames.length}/{students.length}명)
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 transition-colors"
              >
                {selectedNames.length === students.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-2 rounded-lg bg-slate-50 border border-slate-200">
              {students.map((s) => {
                const isSelected = selectedNames.includes(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggleStudent(s.name)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">금액 ({currencyName})</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">지급 / 차감 사유</label>
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
              <span className="font-semibold text-slate-700">세금 부과 ({effectiveRate}% 국고 귀속)</span>
              {applyTax && previewTax > 0 && (
                <span className="text-[11px] text-indigo-600 font-bold mt-0.5">
                  1인당 세금 부과: {previewTax.toLocaleString()} {currencyName} (실지급: {netAmount.toLocaleString()} {currencyName})
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
            onClick={() => handleSubmit(true)}
            className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
          >
            차감 실행
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            입금 완료
          </button>
        </div>
      </div>
    </div>
  );
}
