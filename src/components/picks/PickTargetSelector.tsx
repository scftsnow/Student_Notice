"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { PickStudent } from "@/types";

interface PickTargetSelectorProps {
  students: PickStudent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** 선택자 아래에 이어 붙일 뽑기 설정 영역 (4종 패널과 1패널로 합쳐진다) */
  children?: ReactNode;
}

/**
 * 4종 뽑기 공용 대상 선택 + 설정 패널.
 * 1행: 선택 인원수, 학생 배지(가로 스크롤), 전체선택/해제.
 * children으로 각 뽑기의 설정 행을 같은 카드 안에 합친다.
 */
export default function PickTargetSelector({
  students,
  selectedIds,
  onChange,
  children,
}: PickTargetSelectorProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleOne = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const isAllSelected =
    students.length > 0 && students.every((s) => selectedSet.has(s.id));

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(students.map((s) => s.id));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
          선택 {selectedIds.length}/{students.length}명
        </span>

        <button
          type="button"
          onClick={toggleAll}
          disabled={students.length === 0}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 ${
            isAllSelected
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          {isAllSelected ? "전체해제" : "전체선택"}
        </button>

        <div className="flex-1 min-w-0 flex flex-nowrap gap-1 overflow-x-auto py-0.5 pr-1">
          {students.map((s) => {
            const checked = selectedSet.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleOne(s.id)}
                className={`text-xs px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 border transition-all shrink-0 ${
                  checked
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {s.name}
              </button>
            );
          })}
          {students.length === 0 && (
            <span className="text-xs text-slate-400 py-1.5 shrink-0">등록된 학생이 없습니다.</span>
          )}
        </div>
      </div>

      {children && <div className="pt-2 border-t border-slate-100">{children}</div>}
    </div>
  );
}
