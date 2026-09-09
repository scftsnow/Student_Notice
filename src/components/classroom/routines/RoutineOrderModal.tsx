"use client";

import { useState, useEffect, useRef } from "react";
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
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    if (routine) setOrderList([...routine.order]);
  }, [routine]);

  if (!isOpen || !routine) return null;

  const toggleStudent = (name: string) => {
    setOrderList((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleRemoveAt = (index: number) => {
    setOrderList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
    setDragIndex(idx);
  };

  const handleDragEnter = (idx: number) => {
    dragOver.current = idx;
    setDropIndex(idx);
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const from = dragItem.current;
    const to = dragOver.current;
    if (from !== to) {
      setOrderList((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    dragItem.current = null;
    dragOver.current = null;
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleSave = () => {
    onSave(routine.id, orderList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-800 text-base">
            {routine.icon} {routine.name} — 순번 편집
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* 학생 카드 선택 영역 */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500">학생 선택 (클릭으로 순번 목록 추가/제거)</p>
          {students.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">등록된 학생이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200">
              {students.map((s) => {
                const isInOrder = orderList.includes(s.name);
                const count = orderList.filter((n) => n === s.name).length;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => toggleStudent(s.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all select-none ${
                      isInOrder
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    <span>{s.name}</span>
                    {isInOrder && count > 0 && (
                      <span className="ml-0.5 bg-white/20 text-white rounded-full px-1 text-[10px] font-extrabold">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 순환 순서 드래그 영역 */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500">순환 순서 (⠿ 드래그로 순서 이동)</p>
          <div className="min-h-[60px] p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5 content-start">
            {orderList.length === 0 ? (
              <span className="text-slate-400 text-[11px] italic block text-center w-full py-3">
                위에서 학생을 선택하면 여기에 표시됩니다.
              </span>
            ) : (
              orderList.map((name, idx) => (
                <div
                  key={`order-${name}-${idx}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-grab active:cursor-grabbing select-none ${
                    dragIndex === idx
                      ? "opacity-40 bg-indigo-100 border-indigo-300 ring-2 ring-indigo-400"
                      : dropIndex === idx && dragIndex !== null && dragIndex !== idx
                      ? "border-indigo-400 bg-indigo-50 scale-105"
                      : "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                  }`}
                >
                  <span className="font-bold">{name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAt(idx); }}
                    className="ml-0.5 text-white/60 hover:text-white font-bold leading-none transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            같은 학생을 여러 번 추가하면 순환 주기를 늘릴 수 있습니다.
          </p>
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
