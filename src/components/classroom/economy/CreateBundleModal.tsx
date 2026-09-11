"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { ClassroomStudent, CustomBundle, BundleAction, TaxConfig } from "@/types/classroom";
import { isTaxEnabled } from "@/lib/taxEngine";

interface DraftAction {
  target: "all" | "selected" | "treasury" | "specific";
  specificTargets: string[];
  amountInput: string;
  desc: string;
  applyTax: boolean;
}

interface CreateBundleModalProps {
  isOpen: boolean;
  students: ClassroomStudent[];
  currencyName: string;
  onClose: () => void;
  onSave: (bundle: CustomBundle) => void;
  initialBundle?: CustomBundle | null;
  taxConfig?: TaxConfig;
}

const isActionDeduct = (amountInput: string): boolean => {
  const sanitized = amountInput.trim().replace(/[－—–]/g, "-");
  return sanitized.startsWith("-") || parseInt(sanitized.replace(/[^0-9-]/g, ""), 10) < 0;
};

const parseActionAmount = (amountInput: string): number => {
  const sanitized = amountInput.trim().replace(/[－—–]/g, "-");
  const num = parseInt(sanitized.replace(/[^0-9-]/g, ""), 10);
  return isNaN(num) ? 0 : Math.abs(num);
};

export default function CreateBundleModal({
  isOpen,
  students,
  currencyName,
  onClose,
  onSave,
  initialBundle,
  taxConfig,
}: CreateBundleModalProps) {
  const isTaxOn = isTaxEnabled(taxConfig);

  const makeEmptyAction = (): DraftAction => ({
    target: "all",
    specificTargets: [],
    amountInput: "",
    desc: "",
    applyTax: isTaxOn,
  });

  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([makeEmptyAction()]);

  const reset = () => {
    setDraftName("");
    setDraftDesc("");
    setDraftActions([makeEmptyAction()]);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialBundle) {
        setDraftName(initialBundle.name);
        setDraftDesc(initialBundle.desc || "");
        setDraftActions(
          initialBundle.actions.length > 0
            ? initialBundle.actions.map((a) => {
                const target: "all" | "selected" | "treasury" | "specific" =
                  a.target === "selected" || a.target === "treasury" || a.target === "specific"
                    ? a.target
                    : "all";
                const isDeduct = a.type === "deduct";
                return {
                  target,
                  specificTargets: a.specificTargets ? [...a.specificTargets] : [],
                  amountInput: isDeduct ? `-${a.amount}` : (a.amount ? `${a.amount}` : ""),
                  desc: a.desc || "",
                  applyTax: a.applyTax !== undefined ? !!a.applyTax : (!isDeduct && target !== "treasury" ? isTaxOn : false),
                };
              })
            : [makeEmptyAction()]
        );
      } else {
        reset();
      }
    }
  }, [isOpen, initialBundle, isTaxOn]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const addAction = () => setDraftActions((p) => [...p, makeEmptyAction()]);
  const removeAction = (idx: number) => setDraftActions((p) => p.filter((_, i) => i !== idx));

  const updateAction = (idx: number, patch: Partial<DraftAction>) => {
    setDraftActions((p) =>
      p.map((a, i) => {
        if (i !== idx) return a;
        const updated = { ...a, ...patch };
        const isDeduct = isActionDeduct(updated.amountInput);
        // 세금 적용은 입금(양수)이면서 국고가 아닐 때만 가능
        if (isDeduct || updated.target === "treasury") {
          updated.applyTax = false;
        } else if (patch.amountInput !== undefined && !isDeduct && a.target !== "treasury" && isActionDeduct(a.amountInput)) {
          updated.applyTax = isTaxOn;
        }
        return updated;
      })
    );
  };

  const toggleSpecificStudent = (idx: number, studentName: string) => {
    setDraftActions((p) =>
      p.map((a, i) => {
        if (i !== idx) return a;
        const exists = a.specificTargets.includes(studentName);
        const specificTargets = exists
          ? a.specificTargets.filter((n) => n !== studentName)
          : [...a.specificTargets, studentName];
        return { ...a, specificTargets };
      })
    );
  };

  const handleSave = () => {
    if (!draftName.trim()) return;
    const actions: BundleAction[] = draftActions
      .map((a) => {
        const isDeduct = isActionDeduct(a.amountInput);
        const absAmount = parseActionAmount(a.amountInput);
        return {
          type: (isDeduct ? "deduct" : "deposit") as "deposit" | "deduct",
          target: a.target,
          specificTargets: a.target === "specific" ? a.specificTargets : undefined,
          amount: absAmount,
          desc: a.desc.trim() || draftName.trim(),
          applyTax: !isDeduct && a.target !== "treasury" ? a.applyTax : false,
        };
      })
      .filter((a) => a.amount > 0);

    if (actions.length === 0) {
      alert("유효한 액션(금액이 0이 아닌 항목)이 없습니다.");
      return;
    }

    onSave({
      id: initialBundle ? initialBundle.id : `bundle-${Date.now()}`,
      name: draftName.trim(),
      desc: draftDesc.trim(),
      actions,
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] text-xs overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <span className="font-bold text-sm text-slate-800">
            {initialBundle ? "복합 정산 항목 수정" : "복합 정산 항목 등록"}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              항목 이름 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 급식 당번비, 학급 활동비, 벌금 분배..."
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">설명 (선택)</label>
            <input
              type="text"
              placeholder="이 정산 항목에 대한 설명..."
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>


          {/* 액션 목록 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">정산 액션 구성</label>
              <button
                type="button"
                onClick={addAction}
                className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-all"
              >
                + 행 추가
              </button>
            </div>
            <div className="space-y-2.5">
              {draftActions.map((action, idx) => {
                const isDeduct = isActionDeduct(action.amountInput);
                const canApplyTax = !isDeduct && action.target !== "treasury";
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* 대상 선택 */}
                      <select
                        value={action.target}
                        onChange={(e) =>
                          updateAction(idx, {
                            target: e.target.value as "all" | "selected" | "treasury" | "specific",
                          })
                        }
                        className="px-2 py-1 rounded-md border border-slate-200 bg-white font-bold focus:outline-none text-[11px]"
                      >
                        <option value="all">전체 학생</option>
                        <option value="selected">카드 선택 학생</option>
                        <option value="specific">특정 학생 지정</option>
                        <option value="treasury">학급 국고</option>
                      </select>

                      {/* 금액 입력창 (음수 입력 시 자동 차감) */}
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="금액(+/-)"
                          value={action.amountInput}
                          onChange={(e) => updateAction(idx, { amountInput: e.target.value })}
                          className={`w-24 px-2 py-1 rounded-md border font-mono font-bold text-right focus:outline-none focus:ring-1 text-[11px] transition-colors ${
                            isDeduct
                              ? "border-rose-300 text-rose-700 focus:ring-rose-400 bg-rose-50/20"
                              : "border-slate-200 text-slate-800 focus:ring-indigo-400 bg-white"
                          }`}
                        />
                        <span className="ml-1 text-[11px] font-bold text-slate-400 shrink-0">{currencyName}</span>
                      </div>

                      {/* 입출금 구분 뱃지 */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold select-none shrink-0 ${
                          isDeduct
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        }`}
                      >
                        {action.target === "treasury"
                          ? (isDeduct ? "국고 지출" : "국고 전입")
                          : (isDeduct ? "차감" : "입금")}
                      </span>

                      {/* 세금 부과 (양수 입금 시에만 활성화) */}
                      <label
                        className={`flex items-center gap-1 ml-auto text-[11px] select-none ${
                          canApplyTax ? "text-slate-600 cursor-pointer" : "text-slate-300 cursor-not-allowed"
                        }`}
                        title={canApplyTax ? "세금 부과 (국고 귀속)" : "세금 부과는 학생 입금(+) 시에만 가능합니다."}
                      >
                        <input
                          type="checkbox"
                          disabled={!canApplyTax}
                          checked={action.applyTax && canApplyTax}
                          onChange={(e) => updateAction(idx, { applyTax: e.target.checked })}
                          className="rounded text-indigo-600 w-3 h-3 disabled:opacity-30"
                        />
                        <span>세금 부과</span>
                      </label>

                      {draftActions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(idx)}
                          className="text-slate-300 hover:text-rose-500 ml-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* 특정 학생 선택 UI (target === "specific"일 때 노출) */}
                    {action.target === "specific" && (
                      <div className="p-2 rounded bg-white border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">
                          지정 학생 선택 ({action.specificTargets.length}명 선택됨):
                        </span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {students.map((s) => {
                            const isSelected = action.specificTargets.includes(s.name);
                            return (
                              <button
                                key={s.name}
                                type="button"
                                onClick={() => toggleSpecificStudent(idx, s.name)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-2xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 거래 설명 */}
                    <input
                      type="text"
                      placeholder="거래 설명 (내역 기록용)"
                      value={action.desc}
                      onChange={(e) => updateAction(idx, { desc: e.target.value })}
                      className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draftName.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {initialBundle ? "수정 완료" : "복합 정산 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
