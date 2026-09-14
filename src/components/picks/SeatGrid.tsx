"use client";

import { Lock } from "lucide-react";
import type { PickStudent, SeatCellState } from "@/types";

interface SeatGridProps {
  cells: SeatCellState[];
  divisions: number;
  showFixed: boolean;
  lookup: (studentId: string | null) => PickStudent | null;
  displayName: (studentId: string | null) => string;
  onCellClick: (key: string) => void;
  onCycleGender: (key: string) => void;
  onDropStudent: (cellKey: string, studentId: string) => void;
  onMoveCell: (fromKey: string, toKey: string) => void;
  onClearCell: (key: string) => void;
  onUnfix: (key: string) => void;
}

export default function SeatGrid({
  cells,
  divisions,
  showFixed,
  lookup,
  displayName,
  onCellClick,
  onCycleGender,
  onDropStudent,
  onMoveCell,
  onClearCell,
  onUnfix,
}: SeatGridProps) {
  if (cells.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        인원수에 맞춰 `자리 생성`을 눌러 자리를 만드세요.
      </div>
    );
  }

  const rows = Math.max(...cells.map((c) => c.row)) + 1;

  const cellsAt = (division: number, row: number): SeatCellState[] =>
    cells
      .filter((c) => c.division === division && c.row === row)
      .sort((a, b) => a.col - b.col);

  const renderCell = (cell: SeatCellState) => {
    const student = lookup(cell.studentId);
    const isFixed = cell.fixedStudentId !== null;
    const genderColor =
      student?.gender === "남"
        ? "border-blue-300 bg-blue-50"
        : student?.gender === "여"
          ? "border-rose-300 bg-rose-50"
          : "border-slate-200 bg-white";

    return (
      <div
        key={cell.key}
        draggable={cell.enabled && cell.studentId !== null}
        onDragStart={(e) => {
          if (!cell.studentId) return;
          e.dataTransfer.setData("text/pick-seat-cell", cell.key);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const fromKey = e.dataTransfer.getData("text/pick-seat-cell");
          if (fromKey) {
            onMoveCell(fromKey, cell.key);
            return;
          }
          const studentId = e.dataTransfer.getData("text/student-id");
          if (studentId) onDropStudent(cell.key, studentId);
        }}
        onClick={() => onCellClick(cell.key)}
        onContextMenu={(e) => {
          e.preventDefault();
          onCycleGender(cell.key);
        }}
        title={
          cell.studentId
            ? "클릭: 비우기 / 드래그: 이동"
            : cell.enabled
              ? "클릭: 닫기 / 우클릭: 성별 지정"
              : "클릭: 열기"
        }
        className={`relative flex-1 min-w-0 rounded-xl border-2 px-1 py-2 text-center cursor-pointer select-none transition-all ${
          !cell.enabled
            ? "border-dashed border-slate-200 bg-slate-50"
            : cell.studentId
              ? genderColor
              : "border-slate-200 bg-white hover:border-indigo-300"
        }`}
      >
        {!cell.enabled ? (
          <span className="text-[11px] text-slate-300">닫힘</span>
        ) : cell.studentId ? (
          <>
            <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
              {displayName(cell.studentId)}
            </div>
            {cell.lockedGender && (
              <span
                className={`text-[10px] font-bold ${
                  cell.lockedGender === "남" ? "text-blue-500" : "text-rose-500"
                }`}
              >
                {cell.lockedGender === "남" ? "♂" : "♀"}
              </span>
            )}
            {showFixed && isFixed && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5">
                <span className="p-0.5 rounded-full bg-amber-400 text-white" title="고정 배치됨">
                  <Lock className="w-2.5 h-2.5" />
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnfix(cell.key);
                  }}
                  className="px-1 rounded-full bg-slate-600 text-white text-[9px] leading-4"
                  title="고정 해제 (배치는 유지)"
                >
                  해제
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCell(cell.key);
                  }}
                  className="px-1 rounded-full bg-rose-500 text-white text-[9px] leading-4"
                  title="비우기"
                >
                  ✕
                </button>
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[11px] text-slate-300">빈자리</span>
            {cell.lockedGender && (
              <span
                className={`block text-[10px] font-bold ${
                  cell.lockedGender === "남" ? "text-blue-500" : "text-rose-500"
                }`}
              >
                {cell.lockedGender === "남" ? "♂ 지정" : "♀ 지정"}
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="w-16 shrink-0 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center">
          교탁
        </div>
        <div className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-center text-sm font-bold tracking-[0.5em]">
          칠판
        </div>
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-stretch gap-2 sm:gap-4">
          {Array.from({ length: divisions }, (_, division) => (
            <div key={division} className="flex-1 flex gap-1 min-w-0">
              {cellsAt(division, row).map((cell) => renderCell(cell))}
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>앞 ↑ (윗줄이 앞자리)</span>
        <span>{divisions}분단</span>
      </div>
    </div>
  );
}
