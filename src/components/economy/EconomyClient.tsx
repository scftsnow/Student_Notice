"use client";

import { useState } from "react";
import {
  Coins,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Send,
  PlusCircle,
  FileText,
  Search,
} from "lucide-react";
import { makeTransfer, makeDeposit, approvePayments } from "@/app/actions";
import type {
  StudentAccount,
  Student,
  PendingPayment,
  LedgerEntryItem,
} from "@/types";

interface EconomyClientProps {
  currencyName: string;
  treasury: StudentAccount | null;
  students: Student[];
  pendingPayments: PendingPayment[];
  ledgerEntries: LedgerEntryItem[];
}

export default function EconomyClient({
  currencyName,
  treasury,
  students,
  pendingPayments,
  ledgerEntries,
}: EconomyClientProps) {
  // Transfer Form State
  const [fromAccountId, setFromAccountId] = useState(
    students[0]?.account?.id || ""
  );
  const [toAccountId, setToAccountId] = useState(
    students[1]?.account?.id || ""
  );
  const [transferAmount, setTransferAmount] = useState(100);
  const [transferMemo, setTransferMemo] = useState("");
  const [applyTax, setApplyTax] = useState(true);
  const [transferring, setTransferring] = useState(false);

  // Discretionary Issuance
  const [issuing, setIssuing] = useState(false);
  const [issueAmount, setIssueAmount] = useState(500);

  // Batch Approval
  const [approving, setApproving] = useState(false);

  // Ledger Filter
  const [searchTerm, setSearchTerm] = useState("");

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId) {
      alert("출금 계좌와 입금 계좌가 같을 수 없습니다.");
      return;
    }
    if (transferAmount <= 0) {
      alert("0보다 큰 금액을 입력하세요.");
      return;
    }

    setTransferring(true);
    try {
      await makeTransfer({
        fromAccountId,
        toAccountId,
        amount: Number(transferAmount),
        memo: transferMemo || "학생 간 거래",
        applyTax,
      });
      alert("거래가 완료되었습니다.");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "거래 실패";
      alert(msg);
    } finally {
      setTransferring(false);
    }
  };

  const handleIssueAll = async () => {
    if (!confirm(`전체 학생(${students.length}명)에게 각각 ${issueAmount} ${currencyName}을 지급하시겠습니까?`)) {
      return;
    }
    setIssuing(true);
    try {
      for (const s of students) {
        if (s.account) {
          await makeDeposit({
            accountId: s.account.id,
            amount: Number(issueAmount),
            memo: "담임 재량 학급비 지급",
            applyTax: false,
          });
        }
      }
      alert("전원 지급이 완료되었습니다.");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "지급 실패";
      alert(msg);
    } finally {
      setIssuing(false);
    }
  };

  const handleBatchApprove = async () => {
    if (pendingPayments.length === 0) return;
    setApproving(true);
    try {
      await approvePayments(pendingPayments.map((p) => p.id));
      alert("급여가 일괄 승인 및 지급되었습니다.");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "승인 중 오류 발생";
      alert(msg);
    } finally {
      setApproving(false);
    }
  };

  const filteredEntries = ledgerEntries.filter((e) => {
    const term = searchTerm.toLowerCase();
    const memo = (e.memo || "").toLowerCase();
    const acc = (e.account?.name || "").toLowerCase();
    return memo.includes(term) || acc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header & KPI */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            학급 화폐 관리
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            단순 기입장, 간편 송금 및 담임 재량 통화량 조절
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-900">
            <span className="opacity-75 block text-[10px]">학급 국고</span>
            <span className="font-mono text-base font-bold text-amber-700">
              {treasury?.balance?.toLocaleString() ?? 0} {currencyName}
            </span>
          </div>
        </div>
      </div>

      {/* Top 2 Action Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Batch Salary Approval Queue */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              급여 승인 대기
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {pendingPayments.length}건 대기
            </span>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              현재 승인 대기 중인 급여 건이 없습니다.
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {pendingPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-slate-800">{p.student?.name}</span>
                    <span className="text-[11px] text-slate-500 ml-1.5">{p.title}</span>
                  </div>
                  <div className="text-right font-mono font-bold text-indigo-600">
                    +{p.netAmount.toLocaleString()} {currencyName}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleBatchApprove}
            disabled={approving || pendingPayments.length === 0}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {approving ? "처리 중..." : "전체 일괄 승인 및 즉시 지급"}
          </button>
        </div>

        {/* Discretionary Issuance */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-500" />
              화폐 발행 (담임 재량)
            </span>
            <span className="text-xs text-slate-500">전원 일괄 지급</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              학급 활동 보상 또는 학급비 지원을 위해 재적 학생 전원에게 동일 금액을 발행합니다.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={issueAmount}
                onChange={(e) => setIssueAmount(Number(e.target.value))}
                className="w-32 p-2 rounded-xl border border-slate-200 text-xs font-mono font-bold"
              />
              <span className="text-xs text-slate-600 font-bold">{currencyName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleIssueAll}
            disabled={issuing}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
          >
            {issuing ? "발행 중..." : `전원 +${issueAmount} ${currencyName} 지급`}
          </button>
        </div>
      </div>

      {/* Transfer Tool */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
          <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
          간편 송금
        </h2>

        <form onSubmit={handleTransfer} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">출금 계좌</label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium"
            >
              {students.map((s) => (
                <option key={s.id} value={s.account?.id}>
                  {s.studentNumber}번 {s.name} ({s.account?.balance?.toLocaleString() ?? 0})
                </option>
              ))}
              {treasury && (
                <option value={treasury.id}>학급 국고 ({treasury.balance?.toLocaleString() ?? 0})</option>
              )}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">입금 계좌</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 bg-white font-medium"
            >
              {students.map((s) => (
                <option key={s.id} value={s.account?.id}>
                  {s.studentNumber}번 {s.name}
                </option>
              ))}
              {treasury && <option value={treasury.id}>학급 국고</option>}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">금액</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(Number(e.target.value))}
              className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">적요</label>
            <input
              type="text"
              placeholder="내용 입력"
              value={transferMemo}
              onChange={(e) => setTransferMemo(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200"
            />
          </div>

          <button
            type="submit"
            disabled={transferring}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-sm disabled:opacity-40"
          >
            {transferring ? "송금 중..." : "송금하기"}
          </button>
        </form>
      </div>

      {/* Simple Ledger History */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            단순 기입장 (입출금 내역)
          </span>

          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="적요 / 계좌 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-1.5 rounded-lg border border-slate-200 text-[11px]"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-2.5">일시</th>
                <th className="p-2.5">계좌</th>
                <th className="p-2.5">구분</th>
                <th className="p-2.5">적요</th>
                <th className="p-2.5 text-right">금액</th>
                <th className="p-2.5 text-right">잔액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-[11px] font-mono text-slate-500">
                      {new Date(entry.createdAt).toLocaleDateString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">{entry.account?.name}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.entryType === "CREDIT"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {entry.entryType === "CREDIT" ? "입금" : "출금"}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">{entry.memo || "-"}</td>
                    <td
                      className={`p-2.5 text-right font-mono font-bold ${
                        entry.entryType === "CREDIT" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {entry.entryType === "CREDIT" ? "+" : "-"}
                      {entry.amount.toLocaleString()} {currencyName}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-500">
                      {(entry.balanceAfter ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
