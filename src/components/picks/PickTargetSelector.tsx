"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PickStudent } from "@/types";

interface PickTargetSelectorProps {
  students: PickStudent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function PickTargetSelector({
  students,
  selectedIds,
  onChange,
}: PickTargetSelectorProps) {
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) || String(s.studentNumber).includes(term)
      );
    });
  }, [students, search]);

  const selectable = useMemo(() => visible, [visible]);

  const toggleOne = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const merged = new Set(selectedIds);
    selectable.forEach((s) => merged.add(s.id));
    onChange(Array.from(merged));
  };

  const clearAll = () => {
    const removable = new Set(selectable.map((s) => s.id));
    onChange(selectedIds.filter((sid) => !removable.has(sid)));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 검색..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">
          선택 {selectedIds.length}/{students.length}명
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            전체선택
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            해제
          </button>
        </div>
      </div>

      <div className="max-h-44 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
        {visible.map((s) => {
          const checked = selectedSet.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleOne(s.id)}
              className={`text-xs px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5 border transition-all ${
                checked
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
            >
              {s.name}
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="text-xs text-slate-400 py-4 w-full text-center">검색 결과가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
