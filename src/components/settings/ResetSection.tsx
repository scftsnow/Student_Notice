"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { resetEconomy, resetStudents, resetRoutines } from "@/app/actions";

interface ResetTarget {
  key: "economy" | "students" | "routines";
  label: string;
  confirmWord: string;
  description: string;
  items: string[];
  action: () => Promise<{ success: boolean }>;
  color: "red" | "orange" | "purple";
}

const RESET_TARGETS: ResetTarget[] = [
  {
    key: "economy",
    label: "학급화폐",
    confirmWord: "학급화폐",
    description: "모든 거래 내역과 계좌 잔액을 초기화합니다.",
    items: [
      "모든 학생 계좌 잔액 → 0",
      "전체 거래 내역 및 원장(Ledger) 삭제",
      "미결제(대기 중) 급여 승인 항목 삭제",
    ],
    action: resetEconomy,
    color: "red",
  },
  {
    key: "students",
    label: "학생 명단",
    confirmWord: "학생명단",
    description: "모든 학생 데이터를 삭제합니다. 연관된 계좌·거래·루틴 배정도 함께 삭제됩니다.",
    items: [
      "전체 학생 레코드 삭제",
      "학생 계좌 및 거래내역 삭제",
      "학생 업무 당번 배정 및 이력 삭제",
    ],
    action: resetStudents,
    color: "red",
  },
  {
    key: "routines",
    label: "학생 업무",
    confirmWord: "학생업무",
    description: "등록된 모든 학생 업무와 실행 이력을 삭제합니다.",
    items: [
      "전체 학생 업무 삭제",
      "업무 실행 이력(체크인 기록) 삭제",
      "업무 당번 배정 삭제",
    ],
    action: resetRoutines,
    color: "orange",
  },
];

const COLOR_MAP = {
  red: {
    bg: "bg-red-50 border-red-200",
    btn: "bg-red-600 hover:bg-red-700 text-white",
    icon: "text-red-600",
    heading: "text-red-800",
    dot: "bg-red-500",
  },
  orange: {
    bg: "bg-orange-50 border-orange-200",
    btn: "bg-orange-600 hover:bg-orange-700 text-white",
    icon: "text-orange-600",
    heading: "text-orange-800",
    dot: "bg-orange-500",
  },
  purple: {
    bg: "bg-purple-50 border-purple-200",
    btn: "bg-purple-600 hover:bg-purple-700 text-white",
    icon: "text-purple-600",
    heading: "text-purple-800",
    dot: "bg-purple-500",
  },
};

interface ResetModalProps {
  target: ResetTarget;
  onClose: () => void;
  onSuccess: (label: string) => void;
}

function ResetModal({ target, onClose, onSuccess }: ResetModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const c = COLOR_MAP[target.color];
  const isConfirmed = inputValue === target.confirmWord;

  const handleReset = () => {
    if (!isConfirmed) return;
    startTransition(async () => {
      try {
        await target.action();
        onSuccess(target.label);
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "초기화 중 오류가 발생했습니다.";
        alert(msg);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className={`p-5 border-b ${c.bg}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 ${c.icon} flex-shrink-0`} />
              <div>
                <h2 className={`font-black text-lg ${c.heading}`}>{target.label} 초기화</h2>
                <p className="text-sm text-slate-600 mt-0.5">{target.description}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">삭제되는 항목</p>
            <ul className="space-y-1">
              {target.items.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={`p-3 rounded-xl border ${c.bg} text-xs ${c.heading} font-semibold`}>
            ⚠️ 이 작업은 되돌릴 수 없습니다. 신중하게 진행해 주세요.
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 block mb-1.5">
              확인을 위해{" "}
              <span className={`font-black ${c.heading}`}>「{target.confirmWord}」</span>
              을(를) 입력하세요
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={target.confirmWord}
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>

        <div className="p-5 pt-0 flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isConfirmed || isPending}
            className={`px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all ${
              isConfirmed && !isPending ? c.btn : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {isPending ? "초기화 중..." : "초기화 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetSection() {
  const [activeTarget, setActiveTarget] = useState<ResetTarget | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSuccess = (label: string) => {
    setSuccessMsg(`${label} 초기화가 완료되었습니다.`);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  return (
    <>
      <div className="bg-white rounded-3xl p-6 border border-red-200/60 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-black text-red-700">데이터 초기화</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          선택한 항목의 모든 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>

        {successMsg && (
          <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700">
            ✅ {successMsg}
          </div>
        )}

        <div className="space-y-3">
          {RESET_TARGETS.map((t) => {
            const c = COLOR_MAP[t.color];
            return (
              <div key={t.key} className={`flex items-center justify-between p-4 rounded-2xl border ${c.bg}`}>
                <div>
                  <span className={`text-sm font-black ${c.heading}`}>{t.label} 초기화</span>
                  <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTarget(t)}
                  className={`ml-4 flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${c.btn}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  초기화
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {activeTarget && (
        <ResetModal
          target={activeTarget}
          onClose={() => setActiveTarget(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
