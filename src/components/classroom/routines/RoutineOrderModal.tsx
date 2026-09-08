"use client";

import { useState, useEffect } from "react";
import { ClassroomStudent, ClassroomRoutine } from "@/types/classroom";

interface RoutineOrderModalProps {
  routine: ClassroomRoutine | null;
  students: ClassroomStudent[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newOrder: string[]) => void;
}

export default function RoutineOrderModal({
  routine,
  students,
  isOpen,
  onClose,
  onSave,
}: RoutineOrderModalProps) {
  const [orderList, setOrderList] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");

  useEffect(() => {
    if (routine) {
      setOrderList([...routine.order]);
    }
    if (students.length > 0) {
      setSelectedStudent(students[0].name);
    }
  }, [routine, students]);

  if (!isOpen || !routine) return null;

  const handleAdd = () => {
    if (!selectedStudent) return;
    setOrderList((prev) => [...prev, selectedStudent]);
  };

  const handleRemove = (index: number) => {
    setOrderList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(routine.id, orderList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-800 text-base">
            {routine.icon} {routine.name} — 순번 편집
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-500">학생 추가</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.no} value={s.name}>
                    {s.no}번 {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200"
              >
                추가
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[40px] p-3 rounded-xl bg-slate-50 border border-slate-200">
            {orderList.length === 0 ? (
              <span className="text-slate-400 text-[11px] italic">순환 순서가 비어 있습니다.</span>
            ) : (
              orderList.map((name, idx) => (
                <span
                  key={`${name}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px]"
                >
                  <span>{idx + 1}. {name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-indigo-400 hover:text-rose-500 font-bold leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
          <p className="text-[11px] text-slate-400">이름 옆 ✕를 눌러 순환 순서에서 제외합니다.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
