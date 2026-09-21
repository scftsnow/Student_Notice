"use client";

import {
  ArrowRightLeft,
  MousePointerClick,
  Move,
  UserRound,
} from "lucide-react";

interface SeatGuideItem {
  icon: typeof Move;
  iconClass: string;
  title: string;
  desc: string;
}

const GUIDE_ITEMS: SeatGuideItem[] = [
  {
    icon: MousePointerClick,
    iconClass: "bg-slate-200 text-slate-700",
    title: "클릭",
    desc: "비우기 · 열기/닫기",
  },
  {
    icon: Move,
    iconClass: "bg-indigo-100 text-indigo-700",
    title: "드래그",
    desc: "자유 이동 · 명단에서 카드에 놓으면 고정",
  },
  {
    icon: UserRound,
    iconClass: "bg-rose-100 text-rose-600",
    title: "우클릭",
    desc: "성별 지정 (없음 → 남 → 여)",
  },
  {
    icon: ArrowRightLeft,
    iconClass: "bg-emerald-100 text-emerald-700",
    title: "자리 교환",
    desc: "학생 카드를 다른 카드 위에 놓기",
  },
];

/**
 * 자리 캔버스 조작 방법 안내 (클릭·드래그·우클릭·자리교환).
 */
export default function SeatGuide({
  placedCount,
  hideCount = false,
}: {
  placedCount: number;
  /** true면 배치 인원 뱃지 숨김 (배치 숨김 표시와 함께 사용) */
  hideCount?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-800">자리 조작 방법</h3>
        {!hideCount && (
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
            배치 {placedCount}명
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
        {GUIDE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200"
            >
              <span className={`p-1 rounded-lg shrink-0 ${item.iconClass}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0 flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">{item.title}</span>
                <span className="text-[11px] text-slate-500 truncate">{item.desc}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
