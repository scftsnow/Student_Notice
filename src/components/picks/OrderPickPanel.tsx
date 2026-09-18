"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { ListOrdered, ExternalLink, Bookmark, History } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import PickSaveBar from "./PickSaveBar";
import { PresetLibrarySection, PresetRowShell } from "./PresetLibrary";
import { formatPickName } from "@/lib/pickFormat";
import { shuffle } from "@/lib/pickRandom";
import { playError } from "@/lib/pickSound";
import { openPickWindow } from "@/lib/pickWindowHelper";
import type { PickStudent } from "@/types";
import type { SavedOrderPreset } from "@/types/classroom";

interface OrderPickPanelProps {
  students: PickStudent[];
  savedOrders: SavedOrderPreset[];
  onSaveOrderPreset: (name: string, order: string[]) => void;
  onDeleteOrderPreset: (id: string) => void;
  onPushRecentOrder: (order: string[]) => void;
  onUpdateOrderPreset: (id: string, name: string, order: string[]) => void;
}

export default function OrderPickPanel({
  students,
  savedOrders,
  onSaveOrderPreset,
  onDeleteOrderPreset,
  onPushRecentOrder,
  onUpdateOrderPreset,
}: OrderPickPanelProps) {
  const defaultIds = useMemo(() => students.map((s) => s.id), [students]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [presetName, setPresetName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ordered, setOrdered] = useState<PickStudent[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingOrder, setEditingOrder] = useState<string[]>([]);
  const dragIdxRef = useRef<number | null>(null);
  // 드래그 중 표시용: 잡은 칩과 끼워 넣을 위치
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropPos, setDropPos] = useState<{ index: number; after: boolean } | null>(null);

  const manualPresets = useMemo(() => savedOrders.filter((p) => !p.auto), [savedOrders]);
  const recentPresets = useMemo(() => savedOrders.filter((p) => p.auto).slice(0, 3), [savedOrders]);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  const rollingNames = useMemo(() => selected.map(formatPickName), [selected]);

  const runDraw = useCallback(() => {
    setError("");
    setNotice("");
    if (selected.length < 2) {
      setError("순서를 뽑으려면 학생을 2명 이상 선택해 주세요.");
      playError();
      return;
    }
    const shuffled = shuffle(selected);
    setOrdered(shuffled);
    onPushRecentOrder(shuffled.map((s) => s.name));

    openPickWindow({
      id: `pick-order-${Date.now()}`,
      type: "order",
      title: "순서 뽑기",
      rollingNames,
      results: shuffled.map((s) => formatPickName(s)),
    });
  }, [selected, rollingNames, onPushRecentOrder]);

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

  // 프리셋 수정 (이름·드래그 순서 변경)
  const startRename = (preset: SavedOrderPreset) => {
    setEditingId(preset.id);
    setEditingName(preset.name);
    setEditingOrder([...preset.order]);
    setError("");
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
    setEditingOrder([]);
    dragIdxRef.current = null;
    setDragIdx(null);
    setDropPos(null);
  };
  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError("변경할 순서 이름을 입력해 주세요.");
      return;
    }
    if (editingOrder.length === 0) {
      setError("순서에 포함할 학생이 없습니다.");
      return;
    }
    setError("");
    onUpdateOrderPreset(editingId, trimmed, editingOrder);
    setEditingId(null);
    setEditingName("");
    setEditingOrder([]);
    dragIdxRef.current = null;
    setDragIdx(null);
    setDropPos(null);
  };
  // 잡은 칩을 빼고 toIndex 자리에 끼워 넣기
  const moveEditChipTo = (from: number, toIndex: number) => {
    setEditingOrder((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      const without = prev.filter((_, idx) => idx !== from);
      const clamped = Math.max(0, Math.min(toIndex, without.length));
      return [...without.slice(0, clamped), prev[from], ...without.slice(clamped)];
    });
  };
  const clearDragState = () => {
    dragIdxRef.current = null;
    setDragIdx(null);
    setDropPos(null);
  };

  // 저장된 순서를 live 결과에 불러오기 (모둠/자리와 동일한 프리셋 재사용 흐름)
  const handleLoadPreset = (preset: SavedOrderPreset) => {
    const restored = preset.order
      .map((name) => students.find((s) => s.name === name))
      .filter((s): s is PickStudent => s !== undefined);
    if (restored.length === 0) {
      setError("불러올 학생이 없습니다 (명단에서 삭제됐을 수 있습니다).");
      return;
    }
    setOrdered(restored);
    setNotice(`'${preset.name}' 순서를 불러왔습니다.`);
    setError("");
  };

  // 프리셋 행 (수동 저장·최근 자동 저장 공통 — 공용 껍데기 PresetRowShell 사용)
  const renderPresetRow = (preset: SavedOrderPreset) => (
    <PresetRowShell
      key={preset.id}
      presetId={preset.id}
      presetName={preset.name}
      auto={preset.auto}
      statText={`${preset.order.length}명`}
      editing={editingId === preset.id}
      editingName={editingName}
      onEditingNameChange={setEditingName}
      onStartRename={() => startRename(preset)}
      onCommitRename={commitRename}
      onCancelRename={cancelRename}
      onDelete={() => {
        if (editingId === preset.id) cancelRename();
        onDeleteOrderPreset(preset.id);
      }}
      deleteConfirmMessage={`'${preset.name}' 순서 프리셋을 삭제하시겠습니까?`}
      summary={<p className="text-xs text-slate-500 leading-loose">{preset.order.join(" → ")}</p>}
      editContent={
        <div className="space-y-1.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            onDragLeave={() => setDropPos(null)}
            onDrop={(e) => {
              e.preventDefault();
              clearDragState();
            }}
          >
            {editingOrder.map((name, i) => (
              <span key={`${name}-${i}`} className="flex items-center">
                {dropPos?.index === i && !dropPos.after && (
                  <span className="w-1 self-stretch rounded-full bg-indigo-500 mr-1 animate-pulse" />
                )}
                <span
                  draggable
                  onDragStart={(e) => {
                    dragIdxRef.current = i;
                    setDragIdx(i);
                    setDropPos(null);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const after = e.clientX > rect.left + rect.width / 2;
                    setDropPos((prev) =>
                      prev?.index === i && prev.after === after ? prev : { index: i, after }
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const from = dragIdxRef.current;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const after = e.clientX > rect.left + rect.width / 2;
                    clearDragState();
                    if (from === null || from === i) return;
                    moveEditChipTo(from, after ? (from < i ? i : i + 1) : from < i ? i - 1 : i);
                  }}
                  onDragEnd={clearDragState}
                  className={`inline-flex items-center gap-1.5 text-xs pl-1.5 pr-2.5 py-1 rounded-lg bg-white border text-slate-800 font-bold cursor-grab active:cursor-grabbing transition-all select-none ${
                    dragIdx === i
                      ? "opacity-40 border-indigo-400"
                      : "border-indigo-300 hover:border-indigo-500 hover:shadow-sm"
                  }`}
                  title="드래그로 순서 이동"
                >
                  <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[11px] font-extrabold font-mono flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-center">{name}</span>
                </span>
                {dropPos?.index === i && dropPos.after && (
                  <span className="w-1 self-stretch rounded-full bg-indigo-500 ml-1 animate-pulse" />
                )}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">이름 배지를 드래그해서 순서를 바꾸세요.</p>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={() => handleLoadPreset(preset)}
          className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-bold transition-colors"
        >
          이 순서 불러오기
        </button>
      }
    />
  );
  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) {
      setError("저장할 순서 이름을 입력해 주세요 (예: 1학기 청소 순번).");
      return;
    }
    if (ordered.length === 0) {
      setError("저장할 순서가 없습니다. 먼저 순서 뽑기를 실행해 주세요.");
      return;
    }
    setError("");
    onSaveOrderPreset(
      trimmed,
      ordered.map((s) => s.name)
    );
    setNotice(`순서 프리셋 '${trimmed}'이(가) 저장되었습니다. [학생 업무 추가/수정]에서 선택할 수 있습니다.`);
    setPresetName("");
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            선택된 학생 <span className="font-bold text-indigo-600 font-mono">{selected.length}</span>명의 무작위 순서를 추첨합니다.
          </div>
          <button
            type="button"
            onClick={runDraw}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <ListOrdered className="w-4 h-4" />
            <span>순서 뽑기 (별도 창)</span>
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

      {/* 뽑힌 순서 결과 및 프리셋 저장 영역 */}
      {ordered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">방금 뽑힌 순서 ({ordered.length}명)</h3>
              <p className="text-xs text-slate-400">
                이 순서를 이름과 함께 저장해 두면, [학생 업무 추가/수정]에서 언제든 불러올 수 있습니다.
                뽑기 결과는 아래 최근 자동 저장에도 보관됩니다.
              </p>
            </div>
          </div>

          {/* 순서 이름 입력 및 저장 바 (공용 PickSaveBar) */}
          <PickSaveBar
            value={presetName}
            onChange={setPresetName}
            onSave={handleSavePreset}
            placeholder="저장할 순서 이름 (예: 1학기 급식 순번, 발표 순서)"
            buttonLabel="순서 프리셋 저장"
          />

          {/* 순서 흐름 뷰 (저장 프리셋 목록과 동일한 → 형식) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="inline-block text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
              {ordered.length}명
            </span>
            <p className="text-xs text-slate-700 leading-loose">
              {ordered.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && <span className="text-slate-300 font-bold mx-1">→</span>}
                  <span className="font-bold text-slate-800">{formatPickName(s)}</span>
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* 저장된 순서 프리셋 라이브러리 목록 */}
      <PresetLibrarySection
        icon={<Bookmark className="w-4 h-4 text-indigo-600" />}
        title={`저장된 순서 프리셋 목록 (${manualPresets.length}개)`}
        empty={manualPresets.length === 0}
        emptyText={
          <>
            저장된 순서 프리셋이 없습니다. 위에서 순서를 추첨한 후 이름을 붙여 저장해 보세요.
            <br />
            저장된 순서는 <strong>[학생 업무 추가/수정]</strong> 모달에서 손쉽게 불러올 수 있습니다.
          </>
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
            아직 자동 저장된 순서가 없습니다. 순서 뽑기를 실행하면 최근 3개가 자동 보관됩니다.
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
