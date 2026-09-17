"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FileSpreadsheet, Calendar, RotateCcw, RotateCw } from "lucide-react";
import { ClassroomStudent, LedgerRecord } from "@/types/classroom";
import { formatLedgerDateTime, normalizeLedgerRecords, filterLedgerByPeriod } from "@/lib/ledgerHelpers";

interface UnifiedLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  treasuryBalance: number;
  ledgerHistory: LedgerRecord[];
  undoneLedgerHistory?: LedgerRecord[];
  onUndo?: (id?: number | string) => void;
  onRedo?: (id?: number | string) => void;
  initialStudentFilter?: string;
  currencyName?: string;
}


export default function UnifiedLedgerModal({
  isOpen,
  onClose,
  students,
  treasuryBalance,
  ledgerHistory,
  undoneLedgerHistory = [],
  onUndo,
  onRedo,
  initialStudentFilter = "all",
  currencyName = "원",
}: UnifiedLedgerModalProps) {
  const [studentFilter, setStudentFilter] = useState(initialStudentFilter);
  const [periodPreset, setPeriodPreset] = useState<"all" | "today" | "7d" | "30d" | "custom">("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStudentFilter(initialStudentFilter);
      setPeriodPreset("today");
    }
  }, [isOpen, initialStudentFilter]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleUndo = (id?: number | string) => {
    if (onUndo) {
      onUndo(id);
    } else {
      try {
        const channel = new BroadcastChannel("classroom_os_sync");
        channel.postMessage({ action: "undo_ledger", id });
        channel.close();
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("classroom_undo_ledger", { detail: { id } }));
    }
  };

  const handleRedo = (id?: number | string) => {
    if (onRedo) {
      onRedo(id);
    } else {
      try {
        const channel = new BroadcastChannel("classroom_os_sync");
        channel.postMessage({ action: "redo_ledger", id });
        channel.close();
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("classroom_redo_ledger", { detail: { id } }));
    }
  };

  if (!isOpen || !mounted) return null;

  const isIndividualOrTreasury = studentFilter !== "all";
  const displayRecords = normalizeLedgerRecords(ledgerHistory, studentFilter, treasuryBalance, students, currencyName);
  const filteredRecords = filterLedgerByPeriod(displayRecords, periodPreset, startDate, endDate);

  // 집계 계산 (국고 관점일 때는 정확한 국고 입출금 반영)
  const totalDeposit = filteredRecords.reduce((acc, cur) => (cur.amount > 0 ? acc + cur.amount : acc), 0);
  const totalWithdraw = filteredRecords.reduce((acc, cur) => (cur.amount < 0 ? acc + Math.abs(cur.amount) : acc), 0);
  const totalTax = filteredRecords.reduce((acc, cur) => (cur.type === "세금" ? acc + cur.amount : acc), 0);
  const netAmount = totalDeposit - totalWithdraw;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm cursor-pointer"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] flex flex-col my-auto cursor-default" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="font-extrabold text-slate-800 text-base truncate">
              {studentFilter === "treasury"
                ? `학급 국고 입출금 이력 (잔고: ${treasuryBalance.toLocaleString()} ${currencyName})`
                : studentFilter !== "all"
                ? `${studentFilter} 학생 입출금 이력 (현재 잔액: ${(students.find((s) => s.name === studentFilter)?.balance ?? 0).toLocaleString()} ${currencyName})`
                : "학급 통합 입출금 내역"}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={() => handleUndo(filteredRecords[0]?.originalId || filteredRecords[0]?.id)}
              title={filteredRecords[0] ? `최근 건 취소 (${filteredRecords[0].targetDisplay})` : "취소할 내역 없음"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>최근 건 취소</span>
            </button>
            <button
              type="button"
              disabled={undoneLedgerHistory.length === 0}
              onClick={() => handleRedo()}
              title={undoneLedgerHistory.length > 0 ? `다시실행 (${undoneLedgerHistory[0]?.targetDisplay})` : "다시실행할 내역 없음"}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>다시실행{undoneLedgerHistory.length > 0 ? ` (${undoneLedgerHistory.length})` : ""}</span>
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 ml-1 flex items-center justify-center cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
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
              <option value="all">전체 학생 및 국고 통합</option>
              <option value="treasury">학급 국고 (잔고: {treasuryBalance.toLocaleString()} {currencyName})</option>
              {students.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.balance.toLocaleString()} {currencyName})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 달력 직접 선택 */}
            <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
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
                  periodPreset === "all" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
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
                  periodPreset === "today" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
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
                  periodPreset === "7d" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
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
                  periodPreset === "30d" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
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

        {/* 입출금 내역 테이블 */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
          <div className="sticky top-0 bg-slate-100 p-2 font-bold text-slate-600 grid grid-cols-12 text-center items-center">
            <span className="col-span-2">일시</span>
            <span className="col-span-1">유형</span>
            {isIndividualOrTreasury ? (
              <>
                <span className="col-span-4 text-left pl-1">내용</span>
                <span className="col-span-2 text-right">금액</span>
                <span className="col-span-2 text-right pr-2">잔액</span>
              </>
            ) : (
              <>
                <span className="col-span-2">대상</span>
                <span className="col-span-4 text-left">내용</span>
                <span className="col-span-2 text-right">금액</span>
              </>
            )}
            <span className="col-span-1 text-center">취소</span>
          </div>
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400">조건에 일치하는 출입금 내역이 없습니다.</div>
          ) : (
            filteredRecords.map((item) => (
              <div key={item.id} className="p-2 grid grid-cols-12 items-center text-center hover:bg-slate-50">
                <div className="col-span-2 flex flex-col items-center justify-center font-mono leading-tight py-0.5" title={item.date}>
                  <span className="text-[10px] text-slate-400">{formatLedgerDateTime(item.date).date}</span>
                  <span className="text-[11px] font-bold text-slate-700">{formatLedgerDateTime(item.date).time}</span>
                </div>
                <span className="col-span-1">
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                    item.type === "거래" ? "bg-blue-100 text-blue-800" : item.type === "입금" ? "bg-emerald-100 text-emerald-800" : item.type === "세금" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {item.type}
                  </span>
                </span>
                {isIndividualOrTreasury ? (
                  <>
                    <span className="col-span-4 text-left pl-1 text-slate-700 font-medium truncate" title={item.desc}>
                      {item.desc}
                    </span>
                    <span className={`col-span-2 text-right font-mono font-bold ${item.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {item.amount >= 0 ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString()}
                    </span>
                    <span className="col-span-2 text-right pr-2 font-mono font-extrabold text-slate-800" title={`거래 후 잔액: ${item.balanceAfter !== undefined ? item.balanceAfter.toLocaleString() : "-"} ${currencyName}`}>
                      {item.balanceAfter !== undefined ? `${item.balanceAfter.toLocaleString()} ${currencyName}` : "-"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="col-span-2 font-bold text-slate-700 truncate">{item.targetDisplay}</span>
                    <span className="col-span-4 text-left text-slate-600 truncate">{item.desc}</span>
                    <span className={`col-span-2 text-right font-mono font-bold ${item.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {item.amount >= 0 ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString()}
                    </span>
                  </>
                )}
                <span className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleUndo(item.originalId || item.id)}
                    title={`이 내역 취소: ${item.targetDisplay}`}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        {/* 취소된 내역 (다시실행 지원) */}
        {undoneLedgerHistory.length > 0 && (
          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between px-1 text-[11px] font-bold text-amber-900">
              <span>취소된 내역 ({undoneLedgerHistory.length}건)</span>
              <button
                type="button"
                onClick={() => handleRedo()}
                className="text-indigo-700 hover:underline font-bold cursor-pointer"
              >
                가장 최근 취소건 다시실행
              </button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {undoneLedgerHistory.map((rec) => (
                <div
                  key={`undone-${rec.id}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1 bg-white rounded-lg border border-amber-200 text-[11px]"
                >
                  <span className="line-through text-slate-400 truncate flex-1">
                    {rec.targetDisplay} · {rec.desc || rec.type} ({rec.amount >= 0 ? `+${rec.amount.toLocaleString()}` : rec.amount.toLocaleString()} {currencyName})
                  </span>
                  {rec.date && (
                    <span className="text-[9.5px] font-mono text-amber-800/70 shrink-0">
                      {rec.date.length >= 16 ? `${rec.date.slice(2, 10).replace(/-/g, ".")} ${rec.date.slice(11, 16)}` : rec.date}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRedo(rec.id)}
                    className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 cursor-pointer shrink-0"
                  >
                    다시실행
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
    </div>,
    document.body
  );
}
