"use client";

import type { ReactNode } from "react";
import { seatMiniHeightPx } from "@/lib/seatFree";

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
  /** 카드 폭 % — 지정 없으면 열 수에서 역산 (겹침·잘림 방지) */
  cardWidthPercent?: number;
  /** 외부 래퍼 클래스 (폭 제한 등) */
  className?: string;
  /** 카드에 추가할 애니메이션 클래스 (예: 전광판 pop 애니메이션) */
  cardExtraClass?: string;
  /**
   * true면 카드 key에 표시 이름까지 포함해, 공개될 때마다 pop 애니메이션이
   * 다시 실행되도록 한다 (자리 결과 순차 공개용).
   */
  keyByLabel?: boolean;
  /** true면 전광판용 큰 글씨 (모둠 뽑기 결과 수준). 관리 화면 미리보기는 기본 크기. */
  large?: boolean;
  /** true면 성별 표시를 숨긴다 (뽑는 화면 창용). 관리 화면 미리보기는 그대로 표시. */
  hideGender?: boolean;
  /** 카드에 data-shuffle-key 를 붙인다 (좌석 이동 FLIP 애니메이션 추적용) */
  shuffleKeys?: boolean;
  /** 상단(교탁/칠판 헤더) 아래 부가 노트 */
  note?: ReactNode;
}

/**
 * 카드 너비(%). 같은 x 좌표(열)끼리 겹치지도 잘리지도 않도록 열 수에서 역산한다.
 * 열이 많을수록 좁아지되, 너무 작아 이름이 안 보이지 않게 하한을 둔다.
 */
function defaultCardWidthPercent(cells: SeatMiniCell[]): number {
  const cols = new Set(
    cells.filter((c) => c.enabled).map((c) => Math.round(c.x))
  ).size;
  if (cols <= 1) return 20;
  return Math.min(18, Math.max(9, 84 / cols));
}

/**
 * y좌표 분포에서 행 밴드 수 추정 (4% 이내 근접값은 같은 행).
 * 격자 배치는 격자 행 수와 일치하고, 드래그로 흩어진 배치도 높이에 반영한다.
 * 상한을 둬 흩어짐이 커도 미니가 무한정 커지지 않게 한다.
 */
function distinctYBands(cells: SeatMiniCell[]): number {
  const ys = cells
    .filter((c) => c.enabled)
    .map((c) => Math.min(100, Math.max(0, c.y)))
    .sort((a, b) => a - b);
  let bands = 0;
  let last = -Infinity;
  for (const y of ys) {
    if (y - last > 4) {
      bands++;
      last = y;
    }
  }
  return Math.min(Math.max(bands, 1), 12);
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
  keyByLabel = false,
  large = false,
  hideGender = false,
  shuffleKeys = false,
}: SeatMiniCanvasProps) {
  const visible = cells.filter((c) => c.enabled);
  const fitHeight = seatMiniHeightPx(distinctYBands(cells), large);
  const cardWidth = cardWidthPercent ?? defaultCardWidthPercent(cells);
  return (
    <div className={className}>
      <div className="flex items-stretch gap-2 mb-2">
        <div
          className={`flex-1 ${large ? "py-2.5" : "py-1.5"} rounded-lg text-center ${large ? "text-lg" : "text-xs"} font-bold tracking-[0.5em] ${
            dark ? "bg-emerald-800/80 text-emerald-50" : "bg-emerald-700 text-white"
          }`}
        >
          칠판
        </div>
      </div>
      {note}
      <div
        style={{ height: fitHeight }}
        className={`relative w-full rounded-2xl border overflow-hidden ${
          dark ? "border-white/15 bg-white/5" : "border-slate-200 bg-slate-50"
        }`}
      >
                {visible.map((c) => {
          const genderMark =
            !hideGender && c.lockedGender ? (c.lockedGender === "남" ? "♂" : "♀") : null;
          const genderColorCls = !c.lockedGender
            ? ""
            : c.lockedGender === "남"
              ? dark
                ? "text-blue-300"
                : "text-blue-500"
              : dark
                ? "text-rose-300"
                : "text-rose-500";
          // 카드 중심이 밖으로 나가지 않게 보정 (가장자리 잘림 방지).
          // x는 카드 너비 기준 정확히, y는 카드 반높이 추정치 기준.
          const cx = Math.min(100 - cardWidth / 2, Math.max(cardWidth / 2, c.x));
          const halfH = fitHeight > 0 ? (16 / fitHeight) * 100 : 8;
          const cy = Math.min(100 - halfH, Math.max(halfH, c.y));
          return (
          <div
            key={keyByLabel ? `${c.key}|${c.label}` : c.key}
            className="absolute"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: `${cardWidth}%`,
              transform: "translate(-50%, -50%)",
            }}
            data-shuffle-key={shuffleKeys ? c.key : undefined}
            title={c.label || "빈자리"}
          >
            <div
              className={`${large ? "px-2 py-2.5" : "px-1 py-1"} rounded-lg border text-center truncate ${
                c.label
                  ? dark
                    ? "bg-gradient-to-r from-indigo-900/80 to-violet-900/80 border-indigo-500/40 text-white font-bold shadow"
                    : "bg-white border-slate-300 text-slate-800 font-bold shadow-sm"
                  : dark
                    ? "bg-white/5 border-white/10 text-slate-500"
                    : "bg-slate-100 border-dashed border-slate-300 text-slate-400"
              } ${cardExtraClass}`}
            >
              <span className={`${large ? "text-4xl sm:text-5xl" : "text-[11px] sm:text-xs"} truncate block`}>
                {/* 성별 기호(♂/♀)를 먼저, 그 뒤에 이름을 한 줄에 나란히 보여준다.
                    빈자리는 점을 그리지 않는다. 성별 지정이 있으면 ♂/♀만 표시한다.
                    hideGender면 genderMark가 null이므로 기호가 아예 렌더되지 않는다. */}
                {genderMark && (
                  <span
                    className={`${large ? "text-lg" : "text-[11px]"} font-bold ${genderColorCls} mr-0.5`}
                  >
                    {genderMark}
                  </span>
                )}
                {c.label}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}