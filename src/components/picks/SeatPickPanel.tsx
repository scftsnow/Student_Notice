"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Bookmark,
  Dices,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Printer,
  Save,
  X,
} from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import SeatGuide from "./SeatGuide";
import SeatAvoidPanel from "./SeatAvoidPanel";import SeatGrid from "./SeatGrid";
import StudentPool from "./StudentPool";
import SeatMiniCanvas from "./SeatMiniCanvas";
import { PresetLibrarySection, PresetRowShell } from "./PresetLibrary";
import { useSeatPick } from "@/hooks/useSeatPick";
import { formatPickName } from "@/lib/pickFormat";
import { serializeSeatCells } from "@/lib/seatFree";
import { findSeatViolations } from "@/lib/pickRandom";import { playError } from "@/lib/pickSound";
import { openPickWindow } from "@/lib/pickWindowHelper";
import type { PickSeatCell } from "@/lib/pickWindowHelper";
import type { PickStudent, SeatCellState } from "@/types";
import type { SavedSeatPreset, SeatPresetConfig } from "@/types/classroom";

interface SeatPickPanelProps {
  students: PickStudent[];
  savedSeats: SavedSeatPreset[];
  onSaveSeatPreset: (name: string, cells: SeatCellState[], config?: SeatPresetConfig) => string | undefined;
  onDeleteSeatPreset: (id: string) => void;
  onPushRecentSeats: (cells: SeatCellState[], config?: SeatPresetConfig) => void;
  onUpdateSeatPreset: (id: string, name: string, cells: SeatCellState[]) => void;
}

/** 분단 수별 분단당 열수 상한 (이 조합까지만 지원) */
const MAX_COLS_BY_DIVISIONS: Record<number, number> = {
  1: 8, 2: 4, 3: 3, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1,
};
const DIVISION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

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
  /** 배치 숨기기: 자리배치를 빈 틀처럼 표시 + 분리 메뉴 숨김 (상태는 유지) */
  const [hidePlaced, setHidePlaced] = useState(false);
  /** 보기 방향. teacher면 칠판이 아래에 오도록 뒤집어 표시. */
  const [orientation, setOrientation] = useState<"student" | "teacher">("student");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCells, setEditingCells] = useState<SeatCellState[]>([]);
  /** 자리 저장 팝업 (이름 입력) */
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState("");
  const [saveModalError, setSaveModalError] = useState("");
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

  /** 숨김 표시용: 배치만 가리고 틀·상태는 그대로 (저장·추첨은 실제 값 사용) */
  const gridCells = useMemo(
    () =>
      hidePlaced
        ? displayCells.map((c) => ({ ...c, studentId: null }))
        : displayCells,
    [hidePlaced, displayCells]
  );

  // 자동 보관: 그리드 생성/랜덤 배치 직후 실제 렌더된 cells 스냅샷을 1회 저장 (auto 3개 유지는 상태 레이어 담당)
  useEffect(() => {
    if (!autoSaveRef.current) return;
    autoSaveRef.current = false;
    onPushRecentSeats(displayCells, {
      divisions: config.divisions,
      colsPerDivision: config.colsPerDivision,
      genderMode: config.genderMode,
    });
  }, [seat.cells, displayCells, config, onPushRecentSeats]);

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

  const clamp100 = (n: number): number => {
    if (!Number.isFinite(n)) return 50;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
  };

  const handlePositionChange = (key: string, x: number, y: number) => {
    setPosOverrides((prev) => ({ ...prev, [key]: { x: clamp100(x), y: clamp100(y) } }));
  };

  // 최신 buildCells를 가리키는 ref (자동 생성 effect의 무한 루프 방지)
  const buildRef = useRef(seat.buildCells);
  buildRef.current = seat.buildCells;

  // 설정·대상대로 자리 틀 자동 생성 (자리 생성 버튼 대체).
  // 손댄 틀(배치·이동·여닫음·성별)은 유지하고, 설정·대상 변경 시에만 새 틀로 교체.
  useEffect(() => {
    if (selected.length === 0) return;
    setPosOverrides({});
    buildRef.current(selected.length);
  }, [selected, config.divisions, config.colsPerDivision]);

  const handleDraw = useCallback(() => {
    setNotice("");
    if (selected.length === 0) {
      showError("자리에 앉힐 학생을 1명 이상 선택해 주세요.");
      return;
    }
    const next = seat.randomAssign(selected);
    if (next) {
      autoSaveRef.current = true;
      // 분리 그룹 위반 확인 (best-effort 적용 후 남은 쌍 안내)
      const violations = findSeatViolations(next, seat.avoidGroups);
      if (violations.length > 0) {
        const seen = new Set<string>();
        const pairs: string[] = [];
        for (const v of violations) {
          const key = [v.aName, v.bName].sort().join("–");
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push(key);
          }
        }
        showError(
          `분리 불가 ${pairs.length}쌍 (${pairs.slice(0, 5).join(", ")}${
            pairs.length > 5 ? " 외" : ""
          }): 자리를 수동으로 조정해 주세요.`
        );
      }
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

  // ---- 자리 저장 팝업 ----
  const openSaveModal = () => {
    setNotice("");
    seat.setError("");
    if (displayCells.length === 0) {
      showError("저장할 자리가 없습니다. 먼저 자리를 생성해 주세요.");
      return;
    }
    setSaveModalName("");
    setSaveModalError("");
    setSaveModalOpen(true);
  };
  const commitSaveModal = () => {
    const trimmed = saveModalName.trim();
    if (!trimmed) {
      setSaveModalError("저장할 자리 이름을 입력해 주세요 (예: 3월 자리).");
      return;
    }
    if (displayCells.length === 0) {
      setSaveModalError("저장할 자리가 없습니다. 먼저 자리를 생성해 주세요.");
      return;
    }
    setNotice("");
    const savedAs =
      onSaveSeatPreset(trimmed, displayCells, {
        divisions: config.divisions,
        colsPerDivision: config.colsPerDivision,
        genderMode: config.genderMode,
      }) ?? trimmed;
    setNotice(`자리 프리셋 '${savedAs}'이(가) 저장되었습니다.`);
    setSaveModalOpen(false);
    setSaveModalName("");
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

  /** 프리셋 불러오기: 저장된 분단 설정 그대로 + 명단에서 빠진 학생 배치 정리 */
  const handleLoadPreset = (preset: SavedSeatPreset) => {
    if (preset.config) {
      const cols = Math.max(1, Math.min(8, preset.config.colsPerDivision));
      const gm = preset.config.genderMode;
      seat.setConfig({
        divisions: Math.max(1, Math.min(8, preset.config.divisions)),
        colsPerDivision: cols,
        fillFrom: "back",
        genderMode: cols % 2 === 1 ? "ignore" : gm === "pair" || gm === "separate" ? gm : "ignore",
      });
    } else {
      const cfg = inferGridConfig(preset.cells);
      if (cfg) {
        // 구버전 프리셋: 분단·열수만 보정, 홀수 열이면 성별 모드 무관으로 되돌린다.
        const genderMode =
          cfg.colsPerDivision % 2 === 1 ? "ignore" : config.genderMode;
        seat.setConfig({ ...cfg, fillFrom: config.fillFrom, genderMode });
      }
    }
    const result = seat.loadCellsForRoster(
      serializeSeatCells(preset.cells),
      new Set(students.map((s) => s.name))
    );
    if (result) {
      setPosOverrides({});
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
          <SeatMiniCanvas cells={preset.cells.map(toMiniCell)} />
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
            <label className="text-xs font-semibold text-slate-600 block mb-1">보기</label>
            <button
              type="button"
              onClick={() => setHidePlaced((v) => !v)}
              title={hidePlaced ? "배치 표시 (숨김 해제)" : "배치 숨기기 (빈 틀처럼 표시, 분리 메뉴 숨김)"}
              className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
                hidePlaced
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {hidePlaced ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {hidePlaced ? "숨김 중" : "표시 중"}
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">분단 수</label>
            <select
              value={DIVISION_OPTIONS.includes(config.divisions) ? String(config.divisions) : "custom"}
              onChange={(e) => {
                const nextDiv = Number(e.target.value);
                if (!DIVISION_OPTIONS.includes(nextDiv)) return;
                const maxCols = MAX_COLS_BY_DIVISIONS[nextDiv] ?? 8;
                const nextCols = Math.min(config.colsPerDivision, maxCols);
                // 홀수 열에서는 성별 모드를 쓸 수 없어 무관으로 되돌린다.
                seat.patchConfig(
                  nextCols % 2 === 1
                    ? { divisions: nextDiv, colsPerDivision: nextCols, genderMode: "ignore" }
                    : { divisions: nextDiv, colsPerDivision: nextCols }
                );
              }}
              className="px-2 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DIVISION_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {d}분단
                </option>
              ))}
              {!DIVISION_OPTIONS.includes(config.divisions) && (
                <option value="custom" disabled>
                  {config.divisions}분단 (이전 설정)
                </option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">분단당 열수</label>
            <select
              value={
                config.colsPerDivision >= 1 &&
                config.colsPerDivision <= (MAX_COLS_BY_DIVISIONS[config.divisions] ?? 8)
                  ? String(config.colsPerDivision)
                  : "custom"
              }
              onChange={(e) => {
                const nextCols = Number(e.target.value);
                if (!Number.isInteger(nextCols) || nextCols < 1) return;
                // 홀수 열에서는 성별 모드를 쓸 수 없어 무관으로 되돌린다.
                seat.patchConfig(
                  nextCols % 2 === 1
                    ? { colsPerDivision: nextCols, genderMode: "ignore" }
                    : { colsPerDivision: nextCols }
                );
              }}
              className="px-2 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from(
                { length: MAX_COLS_BY_DIVISIONS[config.divisions] ?? 8 },
                (_, i) => i + 1
              ).map((c) => (
                <option key={c} value={String(c)}>
                  {c}열
                </option>
              ))}
              {(
                config.colsPerDivision < 1 ||
                config.colsPerDivision > (MAX_COLS_BY_DIVISIONS[config.divisions] ?? 8)
              ) && (
                <option value="custom" disabled>
                  {config.colsPerDivision}열 (이전 설정)
                </option>
              )}
            </select>
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
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0" title="자리 배치판 방향">
            {(
              [
                { v: "teacher", label: "선생님 보기" },
                { v: "student", label: "학생 보기" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setOrientation(o.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  orientation === o.v
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openSaveModal}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 text-xs font-bold flex items-center gap-1 transition-colors"
            title="현재 자리를 이름과 함께 저장합니다"
          >
            <Save className="w-3.5 h-3.5" />
            자리 저장
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
            onClick={() => window.print()}
            className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
            title="현재 보기(선생님·학생)대로 자리 배치를 인쇄합니다"
          >
            <Printer className="w-3.5 h-3.5" />
            인쇄
          </button>
        </div>
      </div>
      </PickTargetSelector>

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
            students={hidePlaced ? selected : unplaced}
            masked={hidePlaced}
          />
          {!hidePlaced && (
            <SeatAvoidPanel
              groups={seat.avoidGroups}
              students={students}
              onAddGroup={seat.addAvoidGroup}
              onDeleteGroup={seat.deleteAvoidGroup}
              onModeChange={seat.updateAvoidGroupMode}
              onAddMember={seat.addAvoidMember}
              onRemoveMember={seat.removeAvoidMember}
            />
          )}
          {/* 자리 조작 방법 (동작별 아이콘 카드) */}
          <SeatGuide placedCount={seat.placedCount} hideCount={hidePlaced} />
        </div>
        <div className="min-w-0 relative">
        <SeatGrid
          cells={gridCells}
          divisions={config.divisions}
          orientation={orientation}
          lookup={lookup}
          displayName={displayName}
          onCellClick={seat.handleCellClick}
          onCycleGender={seat.cycleGender}
          onDropStudent={seat.dropStudentOnCell}
          onMoveCell={seat.moveCell}
          onPositionChange={handlePositionChange}
        />
        {hidePlaced && (
          <div
            className="absolute inset-0 z-20 rounded-2xl cursor-default"
            title="배치 숨김 중 (보기 버튼으로 표시)"
          />
        )}
        </div>
      </div>

      <PresetLibrarySection
        icon={<Bookmark className="w-4 h-4 text-indigo-600" />}
        title={`저장된 자리 프리셋 목록 (${manualPresets.length}개)`}
        layout="grid"
        empty={manualPresets.length === 0}
        emptyText={
          <>
            저장된 자리 프리셋이 없습니다. 위에서 자리를 배치한 뒤 [자리 저장] 버튼으로
            저장해 보세요.
          </>
        }
      >
        {manualPresets.map(renderPresetRow)}
      </PresetLibrarySection>

      <PresetLibrarySection
        icon={<History className="w-4 h-4 text-amber-600" />}
        title={`최근 자동 저장 (${recentPresets.length}/3개)`}
        layout="grid"
        empty={recentPresets.length === 0}
        emptyText={
          <>
            아직 자동 저장된 자리가 없습니다. 랜덤 배치를 실행하면 최근 3개가 자동
            보관됩니다.
            <br />
            연필 아이콘으로 이름을 지정하면 프리셋으로 승격·저장됩니다.
          </>
        }
      >
        {recentPresets.map(renderPresetRow)}
      </PresetLibrarySection>

      {/* 자리 저장 팝업 (이름 입력) */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-600" />
                <h2 className="font-extrabold text-slate-800 text-base">자리 프리셋 저장</h2>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              현재 자리 ({displayCells.filter((c) => c.enabled !== false).length}석 ·{" "}
              {seat.placedCount}명 배치)를 이름과 함께 저장합니다.
            </p>

            <input
              type="text"
              value={saveModalName}
              autoFocus
              onChange={(e) => setSaveModalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSaveModal();
                if (e.key === "Escape") setSaveModalOpen(false);
              }}
              placeholder="저장할 자리 이름 (예: 3월 자리, 기본형 틀)"
              className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {saveModalError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {saveModalError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                취소
              </button>
              <button
                type="button"
                onClick={commitSaveModal}
                className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}