"use client";

import { useState } from "react";
import {
  Layout,
  Calendar,
  Clock,
  Coins,
  SquarePen,
  Plus,
  CalendarDays,
  X,
  Check,
} from "lucide-react";
import { BoardElementLayouts, FreeCardData, ClassroomRoutine } from "@/types/classroom";
import { formatVisibleDays } from "@/lib/boardDefaults";

interface NoticeBoxVisibilityBarProps {
  layouts: BoardElementLayouts;
  onUpdateLayouts: (updater: (prev: BoardElementLayouts) => BoardElementLayouts) => void;
  showEconomyShortcut?: boolean;
  onToggleEconomyShortcut?: (val: boolean) => void;
  freeCards?: FreeCardData[];
  onToggleFreeCardVisibility?: (id: string, visible: boolean) => void;
  onUpdateFreeCard?: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  onAddFreeCard?: () => void;
  routines?: ClassroomRoutine[];
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
}

type StandardBoxKey = "dateBox" | "clockBox";

/** 평일만 사용 (토·일은 선택지에서 제외). */
const DAYS_BUTTONS = [
  { day: 1, label: "월" }, { day: 2, label: "화" }, { day: 3, label: "수" },
  { day: 4, label: "목" }, { day: 5, label: "금" },
];

export default function NoticeBoxVisibilityBar({
  layouts,
  onUpdateLayouts,
  showEconomyShortcut = false,
  onToggleEconomyShortcut,
  freeCards = [],
  onToggleFreeCardVisibility,
  onUpdateFreeCard,
  onAddFreeCard,
  routines = [],
  onUpdateRoutine,
}: NoticeBoxVisibilityBarProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const [scheduleTarget, setScheduleTarget] = useState<{
    id: string;
    name: string;
    type: "standard" | "freeCard" | "routine";
    visibleDays?: number[];
  } | null>(null);
  const [tempDays, setTempDays] = useState<number[]>([]);

  const toggleBox = (boxKey: StandardBoxKey, nextVisible: boolean) => {
    onUpdateLayouts((prev) => {
      const currentBox = prev[boxKey];
      if (!currentBox) return prev;
      return {
        ...prev,
        [boxKey]: {
          ...currentBox,
          visible: nextVisible,
        },
      };
    });
  };

  const toggleRoutine = (r: ClassroomRoutine, nextVisible: boolean) => {
    onUpdateRoutine?.(r.id, {
      visibleInNotice: nextVisible,
      layout: {
        ...r.layout,
        visible: nextVisible,
      },
    });
  };

  const startRename = (key: string, currentName: string) => {
    setEditingKey(key);
    setEditingText(currentName);
  };

  const finishRenameStandard = (boxKey: StandardBoxKey) => {
    const trimmed = editingText.trim();
    onUpdateLayouts((prev) => {
      const currentBox = prev[boxKey];
      if (!currentBox) return prev;
      return {
        ...prev,
        [boxKey]: {
          ...currentBox,
          label: trimmed || undefined,
        },
      };
    });
    setEditingKey(null);
  };

  const finishRenameFreeCard = (card: FreeCardData) => {
    const trimmed = editingText.trim();
    if (onUpdateFreeCard) {
      onUpdateFreeCard(card.id, card.html, { label: trimmed || undefined });
    }
    setEditingKey(null);
  };

  const finishRenameRoutine = (r: ClassroomRoutine) => {
    const trimmed = editingText.trim();
    if (trimmed && onUpdateRoutine) {
      onUpdateRoutine(r.id, { name: trimmed });
    }
    setEditingKey(null);
  };

  const openScheduleModal = (
    id: string,
    name: string,
    type: "standard" | "freeCard" | "routine",
    visibleDays?: number[]
  ) => {
    setScheduleTarget({ id, name, type, visibleDays });
    // 토·일은 선택지에서 제외 — 기존 저장값에 섞여 있어도 평일만 이어받는다.
    setTempDays(visibleDays ? visibleDays.filter((d) => d >= 1 && d <= 5) : []);
  };

  const toggleTempDay = (day: number) => {
    setTempDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const saveSchedule = () => {
    if (!scheduleTarget) return;
    // 평일 5일 전부 선택 = 항상 표시와 동일하므로 저장하지 않는다.
    const finalDays = tempDays.length === 0 || tempDays.length === 5 ? undefined : tempDays;

    if (scheduleTarget.type === "freeCard") {
      const card = freeCards.find((c) => c.id === scheduleTarget.id);
      if (card && onUpdateFreeCard) {
        onUpdateFreeCard(card.id, card.html, { visibleDays: finalDays });
      }
    } else if (scheduleTarget.type === "routine") {
      const r = routines.find((item) => item.id === scheduleTarget.id);
      if (r && onUpdateRoutine) {
        onUpdateRoutine(r.id, {
          layout: {
            ...r.layout,
            visibleDays: finalDays,
          },
        });
      }
    } else {
      const boxKey = scheduleTarget.id as StandardBoxKey;
      onUpdateLayouts((prev) => {
        const currentBox = prev[boxKey];
        if (!currentBox) return prev;
        return {
          ...prev,
          [boxKey]: {
            ...currentBox,
            visibleDays: finalDays,
          },
        };
      });
    }

    setScheduleTarget(null);
  };

  const standardBoxes: {
    key: StandardBoxKey;
    defaultName: string;
    icon: typeof Calendar;
    colorClass: string;
  }[] = [
    { key: "dateBox", defaultName: "날짜", icon: Calendar, colorClass: "text-indigo-500" },
    { key: "clockBox", defaultName: "시각", icon: Clock, colorClass: "text-blue-500" },
  ];

  return (
    <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-700 flex items-center gap-1.5 shrink-0 select-none">
          <Layout className="w-3.5 h-3.5 text-indigo-600" />
          <span>글상자 표시:</span>
        </span>

        {/* 1~4 기본 글상자들 */}
        {standardBoxes.map(({ key, defaultName, icon: BoxIcon, colorClass }) => {
          const box = layouts[key];
          const isVisible = box?.visible !== false;
          const displayName = box?.label?.trim() || defaultName;
          const isEditing = editingKey === key;
          const scheduleText = formatVisibleDays(box?.visibleDays);

          return (
            <div
              key={key}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                isVisible
                  ? "bg-white border-slate-200 text-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => toggleBox(key, e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                title={`${displayName} 표시/숨김 토글`}
              />
              <BoxIcon className={`w-3.5 h-3.5 ${colorClass} shrink-0`} />

              {isEditing ? (
                <input
                  type="text"
                  value={editingText}
                  autoFocus
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={() => finishRenameStandard(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRenameStandard(key);
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  className="w-20 px-1 py-0.5 border border-indigo-300 rounded text-xs bg-white text-slate-800 font-bold focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(key, displayName)}
                  className="hover:underline hover:text-indigo-600 select-none"
                  title="클릭하여 이름 변경"
                >
                  {displayName}
                </button>
              )}

              {/* 요일 자동 표시 버튼 & 뱃지 */}
              <button
                type="button"
                onClick={() => openScheduleModal(key, displayName, "standard", box?.visibleDays)}
                className={`p-0.5 rounded transition-colors flex items-center gap-0.5 ${
                  scheduleText
                    ? "text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1 border border-indigo-200 font-bold text-[10px]"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title={scheduleText ? `표시 요일: ${scheduleText}` : "요일별 자동 표시 설정"}
              >
                <CalendarDays className="w-3 h-3 shrink-0" />
                {scheduleText && <span>{scheduleText}</span>}
              </button>
            </div>
          );
        })}

        {/* 4. 업무 루틴 개별 관리 항목들 */}
        {routines.map((r) => {
          const isVisible = r.layout?.visible !== undefined ? r.layout.visible : (r.visibleInNotice !== false);
          const displayName = r.name;
          const isEditing = editingKey === r.id;
          const scheduleText = formatVisibleDays(r.layout?.visibleDays);

          return (
            <div
              key={r.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                isVisible
                  ? "bg-white border-slate-200 text-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => toggleRoutine(r, e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                title={`${displayName} 칠판 표시/숨김 토글`}
              />
              <span className="text-xs shrink-0 select-none">{r.icon || "📌"}</span>

              {isEditing ? (
                <input
                  type="text"
                  value={editingText}
                  autoFocus
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={() => finishRenameRoutine(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRenameRoutine(r);
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  className="w-20 px-1 py-0.5 border border-indigo-300 rounded text-xs bg-white text-slate-800 font-bold focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(r.id, displayName)}
                  className="hover:underline hover:text-indigo-600 select-none max-w-[120px] truncate"
                  title="클릭하여 업무 이름 변경"
                >
                  {displayName}
                </button>
              )}

              {/* 요일 자동 표시 버튼 & 뱃지 */}
              <button
                type="button"
                onClick={() => openScheduleModal(r.id, displayName, "routine", r.layout?.visibleDays)}
                className={`p-0.5 rounded transition-colors flex items-center gap-0.5 ${
                  scheduleText
                    ? "text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1 border border-indigo-200 font-bold text-[10px]"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title={scheduleText ? `표시 요일: ${scheduleText}` : "요일별 자동 표시 설정"}
              >
                <CalendarDays className="w-3 h-3 shrink-0" />
                {scheduleText && <span>{scheduleText}</span>}
              </button>
            </div>
          );
        })}

        {/* 5. 학생 계좌 바로가기 아이콘 토글 */}
        {onToggleEconomyShortcut && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm font-semibold text-slate-700 text-xs">
            <input
              type="checkbox"
              checked={Boolean(showEconomyShortcut)}
              onChange={(e) => onToggleEconomyShortcut(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>학생 계좌</span>
          </label>
        )}

        {/* 6. 자유 글상자들 (알림장 본문 포함 완전 일원화) */}
        {freeCards.map((card, idx) => {
          const preview = card.html ? card.html.replace(/<[^>]+>/g, "").trim().slice(0, 8) : "";
          const defaultTitle = preview ? `자유: ${preview}` : `자유 ${idx + 1}`;
          const displayName = card.label?.trim() || defaultTitle;
          const isVisible = card.visible !== false;
          const isEditing = editingKey === card.id;
          const scheduleText = formatVisibleDays(card.visibleDays);

          return (
            <div
              key={card.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
                isVisible
                  ? "bg-white border-slate-200 text-slate-700"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => onToggleFreeCardVisibility?.(card.id, e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                title={`${displayName} 표시/숨김 토글`}
              />
              <SquarePen className="w-3.5 h-3.5 text-violet-500 shrink-0" />

              {isEditing ? (
                <input
                  type="text"
                  value={editingText}
                  autoFocus
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={() => finishRenameFreeCard(card)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishRenameFreeCard(card);
                    if (e.key === "Escape") setEditingKey(null);
                  }}
                  className="w-20 px-1 py-0.5 border border-indigo-300 rounded text-xs bg-white text-slate-800 font-bold focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(card.id, displayName)}
                  className="hover:underline hover:text-indigo-600 select-none max-w-[120px] truncate"
                  title="클릭하여 이름 변경"
                >
                  {displayName}
                </button>
              )}

              {/* 요일 자동 표시 버튼 & 뱃지 */}
              <button
                type="button"
                onClick={() => openScheduleModal(card.id, displayName, "freeCard", card.visibleDays)}
                className={`p-0.5 rounded transition-colors flex items-center gap-0.5 ${
                  scheduleText
                    ? "text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1 border border-indigo-200 font-bold text-[10px]"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title={scheduleText ? `표시 요일: ${scheduleText}` : "요일별 자동 표시 설정"}
              >
                <CalendarDays className="w-3 h-3 shrink-0" />
                {scheduleText && <span>{scheduleText}</span>}
              </button>
            </div>
          );
        })}
      </div>

      {/* 자유 글상자 추가 바로가기 */}
      {onAddFreeCard && (
        <button
          type="button"
          onClick={onAddFreeCard}
          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-sm transition-all flex items-center gap-1 ml-auto shrink-0 cursor-pointer"
          title="새 자유 글상자를 칠판에 추가합니다"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>글상자 추가</span>
        </button>
      )}

      {/* 요일별 자동 표시 설정 모달 */}
      {scheduleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setScheduleTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">
                  {scheduleTarget.name} — 표시 요일
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setScheduleTarget(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors leading-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-500 text-[11px] leading-relaxed">
              선택한 요일에만 전자칠판과 학생 화면에 자동으로 표시됩니다. 아무 요일도 선택하지 않으면 항상 표시됩니다.
            </p>

            {/* 요일 토글 버튼들 (월~금) */}
            <div className="grid grid-cols-5 gap-1.5 py-2">
              {DAYS_BUTTONS.map(({ day, label }) => {
                const isSelected = tempDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleTempDay(day)}
                    className={`py-2 rounded-xl font-extrabold text-xs transition-all border ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm scale-105"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* 빠른 프리셋 버튼 (월~금 전체 선택 = 항상 표시와 동일) */}
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => setTempDays([1, 2, 3, 4, 5])} className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors">
                평일 (월~금)
              </button>
            </div>

            {/* 하단 제어 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setScheduleTarget(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors">
                취소
              </button>
              <button type="button" onClick={saveSchedule} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-colors">
                <Check className="w-3.5 h-3.5" /><span>저장 완료</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
