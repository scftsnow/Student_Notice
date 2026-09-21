"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

interface PresetRowShellProps {
  presetId: string;
  presetName: string;
  /** true면 자동 보관 프리셋 (이름 변경 시 승격) */
  auto?: boolean;
  /** 통계 뱃지 텍스트 (예: "34명", "3모둠 · 12명", "28석 · 25명 배치") */
  statText: string;
  editing: boolean;
  editingName: string;
  onEditingNameChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  deleteConfirmMessage: string;
  /** 기본(비편집) 콘텐츠 */
  summary: ReactNode;
  /** 편집 중 콘텐츠 (없으면 summary 유지) */
  editContent?: ReactNode;
  /** 하단 슬롯 (예: 불러오기 버튼) */
  footer?: ReactNode;
}

/**
 * 순서/모둠/자리 프리셋 공용 행 껍데기.
 * 이름 표시·자동 뱃지·이름 변경(인라인 입력+저장/취소)·삭제·통계 뱃지를 한 곳에서 처리하고,
 * 내용물(summary/editContent)과 하단 액션(footer)은 호출자가 주입한다.
 */
export function PresetRowShell({
  presetId,
  presetName,
  auto = false,
  statText,
  editing,
  editingName,
  onEditingNameChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  deleteConfirmMessage,
  summary,
  editContent,
  footer,
}: PresetRowShellProps) {
  return (
    <div
      key={presetId}
      className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 transition-colors"
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <span className="flex items-center gap-1.5">
              <input
                type="text"
                value={editingName}
                autoFocus
                onChange={(e) => onEditingNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCommitRename();
                  } else if (e.key === "Escape") {
                    onCancelRename();
                  }
                }}
                className="px-2.5 py-1 text-sm bg-white rounded-lg border border-indigo-300 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
              />
              <button
                type="button"
                onClick={onCommitRename}
                className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                title="이름 저장"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onCancelRename}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                title="취소"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : (
            <>
              <span className="text-sm font-bold text-slate-800">{presetName}</span>
              {auto && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  자동
                </span>
              )}
            </>
          )}
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
            {statText}
          </span>
          {!editing && (
            <button
              type="button"
              onClick={onStartRename}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="이름 변경"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(deleteConfirmMessage)) onDelete();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="프리셋 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {editing && editContent ? editContent : summary}
        {footer}
      </div>
    </div>
  );
}

interface PresetLibrarySectionProps {
  icon: ReactNode;
  title: string;
  empty: boolean;
  emptyText: ReactNode;
  children: ReactNode;
  /** 목록 배치 (기본 1열, grid면 한 행에 여러 카드) */
  layout?: "list" | "grid";
}

/**
 * 저장된 프리셋 라이브러리 껍데기 (수동 목록·최근 자동 저장 공통).
 * 아이콘+제목 헤더, 빈 상태 안내, 스크롤 목록을 한 곳에서 처리한다.
 */
export function PresetLibrarySection({
  icon,
  title,
  empty,
  emptyText,
  children,
  layout = "list",
}: PresetLibrarySectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {empty ? (
        <div className="text-xs text-slate-400 py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          {emptyText}
        </div>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[32rem] overflow-y-auto">
          {children}
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}