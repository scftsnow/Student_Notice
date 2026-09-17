"use client";

import { GripVertical } from "lucide-react";
import { formatPickName } from "@/lib/pickFormat";
import type { PickStudent } from "@/types";

interface StudentPoolProps {
  students: PickStudent[];
  /** 터치 대응: 탭으로 집어든 학생 id (캔버스 탭으로 배치). 미사용 시 생략. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export default function StudentPool({ students, selectedId = null, onSelect }: StudentPoolProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      <h4 className="text-xs font-bold text-slate-700 mb-2">
        미배치 학생 ({students.length}명) — 자리로 드래그·탭하면 고정 배치
      </h4>
      {students.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center">전원 배치됨</p>
      ) : (
        <div className="max-h-64 overflow-y-auto flex flex-wrap gap-1.5">
          {students.map((s) => {
            const active = selectedId === s.id;
            return (
            <span
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/student-id", s.id);
              }}
              onClick={() => onSelect?.(active ? null : s.id)}
              aria-pressed={active}
              className={`text-xs px-2 py-1.5 rounded-xl border font-medium flex items-center gap-1 cursor-grab active:cursor-grabbing ${
                active
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-indigo-50 border-indigo-100 text-slate-700 hover:bg-indigo-100"
              }`}
              title="자리 카드로 드래그하거나 탭 후 캔버스를 탭해 고정 배치"
            >
              <GripVertical className={`w-3 h-3 ${active ? "text-indigo-200" : "text-indigo-300"}`} />
              {formatPickName(s)}
              {s.gender === "남" && <span className={`font-bold ${active ? "text-blue-200" : "text-blue-500"}`}>♂</span>}
              {s.gender === "여" && <span className={`font-bold ${active ? "text-rose-200" : "text-rose-500"}`}>♀</span>}
            </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
