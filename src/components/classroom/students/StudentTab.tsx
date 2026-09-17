"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { User, Users, Plus, X } from "lucide-react";
import { ClassroomStudent } from "@/types/classroom";

interface StudentTabProps {
  students: ClassroomStudent[];
  onAddStudents: (names: string[]) => void;
  onDeleteStudent: (name: string) => void;
  onUpdateGender: (name: string, gender: "남" | "여" | null) => void;
}

export default function StudentTab({
  students,
  onAddStudents,
  onDeleteStudent,
  onUpdateGender,
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

  const maleCount = students.filter((s) => s.gender === "남").length;
  const femaleCount = students.filter((s) => s.gender === "여").length;
  const unspecifiedCount = students.length - maleCount - femaleCount;

  return (
    <div className="space-y-4 text-sm">
      {/* 학생 추가 및 명단 현황 바 */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-base">학급 학생 명단</span>
            <span className="text-slate-500 text-sm">
              (총 <span className="font-bold text-indigo-600">{students.length}</span>명
              {students.length > 0 && (
                <>
                  {" · "}남 <span className="font-bold text-blue-600">{maleCount}</span>
                  {" · "}여 <span className="font-bold text-rose-500">{femaleCount}</span>
                  {unspecifiedCount > 0 && (
                    <>
                      {" · "}미지정 <span className="font-bold text-slate-400">{unspecifiedCount}</span>
                    </>
                  )}
                </>
              )}
              )
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
              placeholder="학생 이름 입력 (Enter / 연속 입력 시 띄어쓰기로 구분 후 Enter)"
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-bold text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400"
            />
            <User className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>추가</span>
          </button>
        </div>
      </div>

      {/* 학생 카드 그리드 */}
      {students.length === 0 ? (
        <div className="p-10 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="font-semibold text-base">등록된 학생이 없습니다.</div>
          <div className="text-xs mt-1">
            위의 입력창에 학생 이름을 입력하고 Enter를 누르면 추가됩니다.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {students.map((s) => (
            <div
              key={s.name}
              className={`group p-2.5 sm:p-3 rounded-xl bg-white border hover:shadow-sm flex items-center justify-between gap-2 transition-all ${
                s.gender === "남"
                  ? "border-blue-200 hover:border-blue-300 bg-blue-50/5"
                  : s.gender === "여"
                    ? "border-rose-200 hover:border-rose-300 bg-rose-50/5"
                    : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* 성별 선택 세그먼트 버튼 (여러번 클릭 없이 원하는 성별을 1번의 클릭으로 직접 선택) */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 shrink-0 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => onUpdateGender(s.name, s.gender === "남" ? null : "남")}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer ${
                      s.gender === "남"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-blue-600 hover:bg-slate-200/70"
                    }`}
                    title={s.gender === "남" ? "남학생 (클릭 시 미지정 해제)" : "남학생으로 선택"}
                  >
                    남
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateGender(s.name, s.gender === "여" ? null : "여")}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer ${
                      s.gender === "여"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-400 hover:text-rose-600 hover:bg-slate-200/70"
                    }`}
                    title={s.gender === "여" ? "여학생 (클릭 시 미지정 해제)" : "여학생으로 선택"}
                  >
                    여
                  </button>
                </div>
                <span className="font-bold text-slate-800 text-sm truncate">{s.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`${s.name} 학생을 명단에서 삭제하시겠습니까?`)) {
                    onDeleteStudent(s.name);
                  }
                }}
                className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors shrink-0 font-bold text-sm cursor-pointer"
                title={`${s.name} 학생 삭제`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
