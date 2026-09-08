"use client";

import { useState, useEffect } from "react";
import { ClassroomStudent, CustomBundle, BundleAction } from "@/types/classroom";

interface DraftAction {
  type: "deposit" | "deduct";
  target: "all" | "selected" | "treasury" | "specific";
  specificTargets: string[];
  amount: number;
  desc: string;
  applyTax: boolean;
}

const EMPTY_ACTION: DraftAction = {
  type: "deposit",
  target: "all",
  specificTargets: [],
  amount: 0,
  desc: "",
  applyTax: true,
};

interface CreateBundleModalProps {
  isOpen: boolean;
  students: ClassroomStudent[];
  currencyName: string;
  onClose: () => void;
  onSave: (bundle: CustomBundle) => void;
  initialBundle?: CustomBundle | null;
}

export default function CreateBundleModal({
  isOpen,
  students,
  currencyName,
  onClose,
  onSave,
  initialBundle,
}: CreateBundleModalProps) {
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([{ ...EMPTY_ACTION }]);

  const reset = () => {
    setDraftName("");
    setDraftDesc("");
    setDraftActions([{ ...EMPTY_ACTION }]);
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
                return {
                  type: a.type,
                  target,
                  specificTargets: a.specificTargets ? [...a.specificTargets] : [],
                  amount: a.amount,
                  desc: a.desc || "",
                  applyTax: !!a.applyTax,
                };
              })
            : [{ ...EMPTY_ACTION }]
        );
      } else {
        reset();
      }
    }
  }, [isOpen, initialBundle]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const addAction = () => setDraftActions((p) => [...p, { ...EMPTY_ACTION }]);
  const removeAction = (idx: number) => setDraftActions((p) => p.filter((_, i) => i !== idx));

  const updateAction = (idx: number, patch: Partial<DraftAction>) => {
    setDraftActions((p) =>
      p.map((a, i) => {
        if (i !== idx) return a;
        const updated = { ...a, ...patch };
        // 세금 적용은 입금(deposit)이면서 국고가 아닐 때만 가능
        if (updated.type === "deduct" || updated.target === "treasury") {
          updated.applyTax = false;
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
      .filter((a) => a.amount > 0)
      .map((a) => ({
        type: a.type,
        target: a.target,
        specificTargets: a.target === "specific" ? a.specificTargets : undefined,
        amount: a.amount,
        desc: a.desc.trim() || draftName.trim(),
        applyTax: a.type === "deposit" && a.target !== "treasury" ? a.applyTax : false,
      }));

    if (actions.length === 0) {
      alert("유효한 액션(금액 > 0)이 없습니다.");
      return;
    }

    onSave({
      id: initialBundle ? initialBundle.id : `bundle-${Date.now()}`,
      name: draftName.trim(),
      desc: draftDesc.trim(),
      actions,
    });
    reset();
    onClose();
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
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-base"
          >
            ✕
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
                const canApplyTax = action.type === "deposit" && action.target !== "treasury";
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
                        <option value="treasury">🏛️ 학급 국고</option>
                      </select>

                      {/* 구분 (입금/차감) */}
                      <select
                        value={action.type}
                        onChange={(e) =>
                          updateAction(idx, { type: e.target.value as "deposit" | "deduct" })
                        }
                        className="px-2 py-1 rounded-md border border-slate-200 bg-white font-semibold focus:outline-none text-[11px]"
                      >
                        <option value="deposit">입금</option>
                        <option value="deduct">차감</option>
                      </select>

                      {/* 금액 */}
                      <input
                        type="number"
                        min={0}
                        placeholder="금액"
                        value={action.amount}
                        onChange={(e) => updateAction(idx, { amount: Number(e.target.value) })}
                        className="w-20 px-2 py-1 rounded-md border border-slate-200 bg-white font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]"
                      />
                      <span className="text-[11px] text-slate-400 shrink-0">{currencyName}</span>

                      {/* 세금 적용 (입금 시에만 활성화) */}
                      <label
                        className={`flex items-center gap-1 ml-auto text-[11px] select-none ${
                          canApplyTax ? "text-slate-600 cursor-pointer" : "text-slate-300 cursor-not-allowed"
                        }`}
                        title={canApplyTax ? "세금 징수/원천징수 적용" : "세금 적용은 학생 입금 시에만 가능합니다."}
                      >
                        <input
                          type="checkbox"
                          disabled={!canApplyTax}
                          checked={action.applyTax}
                          onChange={(e) => updateAction(idx, { applyTax: e.target.checked })}
                          className="rounded text-indigo-600 w-3 h-3 disabled:opacity-30"
                        />
                        <span>세금 적용</span>
                      </label>

                      {draftActions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(idx)}
                          className="text-slate-300 hover:text-rose-500 font-bold text-sm ml-1 transition-colors"
                        >
                          ✕
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
                                key={s.no}
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
                      placeholder="거래 설명 (원장 기록용)"
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
