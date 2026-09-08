"use client";

import { useClassroomState } from "@/hooks/useClassroomState";
import EconomyTab from "@/components/classroom/economy/EconomyTab";

interface EconomyPageClientProps {
  initialCurrencyName?: string;
  initialClassName?: string;
}

export default function EconomyPageClient({
  initialCurrencyName,
  initialClassName,
}: EconomyPageClientProps) {
  const state = useClassroomState({
    initialCurrencyName,
    initialClassName,
  });

  if (!state.isMounted) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-sm animate-pulse">학급 화폐 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 학급 화폐 상단 헤더 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            💰
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">학급 화폐 및 재정 관리</h1>
            <p className="text-xs text-slate-500">
              국고 잔액, 학생별 계좌 거래, 세율 설정 및 복합 정산을 관리합니다.
            </p>
          </div>
        </div>
      </div>

      <EconomyTab
        students={state.students}
        routines={state.routines}
        treasuryBalance={state.treasuryBalance}
        totalTaxCollected={state.totalTaxCollected}
        taxConfig={state.taxConfig}
        currencyName={state.currencyName}
        onUpdateCurrencyName={state.setCurrencyName}
        customBundles={state.customBundles}
        ledgerHistory={state.ledgerHistory}
        onExecuteTransaction={state.executeTransaction}
        onExecuteBatchDeposit={state.executeBatchDeposit}
        onExecuteDirectTax={state.executeDirectTax}
        onExecuteBundle={state.executeBundle}
        onAddBundle={state.addCustomBundle}
        onUpdateBundle={state.updateCustomBundle}
        onDeleteBundle={state.deleteCustomBundle}
        onUpdateTaxConfig={state.updateTaxConfig}
      />
    </div>
  );
}
