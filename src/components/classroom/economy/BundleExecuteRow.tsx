"use client";

import type { ReactNode } from "react";
import { BundleAction, CustomBundle } from "@/types/classroom";

interface BundleActionChipsProps {
  actions: BundleAction[];
  currencyName?: string;
}

/** 복합정산 액션 요약 칩 (학급 화폐 메뉴 · 현황판 관리 패널 공용) */
export function BundleActionChips({ actions, currencyName = "원" }: BundleActionChipsProps) {
  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {actions.map((act, i) => {
        const isTreasury = act.target === "treasury";
        const targetLabel = isTreasury
          ? "국고"
          : act.target === "all"
            ? "전체"
            : act.target === "selected"
              ? "선택"
              : act.target === "unselected"
                ? "미선택"
                : `${act.specificTargets?.length || 0}명`;
        const sign = act.type === "deposit" ? "+" : "-";
        return (
          <span
            key={i}
            className={`px-1 py-0.2 rounded text-[9px] font-bold inline-flex items-center gap-0.5 ${
              isTreasury
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : act.type === "deposit"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            <span>{targetLabel}</span>
            <span>
              {sign}
              {act.amount.toLocaleString()}
              {currencyName}
              {act.applyTax ? " (과세)" : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}

interface BundleExecuteRowProps {
  bundle: CustomBundle;
  currencyName?: string;
  selectedNames?: string[];
  onExecute: (bundleId: string, selectedNames?: string[]) => void;
  /** 수정/삭제 등 추가 버튼 (학급 화폐 메뉴용) */
  extraActions?: ReactNode;
  draggableProps?: {
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
  };
}

/** 복합정산 실행 행 (학급 화폐 메뉴 · 현황판 관리 패널 공용) */
export default function BundleExecuteRow({
  bundle: b,
  currencyName = "원",
  selectedNames,
  onExecute,
  extraActions,
  draggableProps,
}: BundleExecuteRowProps) {
  return (
    <div
      className={`px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-1.5 ${
        draggableProps ? "cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity" : ""
      }`}
      {...(draggableProps
        ? {
            draggable: draggableProps.draggable,
            onDragStart: draggableProps.onDragStart,
            onDragOver: draggableProps.onDragOver,
            onDrop: draggableProps.onDrop,
          }
        : {})}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-800 text-xs truncate">{b.name}</span>
          {b.desc && <span className="text-[10px] text-slate-400 truncate">({b.desc})</span>}
        </div>
        <BundleActionChips actions={b.actions} currencyName={currencyName} />
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {extraActions}
        <button
          type="button"
          onClick={() => onExecute(b.id, selectedNames)}
          className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
        >
          실행
        </button>
      </div>
    </div>
  );
}
