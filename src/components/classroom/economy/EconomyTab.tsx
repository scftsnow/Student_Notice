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
    taxConfig.salaryPayoutMode === "AUTO_ON_CONFIRM" ? "즉시 자동 입금" : "담임 일괄 승인제";
  const taxMethodLabel =
    taxConfig.taxMethod === "TAX_FREE"
      ? "면세 (0%)"
      : taxConfig.taxMethod === "ADDITION"
      ? "추가 부과"
      : "원천징수 (자동 공제)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start text-sm">
      {/* 좌측: 기능 영역 (국고, 정책, 재정 액션) */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-3">
        {/* 1. 국고 및 세수 현황 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <span className="text-xs text-slate-500 font-bold block">🏛️ 학급 국고 및 총 세수</span>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="font-extrabold text-2xl font-mono text-slate-800">
              {treasuryBalance.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">{currencyName}</span>
            </div>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              +{totalTaxCollected.toLocaleString()} 세수
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDirectTaxOpen(true)}
            className="w-full py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <span>🏛️</span>
            <span>국고 세금 직접 입·출금</span>
          </button>
        </div>

        {/* 2. 화폐 및 세무 정책 패널 */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
              <span>⚙️</span>
              <span>화폐 및 세무 정책</span>
            </span>
            <button
              type="button"
              onClick={() => setIsTaxSettingsOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-all"
            >
              정책 변경
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">화폐 단위</span>
              <span className="font-black text-indigo-700">{currencyName}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">급여 승인</span>
              <span className="font-bold text-slate-800">{payoutModeLabel}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">세금 부과</span>
              <span className="font-bold text-slate-800">{taxMethodLabel}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">소득세율</span>
              <span className="font-bold text-slate-800">
                {taxConfig.incomeTaxValue}
                {taxConfig.incomeTaxType === "rate" ? "%" : ` ${currencyName}`}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">거래세율</span>
              <span className="font-bold text-slate-800">
                {taxConfig.txTaxValue}
                {taxConfig.txTaxType === "rate" ? "%" : ` ${currencyName}`}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80">
              <span className="text-slate-400 block text-[11px] font-semibold">반올림 단위</span>
              <span className="font-bold text-slate-800">{taxConfig.taxRoundingUnit || 1}단위</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80 col-span-2">
              <span className="text-slate-400 block text-[11px] font-semibold">벌금 차감액 처리</span>
              <span className="font-bold text-slate-800">
                {taxConfig.penaltyDisposition === "void" ? "화폐 소멸 (국고 미귀속)" : "국고 세수로 귀속"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. 재정 운영 실행 액션 바 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
          <span className="text-xs text-slate-500 font-bold block">💼 재정 송금 및 입금 실행</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsTransactionOpen(true)}
              className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all"
            >
              <span>🔄</span>
              <span>학생 간 거래</span>
            </button>
            <button
              type="button"
              onClick={handleDepositSelected}
              disabled={checkedNames.length === 0}
              className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>💰</span>
              <span>선택 입금 ({checkedNames.length})</span>
            </button>
          </div>
        </div>

        {/* 4. 복합 정산 항목 */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-xs">📦 복합 정산</span>
            <button
              type="button"
              onClick={() => setIsAddBundleOpen((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 font-bold text-xs border border-slate-200 transition-all"
            >
              {isAddBundleOpen ? "닫기" : "+ 추가"}
            </button>
          </div>

          {isAddBundleOpen && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
              <input
                type="text"
                placeholder="항목 이름 (필수)"
                value={newBundleName}
                onChange={(e) => setNewBundleName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="text"
                placeholder="설명 (선택)"
                value={newBundleDesc}
                onChange={(e) => setNewBundleDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={newBundleIsDeposit ? "deposit" : "withdraw"}
                  onChange={(e) => setNewBundleIsDeposit(e.target.value === "deposit")}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none"
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
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <span className="text-xs text-slate-500 shrink-0">{currencyName}</span>
              </div>
              <button
                type="button"
                onClick={handleAddBundle}
                disabled={!newBundleName.trim()}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                등록
              </button>
            </div>
          )}

          {customBundles.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">등록된 복합 정산 항목이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {customBundles.map((b) => (
                <div key={b.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                      <span>{b.icon}</span>
                      <span>{b.name}</span>
                    </div>
                    {b.desc && <p className="text-[11px] text-slate-500 line-clamp-1">{b.desc}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onExecuteBundle(b.id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
                  >
                    실행
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 우측: 학생 계좌 잔액 테이블 (자체 스크롤 컨테이너로 페이지 스크롤 제거) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-10.5rem)] min-h-[520px]">
        {/* 테이블 상단 헤더 */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-sm">학생별 계좌 잔액</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
              총 {students.length}명
            </span>
            {checkedNames.length > 0 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                {checkedNames.length}명 선택됨
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLedgerModalStudent("all")}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all"
          >
            <span>전체 통합 원장 보기</span>
            <span>↗</span>
          </button>
        </div>

        {/* 스크롤 가능한 학생 리스트 */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
          <div
            className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-slate-600 font-bold p-2.5 text-xs grid items-center z-10 select-none"
            style={{ gridTemplateColumns: "48px 56px 1fr 140px 80px" }}
          >
            <div className="text-center">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={students.length > 0 && checkedNames.length === students.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded text-indigo-600 cursor-pointer w-4 h-4"
                  title="전체 선택"
                />
              </label>
            </div>
            <div className="text-center">번호</div>
            <div>이름</div>
            <div className="text-right">계좌 잔액</div>
            <div className="text-center">원장내역</div>
          </div>

          {students.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold text-sm">등록된 학생 계좌가 없습니다.</div>
          ) : (
            students.map((s) => {
              const isChecked = checkedNames.includes(s.name);
              return (
                <div
                  key={s.no}
                  className={`grid items-center hover:bg-slate-50/80 transition-colors p-2.5 text-sm ${
                    isChecked ? "bg-indigo-50/40" : ""
                  }`}
                  style={{ gridTemplateColumns: "48px 56px 1fr 140px 80px" }}
                >
                  <div className="text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(s.name)}
                      className="rounded text-indigo-600 cursor-pointer w-4 h-4"
                    />
                  </div>
                  <div className="text-center font-bold text-slate-400 text-xs font-mono">{s.no}</div>
                  <div className="font-bold text-slate-800">{s.name}</div>
                  <div className="text-right font-mono font-bold text-indigo-700 text-sm">
                    {s.balance.toLocaleString()} {currencyName}
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setLedgerModalStudent(s.name)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 font-bold text-xs shadow-2xs transition-all"
                    >
                      내역
                    </button>
                  </div>
                </div>
              );
            })
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
