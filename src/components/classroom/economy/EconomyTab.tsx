"use client";

import { useState } from "react";
import { ClassroomStudent, TaxConfig, CustomBundle, BundleAction, LedgerRecord } from "@/types/classroom";
import TaxSettingsModal from "./TaxSettingsModal";
import DirectTaxModal from "./DirectTaxModal";
import TransactionModal from "./TransactionModal";
import DepositModal from "./DepositModal";
import UnifiedLedgerModal from "./UnifiedLedgerModal";

interface EconomyTabProps {
  students: ClassroomStudent[];
  treasuryBalance: number;
  totalTaxCollected: number;
  taxConfig: TaxConfig;
  customBundles: CustomBundle[];
  ledgerHistory: LedgerRecord[];
  currencyName?: string;
  onUpdateCurrencyName?: (name: string) => void;
  onExecuteTransaction: (from: string, to: string, amount: number, desc: string, applyTax: boolean) => void;
  onExecuteBatchDeposit: (targetNames: string[], amount: number, desc: string, applyTax: boolean) => void;
  onExecuteDirectTax: (mode: "deposit" | "withdraw", amount: number, desc: string, refundStudentName?: string) => void;
  onExecuteBundle: (bundleId: string) => void;
  onAddBundle: (bundle: CustomBundle) => void;
  onUpdateTaxConfig: (config: TaxConfig) => void;
}

interface DraftAction {
  type: "deposit" | "deduct";
  amount: number;
  desc: string;
  applyTax: boolean;
}

const EMPTY_DRAFT_ACTION: DraftAction = { type: "deposit", amount: 0, desc: "", applyTax: false };

export default function EconomyTab({
  students,
  treasuryBalance,
  totalTaxCollected,
  taxConfig,
  customBundles,
  ledgerHistory,
  currencyName = "원",
  onUpdateCurrencyName,
  onExecuteTransaction,
  onExecuteBatchDeposit,
  onExecuteDirectTax,
  onExecuteBundle,
  onAddBundle,
  onUpdateTaxConfig,
}: EconomyTabProps) {
  const [checkedNames, setCheckedNames] = useState<string[]>([]);
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);
  const [isDirectTaxOpen, setIsDirectTaxOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [ledgerModalStudent, setLedgerModalStudent] = useState<string | null>(null);

  // 복합정산 모달 state
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftIcon, setDraftIcon] = useState("📦");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([{ ...EMPTY_DRAFT_ACTION }]);

  const toggleCheck = (name: string) => {
    setCheckedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleAll = (checked: boolean) => {
    setCheckedNames(checked ? students.map((s) => s.name) : []);
  };

  const handleDepositSelected = () => {
    if (checkedNames.length === 0) { alert("선택된 학생이 없습니다."); return; }
    setIsDepositOpen(true);
  };

  const openBundleModal = () => {
    setDraftName("");
    setDraftDesc("");
    setDraftIcon("📦");
    setDraftActions([{ ...EMPTY_DRAFT_ACTION }]);
    setIsBundleModalOpen(true);
  };

  const addDraftAction = () => {
    setDraftActions((prev) => [...prev, { ...EMPTY_DRAFT_ACTION }]);
  };

  const removeDraftAction = (idx: number) => {
    setDraftActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDraftAction = (idx: number, patch: Partial<DraftAction>) => {
    setDraftActions((prev) => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  const handleSaveBundle = () => {
    if (!draftName.trim()) return;
    const actions: BundleAction[] = draftActions
      .filter((a) => a.amount > 0)
      .map((a) => ({
        type: a.type,
        target: "all",
        amount: a.amount,
        desc: a.desc.trim() || draftName.trim(),
        applyTax: a.applyTax,
      }));
    if (actions.length === 0) { alert("유효한 액션(금액 > 0)이 없습니다."); return; }
    onAddBundle({
      id: `bundle-${Date.now()}`,
      name: draftName.trim(),
      desc: draftDesc.trim(),
      icon: draftIcon,
      actions,
    });
    setIsBundleModalOpen(false);
  };

  const payoutLabel = taxConfig.salaryPayoutMode === "AUTO_ON_CONFIRM" ? "즉시 자동" : "담임 승인제";
  const taxMethodLabel =
    taxConfig.taxMethod === "TAX_FREE" ? "면세"
    : taxConfig.taxMethod === "ADDITION" ? "추가 부과"
    : "원천징수";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start text-sm">
      {/* ── 좌측: 기능 패널 ── */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-2">

        {/* 1. 국고 — 1줄 */}
        <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-bold shrink-0">🏛️ 국고</span>
          <span className="font-black text-base font-mono text-slate-800 flex-1 truncate">
            {treasuryBalance.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">{currencyName}</span>
          </span>
          <button
            type="button"
            onClick={() => setLedgerModalStudent("treasury")}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0 transition-colors"
          >
            이력
          </button>
          <span className="text-slate-200 text-xs">|</span>
          <button
            type="button"
            onClick={() => setIsDirectTaxOpen(true)}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 shrink-0 transition-colors"
          >
            입·출금
          </button>
        </div>

        {/* 2. 화폐·세무 정책 — 3열 */}
        <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 text-xs flex items-center gap-1">
              <span>⚙️</span><span>화폐 및 세무 정책</span>
            </span>
            <button
              type="button"
              onClick={() => setIsTaxSettingsOpen(true)}
              className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all"
            >
              정책 변경
            </button>
          </div>
          <dl className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-400 font-semibold">화폐</dt>
              <dd className="font-black text-indigo-700 truncate">{currencyName}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">급여</dt>
              <dd className="font-bold text-slate-700 truncate">{payoutLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">세금</dt>
              <dd className="font-bold text-slate-700 truncate">{taxMethodLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">소득세율</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.incomeTaxValue}{taxConfig.incomeTaxType === "rate" ? "%" : ` ${currencyName}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">거래세율</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.txTaxValue}{taxConfig.txTaxType === "rate" ? "%" : ` ${currencyName}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">반올림</dt>
              <dd className="font-bold text-slate-700">{taxConfig.taxRoundingUnit || 1}단위</dd>
            </div>
            <div className="col-span-3">
              <dt className="text-slate-400 font-semibold">벌금 처리</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.penaltyDisposition === "void" ? "소멸 (국고 미귀속)" : "국고 세수 귀속"}
              </dd>
            </div>
          </dl>
        </div>

        {/* 3. 재정 실행 — 타이틀 없이 버튼 2개 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsTransactionOpen(true)}
            className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all"
          >
            <span>🔄</span><span>학생 간 거래</span>
          </button>
          <button
            type="button"
            onClick={handleDepositSelected}
            disabled={checkedNames.length === 0}
            className="py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>💰</span>
            <span>선택 입금{checkedNames.length > 0 ? ` (${checkedNames.length})` : ""}</span>
          </button>
        </div>

        {/* 4. 복합 정산 */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 text-xs">📦 복합 정산</span>
            <button
              type="button"
              onClick={openBundleModal}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 font-bold text-[11px] border border-slate-200 transition-all"
            >
              + 항목 추가
            </button>
          </div>
          {customBundles.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-1">등록된 항목 없음</p>
          ) : (
            <div className="space-y-1">
              {customBundles.map((b) => (
                <div key={b.id} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <span className="text-sm shrink-0">{b.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 text-xs truncate">{b.name}</div>
                    {b.desc && <p className="text-[10px] text-slate-400 truncate">{b.desc}</p>}
                    <p className="text-[10px] text-indigo-500">{b.actions.length}개 액션</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onExecuteBundle(b.id)}
                    className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
                  >
                    실행
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 우측: 학생 계좌 카드 그리드 ── */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-10.5rem)] min-h-[520px]">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-sm">학생별 계좌</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              총 {students.length}명
            </span>
            {checkedNames.length > 0 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                {checkedNames.length}명 선택
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={students.length > 0 && checkedNames.length === students.length}
                onChange={(e) => toggleAll(e.target.checked)}
                className="rounded text-indigo-600 cursor-pointer w-3.5 h-3.5"
              />
              전체 선택
            </label>
            <button
              type="button"
              onClick={() => setLedgerModalStudent("all")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-all"
            >
              <span>전체 원장</span><span>↗</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-3">
          {students.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
              등록된 학생 계좌가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
              {students.map((s) => {
                const isChecked = checkedNames.includes(s.name);
                return (
                  <div
                    key={s.no}
                    onClick={() => toggleCheck(s.name)}
                    className={`relative p-3 rounded-xl border cursor-pointer transition-all select-none ${
                      isChecked
                        ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-300 font-mono">{String(s.no).padStart(2, "0")}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(s.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded text-indigo-600 cursor-pointer w-3.5 h-3.5"
                      />
                    </div>
                    <div className="font-extrabold text-slate-800 text-sm mb-1.5 truncate">{s.name}</div>
                    <div className="font-black text-indigo-700 font-mono text-base leading-none">
                      {s.balance.toLocaleString()}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">{currencyName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLedgerModalStudent(s.name); }}
                      className="mt-2 w-full py-1 rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-indigo-600 font-bold text-[11px] transition-all"
                    >
                      내역
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 복합정산 등록 모달 ── */}
      {isBundleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col max-h-[90vh] text-xs overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{draftIcon}</span>
                <span className="font-bold text-sm text-slate-800">복합 정산 항목 등록</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBundleModalOpen(false)}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-base"
              >✕</button>
            </div>

            {/* 모달 본문 */}
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* 기본 정보 */}
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">아이콘</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={draftIcon}
                    onChange={(e) => setDraftIcon(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 text-center text-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">항목 이름 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    placeholder="예: 급식 당번비, 모둠 활동비..."
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
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
                  <label className="font-bold text-slate-700">액션 정의 (전체 학생 대상)</label>
                  <button
                    type="button"
                    onClick={addDraftAction}
                    className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition-all"
                  >
                    + 행 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {draftActions.map((action, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={action.type}
                          onChange={(e) => updateDraftAction(idx, { type: e.target.value as "deposit" | "deduct" })}
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white font-semibold focus:outline-none text-[11px]"
                        >
                          <option value="deposit">입금</option>
                          <option value="deduct">차감</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          placeholder="금액"
                          value={action.amount}
                          onChange={(e) => updateDraftAction(idx, { amount: Number(e.target.value) })}
                          className="w-24 px-2 py-1 rounded-md border border-slate-200 bg-white font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]"
                        />
                        <span className="text-[11px] text-slate-400 shrink-0">{currencyName}</span>
                        <label className="flex items-center gap-1 ml-auto text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={action.applyTax}
                            onChange={(e) => updateDraftAction(idx, { applyTax: e.target.checked })}
                            className="rounded text-indigo-600 w-3 h-3"
                          />
                          세금 적용
                        </label>
                        {draftActions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDraftAction(idx)}
                            className="text-slate-300 hover:text-rose-500 font-bold text-sm ml-1 transition-colors"
                          >✕</button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="거래 설명 (원장 기록용)"
                        value={action.desc}
                        onChange={(e) => updateDraftAction(idx, { desc: e.target.value })}
                        className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 text-[11px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBundleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              >취소</button>
              <button
                type="button"
                onClick={handleSaveBundle}
                disabled={!draftName.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >복합 정산 등록</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달 렌더링 ── */}
      <TaxSettingsModal
        isOpen={isTaxSettingsOpen}
        onClose={() => setIsTaxSettingsOpen(false)}
        config={taxConfig}
        currencyName={currencyName}
        onSave={onUpdateTaxConfig}
        onUpdateCurrencyName={onUpdateCurrencyName}
      />
      <DirectTaxModal
        isOpen={isDirectTaxOpen}
        onClose={() => setIsDirectTaxOpen(false)}
        treasuryBalance={treasuryBalance}
        totalTaxCollected={totalTaxCollected}
        students={students}
        currencyName={currencyName}
        onExecute={onExecuteDirectTax}
      />
      <TransactionModal
        isOpen={isTransactionOpen}
        onClose={() => setIsTransactionOpen(false)}
        students={students}
        treasuryBalance={treasuryBalance}
        currencyName={currencyName}
        onExecute={onExecuteTransaction}
      />
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        students={students}
        initialSelectedNames={checkedNames}
        currencyName={currencyName}
        onExecute={onExecuteBatchDeposit}
      />
      <UnifiedLedgerModal
        isOpen={Boolean(ledgerModalStudent)}
        onClose={() => setLedgerModalStudent(null)}
        students={students}
        treasuryBalance={treasuryBalance}
        ledgerHistory={ledgerHistory}
        initialStudentFilter={ledgerModalStudent || "all"}
        currencyName={currencyName}
      />
    </div>
  );
}
