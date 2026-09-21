"use client";

import { formatPickName } from "@/lib/pickFormat";
import type { PickStudent } from "@/types";

interface StudentPoolProps {
  students: PickStudent[];
  /** true면 전체 목록 표시 모드 (배치 숨김 중 미배치처럼 보이기) */
  masked?: boolean;
}

export default function StudentPool({ students, masked = false }: StudentPoolProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      <h4 className="text-xs font-bold text-slate-700 mb-2">
        {masked ? "전체" : "미배치"} 학생 ({students.length}명) — 자리로 드래그하면 학생 자리 고정
      </h4>
      {students.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center">전원 배치됨</p>
      ) : (
        <div className="max-h-64 overflow-y-auto flex flex-wrap gap-1">
          {students.map((s) => {
            return (
            <span
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/student-id", s.id);
              }}
              className="text-sm px-2.5 py-1.5 rounded-xl border font-bold flex items-center gap-1 cursor-grab active:cursor-grabbing select-none bg-indigo-50 border-indigo-100 text-slate-700 hover:bg-indigo-100"
              title="자리 카드로 드래그하면 학생 자리 고정"
            >
              {formatPickName(s)}
              {s.gender === "남" && <span className="font-bold text-blue-500">♂</span>}
              {s.gender === "여" && <span className="font-bold text-rose-500">♀</span>}
            </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
