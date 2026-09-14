"use client";

import { useMemo, useState } from "react";
import { Users, GripVertical } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import DrawOverlay from "./DrawOverlay";
import SaveBar from "./SaveBar";
import { dealGroups, parseGroupSizes } from "@/lib/pickRandom";
import { formatPickName } from "@/lib/pickFormat";
import { saveGroupSet, deleteGroupSet } from "@/app/pickActions";
import { playError } from "@/lib/pickSound";
import type { PickStudent } from "@/types";

export interface GroupSetItem {
  id: string;
  name: string;
  mode: string;
  genderMode: string;
  groupsJson: string;
  namesJson: string;
}

interface GroupPickPanelProps {
  students: PickStudent[];
  initialSets: GroupSetItem[];
}

type Mode = "count" | "size" | "custom";

function evenSplit(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

export default function GroupPickPanel({ students, initialSets }: GroupPickPanelProps) {
  const defaultIds = useMemo(
    () => students.filter((s) => s.status !== "ABSENT").map((s) => s.id),
    [students]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [mode, setMode] = useState<Mode>("count");
  const [countValue, setCountValue] = useState(4);
  const [sizeValue, setSizeValue] = useState(4);
  const [customText, setCustomText] = useState("");
  const [separateGender, setSeparateGender] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groups, setGroups] = useState<PickStudent[][]>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sets, setSets] = useState<GroupSetItem[]>(initialSets);
  const [loadedId, setLoadedId] = useState("");

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
    () => groups.map((g, i) => `${i + 1}모둠: ${g.map((s) => s.name).join(", ")}`),
    [groups]
  );

  const resolveSizes = (n: number): number[] => {
    if (mode === "count") {
      if (countValue < 1) throw new Error("모둠 수를 1 이상으로 입력해 주세요.");
      if (countValue > n) throw new Error(`모둠 수(${countValue})가 선택 인원(${n}명)보다 많습니다.`);
      return evenSplit(n, countValue);
    }
    if (mode === "size") {
      if (sizeValue < 1) throw new Error("모둠당 인원을 1 이상으로 입력해 주세요.");
      if (sizeValue > n) throw new Error(`모둠당 인원(${sizeValue}명)이 선택 인원(${n}명)보다 많습니다.`);
      return evenSplit(n, Math.max(1, Math.round(n / sizeValue)));
    }
    return parseGroupSizes(customText);
  };

  const runDraw = () => {
    setError("");
    setNotice("");
    if (selected.length < 2) {
      setError("모둠을 나누려면 학생을 2명 이상 선택해 주세요.");
      playError();
      return;
    }
    try {
      const sizes = resolveSizes(selected.length);
      const dealt = dealGroups(selected, sizes, (s) => s.gender, separateGender);
      setGroups(dealt);
      setOverlayOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "모둠 나누기 중 오류가 발생했습니다.");
      playError();
    }
  };

  const moveStudent = (studentId: string, fromGroup: number, toGroup: number) => {
    if (fromGroup === toGroup) return;
    setGroups((prev) => {
      const next = prev.map((g) => [...g]);
      const idx = next[fromGroup].findIndex((s) => s.id === studentId);
      if (idx === -1) return prev;
      const [moved] = next[fromGroup].splice(idx, 1);
      next[toGroup].push(moved);
      return next;
    });
  };

  const snapshotNames = (): Record<string, string> => {
    const map: Record<string, string> = {};
    students.forEach((s) => {
      map[s.id] = formatPickName(s);
    });
    return map;
  };

  const handleSave = async (name: string) => {
    setError("");
    setNotice("");
    if (groups.length === 0) {
      setError("저장할 모둠 결과가 없습니다. 먼저 모둠 뽑기를 실행해 주세요.");
      playError();
      return;
    }
    const existing = sets.find((s) => s.id === loadedId && s.name === name);
    const res = await saveGroupSet({
      id: existing?.id,
      name,
      mode,
      genderMode: separateGender ? "separate" : "ignore",
      groupsJson: JSON.stringify(groups.map((g) => g.map((s) => s.id))),
      namesJson: JSON.stringify(snapshotNames()),
    });
    if (!res.success) {
      setError(res.error);
      playError();
      return;
    }
    setSets((prev) => {
      const without = prev.filter((s) => s.id !== res.data.id);
      return [
        {
          id: res.data.id,
          name: res.data.name,
          mode: res.data.mode,
          genderMode: res.data.genderMode,
          groupsJson: res.data.groupsJson,
          namesJson: res.data.namesJson,
        },
        ...without,
      ];
    });
    setLoadedId(res.data.id);
    setNotice(`'${name}' 모둠을 저장했습니다.`);
  };

  const handleLoad = (id: string) => {
    const target = sets.find((s) => s.id === id);
    if (!target) return;
    try {
      const idGroups = JSON.parse(target.groupsJson) as string[][];
      const names = JSON.parse(target.namesJson) as Record<string, string>;
      const restored = idGroups.map((g) =>
        g.map((sid) => {
          const live = byId.get(sid);
          if (live) return live;
          return {
            id: sid,
            studentNumber: 0,
            name: `${names[sid] ?? "알 수 없음"} (전학/삭제)`,
            gender: null,
            status: "ABSENT",
          } satisfies PickStudent;
        })
      );
      setGroups(restored);
      setMode(target.mode === "custom" ? "custom" : "count");
      setSeparateGender(target.genderMode === "separate");
      setLoadedId(id);
      setNotice(`'${target.name}' 모둠을 불러왔습니다.`);
      setError("");
    } catch {
      setError("저장된 모둠 데이터를 읽지 못했습니다.");
      playError();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteGroupSet(id);
    if (!res.success) {
      setError(res.error);
      playError();
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (loadedId === id) setLoadedId("");
    setNotice("모둠 결과를 삭제했습니다.");
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          {(
            [
              { v: "count", label: "모둠 수 지정" },
              { v: "size", label: "모둠당 인원" },
              { v: "custom", label: "직접 입력" },
            ] as { v: Mode; label: string }[]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === o.v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          {mode === "count" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">모둠 수</label>
              <input
                type="number"
                min={1}
                value={countValue}
                onChange={(e) => setCountValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          {mode === "size" && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">모둠당 인원</label>
              <input
                type="number"
                min={1}
                value={sizeValue}
                onChange={(e) => setSizeValue(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          {mode === "custom" && (
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                각 모둠 인원 (예: 4,4,5 — 합계가 선택 인원과 일치해야 함)
              </label>
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="4,4,5"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pb-2.5 whitespace-nowrap">
            <input
              type="checkbox"
              checked={separateGender}
              onChange={(e) => setSeparateGender(e.target.checked)}
              className="accent-indigo-600"
            />
            남녀 균등 분산
          </label>
          <button
            type="button"
            onClick={runDraw}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 sm:ml-auto"
          >
            <Users className="w-4 h-4" />
            모둠 뽑기
          </button>
        </div>
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

      {groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">학생을 드래그해 모둠 간 이동 가능</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group, gi) => (
              <div
                key={gi}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const raw = e.dataTransfer.getData("text/pick-student");
                    if (!raw) return;
                    const parsed = JSON.parse(raw) as { studentId: string; fromGroup: number };
                    moveStudent(parsed.studentId, parsed.fromGroup, gi);
                  } catch {
                    // 드롭 데이터 무시
                  }
                }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 min-h-[120px]"
              >
                <h4 className="text-xs font-bold text-indigo-700 mb-2">
                  {gi + 1}모둠 ({group.length}명)
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.map((s) => (
                    <span
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "text/pick-student",
                          JSON.stringify({ studentId: s.id, fromGroup: gi })
                        );
                      }}
                      className="text-xs px-2 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium flex items-center gap-1 cursor-grab active:cursor-grabbing"
                      title="드래그해 다른 모둠으로 이동"
                    >
                      <GripVertical className="w-3 h-3 text-slate-400" />
                      {s.studentNumber > 0 ? formatPickName(s) : s.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveBar
        items={sets}
        placeholder="모둠 결과 이름 (예: 1학기 모둠)"
        defaultName=""
        onSave={handleSave}
        onLoad={handleLoad}
        onDelete={handleDelete}
      />

      <DrawOverlay
        open={overlayOpen}
        title="모둠 뽑기"
        rollingNames={rollingNames}
        results={overlayResults}
        onRedraw={runDraw}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  );
}
