"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Users, Shuffle, ExternalLink, Bookmark, History } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import PickSaveBar from "./PickSaveBar";
import { PresetLibrarySection, PresetRowShell } from "./PresetLibrary";
import { dealGroups, parseGroupSizes } from "@/lib/pickRandom";
import { formatPickName } from "@/lib/pickFormat";
import { playError } from "@/lib/pickSound";
import { openPickWindow } from "@/lib/pickWindowHelper";
import type { PickStudent } from "@/types";
import type { SavedGroupPreset } from "@/types/classroom";

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
  savedGroups: SavedGroupPreset[];
  onSaveGroupPreset: (name: string, groups: string[][]) => void;
  onDeleteGroupPreset: (id: string) => void;
  onPushRecentGroups: (groups: string[][]) => void;
  onUpdateGroupPreset: (id: string, name: string, groups: string[][]) => void;
}

type Mode = "count" | "size" | "custom";

function evenSplit(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

export default function GroupPickPanel({
  students,
  savedGroups,
  onSaveGroupPreset,
  onDeleteGroupPreset,
  onPushRecentGroups,
  onUpdateGroupPreset,
}: GroupPickPanelProps) {
  const defaultIds = useMemo(() => students.map((s) => s.id), [students]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [mode, setMode] = useState<Mode>("count");
  const [countValue, setCountValue] = useState(4);
  const [sizeValue, setSizeValue] = useState(4);
  const [customText, setCustomText] = useState("");
  const [separateGender, setSeparateGender] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groups, setGroups] = useState<PickStudent[][]>([]);
  const [presetName, setPresetName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingGroups, setEditingGroups] = useState<string[][]>([]);
  const dragCellRef = useRef<{ gi: number; ci: number } | null>(null);
  const [dragCell, setDragCell] = useState<{ gi: number; ci: number } | null>(null);
  const [dropCell, setDropCell] = useState<{ gi: number; ci: number; after: boolean } | null>(null);

  const manualPresets = useMemo(() => savedGroups.filter((p) => !p.auto), [savedGroups]);
  const recentPresets = useMemo(() => savedGroups.filter((p) => p.auto).slice(0, 3), [savedGroups]);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  const rollingNames = useMemo(() => selected.map(formatPickName), [selected]);

  const resolveSizes = useCallback((n: number): number[] => {
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
  }, [mode, countValue, sizeValue, customText]);

  const runDraw = useCallback(() => {
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
      onPushRecentGroups(dealt.map((g) => g.map((s) => s.name)));
      const display = dealt.map((g, i) => `${i + 1}모둠: ${g.map((s) => s.name).join(", ")}`);
      openPickWindow({
        id: `pick-group-${Date.now()}`,
        type: "group",
        title: "모둠 뽑기",
        rollingNames,
        results: display,
        groups: dealt.map((g, i) => ({
          label: `${i + 1}모둠`,
          members: g.map((s) => formatPickName(s)),
        })),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "모둠 나누기 중 오류가 발생했습니다.");
      playError();
    }
  }, [selected, resolveSizes, separateGender, rollingNames, onPushRecentGroups]);

  // 별도 창에서 '다시 뽑기' 요청 시 재추첨 실행
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_pick_sync");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "REQUEST_REDRAW") {
          runDraw();
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (channel) channel.close();
    };
  }, [runDraw]);

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

  // 뽑힌 모둠 프리셋 저장
  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) {
      setError("저장할 모둠 이름을 입력해 주세요 (예: 1학기 모둠).");
      return;
    }
    if (groups.length === 0) {
      setError("저장할 모둠 결과가 없습니다. 먼저 모둠 뽑기를 실행해 주세요.");
      return;
    }
    setError("");
    onSaveGroupPreset(
      trimmed,
      groups.map((g) => g.map((s) => s.name))
    );
    setNotice(`모둠 프리셋 '${trimmed}'이(가) 저장되었습니다.`);
    setPresetName("");
  };

  // 프리셋 수정 (이름·드래그 모둠/순서 변경)
  const startRename = (preset: SavedGroupPreset) => {
    setEditingId(preset.id);
    setEditingName(preset.name);
    setEditingGroups(preset.groups.map((g) => [...g]));
    setError("");
  };
  const clearDragCell = () => {
    dragCellRef.current = null;
    setDragCell(null);
    setDropCell(null);
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
    setEditingGroups([]);
    clearDragCell();
  };
  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError("변경할 모둠 이름을 입력해 주세요.");
      return;
    }
    if (editingGroups.flat().length === 0) {
      setError("모둠에 포함할 학생이 없습니다.");
      return;
    }
    setError("");
    onUpdateGroupPreset(editingId, trimmed, editingGroups);
    setEditingId(null);
    setEditingName("");
    setEditingGroups([]);
    clearDragCell();
  };
  // 잡은 배지를 빼고 (gi, ci) 자리에 끼워 넣기
  const moveEditMember = (
    from: { gi: number; ci: number },
    to: { gi: number; ci: number }
  ) => {
    setEditingGroups((prev) => {
      if (
        from.gi < 0 || from.gi >= prev.length ||
        from.ci < 0 || from.ci >= (prev[from.gi]?.length ?? 0) ||
        to.gi < 0 || to.gi >= prev.length
      ) {
        return prev;
      }
      const next = prev.map((g) => [...g]);
      const [moved] = next[from.gi].splice(from.ci, 1);
      if (moved === undefined) return prev;
      const target = next[to.gi];
      const clamped = Math.max(0, Math.min(to.ci, target.length));
      target.splice(clamped, 0, moved);
      return next;
    });
  };
  const dropIndexFor = (
    from: { gi: number; ci: number },
    gi: number,
    ci: number,
    after: boolean
  ): number => {
    if (from.gi === gi) {
      if (from.ci === ci) return ci;
      return after ? (from.ci < ci ? ci : ci + 1) : from.ci < ci ? ci - 1 : ci;
    }
    return after ? ci + 1 : ci;
  };

  // 저장된 모둠을 live 영역에 불러오기
  const handleLoadPreset = (preset: SavedGroupPreset) => {
    const restored = preset.groups.map((g) =>
      g
        .map((name) => students.find((s) => s.name === name))
        .filter((s): s is PickStudent => s !== undefined)
    );
    if (restored.flat().length === 0) {
      setError("불러올 학생이 없습니다 (명단에서 삭제됐을 수 있습니다).");
      return;
    }
    setGroups(restored);
    setNotice(`'${preset.name}' 모둠을 불러왔습니다.`);
    setError("");
  };

  const totalMembers = (preset: SavedGroupPreset) =>
    preset.groups.reduce((n, g) => n + g.length, 0);

  // 프리셋 행 (수동 저장·최근 자동 저장 공통 — 공용 껍데기 PresetRowShell 사용)
  const renderPresetRow = (preset: SavedGroupPreset) => (
    <PresetRowShell
      key={preset.id}
      presetId={preset.id}
      presetName={preset.name}
      auto={preset.auto}
      statText={`${preset.groups.length}모둠 · ${totalMembers(preset)}명`}
      editing={editingId === preset.id}
      editingName={editingName}
      onEditingNameChange={setEditingName}
      onStartRename={() => startRename(preset)}
      onCommitRename={commitRename}
      onCancelRename={cancelRename}
      onDelete={() => {
        if (editingId === preset.id) cancelRename();
        onDeleteGroupPreset(preset.id);
      }}
      deleteConfirmMessage={`'${preset.name}' 모둠 프리셋을 삭제하시겠습니까?`}
      summary={
        <p className="text-xs text-slate-600 leading-loose">
          {preset.groups.map((g, gi) => (
            <span key={gi}>
              {gi > 0 && <span className="text-slate-300 font-bold mx-1">·</span>}
              <span className="font-bold text-indigo-700">{gi + 1}모둠: </span>
              {g.join(", ")}
            </span>
          ))}
        </p>
      }
      editContent={
        <div className="space-y-1.5">
          <div
            className="flex items-center gap-2 flex-nowrap overflow-x-auto py-0.5 min-h-[30px]"
            onDragLeave={() => setDropCell(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragCellRef.current;
              clearDragCell();
              if (!from) return;
              moveEditMember(from, { gi: editingGroups.length - 1, ci: 999 });
            }}
          >
            {editingGroups.map((g, gi) => (
              <span
                key={gi}
                className={`flex items-center gap-1.5 shrink-0${
                  gi > 0 ? " ml-2 pl-3 border-l-2 border-indigo-100" : ""
                }`}
              >
                <span className="shrink-0 text-[11px] font-bold text-indigo-700 whitespace-nowrap">
                  {gi + 1}모둠
                </span>
                {g.map((name, ci) => (
                  <span key={`${name}-${gi}-${ci}`} className="flex items-center shrink-0">
                    {dropCell?.gi === gi && dropCell.ci === ci && !dropCell.after && (
                      <span className="w-1 self-stretch rounded-full bg-indigo-500 mr-1 animate-pulse" />
                    )}
                    <span
                      draggable
                      onDragStart={(e) => {
                        dragCellRef.current = { gi, ci };
                        setDragCell({ gi, ci });
                        setDropCell(null);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const after = e.clientX > rect.left + rect.width / 2;
                        setDropCell((prev) =>
                          prev?.gi === gi && prev.ci === ci && prev.after === after
                            ? prev
                            : { gi, ci, after }
                        );
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const from = dragCellRef.current;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const after = e.clientX > rect.left + rect.width / 2;
                        clearDragCell();
                        if (!from) return;
                        if (from.gi === gi && from.ci === ci) return;
                        moveEditMember(from, { gi, ci: dropIndexFor(from, gi, ci, after) });
                      }}
                      onDragEnd={clearDragCell}
                      className={`inline-flex items-center justify-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white border text-slate-800 font-bold cursor-grab active:cursor-grabbing transition-all select-none text-center ${
                        dragCell?.gi === gi && dragCell.ci === ci
                          ? "opacity-40 border-indigo-400"
                          : "border-indigo-300 hover:border-indigo-500 hover:shadow-sm"
                      }`}
                      title="드래그로 모둠·순서 이동"
                    >
                      {name}
                    </span>
                    {dropCell?.gi === gi && dropCell.ci === ci && dropCell.after && (
                      <span className="w-1 self-stretch rounded-full bg-indigo-500 ml-1 animate-pulse" />
                    )}
                  </span>
                ))}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            이름 배지를 드래그해서 모둠과 순서를 바꾸세요 (빈 모둠은 저장 시 제외).
          </p>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={() => handleLoadPreset(preset)}
          className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-bold transition-colors"
        >
          이 모둠 불러오기
        </button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit shrink-0">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                mode === o.v
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {mode === "count" && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">모둠 수</span>
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
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">모둠당 인원</span>
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
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">각 모둠 인원</span>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="4,4,5 (합계 = 선택 인원)"
              title="각 모둠 인원 — 합계가 선택 인원과 일치해야 합니다"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer whitespace-nowrap shrink-0">
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
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 sm:ml-auto transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Users className="w-4 h-4" />
          <span>모둠 뽑기 (별도 창)</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>
      </PickTargetSelector>

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              방금 나눈 모둠 ({groups.length}모둠)
            </h3>
            <button
              type="button"
              onClick={runDraw}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1"
            >
              <Shuffle className="w-3.5 h-3.5" />
              다시 섞기
            </button>
          </div>

          {/* 모둠 이름 입력 및 저장 바 (공용 PickSaveBar) */}
          <PickSaveBar
            value={presetName}
            onChange={setPresetName}
            onSave={handleSavePreset}
            placeholder="저장할 모둠 이름 (예: 1학기 모둠)"
            buttonLabel="모둠 프리셋 저장"
          />

          <p className="text-xs text-slate-400">학생을 드래그해 모둠 간 이동 가능</p>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto py-0.5">
              {groups.map((group, gi) => (
                <span
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
                  className={`flex items-center gap-1.5 shrink-0${
                    gi > 0 ? " ml-2 pl-3 border-l-2 border-indigo-100" : ""
                  }`}
                >
                  <span className="shrink-0 text-[11px] font-bold text-indigo-700 whitespace-nowrap">
                    {gi + 1}모둠
                  </span>
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
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:shadow-sm transition-all whitespace-nowrap"
                      title="드래그해 다른 모둠으로 이동"
                    >
                      {formatPickName(s)}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 저장된 모둠 프리셋 목록 */}
      <PresetLibrarySection
        icon={<Bookmark className="w-4 h-4 text-indigo-600" />}
        title={`저장된 모둠 프리셋 목록 (${manualPresets.length}개)`}
        empty={manualPresets.length === 0}
        emptyText={
          <>저장된 모둠 프리셋이 없습니다. 위에서 모둠을 나눈 후 이름을 붙여 저장해 보세요.</>
        }
      >
        {manualPresets.map(renderPresetRow)}
      </PresetLibrarySection>

      {/* 최근 자동 저장 (최대 3개) */}
      <PresetLibrarySection
        icon={<History className="w-4 h-4 text-amber-600" />}
        title={`최근 자동 저장 (${recentPresets.length}/3개)`}
        empty={recentPresets.length === 0}
        emptyText={
          <>
            아직 자동 저장된 모둠이 없습니다. 모둠 뽑기를 실행하면 최근 3개가 자동 보관됩니다.
            <br />
            연필 아이콘으로 이름을 지정하면 프리셋으로 저장됩니다.
          </>
        }
      >
        {recentPresets.map(renderPresetRow)}
      </PresetLibrarySection>
    </div>
  );
}
