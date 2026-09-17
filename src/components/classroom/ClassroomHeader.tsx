"use client";

import { useEffect, useState } from "react";
import { Plus, Monitor, BarChart3, GraduationCap } from "lucide-react";

interface ClassroomHeaderProps {
  className: string;
  onClassNameChange: (name: string) => void;
  onOpenQuickView: () => void;
  onOpenBoardWindow: () => void;
  onAddFreeCard: () => void;
}

export default function ClassroomHeader({
  className,
  onClassNameChange,
  onOpenQuickView,
  onOpenBoardWindow,
  onAddFreeCard,
}: ClassroomHeaderProps) {
  const [liveDateStr, setLiveDateStr] = useState("");

  useEffect(() => {
    const now = new Date();
    const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const dayName = days[now.getDay()];
    setLiveDateStr(`${m}월 ${d}일 ${dayName}`);
  }, []);

  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
          <GraduationCap className="w-4 h-4 text-white" />
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 px-1 py-0.5">
            Teacher Helper-학급 운영
          </span>
          <input
            type="text"
            value={className}
            onChange={(e) => onClassNameChange(e.target.value)}
            className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:border-indigo-300 focus:border-indigo-500 focus:outline-none px-2 py-0.5 rounded-md transition-all"
            title="클릭하여 학급 이름 수정"
            placeholder="학급 이름"
          />
          <span className="text-xs font-extrabold text-indigo-600 font-mono">
            {liveDateStr || "오늘 날짜"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenQuickView}
          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          title="학생별 계좌 잔액 및 오늘 재정 간편 조회"
        >
          <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
          <span>간편 재정 조회</span>
        </button>

        <button
          type="button"
          onClick={onAddFreeCard}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border border-indigo-200"
          title="자유 글상자를 칠판에 추가합니다"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>글상자 추가</span>
        </button>

        <button
          type="button"
          onClick={onOpenBoardWindow}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          title="전자칠판/프로젝터 송출 전용 화면을 별도 창으로 엽니다"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>학생 화면 열기</span>
        </button>
      </div>
    </div>
  );
}
