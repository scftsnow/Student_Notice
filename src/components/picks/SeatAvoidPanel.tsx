"use client";

import { useState } from "react";
import { Split, Plus, Trash2, X } from "lucide-react";
import { formatPickName } from "@/lib/pickFormat";
import type { PickStudent, SeatAvoidGroup } from "@/types";

interface SeatAvoidPanelProps {
  groups: SeatAvoidGroup[];
  students: PickStudent[];
  onAddGroup: () => void;
  onDeleteGroup: (id: string) => void;
  onModeChange: (id: string, mode: "side" | "around") => void;
  onAddMember: (id: string, studentId: string) => void;
  onRemoveMember: (id: string, studentId: string) => void;
}

/**
 * 만나지 말아야 할 학생 묶음 (분리 그룹).
 * 같은 그룹 학생이 이웃 자리(옆, 옆+앞뒤 선택 시 앞뒤 포함)에 앉지 않게 뽑는다.
 */
export default function SeatAvoidPanel({
  groups,
  students,
  onAddGroup,
  onDeleteGroup,
  onModeChange,
  onAddMember,
  onRemoveMember,
}: SeatAvoidPanelProps) {
  const [pickFor, setPickFor] = useState<Record<string, string>>({});

  const nameOf = (id: string): string => {
    const s = students.find((x) => x.id === id);
    return s ? formatPickName(s) : id;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Split className="w-3.5 h-3.5 text-rose-500" />
          만나지 말아야 할 학생
        </h3>
        <button
          type="button"
          onClick={onAddGroup}
          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-[11px] border border-slate-200 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          그룹 추가
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2 text-center">
          서로 떨어뜨릴 학생을 그룹으로 묶어 주세요.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((g, gi) => {
            const candidates = students.filter((s) => !g.members.includes(s.id));
            const picked = pickFor[g.id] ?? "";
            return (
              <div key={g.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 shrink-0">분리 {gi + 1}</span>
                  <select
                    value={picked}
                    onChange={(e) => setPickFor((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    className="w-28 px-1.5 py-1 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
                  >
                    <option value="">학생 선택</option>
                    {candidates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatPickName(s)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!picked}
                    onClick={() => {
                      onAddMember(g.id, picked);
                      setPickFor((prev) => ({ ...prev, [g.id]: "" }));
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold transition-colors shrink-0"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange(g.id, g.mode === "side" ? "around" : "side")}
                    title="클릭하여 분리 범위 변경"
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors shrink-0 ${
                      g.mode === "around"
                        ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {g.mode === "side" ? "옆자리만" : "옆+앞뒤"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`분리 ${gi + 1} 그룹을 삭제하시겠습니까?`)) onDeleteGroup(g.id);
                    }}
                    className="ml-auto p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                    title="그룹 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {g.members.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-lg bg-white border border-rose-200 text-slate-800 font-bold select-none"
                    >
                      {nameOf(m)}
                      <button
                        type="button"
                        onClick={() => onRemoveMember(g.id, m)}
                        className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="그룹에서 빼기"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {g.members.length === 0 && (
                    <span className="text-[11px] text-slate-400">학생을 추가해 주세요.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
