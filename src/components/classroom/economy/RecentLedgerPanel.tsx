"use client";

import { useState } from "react";
import { LedgerRecord } from "@/types/classroom";
import { RotateCcw, RotateCw, History, ChevronDown, ChevronUp } from "lucide-react";

interface RecentLedgerPanelProps {
  records: LedgerRecord[];
  undoneRecords?: LedgerRecord[];
  currencyName?: string;
  onUndo: (id?: number | string) => void;
  onRedo?: (id?: number | string) => void;
  /** 표시할 최대 건수 (기본 4) */
  maxRows?: number;
  /** 기본 펼침 여부 (기본 false) */
  defaultExpanded?: boolean;
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
  defaultExpanded = false,
}: RecentLedgerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const recent = records.slice(0, maxRows);
  const latest = recent[0];
  const hasRecords = recent.length > 0;
  const hasUndone = undoneRecords.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all text-xs">
      {/* 아코디언 헤더 바 (클릭 시 토글) */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 transition-colors select-none cursor-pointer"
      >
        {/* 좌측: 타이틀 및 최근 1건 요약 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <History className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="text-[11px] font-extrabold text-slate-800 tracking-tight shrink-0">
            최근 지급
          </span>

          {latest ? (
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className={`shrink-0 px-1 py-0.2 rounded text-[9px] font-bold border ${typeBadgeClass(latest.type)}`}>
                {typeLabel(latest.type, latest.amount)}
              </span>
              <span className="text-[10px] text-slate-600 truncate font-semibold">
                {latest.targetDisplay}
              </span>
              <span className={`text-[10px] font-black shrink-0 ${
                latest.type === "차감" ? "text-rose-600" : latest.type === "거래" ? "text-indigo-600" : "text-emerald-700"
              }`}>
                {amountText(latest.type, latest.amount, currencyName)}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 italic truncate">
              (지급 내역 없음)
            </span>
          )}

          <span className="text-slate-400 shrink-0 text-[10px] ml-auto mr-1">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* 우측 퀵 액션: 취소 & 다시실행 (클릭 시 아코디언 토글 전파 방지) */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onUndo()}
            disabled={!hasRecords}
            title={hasRecords ? `최근 지급건 취소: ${latest?.targetDisplay}` : "취소할 지급 내역 없음"}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
              hasRecords
                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 cursor-pointer active:scale-95"
                : "bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed"
            }`}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>취소</span>
          </button>

          {onRedo && (
            <button
              type="button"
              onClick={() => onRedo()}
              disabled={!hasUndone}
              title={hasUndone ? `최근 취소건 다시실행: ${undoneRecords[0]?.targetDisplay}` : "다시 실행할 내역 없음"}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                hasUndone
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer active:scale-95"
                  : "bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed"
              }`}
            >
              <RotateCw className="w-2.5 h-2.5" />
              <span>다시실행</span>
              {hasUndone && (
                <span className="text-[9px] bg-indigo-200 text-indigo-800 px-1 rounded-full font-black">
                  {undoneRecords.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 펼쳐진 상세 목록 (아코디언 본문) */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 divide-y divide-slate-100">
          {!hasRecords && !hasUndone ? (
            <div className="px-3 py-2 text-center text-[11px] text-slate-400 font-semibold">
              최근 지급된 내역이 없습니다.
            </div>
          ) : (
            <>
              {recent.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white transition-colors"
                >
                  <span className={`shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold border ${typeBadgeClass(rec.type)}`}>
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
                  <span className={`shrink-0 text-[11px] font-black tabular-nums ${
                    rec.type === "차감" ? "text-rose-600" : rec.type === "거래" ? "text-indigo-600" : "text-emerald-700"
                  }`}>
                    {amountText(rec.type, rec.amount, currencyName)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUndo(rec.id)}
                    title={`이 건 취소: ${rec.targetDisplay}`}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ))}

              {/* 취소된 목록 */}
              {hasUndone && onRedo && (
                <div className="bg-amber-50/50 p-1.5 border-t border-amber-200/60 space-y-1">
                  <div className="flex items-center justify-between px-1 text-[10px] font-bold text-amber-800">
                    <span>취소된 지급 내역 ({undoneRecords.length}건)</span>
                    <button
                      type="button"
                      onClick={() => onRedo()}
                      className="text-indigo-700 hover:underline cursor-pointer"
                    >
                      최근 건 다시실행
                    </button>
                  </div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
