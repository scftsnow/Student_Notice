"use client";

import { useState } from "react";
import { X, Landmark, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { ClassroomStudent } from "@/types/classroom";

interface DirectTaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  treasuryBalance: number;
  totalTaxCollected: number;
  students: ClassroomStudent[];
  currencyName?: string;
  onExecute: (mode: "deposit" | "withdraw", amount: number, desc: string, refundStudentName?: string) => void;
}

export default function DirectTaxModal({
  isOpen,
  onClose,
  treasuryBalance,
  totalTaxCollected,
  students,
  currencyName = "원",
  onExecute,
}: DirectTaxModalProps) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState(100);
  const [desc, setDesc] = useState("학급 바자회 수익금 세수 편입");
  const [targetType, setTargetType] = useState<"common" | "student">("common");
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.name || "");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (amount <= 0) {
      alert("올바른 금액을 입력하세요.");
      return;
    }
    const refundTarget = mode === "withdraw" && targetType === "student" ? selectedStudent : undefined;
    onExecute(mode, amount, desc.trim() || (mode === "deposit" ? "세금 직접 입금" : "세금 직접 출금"), refundTarget);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-slate-800 text-base">국고 세금 별도 직접 입금 / 출금</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 block text-xs font-semibold">현재 학급 국고 잔고</span>
            <span className="font-mono font-extrabold text-slate-800 text-base">{treasuryBalance.toLocaleString()} {currencyName}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-xs font-semibold">누적 징수 세수</span>
            <span className="font-mono font-extrabold text-emerald-600 text-base">+{totalTaxCollected.toLocaleString()} {currencyName}</span>
          </div>
        </div>

        {/* 탭: 입금 vs 출금 */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("deposit");
              setDesc("학급 바자회 수익금 세수 편입");
            }}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
              mode === "deposit" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> 세금 직접 입금 (세수 증액)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("withdraw");
              setDesc("학급 문구류 구입 세수 지출");
            }}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
              mode === "withdraw" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" /> 세금 출금 / 학생 환급
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">금액 ({currencyName})</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none"
            />
          </div>

          {mode === "withdraw" && (
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-slate-600">출금 / 환급 대상</label>
              <div className="flex items-center gap-2">
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as "common" | "student")}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                >
                  <option value="common">학급 공동 행사/물품 지출</option>
                  <option value="student">특정 학생에게 세금 환급</option>
                </select>
                {targetType === "student" && (
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    {students.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">사유 / 비고</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`px-5 py-1.5 rounded-lg text-white font-bold text-xs shadow-xs ${
              mode === "deposit" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {mode === "deposit" ? "세금 입금 완료" : "세금 출금 / 환급 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}
