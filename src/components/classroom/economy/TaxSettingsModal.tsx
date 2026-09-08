"use client";

import { useState, useEffect } from "react";
import { TaxConfig } from "@/types/classroom";
import { DEFAULT_TAX_CONFIG } from "@/lib/taxEngine";

interface TaxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: TaxConfig;
  currencyName?: string;
  onSave: (config: TaxConfig) => void;
  onUpdateCurrencyName?: (name: string) => void;
}

export default function TaxSettingsModal({
  isOpen,
  onClose,
  config,
  currencyName = "원",
  onSave,
  onUpdateCurrencyName,
}: TaxSettingsModalProps) {
  const [unitName, setUnitName] = useState(currencyName);
  const [formData, setFormData] = useState<TaxConfig>({
    ...config,
    salaryPayoutMode: config.salaryPayoutMode || "MANUAL_APPROVAL",
    taxMethod: config.taxMethod || "WITHHOLDING",
    penaltyDisposition: config.penaltyDisposition || "treasury",
    taxRoundingUnit: config.taxRoundingUnit || 1,
  });

  useEffect(() => {
    setFormData({
      ...config,
      salaryPayoutMode: config.salaryPayoutMode || "MANUAL_APPROVAL",
      taxMethod: config.taxMethod || "WITHHOLDING",
      penaltyDisposition: config.penaltyDisposition || "treasury",
      taxRoundingUnit: config.taxRoundingUnit || 1,
    });
    setUnitName(currencyName);
  }, [config, currencyName]);

  if (!isOpen) return null;

  const handleReset = () => {
    setFormData({
      ...DEFAULT_TAX_CONFIG,
    });
    setUnitName(currencyName || "원");
  };

  const handleSave = () => {
    if (onUpdateCurrencyName && unitName.trim()) {
      onUpdateCurrencyName(unitName.trim());
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="font-extrabold text-slate-800 text-lg">학급 화폐 및 세무·급여 정책 설정</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl leading-none">
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-500">
          화폐 단위 명칭, 급여 승인 방식, 세금 부과 체계 및 벌금 처리 방식을 설정합니다.
        </p>

        <div className="space-y-3 text-sm">
          {/* 화폐 단위 명칭 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800">학급 화폐 단위 명칭</div>
              <div className="text-xs text-slate-500">학급 화폐의 호칭 (예: 원, 포인트, 코인 등)</div>
            </div>
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="예: 원, 포인트 등"
              className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
              required
            />
          </div>

          {/* 급여 승인 방식 & 세금 부과 체계 & 반올림 단위 */}
          <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">급여 지급 승인 방식</div>
                <div className="text-xs text-slate-500">당번/루틴 수행 후 급여 정산 승인 규칙</div>
              </div>
              <select
                value={formData.salaryPayoutMode || "MANUAL_APPROVAL"}
                onChange={(e) => setFormData({ ...formData, salaryPayoutMode: e.target.value as "MANUAL_APPROVAL" | "AUTO_ON_CONFIRM" })}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold text-indigo-900 focus:outline-none"
              >
                <option value="MANUAL_APPROVAL">담임 일괄 승인제</option>
                <option value="AUTO_ON_CONFIRM">즉시 자동 입금</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-100/60">
              <div>
                <div className="font-bold text-slate-800">세금 부과 체계</div>
                <div className="text-xs text-slate-500">지급 시 공제(원천징수) 또는 별도 납부</div>
              </div>
              <select
                value={formData.taxMethod || "WITHHOLDING"}
                onChange={(e) => setFormData({ ...formData, taxMethod: e.target.value as "WITHHOLDING" | "ADDITION" | "TAX_FREE" })}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold text-indigo-900 focus:outline-none"
              >
                <option value="WITHHOLDING">원천징수 (자동 공제)</option>
                <option value="ADDITION">추가 부과</option>
                <option value="TAX_FREE">면세 (세금 0%)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-indigo-100/60">
              <div>
                <div className="font-bold text-slate-800">세금 계산 반올림 단위</div>
                <div className="text-xs text-slate-500">세액 계산 시 끝수 처리 자리수</div>
              </div>
              <select
                value={formData.taxRoundingUnit || 1}
                onChange={(e) => setFormData({ ...formData, taxRoundingUnit: Number(e.target.value) as 1 | 10 | 100 })}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold text-indigo-900 focus:outline-none"
              >
                <option value={1}>1단위 (반올림 없음 / 1단위 정산)</option>
                <option value={10}>10단위 (1의 자리 반올림)</option>
                <option value={100}>100단위 (10의 자리 반올림)</option>
              </select>
            </div>
          </div>

          {/* 소득세 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800">1. 소득세 (급여/수당 세율)</div>
              <div className="text-xs text-slate-500">당번 급여 및 노동 수당 입금 시 부과</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={formData.incomeTaxType}
                onChange={(e) => setFormData({ ...formData, incomeTaxType: e.target.value as "rate" | "fixed" })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold focus:outline-none"
              >
                <option value="rate">비율 (%)</option>
                <option value="fixed">정액 ({unitName})</option>
              </select>
              <input
                type="number"
                min={0}
                value={formData.incomeTaxValue}
                onChange={(e) => setFormData({ ...formData, incomeTaxValue: parseInt(e.target.value, 10) || 0 })}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* 거래세 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800">2. 거래세 (학생 간 송금)</div>
              <div className="text-xs text-slate-500">학생 간 송금 및 물품 거래 시 수취인에게 부과</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={formData.txTaxType}
                onChange={(e) => setFormData({ ...formData, txTaxType: e.target.value as "rate" | "fixed" })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold focus:outline-none"
              >
                <option value="rate">비율 (%)</option>
                <option value="fixed">정액 ({unitName})</option>
              </select>
              <input
                type="number"
                min={0}
                value={formData.txTaxValue}
                onChange={(e) => setFormData({ ...formData, txTaxValue: parseInt(e.target.value, 10) || 0 })}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* 기타 세금 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800">3. 기타 세금 (상금 등)</div>
              <div className="text-xs text-slate-500">일반 상금 및 특별 지원금 입금 시 부과</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={formData.otherTaxType}
                onChange={(e) => setFormData({ ...formData, otherTaxType: e.target.value as "rate" | "fixed" })}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold focus:outline-none"
              >
                <option value="rate">비율 (%)</option>
                <option value="fixed">정액 ({unitName})</option>
              </select>
              <input
                type="number"
                min={0}
                value={formData.otherTaxValue}
                onChange={(e) => setFormData({ ...formData, otherTaxValue: parseInt(e.target.value, 10) || 0 })}
                className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* 벌금 정책 (국고 귀속 vs 화폐 소멸) */}
          <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/60 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-rose-900">4. 학생 벌금 (차감액) 처리 방식</div>
              <div className="text-xs text-rose-700">규칙 위반 벌금 차감 시 국고 세수로 귀속할지 통화에서 소멸시킬지 결정</div>
            </div>
            <select
              value={formData.penaltyDisposition || "treasury"}
              onChange={(e) => setFormData({ ...formData, penaltyDisposition: e.target.value as "treasury" | "void" })}
              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-white font-bold text-rose-900 focus:outline-none"
            >
              <option value="treasury">국고 세수로 귀속</option>
              <option value="void">화폐 소멸 (국고 미귀속)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-sm font-bold"
          >
            기본값 복원
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs"
            >
              설정 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
