"use client";

import { useState } from "react";
import { CustomBundle, BundleAction } from "@/types/classroom";

interface DraftAction {
  type: "deposit" | "deduct";
  amount: number;
  desc: string;
  applyTax: boolean;
}

const EMPTY_ACTION: DraftAction = { type: "deposit", amount: 0, desc: "", applyTax: false };

interface CreateBundleModalProps {
  isOpen: boolean;
  currencyName: string;
  onClose: () => void;
  onSave: (bundle: CustomBundle) => void;
}

export default function CreateBundleModal({ isOpen, currencyName, onClose, onSave }: CreateBundleModalProps) {
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftIcon, setDraftIcon] = useState("📦");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([{ ...EMPTY_ACTION }]);

  const reset = () => {
    setDraftName(""); setDraftDesc(""); setDraftIcon("📦");
    setDraftActions([{ ...EMPTY_ACTION }]);
  };

  const handleClose = () => { reset(); onClose(); };

  const addAction = () => setDraftActions((p) => [...p, { ...EMPTY_ACTION }]);
  const removeAction = (idx: number) => setDraftActions((p) => p.filter((_, i) => i !== idx));
  const updateAction = (idx: number, patch: Partial<DraftAction>) =>
    setDraftActions((p) => p.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const handleSave = () => {
    if (!draftName.trim()) return;
    const actions: BundleAction[] = draftActions
      .filter((a) => a.amount > 0)
      .map((a) => ({ type: a.type, target: "all", amount: a.amount, desc: a.desc.trim() || draftName.trim(), applyTax: a.applyTax }));
    if (actions.length === 0) { alert("유효한 액션(금액 > 0)이 없습니다."); return; }
    onSave({ id: `bundle-${Date.now()}`, name: draftName.trim(), desc: draftDesc.trim(), icon: draftIcon, actions });
    reset(); onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] text-xs overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{draftIcon}</span>
            <span className="font-bold text-sm text-slate-800">복합 정산 항목 등록</span>
          </div>
          <button type="button" onClick={handleClose}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-base">
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-1">
              <label className="block font-bold text-slate-700 mb-1">아이콘</label>
              <input type="text" maxLength={2} value={draftIcon} onChange={(e) => setDraftIcon(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 text-center text-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
            <div className="col-span-4">
              <label className="block font-bold text-slate-700 mb-1">항목 이름 <span className="text-rose-500">*</span></label>
              <input type="text" placeholder="예: 급식 당번비, 모둠 활동비..." value={draftName} onChange={(e) => setDraftName(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">설명 (선택)</label>
            <input type="text" placeholder="이 정산 항목에 대한 설명..." value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>

          {/* 액션 목록 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">액션 정의 (전체 학생 대상)</label>
              <button type="button" onClick={addAction}
                className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-all">
                + 행 추가
              </button>
            </div>
            <div className="space-y-2">
              {draftActions.map((action, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <select value={action.type} onChange={(e) => updateAction(idx, { type: e.target.value as "deposit" | "deduct" })}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white font-semibold focus:outline-none text-[11px]">
                      <option value="deposit">입금</option>
                      <option value="deduct">차감</option>
                    </select>
                    <input type="number" min={0} placeholder="금액" value={action.amount}
                      onChange={(e) => updateAction(idx, { amount: Number(e.target.value) })}
                      className="w-24 px-2 py-1 rounded-md border border-slate-200 bg-white font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]" />
                    <span className="text-[11px] text-slate-400 shrink-0">{currencyName}</span>
                    <label className="flex items-center gap-1 ml-auto text-[11px] text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={action.applyTax} onChange={(e) => updateAction(idx, { applyTax: e.target.checked })}
                        className="rounded text-indigo-600 w-3 h-3" />
                      세금 적용
                    </label>
                    {draftActions.length > 1 && (
                      <button type="button" onClick={() => removeAction(idx)}
                        className="text-slate-300 hover:text-rose-500 font-bold text-sm ml-1 transition-colors">✕</button>
                    )}
                  </div>
                  <input type="text" placeholder="거래 설명 (원장 기록용)" value={action.desc}
                    onChange={(e) => updateAction(idx, { desc: e.target.value })}
                    className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={handleClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={!draftName.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            복합 정산 등록
          </button>
        </div>
      </div>
    </div>
  );
}
