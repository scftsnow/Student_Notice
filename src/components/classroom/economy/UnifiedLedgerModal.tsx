"use client";

import { useState } from "react";
import { ClassroomStudent, LedgerRecord } from "@/types/classroom";

interface UnifiedLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  treasuryBalance: number;
  ledgerHistory: LedgerRecord[];
  initialStudentFilter?: string;
  currencyName?: string;
}

export default function UnifiedLedgerModal({
  isOpen,
  onClose,
  students,
  treasuryBalance,
  ledgerHistory,
  initialStudentFilter = "all",
  currencyName = "원",
}: UnifiedLedgerModalProps) {
  const [studentFilter, setStudentFilter] = useState(initialStudentFilter);
  const [periodPreset, setPeriodPreset] = useState<"all" | "today" | "7d" | "30d" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  if (!isOpen) return null;

  // Filter records
  const filteredRecords = ledgerHistory.filter((item) => {
    // Student filter
    if (studentFilter !== "all") {
      if (!item.targets.includes(studentFilter)) return false;
    }

    // Period filter
    if (periodPreset === "today") {
      const today = new Date().toISOString().split("T")[0];
      if (!item.date.startsWith(today)) return false;
    } else if (periodPreset === "7d") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (new Date(item.date) < sevenDaysAgo) return false;
    } else if (periodPreset === "30d") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(item.date) < thirtyDaysAgo) return false;
    } else if (periodPreset === "custom") {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(item.date) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.date) > end) return false;
      }
    }
    return true;
  });

  // Aggregates
  const totalDeposit = filteredRecords.reduce((acc, cur) => (cur.amount > 0 ? acc + cur.amount : acc), 0);
  const totalWithdraw = filteredRecords.reduce((acc, cur) => (cur.amount < 0 ? acc + Math.abs(cur.amount) : acc), 0);
  const totalTax = filteredRecords.reduce((acc, cur) => acc + (cur.tax || 0), 0);
  const netAmount = totalDeposit - totalWithdraw;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h2 className="font-extrabold text-slate-800 text-base">학급 통합 출입금 원장</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">
            ✕
          </button>
        </div>

        {/* 필터 영역 */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">대상:</span>
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="px-2 py-1 rounded border border-slate-200 bg-white font-semibold focus:outline-none"
            >
              <option value="all">🌟 전체 학생 및 국고 통합</option>
              <option value="treasury">🏛️ 학급 국고 (잔고: {treasuryBalance.toLocaleString()} {currencyName})</option>
              {students.map((s) => (
                <option key={s.name} value={s.name}>
                  👤 {s.name} ({s.balance.toLocaleString()} {currencyName})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 달력 직접 선택 */}
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-400">📅</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none"
                title="조회 시작일"
              />
              <span className="text-slate-300 text-xs">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none"
                title="조회 종료일"
              />
            </div>

            {/* 프리셋 버튼 */}
            <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg font-bold">
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className={`px-2 py-1 rounded text-[11px] transition-all ${
                  periodPreset === "all" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset("today");
                  const today = new Date().toISOString().split("T")[0];
                  setStartDate(today);
                  setEndDate(today);
                }}
                className={`px-2 py-1 rounded text-[11px] transition-all ${
                  periodPreset === "today" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                }`}
              >
                오늘
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset("7d");
                  const end = new Date().toISOString().split("T")[0];
                  const start = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
                  setStartDate(start);
                  setEndDate(end);
                }}
                className={`px-2 py-1 rounded text-[11px] transition-all ${
                  periodPreset === "7d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                }`}
              >
                7일
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset("30d");
                  const end = new Date().toISOString().split("T")[0];
                  const start = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
                  setStartDate(start);
                  setEndDate(end);
                }}
                className={`px-2 py-1 rounded text-[11px] transition-all ${
                  periodPreset === "30d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                }`}
              >
                30일
              </button>
            </div>
          </div>
        </div>

        {/* 4대 집계 카드 */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-400 block font-semibold">순 변동액</span>
            <span className={`font-mono font-extrabold text-sm ${netAmount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {netAmount >= 0 ? `+${netAmount.toLocaleString()}` : netAmount.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <span className="text-[11px] text-emerald-700 block font-semibold">총 입금액</span>
            <span className="font-mono font-extrabold text-sm text-emerald-800">+{totalDeposit.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/80">
            <span className="text-[11px] text-rose-700 block font-semibold">총 출금/차감</span>
            <span className="font-mono font-extrabold text-sm text-rose-800">-{totalWithdraw.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
            <span className="text-[11px] text-indigo-700 block font-semibold">총 세금/벌금</span>
            <span className="font-mono font-extrabold text-sm text-indigo-800">{totalTax.toLocaleString()}</span>
          </div>
        </div>

        {/* 원장 테이블 */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
          <div className="sticky top-0 bg-slate-100 p-2 font-bold text-slate-600 grid grid-cols-6 text-center">
            <span>시각</span>
            <span>유형</span>
            <span>대상</span>
            <span className="col-span-2 text-left">내용</span>
            <span className="text-right">금액</span>
          </div>
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400">조건에 일치하는 출입금 내역이 없습니다.</div>
          ) : (
            filteredRecords.map((item) => (
              <div key={item.id} className="p-2 grid grid-cols-6 items-center text-center hover:bg-slate-50">
                <span className="font-mono text-slate-400 text-[11px] truncate">{item.date.split(" ")[1] || item.date}</span>
                <span>
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                    item.type === "거래" ? "bg-blue-100 text-blue-800" : item.type === "입금" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {item.type}
                  </span>
                </span>
                <span className="font-bold text-slate-700 truncate">{item.targetDisplay}</span>
                <span className="col-span-2 text-left text-slate-600 truncate">{item.desc}</span>
                <span className={`text-right font-mono font-bold ${item.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {item.amount >= 0 ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
