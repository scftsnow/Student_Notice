"use client";

import type { ReactNode } from "react";

/** 읽기 전용 미니 캔버스용 셀 스냅샷 (교실 캔버스 % 좌표) */
export interface SeatMiniCell {
  key: string;
  x: number;
  y: number;
  label: string;
  enabled: boolean;
  lockedGender: "남" | "여" | null;
}

interface SeatMiniCanvasProps {
  cells: SeatMiniCell[];
  /** 전광판(어두운 배경) 렌더 여부. false면 관리 화면(밝은 배경) 스타일. */
  dark?: boolean;
  /** 카드 폭 % — 기본은 인원수 기반 (≤12: 17, ≤20: 13.5, 초과: 11) */
  cardWidthPercent?: number;
  /** 외부 래퍼 클래스 (폭 제한 등) */
  className?: string;
  /** 카드에 추가할 애니메이션 클래스 (예: 전광판 pop 애니메이션) */
  cardExtraClass?: string;
  /** 상단(교탁/칠판 헤더) 아래 부가 노트 */
  note?: ReactNode;
}

/**
 * 자리 뽑기 결과·프리셋 공용 읽기 전용 미니 캔버스.
 * 전광판(뽑기 별도 창)과 관리 화면 프리셋 미리보기가 동일 좌표(% 중심 정렬)로 공유한다.
 */
export default function SeatMiniCanvas({
  cells,
  dark = false,
  cardWidthPercent,
  className,
  cardExtraClass = "",
  note,
}: SeatMiniCanvasProps) {
  const visible = cells.filter((c) => c.enabled);
  const cardWidth =
    cardWidthPercent ?? (visible.length <= 12 ? 17 : visible.length <= 20 ? 13.5 : 11);
  return (
    <div className={className}>
      <div className="flex items-stretch gap-2 mb-2">
        <div
          className={`w-14 shrink-0 rounded-lg border text-[11px] font-bold flex items-center justify-center ${
            dark
              ? "bg-amber-500/20 border-amber-400/30 text-amber-200"
              : "bg-amber-100 border-amber-200 text-amber-800"
          }`}
        >
          교탁
        </div>
        <div
          className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold tracking-[0.5em] ${
            dark ? "bg-emerald-800/80 text-emerald-50" : "bg-emerald-700 text-white"
          }`}
        >
          칠판
        </div>
      </div>
      {note}
      <div
        className={`relative w-full aspect-[4/3] rounded-2xl border overflow-hidden ${
          dark ? "border-white/15 bg-white/5" : "border-slate-200 bg-slate-50"
        }`}
      >
        {visible.map((c) => (
          <div
            key={c.key}
            className="absolute"
            style={{
              left: `${Math.min(100, Math.max(0, c.x))}%`,
              top: `${Math.min(100, Math.max(0, c.y))}%`,
              width: `${cardWidth}%`,
              transform: "translate(-50%, -50%)",
            }}
            title={c.label || "빈자리"}
          >
            <div
              className={`px-1 py-1 rounded-lg border text-center truncate ${
                c.label
                  ? dark
                    ? "bg-gradient-to-r from-indigo-900/80 to-violet-900/80 border-indigo-500/40 text-white font-bold shadow"
                    : "bg-white border-slate-300 text-slate-800 font-bold shadow-sm"
                  : dark
                    ? "bg-white/5 border-white/10 text-slate-500"
                    : "bg-slate-100 border-dashed border-slate-300 text-slate-400"
              } ${cardExtraClass}`}
            >
              <span className="text-[11px] sm:text-xs truncate block">{c.label || "·"}</span>
              {c.lockedGender && (
                <span
                  className={`text-[9px] font-bold ${
                    c.lockedGender === "남"
                      ? dark
                        ? "text-blue-300"
                        : "text-blue-500"
                      : dark
                        ? "text-rose-300"
                        : "text-rose-500"
                  }`}
                >
                  {c.lockedGender === "남" ? "♂" : "♀"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}