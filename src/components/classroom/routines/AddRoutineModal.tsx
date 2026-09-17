"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Bookmark, Sparkles, Check, ExternalLink, ListOrdered } from "lucide-react";
import { ClassroomStudent, ClassroomRoutine, SavedOrderPreset } from "@/types/classroom";

interface AddRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: ClassroomStudent[];
  currencyName?: string;
  onSave?: (routine: Omit<ClassroomRoutine, "id" | "currentIdx">) => void;
  initialRoutine?: ClassroomRoutine | null;
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  savedOrders?: SavedOrderPreset[];
}

export default function AddRoutineModal({
  isOpen,
  onClose,
  students,
  currencyName = "원",
  onSave,
  initialRoutine,
  onUpdateRoutine,
  savedOrders = [],
}: AddRoutineModalProps) {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState(1);
  const [payCycle, setPayCycle] = useState<"건당" | "일당" | "주당" | "월당">("건당");
  const [pay, setPay] = useState(200);
  const [memo, setMemo] = useState("");
  const [orderList, setOrderList] = useState<string[]>([]);
  const [effectiveSavedOrders, setEffectiveSavedOrders] = useState<SavedOrderPreset[]>(savedOrders || []);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetNotice, setPresetNotice] = useState("");
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // 저장된 순서 목록 최신화 (props 우선 + localStorage/Snapshot 폴백)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const direct = localStorage.getItem("classroom_saved_orders");
      if (direct) {
        const parsed = JSON.parse(direct);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEffectiveSavedOrders(parsed);
          return;
        }
      }
      const v3 = localStorage.getItem("classroom_os_state_v3");
      if (v3) {
        const parsed = JSON.parse(v3);
        if (Array.isArray(parsed.savedOrders) && parsed.savedOrders.length > 0) {
          setEffectiveSavedOrders(parsed.savedOrders);
          return;
        }
      }
    } catch {
      // noop
    }
    if (savedOrders && savedOrders.length > 0) {
      setEffectiveSavedOrders(savedOrders);
    }
  }, [isOpen, savedOrders]);

  useEffect(() => {
    if (isOpen && initialRoutine) {
      setName(initialRoutine.name || "");
      setSlots(initialRoutine.slots || 1);
      const cycle = initialRoutine.payCycle;
      setPayCycle(
        cycle === "일당" || cycle === "주당" || cycle === "월당" || cycle === "건당"
          ? cycle
          : "건당"
      );
      setPay(initialRoutine.pay ?? 200);
      setMemo(initialRoutine.memo || "");
      setOrderList([...initialRoutine.order]);
      setSelectedPresetId("");
      setPresetNotice("");
    } else if (isOpen && !initialRoutine) {
      setName("");
      setSlots(1);
      setPayCycle("건당");
      setPay(200);
      setMemo("");
      setOrderList([]);
      setSelectedPresetId("");
      setPresetNotice("");
    }
  }, [isOpen, initialRoutine]);

  const handleApplyPreset = useCallback(
    (presetId?: string) => {
      const targetId = presetId || selectedPresetId;
      if (!targetId) return;
      const target = effectiveSavedOrders.find((p) => p.id === targetId);
      if (!target) return;
      if (
        orderList.length > 0 &&
        !confirm(
          `현재 설정된 순서(${orderList.length}명)를 '${target.name}'(${target.order.length}명) 프리셋으로 교체하시겠습니까?`
        )
      ) {
        return;
      }
      setOrderList([...target.order]);
      setPresetNotice(`'${target.name}' 순서(${target.order.length}명)가 순환 순서에 적용되었습니다.`);
      setTimeout(() => setPresetNotice(""), 3500);
    },
    [effectiveSavedOrders, selectedPresetId, orderList]
  );

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
    if (initialRoutine && onUpdateRoutine) {
      onUpdateRoutine(initialRoutine.id, {
        name: name.trim(),
        slots: Math.max(1, slots),
        pay: Math.max(0, pay),
        payCycle,
        memo: memo.trim(),
        order: orderList,
      });
    } else if (onSave) {
      onSave({
        icon: "",
        name: name.trim(),
        slots: Math.max(1, slots),
        pay: Math.max(0, pay),
        payCycle,
        memo: memo.trim(),
        order: orderList,
        absenceMode: "next",
        visibleInNotice: true,
      });
    }
    setName("");
    setOrderList([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-800 text-lg">
            {initialRoutine ? `${initialRoutine.name} — 업무 설정` : "새 학생 업무 등록"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors leading-none"
          >
            <X className="w-5 h-5" />
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

          {/* 저장 순서 불러오기 영역 */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Bookmark className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>저장 순서 불러오기</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                학급 뽑기 연동 ({effectiveSavedOrders.length}개)
              </span>
            </div>

            {effectiveSavedOrders.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-indigo-200 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">불러올 저장 순서를 선택하세요...</option>
                    {effectiveSavedOrders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.order.length}명)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPresetId}
                    onClick={() => handleApplyPreset()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors shrink-0 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    순서 적용
                  </button>
                </div>

                {selectedPresetId && (
                  <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-indigo-100/60 leading-relaxed">
                    {effectiveSavedOrders.find((p) => p.id === selectedPresetId)?.order.join(" → ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-indigo-950 bg-white/80 p-3 rounded-xl border border-indigo-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>현재 저장된 순서가 없습니다.</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <a href="/picks?tab=order" className="font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                    순서 뽑기 화면
                  </a>
                  에서 학생들의 순서를 추첨하고 이름을 지정하여 저장하면, 이곳에서 언제든지 클릭 한 번으로 불러올 수 있습니다.
                </p>
              </div>
            )}

            {presetNotice && (
              <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{presetNotice}</span>
              </p>
            )}
          </div>

          {/* 학생 카드 선택 */}
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-slate-700">담당 학생 선택 (클릭으로 순번 목록 추가/제거)</p>
            {students.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">등록된 학생이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200">
                {students.map((s) => {
                  const indices = orderList
                    .map((n, i) => (n === s.name ? i + 1 : null))
                    .filter((x): x is number => x !== null);
                  const isInOrder = indices.length > 0;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => toggleStudent(s.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all select-none ${
                        isInOrder
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                      }`}
                    >
                      <span>{s.name}</span>
                      {isInOrder && (
                        <span className="bg-white/25 text-white rounded-full px-1.5 py-0.2 text-[10px] font-extrabold font-mono">
                          {indices.join(",")}
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
            <p className="font-bold text-slate-700">
              순환 순서 <span className="font-normal text-slate-400 text-xs">(배지 드래그로 순서 이동)</span>
            </p>
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragIndex === idx
                        ? "opacity-40 bg-indigo-100 border-indigo-300 ring-2 ring-indigo-400"
                        : dropIndex === idx && dragIndex !== null && dragIndex !== idx
                        ? "border-indigo-400 bg-indigo-50 scale-105"
                        : "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                    }`}
                  >
                    <span className="bg-white/20 text-white rounded-md px-1.5 py-0.2 text-[10px] font-extrabold font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-bold">{sName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAt(idx);
                      }}
                      className="ml-0.5 text-white/70 hover:text-white transition-colors"
                      title="순번에서 제거"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
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
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm"
          >
            {initialRoutine ? "설정 저장" : "등록 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
