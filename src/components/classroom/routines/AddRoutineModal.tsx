"use client";

import { useState } from "react";
import { ClassroomStudent, ClassroomRoutine } from "@/types/classroom";

interface AddRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  currencyName?: string;
  onSave: (routine: Omit<ClassroomRoutine, "id" | "currentIdx">) => void;
}

export default function AddRoutineModal({
  isOpen,
  onClose,
  students,
  currencyName = "원",
  onSave,
}: AddRoutineModalProps) {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState(1);
  const [payCycle, setPayCycle] = useState<"건당" | "일당" | "주당" | "월당">("건당");
  const [pay, setPay] = useState(200);
  const [memo, setMemo] = useState("");
  const [displayFormat, setDisplayFormat] = useState("");
  const [orderList, setOrderList] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.name || "");

  if (!isOpen) return null;

  const handleAddStudentToOrder = () => {
    if (!selectedStudent) return;
    setOrderList((prev) => [...prev, selectedStudent]);
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("업무 이름을 입력하세요.");
      return;
    }
    onSave({
      icon: "📌",
      name: name.trim(),
      slots: Math.max(1, slots),
      pay: Math.max(0, pay),
      payCycle,
      memo: memo.trim(),
      order: orderList,
      absenceMode: "next",
      displayFormat: displayFormat.trim() || undefined,
    });
    setName("");
    setOrderList([]);
    setDisplayFormat("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-800 text-lg">새 업무 루틴 등록</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* 업무 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">업무 이름 <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 칠판 지우기, 우유 급식, 환기 담당"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>

          {/* 정원 및 급여 주기/금액 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">정원 (명)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={slots}
                onChange={(e) => setSlots(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">지급 주기</label>
              <select
                value={payCycle}
                onChange={(e) => setPayCycle(e.target.value as "건당" | "일당" | "주당" | "월당")}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="건당">건당 (1회)</option>
                <option value="일당">일당</option>
                <option value="주당">주당</option>
                <option value="월당">월당</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-slate-700">급여 ({currencyName})</label>
              <input
                type="number"
                min={0}
                value={pay}
                onChange={(e) => setPay(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 순환 순서 지정 */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">담당 순환 순서 (학생 선택 후 추가)</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.no} value={s.name}>
                    {s.no}번 {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddStudentToOrder}
                className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-all"
              >
                추가
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 min-h-[40px] p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              {orderList.length === 0 ? (
                <span className="text-slate-400 text-xs italic">담당 학생을 순서대로 추가하세요.</span>
              ) : (
                orderList.map((stName, idx) => (
                  <span
                    key={`${stName}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs"
                  >
                    <span>{idx + 1}. {stName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOrderItem(idx)}
                      className="text-indigo-400 hover:text-rose-600 font-bold leading-none ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 알림장 표시 문구 서식 (선택) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">알림장 표시 문구 서식 (선택)</label>
              <span className="text-[11px] text-slate-400">미입력 시 기본 형식 적용</span>
            </div>
            <input
              type="text"
              value={displayFormat}
              onChange={(e) => setDisplayFormat(e.target.value)}
              placeholder="비워둘 경우 기본 형식(업무명: 당번 이름들)으로 표시"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-xs"
            />
            <p className="text-[11px] text-slate-500">
              각 당번 학생 이름이 들어갈 자리에 <span className="font-bold text-indigo-600">?</span> 기호를 입력하세요.
            </p>
          </div>

          {/* 메모 */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 매일 하교 전 점검, 급식 전 배부"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs"
          >
            등록 완료
          </button>
        </div>
      </div>
    </div>
  );
}
