"use client";

import { useEffect, useState } from "react";

interface ClassroomHeaderProps {
  className: string;
  onClassNameChange: (name: string) => void;
  onOpenQuickView: () => void;
  onOpenBoardWindow: () => void;
}

export default function ClassroomHeader({
  className,
  onClassNameChange,
  onOpenQuickView,
  onOpenBoardWindow,
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
        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
          🌱
        </span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={className}
            onChange={(e) => onClassNameChange(e.target.value)}
            className="text-sm font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent px-1 py-0.5 rounded transition-all"
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
          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          title="학생별 계좌 잔액 및 오늘 재정 간편 조회"
        >
          <span>📊</span>
          <span>간편 재정 조회</span>
        </button>

        <button
          type="button"
          onClick={onOpenBoardWindow}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          title="전자칠판/프로젝터 송출 전용 화면을 별도 창으로 엽니다"
        >
          <span>↗</span>
          <span>학생 화면 별도 창 열기</span>
        </button>
      </div>
    </div>
  );
}
