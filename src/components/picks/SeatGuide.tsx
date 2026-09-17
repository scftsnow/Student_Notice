"use client";

import {
  ArrowRightLeft,
  MapPin,
  MousePointerClick,
  Move,
  Pin,
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
    icon: Move,
    iconClass: "bg-indigo-100 text-indigo-700",
    title: "끌어서 옮기기",
    desc: "카드를 빈 곳으로 옮기면 위치만 바뀝니다",
  },
  {
    icon: ArrowRightLeft,
    iconClass: "bg-emerald-100 text-emerald-700",
    title: "카드 위에 놓으면 자리 교환",
    desc: "학생 카드를 다른 카드 위에 놓으면 두 명이 자리를 바꿉니다",
  },
  {
    icon: MousePointerClick,
    iconClass: "bg-slate-200 text-slate-700",
    title: "클릭",
    desc: "학생 있음 → 비우기 · 빈자리 → 닫기 · 닫힘 → 열기",
  },
  {
    icon: UserRound,
    iconClass: "bg-rose-100 text-rose-600",
    title: "우클릭 · 더블클릭",
    desc: "성별 지정이 바뀝니다 (없음 → 남♂ → 여♀)",
  },
  {
    icon: Pin,
    iconClass: "bg-amber-100 text-amber-700",
    title: "명단에서 끌어다 놓기 · 탭",
    desc: "왼쪽 미배치 학생을 카드에 놓으면 그 자리에 고정됩니다",
  },
  {
    icon: MapPin,
    iconClass: "bg-violet-100 text-violet-700",
    title: "빈 곳에 놓기 · 탭",
    desc: "빈 곳을 찍으면 가장 가까운 빈자리가 그 위치로 와서 배치됩니다",
  },
];

/**
 * 자리 캔버스 조작 방법 안내.
 * 동작 6종을 아이콘 카드로 구분해 한눈에 보이게 한다.
 */
export default function SeatGuide({ placedCount }: { placedCount: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">자리 조작 방법</h3>
        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
          배치 {placedCount}명
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {GUIDE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
            >
              <span className={`p-1.5 rounded-lg shrink-0 ${item.iconClass}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800">{item.title}</span>
                <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                  {item.desc}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
