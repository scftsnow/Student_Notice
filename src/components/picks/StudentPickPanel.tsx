"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Shuffle, ExternalLink, RotateCcw } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import { dealRounds } from "@/lib/pickRandom";
import { formatPickName } from "@/lib/pickFormat";
import { playError } from "@/lib/pickSound";
import { openPickWindow, broadcastPick, stampPayload, PICK_SYNC_CHANNEL } from "@/lib/pickWindowHelper";
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
      const drawId = `pick-student-${Date.now()}`;
      // 버튼을 누른 시점에는 후보만 보낸다. 실제로 뽑는 것은 전광판에서
      // [추첨 시작]을 누른 그 순간(rollStudent)이다.
      openPickWindow({
        id: drawId,
        type: "student",
        title: "학생 뽑기",
        rollingNames: poolNames,
        results: [],
        rolled: false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "뽑기 중 오류가 발생했습니다.");
      playError();
    }
  }, [drawPool.length, count, allowDup, poolNames]);

  // 전광판의 추첨 요청에 응답해 이 순간에 실제로 뽑는다.
  // 후보에서 이미 뽑힌 학생을 제외하는 확정 처리도 여기서 함께 된다.
  const rollStudent = useCallback(
    (id: string) => {
      if (drawPool.length === 0) return;
      try {
        const picked = dealRounds(drawPool, count, 1, allowDup);
        const names = picked.flat().map((s) => s.id);
        const display = (picked[0] ?? []).map(formatPickName);

        // 실제로 추첨이 시작되었으므로 뽑힌 학생을 후보에서 제외한다
        setExcludedIds((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);

        broadcastPick(
          stampPayload({
            id,
            type: "student",
            title: "학생 뽑기",
            rollingNames: poolNames,
            results: display,
            rolled: true,
          })
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "뽑기 중 오류가 발생했습니다.");
        playError();
      }
    },
    [drawPool, count, allowDup, poolNames]
  );

  // 전광판이 '지금 뽑아라'고 요청하면 그때 랜덤이 돈다
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(PICK_SYNC_CHANNEL);
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "PICK_ROLL" && e.data?.pickType === "student") {
          rollStudent(String(e.data.id));
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (channel) channel.close();
    };
  }, [rollStudent]);

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds}>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
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
      </PickTargetSelector>

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
