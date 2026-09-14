"use client";

import { useMemo, useState } from "react";
import { ListOrdered, CheckCheck } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import DrawOverlay from "./DrawOverlay";
import { formatPickName } from "@/lib/pickFormat";
import { shuffle } from "@/lib/pickRandom";
import { applyRoutineOrder } from "@/app/pickActions";
import { playError, unlockAudio } from "@/lib/pickSound";
import type { PickStudent } from "@/types";

interface OrderPickPanelProps {
  students: PickStudent[];
  routines: { id: string; title: string }[];
}

export default function OrderPickPanel({ students, routines }: OrderPickPanelProps) {
  const defaultIds = useMemo(
    () => students.filter((s) => s.status !== "ABSENT").map((s) => s.id),
    [students]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [routineId, setRoutineId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [ordered, setOrdered] = useState<PickStudent[]>([]);
  const [applying, setApplying] = useState(false);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  const rollingNames = useMemo(() => selected.map(formatPickName), [selected]);
  const overlayResults = useMemo(
    () => ordered.map((s, i) => `${i + 1}. ${formatPickName(s)}`),
    [ordered]
  );

  const runDraw = () => {
    setError("");
    setNotice("");
    unlockAudio();
    if (selected.length < 2) {
      setError("순서를 뽑으려면 학생을 2명 이상 선택해 주세요.");
      playError();
      return;
    }
    setOrdered(shuffle(selected));
    setOverlayOpen(true);
  };

  const handleApply = async () => {
    if (!routineId || ordered.length === 0) return;
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    if (
      !confirm(
        `'${routine.title}' 업무의 담당 순서가 방금 뽑은 순서로 변경됩니다. 계속하시겠습니까?`
      )
    ) {
      return;
    }
    setApplying(true);
    setError("");
    setNotice("");
    const res = await applyRoutineOrder(
      routineId,
      ordered.map((s) => s.id)
    );
    setApplying(false);
    if (res.success) {
      setNotice(`'${routine.title}' 업무 순서에 적용했습니다. (선택 밖 학생은 뒤로 유지)`);
    } else {
      setError(res.error);
      playError();
    }
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            연동할 학생 업무 (선택 시 순서 적용 가능)
          </label>
          <select
            value={routineId}
            onChange={(e) => setRoutineId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">연동 없음 (순서만 뽑기)</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={runDraw}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200"
        >
          <ListOrdered className="w-4 h-4" />
          순서 뽑기
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
          {notice}
        </p>
      )}

      {ordered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">뽑힌 순서</h3>
            {routineId && (
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {applying ? "적용 중..." : "업무 순서에 적용"}
              </button>
            )}
          </div>
          <ol className="space-y-1">
            {ordered.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-slate-50"
              >
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-700">{formatPickName(s)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <DrawOverlay
        open={overlayOpen}
        title="순서 뽑기"
        rollingNames={rollingNames}
        results={overlayResults}
        onRedraw={runDraw}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  );
}
