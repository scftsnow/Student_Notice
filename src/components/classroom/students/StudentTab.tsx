"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { ClassroomStudent } from "@/types/classroom";

interface StudentTabProps {
  students: ClassroomStudent[];
  onAddStudents: (names: string[]) => void;
  onDeleteStudent: (no: number) => void;
}

export default function StudentTab({
  students,
  onAddStudents,
  onDeleteStudent,
}: StudentTabProps) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const raw = inputText.trim();
    if (!raw) return;

    // Split by spaces or commas
    const tokens = raw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length > 0) {
      onAddStudents(tokens);
      setInputText("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* 학생 추가 및 명단 현황 바 */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-base">학급 학생 명단</span>
            <span className="text-slate-500 text-sm">
              (총 <span className="font-bold text-indigo-600">{students.length}</span>명)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="학생 이름 입력 (예: 강민준 후 Enter / 또는 '민준 서연 도윤 지우' 연속 입력 후 Enter)"
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-bold text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400"
            />
            <span className="absolute left-3 top-3 text-slate-400 text-sm">👤</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap"
          >
            <span>＋</span>
            <span>추가</span>
          </button>
        </div>
      </div>

      {/* 학생 카드 그리드 */}
      {students.length === 0 ? (
        <div className="p-10 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <div className="text-3xl mb-2">👥</div>
          <div className="font-semibold text-base">등록된 학생이 없습니다.</div>
          <div className="text-xs mt-1">
            위의 입력창에 학생 이름을 입력하고 Enter를 누르면 추가됩니다.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {students.map((s) => (
            <div
              key={s.no}
              className="group p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-xs flex items-center justify-between gap-2 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-600 font-bold flex items-center justify-center text-xs shrink-0 font-mono transition-colors">
                  {s.no}
                </span>
                <span className="font-bold text-slate-800 text-sm truncate">{s.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`${s.name} 학생을 명단에서 삭제하시겠습니까?`)) {
                    onDeleteStudent(s.no);
                  }
                }}
                className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors shrink-0 font-bold text-sm"
                title={`${s.name} 학생 삭제`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
