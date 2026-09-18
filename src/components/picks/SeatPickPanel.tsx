"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Armchair,
  Bookmark,
  Dices,
  Eraser,
  Eye,
  EyeOff,
  ExternalLink,
  History,
  X,
} from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import PickSaveBar from "./PickSaveBar";
import SeatGuide from "./SeatGuide";
import SeatGrid from "./SeatGrid";
import StudentPool from "./StudentPool";
import SeatMiniCanvas from "./SeatMiniCanvas";
import { PresetLibrarySection, PresetRowShell } from "./PresetLibrary";
import { useSeatPick } from "@/hooks/useSeatPick";
import { formatPickName } from "@/lib/pickFormat";
import { serializeSeatCells, seatGridRowCount } from "@/lib/seatFree";import { playError } from "@/lib/pickSound";
import { openPickWindow } from "@/lib/pickWindowHelper";
import type { PickSeatCell } from "@/lib/pickWindowHelper";
import type { PickStudent, SeatCellState } from "@/types";
import type { SavedSeatPreset } from "@/types/classroom";

interface SeatPickPanelProps {
  students: PickStudent[];
  savedSeats: SavedSeatPreset[];
  onSaveSeatPreset: (name: string, cells: SeatCellState[]) => void;
  onDeleteSeatPreset: (id: string) => void;
  onPushRecentSeats: (cells: SeatCellState[]) => void;
  onUpdateSeatPreset: (id: string, name: string, cells: SeatCellState[]) => void;
}

/** 프리셋 셀(division/col)에서 분단·열수 추론 (표시·분단/열수 입력 보정용) */
function inferGridConfig(
  cells: SeatCellState[]
): { divisions: number; colsPerDivision: number } | null {
  if (cells.length === 0) return null;
  const divisions = Array.from(new Set(cells.map((c) => c.division)));
  if (divisions.length === 0) return null;
  let colsPerDivision = 0;
  for (const div of divisions) {
    const cols = cells.filter((c) => c.division === div).map((c) => c.col);
    colsPerDivision = Math.max(colsPerDivision, Math.max(...cols) - Math.min(...cols) + 1);
  }
  return { divisions: divisions.length, colsPerDivision: Math.max(1, colsPerDivision) };
}

export default function SeatPickPanel({
  students,
  savedSeats,
  onSaveSeatPreset,
  onDeleteSeatPreset,
  onPushRecentSeats,
  onUpdateSeatPreset,
}: SeatPickPanelProps) {
  const defaultIds = useMemo(() => students.map((s) => s.id), [students]);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  /** 자유 캔버스 위치 오버라이드 (key → % 좌표). hook 셀 x/y 위에 덮어씀. 틀 재생성·불러오기 시 초기화. */
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>({});
  /** 터치 대응: 풀에서 탭으로 집어든 학생 id */
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [presetName, setPresetName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCells, setEditingCells] = useState<SeatCellState[]>([]);
  /** 생성/랜덤 배치 직후 다음 렌더의 cells를 자동 보관 1회 실행하는 플래그 */
  const autoSaveRef = useRef(false);

  const seat = useSeatPick();
  const { config } = seat;

  /** hook 셀 + 자유 이동분 병합. 런타임 셀은 항상 x/y가 채워져 있다. */
  const displayCells = useMemo(
    () =>
      seat.cells.map((c) => {
        const o = posOverrides[c.key];
        return o ? { ...c, x: o.x, y: o.y } : c;
      }),
    [seat.cells, posOverrides]
  );

  // 자동 보관: 그리드 생성/랜덤 배치 직후 실제 렌더된 cells 스냅샷을 1회 저장 (auto 3개 유지는 상태 레이어 담당)
  useEffect(() => {
    if (!autoSaveRef.current) return;
    autoSaveRef.current = false;
    onPushRecentSeats(displayCells);
  }, [seat.cells, displayCells, onPushRecentSeats]);

  const manualPresets = useMemo(() => savedSeats.filter((p) => !p.auto), [savedSeats]);
  const recentPresets = useMemo(() => savedSeats.filter((p) => p.auto).slice(0, 3), [savedSeats]);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((s): s is PickStudent => s !== undefined),
    [selectedIds, byId]
  );
  const rollingNames = useMemo(() => selected.map(formatPickName), [selected]);
  const unplaced = seat.unplacedIds(selected);

  const lookup = (id: string | null): PickStudent | null => {
    if (!id) return null;
    return byId.get(id) ?? null;
  };
  const displayName = (id: string | null): string => {
    if (!id) return "";
    const live = byId.get(id);
    return live ? formatPickName(live) : "?";
  };

  const showError = (msg: string) => {
    seat.setError(msg);
    setNotice("");
    playError();
  };

  const handleBuild = () => {
    setNotice("");
    if (selected.length === 0) {
      showError("자리에 앉힐 학생을 1명 이상 선택해 주세요.");
      return;
    }
    setPosOverrides({});
    setSelectedPoolId(null);
    const ok = seat.buildCells(selected.length);
    autoSaveRef.current = ok;
  };

  const clamp100 = (n: number): number => {
    if (!Number.isFinite(n)) return 50;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
  };

  const handlePositionChange = (key: string, x: number, y: number) => {
    setPosOverrides((prev) => ({ ...prev, [key]: { x: clamp100(x), y: clamp100(y) } }));
  };

  /** 풀 학생을 빈 캔버스 지점에 배치: 가장 가까운 빈자리 셀에 고정 + 해당 셀을 지점으로 이동. */
  const handleCanvasDropStudent = (studentId: string, x: number, y: number) => {
    const px = clamp100(x);
    const py = clamp100(y);
    const at = (c: { x?: number; y?: number }) => ({
      x: typeof c.x === "number" && Number.isFinite(c.x) ? c.x : 50,
      y: typeof c.y === "number" && Number.isFinite(c.y) ? c.y : 50,
    });
    const enabled = displayCells.filter((c) => c.enabled);
    if (enabled.length === 0) {
      showError("배치할 수 있는 자리가 없습니다. 먼저 자리를 생성해 주세요.");
      return;
    }
    const empty = enabled.filter((c) => !c.studentId);
    const pool = empty.length > 0 ? empty : enabled;
    let best = pool[0];
    let bestDist = Infinity;
    for (const c of pool) {
      const p = at(c);
      const dist = Math.hypot(p.x - px, p.y - py);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    seat.dropStudentOnCell(best.key, studentId);
    handlePositionChange(best.key, px, py);
    setSelectedPoolId(null);
  };

  const handleDraw = useCallback(() => {
    setNotice("");
    setSelectedPoolId(null);
    const next = seat.randomAssign(selected);
    if (next) {
      autoSaveRef.current = true;
      const merged = next.map((c) => {
        const o = posOverrides[c.key];
        return o ? { ...c, x: o.x, y: o.y } : c;
      });
      const placed = merged
        .filter((c) => c.studentId)
        .map((c) => {
          const live = byId.get(c.studentId as string);
          const who = live ? formatPickName(live) : "?";
          return `${who} → ${c.division + 1}분단 ${c.row + 1}행`;
        });
      const seatCells: PickSeatCell[] = merged.map((c) => {
        const live = c.studentId ? byId.get(c.studentId) : undefined;
        return {
          key: c.key,
          x: typeof c.x === "number" && Number.isFinite(c.x) ? c.x : 50,
          y: typeof c.y === "number" && Number.isFinite(c.y) ? c.y : 50,
          label: live ? formatPickName(live) : "",
          enabled: c.enabled,
          lockedGender: c.lockedGender,
        };
      });
      openPickWindow({
        id: `pick-seat-${Date.now()}`,
        type: "seat",
        title: "자리 뽑기",
        rollingNames: selected.map(formatPickName),
        results: placed.length > 0 ? placed : selected.map(formatPickName),
        seatCells,
      });
    } else {
      playError();
    }
  }, [seat, selected, byId, posOverrides]);

  // 별도 창에서 '다시 뽑기' 요청 시 재추첨 실행
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_pick_sync");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "REQUEST_REDRAW") {
          handleDraw();
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (channel) channel.close();
    };
  }, [handleDraw]);

  // ---- 로컬 프리셋 (DB SaveBar 대체) ----
  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) {
      showError("저장할 자리 이름을 입력해 주세요 (예: 3월 자리).");
      return;
    }
    if (displayCells.length === 0) {
      showError("저장할 자리가 없습니다. 먼저 자리를 생성해 주세요.");
      return;
    }
    setNotice("");
    onSaveSeatPreset(trimmed, displayCells);
    setNotice(`자리 프리셋 '${trimmed}'이(가) 저장되었습니다.`);
    setPresetName("");
  };

  const startRename = (preset: SavedSeatPreset) => {
    setEditingId(preset.id);
    setEditingName(preset.name);
    setEditingCells(preset.cells.map((c) => ({ ...c })));
    setNotice("");
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
    setEditingCells([]);
  };
  const commitRename = () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      showError("변경할 자리 이름을 입력해 주세요.");
      return;
    }
    const target = savedSeats.find((p) => p.id === editingId);
    setNotice("");
    onUpdateSeatPreset(editingId, trimmed, editingCells.length > 0 ? editingCells : (target?.cells ?? []));
    setEditingId(null);
    setEditingName("");
    setEditingCells([]);
  };
  /** 편집 중 배치 비우기 (틀은 유지, 해당 학생만 빼기) */
  const removeEditingMember = (studentId: string) => {
    setEditingCells((prev) =>
      prev.map((c) =>
        c.studentId === studentId ? { ...c, studentId: null, fixedStudentId: null } : c
      )
    );
  };
  /** 편집 중 배치된 학생 이름 (명단을 떠난 학생은 저장된 이름 그대로) */
  const editingMemberName = (studentId: string): string => {
    const live = byId.get(studentId);
    return live ? formatPickName(live) : studentId;
  };

  /** 프리셋 불러오기: 분단·열수 보정 + 명단에서 빠진 학생 배치 정리 */
  const handleLoadPreset = (preset: SavedSeatPreset) => {
    const cfg = inferGridConfig(preset.cells);
    if (cfg) {
      // 분단당 열수가 홀수면 성별 모드를 사용할 수 없어 무관으로 되돌린다.
      const genderMode =
        cfg.colsPerDivision % 2 === 1 ? "ignore" : config.genderMode;
      seat.setConfig({ ...cfg, fillFrom: config.fillFrom, genderMode });
    }
    const result = seat.loadCellsForRoster(
      serializeSeatCells(preset.cells),
      new Set(students.map((s) => s.name))
    );
    if (result) {
      setPosOverrides({});
      setSelectedPoolId(null);
      setNotice(
        result.dropped > 0
          ? `'${preset.name}' 자리를 불러왔습니다 (전학/삭제 ${result.dropped}자리는 비움).`
          : `'${preset.name}' 자리를 불러왔습니다.`
      );
    } else {
      playError();
    }
  };

  /** 프리셋 미리보기용 읽기 전용 미니 캔버스 셀. 학생은 실명단 기준 이름으로 표시. */
  const toMiniCell = (c: SeatCellState) => {
    const live = c.studentId ? byId.get(c.studentId) : undefined;
    return {
      key: c.key,
      x: typeof c.x === "number" && Number.isFinite(c.x) ? c.x : 50,
      y: typeof c.y === "number" && Number.isFinite(c.y) ? c.y : 50,
      label: live ? formatPickName(live) : "",
      enabled: c.enabled,
      lockedGender: c.lockedGender,
    };
  };

  // 프리셋 행 (수동 저장·최근 자동 저장 공통, 전광판 seat 렌더 재사용 미리보기)
  const renderPresetRow = (preset: SavedSeatPreset) => {
    const enabledCount = preset.cells.filter((c) => c.enabled !== false).length;
    const placedCount = preset.cells.filter((c) => c.studentId !== null).length;
    return (
      <PresetRowShell
        key={preset.id}
        presetId={preset.id}
        presetName={preset.name}
        auto={preset.auto}
        statText={`${enabledCount}석 · ${placedCount}명 배치`}
        editing={editingId === preset.id}
        editingName={editingName}
        onEditingNameChange={setEditingName}
        onStartRename={() => startRename(preset)}
        onCommitRename={commitRename}
        onCancelRename={cancelRename}
        onDelete={() => {
          if (editingId === preset.id) cancelRename();
          onDeleteSeatPreset(preset.id);
        }}
        deleteConfirmMessage={`'${preset.name}' 자리 프리셋을 삭제하시겠습니까?`}
        summary={
          <SeatMiniCanvas cells={preset.cells.map(toMiniCell)} cardWidthPercent={22} rows={seatGridRowCount(preset.cells)} className="max-w-[420px]" />
        }
        editContent={
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {editingCells
                .filter((c) => c.studentId !== null)
                .map((c) => (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-indigo-300 text-slate-800 font-bold select-none"
                  >
                    {editingMemberName(c.studentId as string)}
                    <button
                      type="button"
                      onClick={() => removeEditingMember(c.studentId as string)}
                      className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="이 자리 비우기 (틀 유지)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              {editingCells.every((c) => c.studentId === null) && (
                <span className="text-[11px] text-slate-400">배치된 학생이 없습니다 (빈 틀).</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              ×를 눌러 배치를 비우세요 (틀은 유지됩니다).
            </p>
          </div>
        }
        footer={
          <button
            type="button"
            onClick={() => handleLoadPreset(preset)}
            className="w-full py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-bold transition-colors"
          >
            이 자리 불러오기
          </button>
        }
      />
    );
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-end gap-3">
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">분단 수</label>
            <input
              type="number"
              min={1}
              max={6}
              value={config.divisions}
              onChange={(e) =>
                seat.patchConfig({ divisions: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })
              }
              className="w-16 px-2 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">분단당 열수</label>
            <input
              type="number"
              min={1}
              max={6}
              value={config.colsPerDivision}
              onChange={(e) => {
                const nextCols = Math.max(1, Math.min(6, Number(e.target.value) || 1));
                // 홀수 열에서는 성별 모드를 쓸 수 없어 무관으로 되돌린다.
                seat.patchConfig(
                  nextCols % 2 === 1
                    ? { colsPerDivision: nextCols, genderMode: "ignore" }
                    : { colsPerDivision: nextCols }
                );
              }}
              className="w-16 px-2 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {config.colsPerDivision % 2 === 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">성별</label>
              <select
                value={config.genderMode}
                onChange={(e) =>
                  seat.patchConfig({
                    genderMode:
                      e.target.value === "pair" || e.target.value === "separate"
                        ? e.target.value
                        : "ignore",
                  })
                }
                className="px-2 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="분단당 열수가 짝수일 때만 사용"
              >
                <option value="ignore">무관</option>
                <option value="pair">짝꿍 우선</option>
                <option value="separate">분리</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => seat.setShowFixed(!seat.showFixed)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 border ${
              seat.showFixed
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-white border-slate-200 text-slate-500"
            }`}
            title="켜면 고정 배치 자물쇠가 보입니다"
          >
            {seat.showFixed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            고정 표시
          </button>
          <button
            type="button"
            onClick={handleBuild}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
          >
            <Armchair className="w-3.5 h-3.5" />
            자리 생성
          </button>
          <button
            type="button"
            onClick={handleDraw}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>랜덤 배치 (별도 창)</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </button>
          <button
            type="button"
            onClick={() => {
              seat.clearAssign();
              setNotice("");
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-bold flex items-center gap-1"
            title="배치 지우기 (틀 유지)"
          >
            <Eraser className="w-3.5 h-3.5" />
            지우기
          </button>
        </div>
      </div>
      </PickTargetSelector>

      {seat.showFixed && seat.fixedCount > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <span className="text-xs text-amber-700 font-semibold">
            고정 {seat.fixedCount}자리 (연출 화면에서는 숨겨짐)
          </span>
          <button
            type="button"
            onClick={seat.clearFixed}
            className="text-xs font-bold text-amber-700 hover:text-amber-900"
          >
            고정 전체 해제
          </button>
        </div>
      )}

      {seat.error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          {seat.error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <StudentPool
            students={unplaced}
            selectedId={selectedPoolId}
            onSelect={(id) => setSelectedPoolId((prev) => (prev === id ? null : id))}
          />
          {/* 자리 조작 방법 (동작별 아이콘 카드) */}
          <SeatGuide placedCount={seat.placedCount} />
        </div>
        <div className="min-w-0">
          <SeatGrid
            cells={displayCells}
            divisions={config.divisions}
            showFixed={seat.showFixed}
            lookup={lookup}
            displayName={displayName}
            onCellClick={seat.handleCellClick}
            onCycleGender={seat.cycleGender}
            onDropStudent={seat.dropStudentOnCell}
            onMoveCell={seat.moveCell}
            onClearCell={seat.clearCell}
            onUnfix={seat.unfixCell}
            onPositionChange={handlePositionChange}
            onCanvasDropStudent={handleCanvasDropStudent}
            selectedPoolId={selectedPoolId}
            onSelectPool={setSelectedPoolId}
          />
        </div>
      </div>

      {/* 방금 만든 자리 결과 및 프리셋 저장 영역 (순서/모둠과 동일한 구조) */}
      {displayCells.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              방금 만든 자리 ({displayCells.filter((c) => c.enabled !== false).length}석 ·{" "}
              {seat.placedCount}명 배치)
            </h3>
            <p className="text-xs text-slate-400">
              이 자리를 이름과 함께 저장해 두면 언제든 다시 불러올 수 있습니다.
              자리 생성·랜덤 배치 결과는 아래 최근 자동 저장에도 보관됩니다.
            </p>
          </div>
          <PickSaveBar
            value={presetName}
            onChange={setPresetName}
            onSave={handleSavePreset}
            placeholder="저장할 자리 이름 (예: 3월 자리, 기본형 틀)"
            buttonLabel="자리 프리셋 저장"
          />
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <SeatMiniCanvas cells={displayCells.map(toMiniCell)} rows={seatGridRowCount(displayCells)} className="max-w-[420px]" />
          </div>
        </div>
      )}

      <PresetLibrarySection
        icon={<Bookmark className="w-4 h-4 text-indigo-600" />}
        title={`저장된 자리 프리셋 목록 (${manualPresets.length}개)`}
        empty={manualPresets.length === 0}
        emptyText={
          <>
            저장된 자리 프리셋이 없습니다. 위에서 자리를 만들거나 랜덤 배치한 뒤 이름을 붙여
            저장해 보세요.
          </>
        }
      >
        {manualPresets.map(renderPresetRow)}
      </PresetLibrarySection>

      <PresetLibrarySection
        icon={<History className="w-4 h-4 text-amber-600" />}
        title={`최근 자동 저장 (${recentPresets.length}/3개)`}
        empty={recentPresets.length === 0}
        emptyText={
          <>
            아직 자동 저장된 자리가 없습니다. 자리 생성·랜덤 배치를 실행하면 최근 3개가 자동
            보관됩니다.
            <br />
            연필 아이콘으로 이름을 지정하면 프리셋으로 승격·저장됩니다.
          </>
        }
      >
        {recentPresets.map(renderPresetRow)}
      </PresetLibrarySection>
    </div>
  );
}