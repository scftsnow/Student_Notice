"use client";

import { useMemo, useState } from "react";
import { Armchair, Dices, Eraser, Eye, EyeOff } from "lucide-react";
import PickTargetSelector from "./PickTargetSelector";
import DrawOverlay from "./DrawOverlay";
import SaveBar from "./SaveBar";
import SeatGrid from "./SeatGrid";
import StudentPool from "./StudentPool";
import { useSeatPick } from "@/hooks/useSeatPick";
import { formatPickName } from "@/lib/pickFormat";
import {
  saveSeatLayout,
  deleteSeatLayout,
  saveSeatAssignment,
  deleteSeatAssignment,
} from "@/app/pickActions";
import { playError, unlockAudio } from "@/lib/pickSound";
import type {
  PickStudent,
  SeatAssignmentItem,
  SeatConfig,
  SeatLayoutItem,
} from "@/types";

interface SeatPickPanelProps {
  students: PickStudent[];
  initialLayouts: SeatLayoutItem[];
  initialAssignments: SeatAssignmentItem[];
}

function parseConfig(raw: string): SeatConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SeatConfig>;
    if (
      typeof parsed.divisions !== "number" ||
      typeof parsed.colsPerDivision !== "number"
    ) {
      return null;
    }
    return {
      divisions: parsed.divisions,
      colsPerDivision: parsed.colsPerDivision,
      fillFrom: parsed.fillFrom === "front" ? "front" : "back",
      genderMode:
        parsed.genderMode === "pair" || parsed.genderMode === "separate"
          ? parsed.genderMode
          : "ignore",
    };
  } catch {
    return null;
  }
}

export default function SeatPickPanel({
  students,
  initialLayouts,
  initialAssignments,
}: SeatPickPanelProps) {
  const defaultIds = useMemo(
    () => students.filter((s) => s.status !== "ABSENT").map((s) => s.id),
    [students]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [layouts, setLayouts] = useState<SeatLayoutItem[]>(initialLayouts);
  const [assignments, setAssignments] = useState<SeatAssignmentItem[]>(initialAssignments);
  const [loadedLayoutId, setLoadedLayoutId] = useState("");
  const [loadedAssignmentId, setLoadedAssignmentId] = useState("");
  const [namesSnap, setNamesSnap] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayResults, setOverlayResults] = useState<string[]>([]);

  const seat = useSeatPick();
  const { config } = seat;
  const defaultAssignmentName = useMemo(() => {
    const today = new Date();
    return `${today.getMonth() + 1}월 ${today.getDate()}일 자리`;
  }, []);

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
    if (live) return formatPickName(live);
    return `${namesSnap[id] ?? "?"} (전학/삭제)`;
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
    seat.buildCells(selected.length);
  };

  const handleDraw = () => {
    setNotice("");
    unlockAudio();
    const next = seat.randomAssign(selected);
    if (next) {
      const placed = next
        .filter((c) => c.studentId)
        .map((c) => {
          const live = byId.get(c.studentId as string);
          const who = live ? formatPickName(live) : (namesSnap[c.studentId as string] ?? "?");
          return `${who} → ${c.division + 1}분단 ${c.row + 1}행`;
        });
      setOverlayResults(placed.length > 0 ? placed : selected.map(formatPickName));
      setOverlayOpen(true);
    } else {
      playError();
    }
  };

  const snapshotNames = (): Record<string, string> => {
    const map: Record<string, string> = {};
    students.forEach((s) => {
      map[s.id] = formatPickName(s);
    });
    return map;
  };

  const handleSaveLayout = async (name: string) => {
    if (seat.cells.length === 0) {
      showError("저장할 자리 틀이 없습니다. 먼저 자리를 생성해 주세요.");
      return;
    }
    const existing = layouts.find((l) => l.id === loadedLayoutId && l.name === name);
    const frameCells = seat.cells.map((c) => ({ ...c, studentId: null, fixedStudentId: null }));
    const res = await saveSeatLayout({
      id: existing?.id,
      name,
      divisions: config.divisions,
      colsPerDivision: config.colsPerDivision,
      fillFrom: config.fillFrom,
      cellsJson: JSON.stringify(frameCells),
    });
    if (!res.success) {
      showError(res.error);
      return;
    }
    setLayouts((prev) => [{ ...res.data }, ...prev.filter((l) => l.id !== res.data.id)]);
    setLoadedLayoutId(res.data.id);
    setNotice(`자리 틀 '${name}'을(를) 저장했습니다.`);
  };

  const handleLoadLayout = (id: string) => {
    const target = layouts.find((l) => l.id === id);
    if (!target) return;
    seat.setConfig({
      divisions: target.divisions,
      colsPerDivision: target.colsPerDivision,
      fillFrom: target.fillFrom === "front" ? "front" : "back",
      genderMode: config.genderMode,
    });
    let enabledCount = 0;
    try {
      const raw = JSON.parse(target.cellsJson) as { enabled?: unknown }[];
      if (Array.isArray(raw)) {
        enabledCount = raw.filter((c) => c.enabled !== false).length;
      }
    } catch {
      enabledCount = 0;
    }
    if (seat.loadCellsJson(target.cellsJson)) {
      setLoadedLayoutId(id);
      setLoadedAssignmentId("");
      if (enabledCount > 0 && enabledCount < selected.length) {
        setNotice(
          `자리 틀 '${target.name}'을(를) 불러왔으나 현재 선택 인원(${selected.length}명)보다 자리(${enabledCount}석)가 부족합니다. 분단·열수를 조정해 자리를 다시 생성해 주세요.`
        );
      } else {
        setNotice(`자리 틀 '${target.name}'을(를) 불러왔습니다.`);
      }
    } else {
      playError();
    }
  };

  const handleDeleteLayout = async (id: string) => {
    const res = await deleteSeatLayout(id);
    if (!res.success) {
      showError(res.error);
      return;
    }
    setLayouts((prev) => prev.filter((l) => l.id !== id));
    if (loadedLayoutId === id) setLoadedLayoutId("");
    setNotice("자리 틀을 삭제했습니다.");
  };

  const handleSaveAssignment = async (name: string) => {
    if (seat.cells.length === 0 || seat.placedCount === 0) {
      showError("저장할 배치 결과가 없습니다. 먼저 랜덤 배치를 실행해 주세요.");
      return;
    }
    const existing = assignments.find((a) => a.id === loadedAssignmentId && a.name === name);
    const res = await saveSeatAssignment({
      id: existing?.id,
      name,
      layoutId: loadedLayoutId || null,
      configJson: JSON.stringify(config),
      cellsJson: JSON.stringify(seat.cells),
      namesJson: JSON.stringify(snapshotNames()),
    });
    if (!res.success) {
      showError(res.error);
      return;
    }
    setAssignments((prev) => [{ ...res.data }, ...prev.filter((a) => a.id !== res.data.id)]);
    setLoadedAssignmentId(res.data.id);
    setNotice(`자리 배치 '${name}'을(를) 저장했습니다.`);
  };

  const handleLoadAssignment = (id: string) => {
    const target = assignments.find((a) => a.id === id);
    if (!target) return;
    const cfg = parseConfig(target.configJson);
    if (cfg) seat.setConfig(cfg);
    try {
      setNamesSnap(JSON.parse(target.namesJson) as Record<string, string>);
    } catch {
      setNamesSnap({});
    }
    if (seat.loadCellsJson(target.cellsJson)) {
      setLoadedAssignmentId(id);
      setLoadedLayoutId(target.layoutId ?? "");
      setNotice(`자리 배치 '${target.name}'을(를) 불러왔습니다.`);
    } else {
      playError();
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    const res = await deleteSeatAssignment(id);
    if (!res.success) {
      showError(res.error);
      return;
    }
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    if (loadedAssignmentId === id) setLoadedAssignmentId("");
    setNotice("자리 배치를 삭제했습니다.");
  };

  return (
    <div className="space-y-4">
      <PickTargetSelector students={students} selectedIds={selectedIds} onChange={setSelectedIds} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-3">
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
              onChange={(e) =>
                seat.patchConfig({
                  colsPerDivision: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                })
              }
              className="w-16 px-2 py-2 text-sm rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">채우기</label>
            <select
              value={config.fillFrom}
              onChange={(e) =>
                seat.patchConfig({ fillFrom: e.target.value === "front" ? "front" : "back" })
              }
              className="px-2 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="back">뒷줄부터</option>
              <option value="front">앞줄부터</option>
            </select>
          </div>
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
            >
              <option value="ignore">무관</option>
              <option value="pair">짝꿍 우선</option>
              <option value="separate">분리</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
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
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-indigo-200"
          >
            <Dices className="w-3.5 h-3.5" />
            랜덤 배치
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

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-start">
        <StudentPool students={unplaced} />
        <SeatGrid
          cells={seat.cells}
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
        />
      </div>
      <p className="text-[11px] text-slate-400">
        클릭: 열기/닫기·비우기 · 우클릭: 성별 지정 · 드래그: 풀→자리 고정 배치, 자리↔자리 교환 ·
        배치 {seat.placedCount}명
      </p>

      <SaveBar
        items={layouts}
        placeholder="자리 틀 이름 (예: 3분단 기본형)"
        defaultName=""
        onSave={handleSaveLayout}
        onLoad={handleLoadLayout}
        onDelete={handleDeleteLayout}
      />
      <SaveBar
        items={assignments}
        placeholder="배치 결과 이름 (예: 3월 자리)"
        defaultName={defaultAssignmentName}
        onSave={handleSaveAssignment}
        onLoad={handleLoadAssignment}
        onDelete={handleDeleteAssignment}
      />

      <DrawOverlay
        open={overlayOpen}
        title="자리 뽑기"
        rollingNames={rollingNames}
        results={overlayResults}
        onRedraw={handleDraw}
        onClose={() => setOverlayOpen(false)}
      />
    </div>
  );
}
