"use client";
import { useState, useRef, useEffect } from "react";
import { ClassroomStudent, ClassroomRoutine, TaxConfig, CustomBundle, LedgerRecord } from "@/types/classroom";
import TaxSettingsModal from "./TaxSettingsModal";
import DirectTaxModal from "./DirectTaxModal";
import TransactionModal from "./TransactionModal";
import DepositModal from "./DepositModal";
import UnifiedLedgerModal from "./UnifiedLedgerModal";
import CreateBundleModal from "./CreateBundleModal";
import QuickDepositBar from "./QuickDepositBar";
import { Pencil, Trash2, Landmark, Settings, ArrowRightLeft, Coins, Monitor, User, ArrowUpRight } from "lucide-react";
interface EconomyTabProps {
  students: ClassroomStudent[]; routines: ClassroomRoutine[];
  treasuryBalance: number; totalTaxCollected: number;
  taxConfig: TaxConfig; customBundles: CustomBundle[];
  ledgerHistory: LedgerRecord[]; undoneLedgerHistory?: LedgerRecord[];
  currencyName?: string; onUpdateCurrencyName?: (name: string) => void;
  onExecuteTransaction: (from: string, to: string, amount: number, desc: string, applyTax: boolean) => void;
  onExecuteBatchDeposit: (targetNames: string[], amount: number, desc: string, applyTax: boolean) => void;
  onExecuteDirectTax: (mode: "deposit" | "withdraw", amount: number, desc: string, refundStudentName?: string) => void;
  onExecuteBundle: (bundleId: string, selectedNames?: string[]) => void;
  onAddBundle: (bundle: CustomBundle) => void;
  onUpdateBundle?: (bundle: CustomBundle) => void;
  onDeleteBundle?: (bundleId: string) => void;
  onUpdateTaxConfig: (config: TaxConfig) => void;
  onUndoLedgerEntry?: (id?: number | string) => void;
  onRedoLedgerEntry?: (id?: number | string) => void;
}
export default function EconomyTab({
  students, routines, treasuryBalance, totalTaxCollected, taxConfig, customBundles,
  ledgerHistory, undoneLedgerHistory, currencyName = "원", onUpdateCurrencyName,
  onExecuteTransaction, onExecuteBatchDeposit, onExecuteDirectTax, onExecuteBundle,
  onAddBundle, onUpdateBundle, onDeleteBundle, onUpdateTaxConfig,
  onUndoLedgerEntry, onRedoLedgerEntry,
}: EconomyTabProps) {
  const [checkedNames, setCheckedNames] = useState<string[]>([]);
  const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);
  const [isDirectTaxOpen, setIsDirectTaxOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [ledgerModalStudent, setLedgerModalStudent] = useState<string | null>(null);
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<CustomBundle | null>(null);
  const [routineTaxChecked, setRoutineTaxChecked] = useState<Record<string, boolean>>({});
  const [bundleOrder, setBundleOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("classroom_bundle_order");
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const current = customBundles.map((b) => b.id);
        const filtered = parsed.filter((id) => current.includes(id));
        const added = current.filter((id) => !parsed.includes(id));
        return [...filtered, ...added];
      }
    } catch {
      // ignore
    }
    return customBundles.map((b) => b.id);
  });
  const dragIdRef = useRef<string | null>(null);
  useEffect(() => {
    setBundleOrder((prev) => {
      const existing = new Set(prev);
      const newIds = customBundles.map((b) => b.id);
      const filtered = prev.filter((id) => newIds.includes(id));
      const added = newIds.filter((id) => !existing.has(id));
      const next = [...filtered, ...added];
      try { localStorage.setItem("classroom_bundle_order", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [customBundles]);
  const handleOpenAddBundle = () => {
    setEditingBundle(null);
    setIsBundleModalOpen(true);
  };
  const handleEditBundle = (bundle: CustomBundle) => {
    setEditingBundle(bundle);
    setIsBundleModalOpen(true);
  };
  const handleDeleteBundle = (id: string, name: string) => {
    if (confirm(`복합 정산 항목 '${name}'을(를) 삭제하시겠습니까?`)) {
      onDeleteBundle?.(id);
    }
  };
  const handleSaveBundle = (bundle: CustomBundle) => {
    if (editingBundle && onUpdateBundle) {
      onUpdateBundle(bundle);
    } else {
      onAddBundle(bundle);
    }
  };
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
  const handleOpenEconomyBoard = () => {
    const width = 1280;
    const height = 720;
    const left = window.screen.width ? (window.screen.width - width) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - height) / 2 : 100;
    window.open(
      "/economy/board",
      "StudentEconomyBoardWindow",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
    );
  };
  const handleBundleDragStart = (id: string) => {
    dragIdRef.current = id;
  };
  const handleBundleDrop = (targetId: string) => {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    setBundleOrder((prev) => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(fromId);
      const toIdx = arr.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, fromId);
      try { localStorage.setItem("classroom_bundle_order", JSON.stringify(arr)); } catch { /* ignore */ }
      return arr;
    });
    dragIdRef.current = null;
  };
  const payoutLabel = taxConfig.salaryPayoutMode === "AUTO_ON_CONFIRM" ? "즉시 자동" : "담임 승인제";
  const taxMethodLabel =
    taxConfig.taxMethod === "TAX_FREE" ? "세금없음" : "원천징수";
  return (
    <>
      <div className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* ── 좌측: 기능 패널 ── */}
          <div className="lg:col-span-4 space-y-2">
        {/* 1. 국고 — 1줄 */}
        <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-bold shrink-0 flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> 국고</span>
          <span className="font-black text-base font-mono text-slate-800 flex-1 truncate">
            {treasuryBalance.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">{currencyName}</span>
          </span>
          <button
            type="button"
            onClick={() => setLedgerModalStudent("treasury")}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs transition-all shrink-0"
          >
            이력
          </button>
          <button
            type="button"
            onClick={() => setIsDirectTaxOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 shadow-2xs transition-all shrink-0"
          >
            입·출금
          </button>
        </div>
        {/* 2. 화폐·세무 정책 — 3열 */}
        <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 text-xs flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" /><span>화폐 및 세무 정책</span>
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
            {taxConfig.taxMethod !== "TAX_FREE" && (
              <>
                <div>
                  <dt className="text-slate-400 font-semibold">학급 세율</dt>
                  <dd className="font-bold text-slate-700">
                    {taxConfig.taxRate ?? taxConfig.incomeTaxValue ?? 10}%
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-semibold">반올림</dt>
                  <dd className="font-bold text-slate-700">
                    {(() => {
                      const u = taxConfig.taxRoundingUnit ?? 1;
                      if (u >= 1) return "정수 단위";
                      if (u >= 0.1) return "소수 첫째 자리";
                      if (u >= 0.01) return "소수 둘째 자리";
                      return "소수 셋째 자리";
                    })()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-semibold">벌금 처리</dt>
                  <dd className="font-bold text-slate-700 truncate">
                    {taxConfig.penaltyDisposition === "void" ? "소멸 (미귀속)" : "국고 귀속"}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
        {/* 3. 재정 실행 — 타이틀 없이 버튼 2개 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsTransactionOpen(true)}
            className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /><span>학생 간 거래</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDepositOpen(true)}
            className="py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>입금 / 차감{checkedNames.length > 0 ? ` (${checkedNames.length}명)` : ""}</span>
          </button>
        </div>
      </div>
      {/* ── 우측: 학생 계좌 카드 그리드 ── */}
      <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden h-[calc(100vh-16rem)] min-h-[360px]">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-slate-900 text-sm shrink-0">학생별 계좌</span>
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl shrink-0">
              <span className="text-xs font-black text-indigo-700">
                총 {students.length}명
              </span>
              <span className="text-indigo-200 text-xs select-none">|</span>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-800 hover:text-indigo-700 font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={students.length > 0 && checkedNames.length === students.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded text-indigo-600 cursor-pointer w-4 h-4 accent-indigo-600"
                />
                <span>전체 선택</span>
              </label>
            </div>
            {checkedNames.length > 0 && (
              <QuickDepositBar
                checkedNames={checkedNames}
                currencyName={currencyName}
                taxConfig={taxConfig}
                onExecuteBatchDeposit={onExecuteBatchDeposit}
                onOpenDepositModal={handleDepositSelected}
                onClearSelection={() => setCheckedNames([])}
              />
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenEconomyBoard}
              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1 transition-all shadow-2xs"
              title="교실 TV/빔프로젝터용 학생 전용 잔액 전광판 창 띄우기"
            >
              <span>학생 화면 띄우기</span>
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLedgerModalStudent("all")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-all"
            >
              <span>전체 내역</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-2.5">
          {students.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
              등록된 학생 계좌가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {students.map((s) => {
                const isChecked = checkedNames.includes(s.name);
                return (
                  <div
                    key={s.name}
                    onClick={() => toggleCheck(s.name)}
                    className={`relative p-2 rounded-lg border cursor-pointer transition-all select-none ${
                      isChecked
                        ? "border-indigo-400 bg-indigo-50/80 ring-1 ring-indigo-400"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                    }`}
                  >
                    {/* 상단: 이름 + 체크박스 */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="font-extrabold text-slate-800 text-xs truncate">
                          {s.name}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(s.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded text-indigo-600 cursor-pointer w-3.5 h-3.5 shrink-0"
                      />
                    </div>
                    {/* 하단: 잔액 + 내역 버튼 */}
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="font-black text-xs font-mono text-indigo-700 leading-none truncate">
                        {s.balance.toLocaleString()}
                        <span className="text-[9px] font-normal text-slate-400 ml-0.5">{currencyName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLedgerModalStudent(s.name);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-indigo-600 transition-all shrink-0 leading-tight"
                      >
                        내역
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>{/* 상단 행 닫기 */}
      {/* ── 하단: 복합 정산 전폭 패널 ── */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 text-xs">복합 정산</span>
          <button
            type="button"
            onClick={handleOpenAddBundle}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 font-bold text-[11px] border border-slate-200 transition-all"
          >
            + 항목 추가
          </button>
        </div>
        {customBundles.length === 0 && routines.filter((r) => r.pay > 0).length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-1">등록된 항목 없음</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {/* 루틴 자동 항목 (드래그 불가) */}
            {routines
              .filter((r) => r.pay > 0)
              .map((r) => {
                const workers =
                  r.order.length > 0
                    ? Array.from({ length: r.slots }, (_, i) =>
                        r.order[(r.currentIdx + i) % r.order.length]
                      )
                    : [];
                return (
                  <div key={r.id} className="px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 flex flex-col gap-1.5">
                    <div className="font-bold text-slate-800 text-xs truncate">{r.name}</div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {workers.length > 0 ? workers.join(", ") : "당번 없음"} · {r.pay.toLocaleString()} {currencyName}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-1 border-t border-amber-100">
                      {taxConfig.taxMethod !== "TAX_FREE" && (
                        <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={routineTaxChecked[r.id] !== undefined ? Boolean(routineTaxChecked[r.id]) : true}
                            onChange={(e) => setRoutineTaxChecked((p) => ({ ...p, [r.id]: e.target.checked }))}
                            className="rounded text-indigo-600 w-3 h-3"
                          />
                          <span>세금</span>
                        </label>
                      )}
                      <button
                        type="button"
                        disabled={workers.length === 0}
                        onClick={() => {
                          const isChecked = routineTaxChecked[r.id] !== undefined ? Boolean(routineTaxChecked[r.id]) : true;
                          onExecuteBatchDeposit(workers, r.pay, `[${r.name}] 업무 급여`, isChecked);
                        }}
                        className="ml-auto px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        지급
                      </button>
                    </div>
                  </div>
                );
              })}
            {/* 커스텀 번들 (드래그로 재정렬 가능) */}
            {bundleOrder
              .map((id) => customBundles.find((b) => b.id === id))
              .filter((b): b is CustomBundle => b !== undefined)
              .map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => handleBundleDragStart(b.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleBundleDrop(b.id)}
                  className="px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity"
                >
                  <div className="font-bold text-slate-800 text-xs truncate">{b.name}</div>
                  {b.desc && <p className="text-[10px] text-slate-400 truncate">{b.desc}</p>}
                  <div className="flex flex-wrap gap-1">
                    {b.actions.map((act, i) => {
                      const isTreasury = act.target === "treasury";
                      const targetLabel = isTreasury
                        ? "국고"
                        : act.target === "all"
                        ? "전체"
                        : act.target === "selected"
                        ? "선택"
                        : act.target === "unselected"
                        ? "미선택"
                        : `${act.specificTargets?.length || 0}명`;
                      const sign = act.type === "deposit" ? "+" : "-";
                      return (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-0.5 ${
                            isTreasury
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : act.type === "deposit"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          <span>{targetLabel}</span>
                          <span>{sign}{act.amount.toLocaleString()}{currencyName}</span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1 mt-auto pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleEditBundle(b)}
                      title="복합 정산 수정"
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-200/70 transition-colors"
                      aria-label="복합 정산 수정"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBundle(b.id, b.name)}
                      title="복합 정산 삭제"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      aria-label="복합 정산 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onExecuteBundle(b.id, checkedNames)}
                      className="ml-auto px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
                    >
                      실행
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>{/* flex flex-col 닫기 */}
      {/* ── 복합정산 등록/수정 모달 ── */}
      <CreateBundleModal
        isOpen={isBundleModalOpen}
        students={students}
        currencyName={currencyName}
        taxConfig={taxConfig}
        onClose={() => {
          setIsBundleModalOpen(false);
          setEditingBundle(null);
        }}
        onSave={handleSaveBundle}
        initialBundle={editingBundle}
      />
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
        taxConfig={taxConfig}
        onExecute={onExecuteTransaction}
      />
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        students={students}
        initialSelectedNames={checkedNames}
        currencyName={currencyName}
        taxConfig={taxConfig}
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
    </>
  );
}
