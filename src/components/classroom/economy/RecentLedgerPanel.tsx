"use client";

import { useState } from "react";
import { LedgerRecord } from "@/types/classroom";
import { RotateCcw, RotateCw, History } from "lucide-react";

interface RecentLedgerPanelProps {
  records: LedgerRecord[];
  undoneRecords?: LedgerRecord[];
  currencyName?: string;
  onUndo: (id?: number | string) => void;
  onRedo?: (id?: number | string) => void;
  /** 표시할 최대 건수 (기본 4) */
  maxRows?: number;
}

function typeLabel(type: string, amount: number): string {
  if (type === "입금") return "입금";
  if (type === "차감") return "차감";
  if (type === "거래") return "거래";
  return amount >= 0 ? "입금" : "차감";
}

function typeBadgeClass(type: string): string {
  if (type === "입금") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (type === "차감") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function amountText(type: string, amount: number, currencyName: string): string {
  const abs = Math.abs(amount).toLocaleString();
  const sign = type === "차감" ? "-" : type === "거래" ? "↔" : "+";
  return `${sign}${abs} ${currencyName}`;
}

export default function RecentLedgerPanel({
  records,
  undoneRecords = [],
  currencyName = "원",
  onUndo,
  onRedo,
  maxRows = 4,
}: RecentLedgerPanelProps) {
  const [showUndone, setShowUndone] = useState(false);
  const recent = records.slice(0, maxRows);
  const hasRecords = recent.length > 0;
  const hasUndone = undoneRecords.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs">
      {/* 패널 상단 헤더 */}
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-200/90 bg-white select-none">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-extrabold text-slate-800 tracking-tight">
            최근 지급 내역
          </span>
          {hasRecords && (
            <span className="text-[10px] text-slate-400 font-semibold">
              ({recent.length}건)
            </span>
          )}
        </div>

        {/* 상단 퀵 액션 버튼: 최근 건 취소 & 다시실행 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUndo()}
            disabled={!hasRecords}
            title={hasRecords ? `최근 지급건 취소: ${recent[0].targetDisplay}` : "취소할 지급 내역 없음"}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              hasRecords
                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 cursor-pointer active:scale-95"
                : "bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>취소</span>
          </button>

          {onRedo && (
            <button
              type="button"
              onClick={() => onRedo()}
              disabled={!hasUndone}
              title={hasUndone ? `최근 취소건 다시실행: ${undoneRecords[0].targetDisplay}` : "다시 실행할 취소 내역 없음"}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                hasUndone
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer active:scale-95"
                  : "bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed"
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>다시실행</span>
              {hasUndone && (
                <span className="ml-0.5 text-[9px] bg-indigo-200 text-indigo-800 px-1 rounded-full font-black">
                  {undoneRecords.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 내역 본문 */}
      {!hasRecords && !hasUndone ? (
        <div className="px-3 py-2.5 text-center">
          <p className="text-[11px] text-slate-400 font-semibold">
            최근 지급된 내역이 없습니다.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {recent.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-white transition-colors text-xs"
            >
              <span
                className={`shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold border ${typeBadgeClass(rec.type)}`}
              >
                {typeLabel(rec.type, rec.amount)}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-800 truncate leading-tight">
                  {rec.targetDisplay}
                </p>
                {rec.desc && (
                  <p className="text-[10px] text-slate-400 truncate leading-tight">
                    {rec.desc}
                  </p>
                )}
              </div>

              <span
                className={`shrink-0 text-[11px] font-black tabular-nums ${
                  rec.type === "차감" ? "text-rose-600" : rec.type === "거래" ? "text-indigo-600" : "text-emerald-700"
                }`}
              >
                {amountText(rec.type, rec.amount, currencyName)}
              </span>

              <button
                type="button"
                onClick={() => onUndo(rec.id)}
                title={`이 건 취소: ${rec.targetDisplay}`}
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          ))}

          {/* 취소된 항목 토글 섹션 */}
          {hasUndone && onRedo && (
            <div className="bg-amber-50/40 p-1.5 border-t border-amber-200/60">
              <div className="flex items-center justify-between px-1.5">
                <button
                  type="button"
                  onClick={() => setShowUndone((prev) => !prev)}
                  className="text-[10px] font-bold text-amber-800 hover:text-amber-900 cursor-pointer flex items-center gap-1"
                >
                  <span>{showUndone ? "▼" : "▶"}</span>
                  <span>취소된 지급 {undoneRecords.length}건</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRedo()}
                  className="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer"
                >
                  최근 취소 다시실행
                </button>
              </div>

              {showUndone && (
                <div className="mt-1 space-y-1">
                  {undoneRecords.slice(0, 3).map((rec) => (
                    <div
                      key={`undone-${rec.id}`}
                      className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-amber-200 text-[10px]"
                    >
                      <span className="line-through text-slate-400 flex-1 truncate">
                        {rec.targetDisplay} ({amountText(rec.type, rec.amount, currencyName)})
                      </span>
                      <button
                        type="button"
                        onClick={() => onRedo(rec.id)}
                        className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 cursor-pointer shrink-0"
                      >
                        다시실행
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
