"use client";

import { Save } from "lucide-react";

interface PickSaveBarProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder: string;
  buttonLabel: string;
}

/**
 * 순서/모둠/자리 뽑기 공용 프리셋 저장 바.
 * 이름 입력 + 저장 버튼 조합이 3개 패널에 중복되므로 한 곳에서 관리한다.
 */
export default function PickSaveBar({
  value,
  onChange,
  onSave,
  placeholder,
  buttonLabel,
}: PickSaveBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
        }}
      />
      <button
        type="button"
        onClick={onSave}
        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
      >
        <Save className="w-3.5 h-3.5" />
        {buttonLabel}
      </button>
    </div>
  );
}
