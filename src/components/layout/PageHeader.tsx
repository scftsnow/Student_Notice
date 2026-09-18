"use client";

import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
  /** 타이틀 우측 슬롯 (예: 뽑기 메뉴 탭, 학생 화면 열기 버튼) */
  actions?: ReactNode;
}

/**
 * 메뉴 페이지 공용 상단 헤더 (아이콘 + 제목 + 설명 + 우측 액션).
 * 메뉴별 타이틀 스타일 통일을 한 곳에서 관리한다.
 */
export default function PageHeader({ icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
          {icon}
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
