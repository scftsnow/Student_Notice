"use client";

import { useState, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [visibleInNotice, setVisibleInNotice] = useState(true);
  const [orderList, setOrderList] = useState<string[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const toggleStudent = (name: string) => {
    setOrderList((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleRemoveAt = (idx: number) => {
    setOrderList((prev) => prev.filter((_, i) => i !== idx));
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
      visibleInNotice,
    });
    setName("");
    setOrderList([]);
    setDisplayFormat("");
    setVisibleInNotice(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-800 text-lg">새 학생 업무 등록</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* 업무 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">
              업무 이름 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 칠판 지우기, 우유 급식, 환기 담당"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>

          {/* 정원 및 급여 주기/금액 */}
          <div className="grid grid-cols-3 gap-3">
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

          {/* 학생 카드 선택 */}
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-slate-700">담당 학생 선택 (클릭으로 순번 목록 추가/제거)</p>
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
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-slate-700">순환 순서 <span className="font-normal text-slate-400 text-xs">(배지 드래그로 순서 이동)</span></p>
            <div className="min-h-[48px] p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5 content-start">
              {orderList.length === 0 ? (
                <span className="text-slate-400 text-[11px] italic block text-center w-full py-2">
                  위에서 학생을 클릭하면 순번이 여기에 추가됩니다.
                </span>
              ) : (
                orderList.map((sName, idx) => (
                  <div
                    key={`order-${sName}-${idx}`}
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
                    <span className="font-bold">{sName}</span>
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
            <p className="text-[11px] text-slate-400">
              같은 학생을 여러 번 추가하려면 카드를 다시 클릭하세요.
            </p>
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
              각 당번 학생 이름이 들어갈 자리에{" "}
              <span className="font-bold text-indigo-600">?</span> 기호를 입력하세요.
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

          {/* 알림장(칠판) 표시 여부 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                visibleInNotice ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
              }`}>
                {visibleInNotice ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold text-slate-800 text-xs block">알림장(칠판) 표시</span>
                <span className="text-[11px] text-slate-500">알림장 칠판 및 학생 전광판에 노출</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVisibleInNotice((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                visibleInNotice
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-xs hover:bg-indigo-700"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {visibleInNotice ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>표시함</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>숨김</span>
                </>
              )}
            </button>
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
