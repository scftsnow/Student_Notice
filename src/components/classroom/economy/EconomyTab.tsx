"use client";

import { useState } from "react";
import { ClassroomStudent, TaxConfig, CustomBundle, LedgerRecord } from "@/types/classroom";
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
  const [isAddBundleOpen, setIsAddBundleOpen] = useState(false);
  const [newBundleName, setNewBundleName] = useState("");
  const [newBundleDesc, setNewBundleDesc] = useState("");
  const [newBundleAmount, setNewBundleAmount] = useState(0);
  const [newBundleIsDeposit, setNewBundleIsDeposit] = useState(true);

  const toggleCheck = (name: string) => {
    setCheckedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleAll = (checked: boolean) => {
    setCheckedNames(checked ? students.map((s) => s.name) : []);
  };

  const handleDepositSelected = () => {
    if (checkedNames.length === 0) {
      alert("선택된 학생이 없습니다.");
      return;
    }
    setIsDepositOpen(true);
  };

  const handleAddBundle = () => {
    if (!newBundleName.trim()) return;
    onAddBundle({
      id: `bundle-${Date.now()}`,
      name: newBundleName.trim(),
      desc: newBundleDesc.trim(),
      icon: "📦",
      actions: [
        {
          type: newBundleIsDeposit ? "deposit" : "deduct",
          target: "all",
          amount: newBundleAmount,
          desc: newBundleDesc.trim() || newBundleName.trim(),
          applyTax: false,
        },
      ],
    });
    setNewBundleName("");
    setNewBundleDesc("");
    setNewBundleAmount(0);
    setIsAddBundleOpen(false);
  };

  const payoutModeLabel =
    taxConfig.salaryPayoutMode === "AUTO_ON_CONFIRM" ? "즉시 자동" : "담임 승인제";
  const taxMethodLabel =
    taxConfig.taxMethod === "TAX_FREE"
      ? "면세"
      : taxConfig.taxMethod === "ADDITION"
      ? "추가 부과"
      : "원천징수";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start text-sm">
      {/* 좌측: 기능 영역 */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-2">

        {/* 1. 국고 현황 */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-bold">🏛️ 국고</span>
            <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              +{totalTaxCollected.toLocaleString()} 세수
            </span>
          </div>
          <div className="font-extrabold text-xl font-mono text-slate-800 leading-none">
            {treasuryBalance.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">{currencyName}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsDirectTaxOpen(true)}
            className="w-full py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center justify-center gap-1 transition-all"
          >
            <span>🏛️</span>
            <span>국고 직접 입·출금</span>
          </button>
        </div>

        {/* 2. 화폐·세무 정책 */}
        <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 text-xs flex items-center gap-1">
              <span>⚙️</span>
              <span>화폐 및 세무 정책</span>
            </span>
            <button
              type="button"
              onClick={() => setIsTaxSettingsOpen(true)}
              className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all"
            >
              정책 변경
            </button>
          </div>
          {/* 인라인 정책 목록 — 흰 박스 제거로 공간 압축 */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-400 font-semibold">화폐 단위</dt>
              <dd className="font-black text-indigo-700">{currencyName}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">급여 승인</dt>
              <dd className="font-bold text-slate-700">{payoutModeLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">세금 부과</dt>
              <dd className="font-bold text-slate-700">{taxMethodLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">소득세율</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.incomeTaxValue}
                {taxConfig.incomeTaxType === "rate" ? "%" : ` ${currencyName}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">거래세율</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.txTaxValue}
                {taxConfig.txTaxType === "rate" ? "%" : ` ${currencyName}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-semibold">반올림</dt>
              <dd className="font-bold text-slate-700">{taxConfig.taxRoundingUnit || 1}단위</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400 font-semibold">벌금 처리</dt>
              <dd className="font-bold text-slate-700">
                {taxConfig.penaltyDisposition === "void" ? "소멸 (국고 미귀속)" : "국고 세수 귀속"}
              </dd>
            </div>
          </dl>
        </div>

        {/* 3. 재정 액션 */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] text-slate-400 font-bold block">💼 재정 실행</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsTransactionOpen(true)}
              className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all"
            >
              <span>🔄</span>
              <span>학생 간 거래</span>
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
        </div>

        {/* 4. 복합 정산 */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 text-xs">📦 복합 정산</span>
            <button
              type="button"
              onClick={() => setIsAddBundleOpen((v) => !v)}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 font-bold text-[11px] border border-slate-200 transition-all"
            >
              {isAddBundleOpen ? "닫기" : "+ 추가"}
            </button>
          </div>

          {isAddBundleOpen && (
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 space-y-1.5">
              <input
                type="text"
                placeholder="항목 이름 (필수)"
                value={newBundleName}
                onChange={(e) => setNewBundleName(e.target.value)}
                className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="text"
                placeholder="설명 (선택)"
                value={newBundleDesc}
                onChange={(e) => setNewBundleDesc(e.target.value)}
                className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div className="flex gap-1.5 items-center">
                <select
                  value={newBundleIsDeposit ? "deposit" : "withdraw"}
                  onChange={(e) => setNewBundleIsDeposit(e.target.value === "deposit")}
                  className="px-2 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold focus:outline-none"
                >
                  <option value="deposit">입금</option>
                  <option value="withdraw">차감</option>
                </select>
                <input
                  type="number"
                  min={0}
                  placeholder="금액"
                  value={newBundleAmount}
                  onChange={(e) => setNewBundleAmount(Number(e.target.value))}
                  className="flex-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-xs font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <span className="text-[11px] text-slate-400 shrink-0">{currencyName}</span>
              </div>
              <button
                type="button"
                onClick={handleAddBundle}
                disabled={!newBundleName.trim()}
                className="w-full py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                등록
              </button>
            </div>
          )}

          {customBundles.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-1">등록된 항목 없음</p>
          ) : (
            <div className="space-y-1">
              {customBundles.map((b) => (
                <div key={b.id} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1 truncate">
                      <span>{b.icon}</span>
                      <span className="truncate">{b.name}</span>
                    </div>
                    {b.desc && <p className="text-[10px] text-slate-400 truncate">{b.desc}</p>}
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

      {/* 우측: 학생 계좌 카드 그리드 */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-10.5rem)] min-h-[520px]">
        {/* 상단 헤더 */}
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
              <span>전체 원장</span>
              <span>↗</span>
            </button>
          </div>
        </div>

        {/* 카드 그리드 */}
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
                    {/* 체크박스 + 번호 */}
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
                    {/* 이름 */}
                    <div className="font-extrabold text-slate-800 text-sm mb-1.5 truncate">{s.name}</div>
                    {/* 잔액 */}
                    <div className="font-black text-indigo-700 font-mono text-base leading-none">
                      {s.balance.toLocaleString()}
                      <span className="text-[10px] font-normal text-slate-400 ml-1">{currencyName}</span>
                    </div>
                    {/* 내역 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLedgerModalStudent(s.name);
                      }}
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

      {/* 모달 렌더링 */}
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
