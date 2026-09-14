"use client";

import { GripVertical } from "lucide-react";
import { formatPickName } from "@/lib/pickFormat";
import type { PickStudent } from "@/types";

interface StudentPoolProps {
  students: PickStudent[];
}

export default function StudentPool({ students }: StudentPoolProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      <h4 className="text-xs font-bold text-slate-700 mb-2">
        미배치 학생 ({students.length}명) — 자리로 드래그하면 고정 배치
      </h4>
      {students.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center">전원 배치됨</p>
      ) : (
        <div className="max-h-64 overflow-y-auto flex flex-wrap gap-1.5">
          {students.map((s) => (
            <span
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/student-id", s.id);
              }}
              className="text-xs px-2 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-slate-700 font-medium flex items-center gap-1 cursor-grab active:cursor-grabbing hover:bg-indigo-100"
              title="자리 셀로 드래그해 고정 배치"
            >
              <GripVertical className="w-3 h-3 text-indigo-300" />
              {formatPickName(s)}
              {s.gender === "남" && <span className="text-blue-500 font-bold">♂</span>}
              {s.gender === "여" && <span className="text-rose-500 font-bold">♀</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
