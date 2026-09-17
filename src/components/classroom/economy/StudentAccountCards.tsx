"use client";

import { User } from "lucide-react";
import { ClassroomStudent } from "@/types/classroom";

interface StudentAccountCardsProps {
  students: ClassroomStudent[];
  checkedNames: string[];
  currencyName?: string;
  onToggleCheck: (name: string) => void;
  /** 전달 시 카드에 [내역] 버튼 표시 (학급 화폐 메뉴용) */
  onShowLedger?: (name: string) => void;
}

/**
 * 학생 계좌 카드 그리드 (학급 화폐 메뉴 · 현황판 관리 패널 공용).
 * 카드 클릭 선택, 체크박스, 잔액 표시.
 */
export default function StudentAccountCards({
  students,
  checkedNames,
  currencyName = "원",
  onToggleCheck,
  onShowLedger,
}: StudentAccountCardsProps) {
  if (students.length === 0) {
    return (
      <div className="py-8 flex items-center justify-center text-slate-400 font-bold text-sm">
        등록된 학생 계좌가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-1.5">
      {students.map((s) => {
        const isChecked = checkedNames.includes(s.name);
        return (
          <div
            key={s.name}
            onClick={() => onToggleCheck(s.name)}
            className={`p-1.5 rounded-lg border cursor-pointer transition-all select-none ${
              isChecked
                ? "border-indigo-400 bg-indigo-50/80 ring-1 ring-indigo-400"
                : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 min-w-0">
                <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="font-extrabold text-slate-800 text-[14px] truncate">{s.name}</span>
              </div>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleCheck(s.name)}
                onClick={(e) => e.stopPropagation()}
                className="rounded text-indigo-600 cursor-pointer w-3.5 h-3.5 shrink-0"
              />
            </div>
            <div className="mt-1 pt-0.5 border-t border-slate-100 flex items-center justify-between gap-1">
              <div className="font-black text-[14px] font-mono text-indigo-700 leading-none truncate">
                {s.balance.toLocaleString()}
                <span className="text-[11px] font-normal text-slate-400 ml-0.5">{currencyName}</span>
              </div>
              {onShowLedger && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowLedger(s.name);
                  }}
                  className="px-1.5 py-0.5 rounded text-[11px] font-bold border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-indigo-600 transition-all shrink-0 leading-tight"
                >
                  내역
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
