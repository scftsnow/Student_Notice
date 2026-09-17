"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import DepositModal from "@/components/classroom/economy/DepositModal";
import QuickDepositBar from "@/components/classroom/economy/QuickDepositBar";
import StudentAccountCards from "@/components/classroom/economy/StudentAccountCards";
import BundleExecuteRow from "@/components/classroom/economy/BundleExecuteRow";

/**
 * 학급돈 현황판(학생 전광판) 하단 접이식 관리 패널 내용물.
 * 학급 화폐 메뉴(EconomyTab)와 동일한 UI/조작.
 * - 학생 카드 클릭 선택 + 전체선택 체크박스
 * - 입금 / 차감 (DepositModal 재사용)
 * - 복합정산 실행 (선택 학생 기준)
 */
export default function BoardManagePanel() {
  const state = useClassroomState();
  const [checkedNames, setCheckedNames] = useState<string[]>([]);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const students = state.students;
  const currencyName = state.currencyName || "원";
  const allChecked = students.length > 0 && checkedNames.length === students.length;

  const toggleCheck = (name: string) => {
    setCheckedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleAll = (checked: boolean) => {
    setCheckedNames(checked ? students.map((s) => s.name) : []);
  };

  return (
    <>
      <div className="p-4 space-y-4">
        {/* 선택 바 */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-slate-800 hover:text-indigo-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              className="rounded text-indigo-600 w-3.5 h-3.5 accent-indigo-600"
            />
            <span>전체 선택</span>
          </label>
          {checkedNames.length > 0 && (
            <button
              type="button"
              onClick={() => setCheckedNames([])}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              선택 해제
            </button>
          )}
          <span className="text-xs text-slate-500 font-semibold">
            선택 {checkedNames.length}명 (카드를 클릭해 선택)
          </span>
          {checkedNames.length > 0 && (
            <QuickDepositBar
              checkedNames={checkedNames}
              currencyName={currencyName}
              taxConfig={state.taxConfig}
              onExecuteBatchDeposit={state.executeBatchDeposit}
              onOpenDepositModal={() => setIsDepositOpen(true)}
              onClearSelection={() => setCheckedNames([])}
            />
          )}
        </div>

        {/* 학생 카드 그리드 (학급 화폐 메뉴와 동일 컴포넌트) */}
        <StudentAccountCards
          students={students}
          checkedNames={checkedNames}
          currencyName={currencyName}
          onToggleCheck={toggleCheck}
        />

        {/* 복합 정산 */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-800 text-sm">복합 정산</span>
            {checkedNames.length > 0 && (
              <span className="text-[11px] font-bold text-indigo-600">
                (선택 {checkedNames.length}명 기준)
              </span>
            )}
          </div>
          {state.customBundles.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">
              등록된 항목 없음 (학급 화폐 메뉴에서 추가)
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {state.customBundles.map((b) => (
                <BundleExecuteRow
                  key={b.id}
                  bundle={b}
                  currencyName={currencyName}
                  selectedNames={checkedNames}
                  onExecute={state.executeBundle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 입금/차감 모달 (화폐 메뉴와 동일) */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        students={students}
        initialSelectedNames={checkedNames}
        currencyName={currencyName}
        taxConfig={state.taxConfig}
        onExecute={state.executeBatchDeposit}
      />

      {/* 토스트 */}
      {state.toastMessage && (
        <div className="fixed bottom-5 right-5 z-[70] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold">
          {state.toastMessage}
        </div>
      )}
    </>
  );
}
