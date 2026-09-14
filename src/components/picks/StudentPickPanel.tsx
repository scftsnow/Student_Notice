"use client";

import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import DrawOverlay from "./DrawOverlay";
import { dealRounds } from "@/lib/pickRandom";
import { formatPickName } from "@/lib/pickFormat";
import { playError, unlockAudio } from "@/lib/pickSound";
import type { PickStudent } from "@/types";

interface StudentPickPanelProps {
  students: PickStudent[];
}

export default function StudentPickPanel({ students }: StudentPickPanelProps) {
  const defaultIds = useMemo(() => students.map((s) => s.id), [students]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [count, setCount] = useState(1);
  const [rounds, setRounds] = useState(1);
  const [allowDup, setAllowDup] = useState(false);
  const [error, setError] = useState("");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayResults, setOverlayResults] = useState<string[]>([]);
  const [history, setHistory] = useState<PickStudent[][]>([]);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  const rollingNames = useMemo(() => selected.map(formatPickName), [selected]);

  const runDraw = () => {
    setError("");
    unlockAudio();
    if (selected.length === 0) {
      setError("뽑을 학생을 1명 이상 선택해 주세요.");
      playError();
      return;
    }
    try {
      const picked = dealRounds(selected, count, rounds, allowDup);
      setHistory(picked);
      const display =
        rounds > 1
          ? picked.map(
              (group, i) => `${i + 1}회차: ${group.map(formatPickName).join(", ")}`
            )
          : (picked[0] ?? []).map(formatPickName);
      setOverlayResults(display);
      setOverlayOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "뽑기 중 오류가 발생했습니다.");
      playError();
    }
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">뽑는 명수</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, selected.length)}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">회차 수</label>
          <input
            type="number"
            min={1}
            max={50}
            value={rounds}
            onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pb-2.5">
          <input
            type="checkbox"
            checked={allowDup}
            onChange={(e) => setAllowDup(e.target.checked)}
            className="accent-indigo-600"
          />
          회차 간 중복 허용
        </label>
        <button
          type="button"
          onClick={runDraw}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 sm:ml-auto"
        >
          <Shuffle className="w-4 h-4" />
          뽑기
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          {error}
        </p>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-800">뽑기 결과</h3>
          {history.map((group, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
              {rounds > 1 && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {i + 1}회차
                </span>
              )}
              {group.map((s) => (
                <span key={s.id} className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                  {formatPickName(s)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <DrawOverlay
        open={overlayOpen}
        title="학생 뽑기"
        rollingNames={rollingNames}
        results={overlayResults}
        onRedraw={runDraw}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  );
}
