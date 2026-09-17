"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Shuffle, ExternalLink, RotateCcw } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import { dealRounds } from "@/lib/pickRandom";
import { formatPickName } from "@/lib/pickFormat";
import { playError } from "@/lib/pickSound";
import { openPickWindow } from "@/lib/pickWindowHelper";
import type { PickStudent } from "@/types";

interface StudentPickPanelProps {
  students: PickStudent[];
}

export default function StudentPickPanel({ students }: StudentPickPanelProps) {
  const defaultIds = useMemo(() => students.map((s) => s.id), [students]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [count, setCount] = useState(1);
  const [allowDup, setAllowDup] = useState(false);
  const [error, setError] = useState("");
  // 중복 미허용 시 이미 뽑힌 학생 ID (다음 추첨에서 제외, 리셋으로 복원)
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  // 팝업에서 실제 추첨 시작 전까지는 미확정 (reveal 전 내역 오염 방지)
  const pendingRef = useRef<{ id: string; ids: string[] } | null>(null);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  // 중복 미허용이면 이미 뽑힌 학생을 후보에서 제외
  const drawPool = useMemo(
    () => (allowDup ? selected : selected.filter((s) => !excludedIds.includes(s.id))),
    [selected, excludedIds, allowDup]
  );
  const poolNames = useMemo(() => drawPool.map(formatPickName), [drawPool]);
  const excludedStudents = useMemo(
    () =>
      excludedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [excludedIds, byId]
  );

  const runDraw = useCallback(() => {
    setError("");
    if (drawPool.length === 0) {
      setError(
        allowDup
          ? "뽑을 학생을 1명 이상 선택해 주세요."
          : "후보를 모두 뽑았습니다. 아래 [제외 리셋]을 눌러 처음부터 다시 뽑아주세요."
      );
      playError();
      return;
    }
    if (!allowDup && count > drawPool.length) {
      setError(
        `남은 후보 ${drawPool.length}명으로는 ${count}명을 중복 없이 뽑을 수 없습니다. 명수를 줄이거나 [제외 리셋]을 눌러주세요.`
      );
      playError();
      return;
    }
    try {
      const picked = dealRounds(drawPool, count, 1, allowDup);
      const drawId = `pick-student-${Date.now()}`;
      // 팝업에서 [추첨 시작]을 눌러 실제 추첨이 시작될 때 내역에 확정 (PICK_COMMIT 수신 시)
      // 중복 허용 시에도 기록은 누적, 후보 제외만 하지 않음
      pendingRef.current = { id: drawId, ids: picked.flat().map((s) => s.id) };
      const display = (picked[0] ?? []).map(formatPickName);

      openPickWindow({
        id: drawId,
        type: "student",
        title: "학생 뽑기",
        rollingNames: poolNames,
        results: display,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "뽑기 중 오류가 발생했습니다.");
      playError();
    }
  }, [drawPool, count, allowDup, poolNames]);

  // 팝업 이벤트: '다시 뽑기' 재추첨 / '추첨 시작' 확정
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_pick_sync");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "REQUEST_REDRAW") {
          runDraw();
        } else if (e.data?.type === "PICK_COMMIT") {
          const pending = pendingRef.current;
          if (pending && e.data?.id === pending.id) {
            pendingRef.current = null;
            setExcludedIds((prev) => [
              ...prev,
              ...pending.ids.filter((id) => !prev.includes(id)),
            ]);
          }
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (channel) channel.close();
    };
  }, [runDraw]);

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">뽑는 명수</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, drawPool.length)}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
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
          중복 허용
        </label>
        <button
          type="button"
          onClick={runDraw}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 sm:ml-auto transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Shuffle className="w-4 h-4" />
          <span>뽑기 (별도 창)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          {error}
        </p>
      )}

      {/* 뽑힌 내역 + 리셋 (중복 허용 시에도 기록 표시, 제외는 미허용 시에만) */}
      {excludedIds.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-sm font-bold text-amber-900">
              뽑힌 내역{" "}
              <span className="text-xs font-semibold text-amber-700">
                {allowDup
                  ? `(누적 ${excludedIds.length}명)`
                  : `(제외 ${excludedIds.length}명 · 남은 후보 ${drawPool.length}명)`}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setExcludedIds([]);
                setError("");
              }}
              className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {allowDup ? "기록 지우기" : "제외 리셋"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {excludedStudents.map((s) => (
              <span
                key={s.id}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-900 font-medium"
              >
                {formatPickName(s)}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
