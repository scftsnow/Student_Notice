"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { AlignLeft, AlignCenter, AlignRight, ClipboardList, Minus, Plus, Undo2, Redo2 } from "lucide-react";
import { BoardTheme, NoticeFontSize, BoardTargetElement, BoardElementLayouts, FreeCardData, ClassroomRoutine } from "@/types/classroom";
import { CLASSROOM_FONTS } from "@/lib/classroomFonts";
import { useSelectionRange } from "@/hooks/useSelectionRange";
import FontSelectorDropdown from "./FontSelectorDropdown";
import NoticeBoxVisibilityBar from "./NoticeBoxVisibilityBar";


const TEXT_COLORS = [
  { label: "흰색", value: "#ffffff" }, { label: "노랑", value: "#fde047" },
  { label: "연두", value: "#86efac" }, { label: "하늘", value: "#7dd3fc" },
  { label: "분홍", value: "#f9a8d4" }, { label: "주황", value: "#fb923c" },
  { label: "빨강", value: "#f87171" }, { label: "검정", value: "#1e293b" },
];

interface NoticeTabProps {
  fontSize: NoticeFontSize;
  onFontSizeChange: (size: NoticeFontSize) => void;
  theme: BoardTheme;
  onThemeChange: (theme: BoardTheme) => void;
  targetElement?: BoardTargetElement;
  onTargetElementChange?: (target: BoardTargetElement) => void;
  onApplyColor?: (color: string) => void;
  onApplyFontSize?: (size: number) => void;
  onApplyAlign?: (align: "left" | "center" | "right") => void;
  currentFontSize?: number;
  currentFontFamily?: string;
  onApplyFontFamily?: (fontFamily: string) => void;
  lineHeight?: number;
  onApplyLineHeight?: (lineHeight: number) => void;
  showEconomyShortcut?: boolean;
  onToggleEconomyShortcut?: (show: boolean) => void;
  onOpenRoutineNoticeSettings?: () => void;
  layouts?: BoardElementLayouts;
  onUpdateLayouts?: (updater: (prev: BoardElementLayouts) => BoardElementLayouts) => void;
  freeCards?: FreeCardData[];
  onToggleFreeCardVisibility?: (id: string, visible: boolean) => void;
  onUpdateFreeCard?: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  onAddFreeCard?: () => void;
  previewScale?: number;
  onPreviewScaleChange?: (scale: number) => void;
  routines?: ClassroomRoutine[];
  onUpdateRoutine?: (id: string, patch: Partial<ClassroomRoutine>) => void;
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean;
}

export default function NoticeTab({
  fontSize, onFontSizeChange, theme, onThemeChange,
  targetElement = "noticeBox", onTargetElementChange, onApplyColor, onApplyFontSize, onApplyAlign,
  currentFontSize, currentFontFamily, onApplyFontFamily, lineHeight = 140, onApplyLineHeight,
  showEconomyShortcut = false, onToggleEconomyShortcut, onOpenRoutineNoticeSettings,
  layouts, onUpdateLayouts, freeCards, onToggleFreeCardVisibility, onUpdateFreeCard, onAddFreeCard,
  previewScale = 75, onPreviewScaleChange, routines, onUpdateRoutine,
  onUndo, onRedo, canUndo, canRedo,
}: NoticeTabProps) {
  const {
    getEffectiveRange,
    getTargetEl,
    dispatchInput,
    selectAndCacheNode,
    lastRangeRef,
    lastEditableRef,
    applyInlineFontSize,
  } = useSelectionRange(targetElement);

  const handleUndo = useCallback(() => {
    if (onUndo) return onUndo();
    const el = lastEditableRef.current ?? document.querySelector<HTMLElement>("[contenteditable='true']");
    if (el) { el.focus(); document.execCommand("undo"); dispatchInput(el); }
  }, [onUndo, lastEditableRef, dispatchInput]);

  const handleRedo = useCallback(() => {
    if (onRedo) return onRedo();
    const el = lastEditableRef.current ?? document.querySelector<HTMLElement>("[contenteditable='true']");
    if (el) { el.focus(); document.execCommand("redo"); dispatchInput(el); }
  }, [onRedo, lastEditableRef, dispatchInput]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  const selectedFontId =
    CLASSROOM_FONTS.find((f) => f.family === currentFontFamily || f.id === currentFontFamily)?.id || "pretendard";

  const [scaleInput, setScaleInput] = useState<string>(String(previewScale));
  useEffect(() => { setScaleInput(String(previewScale)); }, [previewScale]);

  const handleScaleChange = (next: number) => {
    onPreviewScaleChange?.(Math.max(50, Math.min(100, Math.round(next))));
  };

  const applyFontFamilyToSelectionOrTarget = (fontId: string) => {
    const fontObj = CLASSROOM_FONTS.find((f) => f.id === fontId);
    const fontFamily = fontObj ? fontObj.family : "'Pretendard', sans-serif";
    const { range, sel } = getEffectiveRange();

    if (range) {
      try {
        const span = document.createElement("span");
        span.style.fontFamily = fontFamily;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        if (sel) selectAndCacheNode(span, sel);
        dispatchInput(getTargetEl(range));
        return;
      } catch {
        // Fallback to applying on target element
      }
    }
    onApplyFontFamily?.(fontFamily);
  };

  // 글자 크기/행간 직접 입력 및 스테퍼 로직
  const effectiveFontSize = currentFontSize ?? (Number(fontSize) || 42);
  const [fontSizeInput, setFontSizeInput] = useState<string>(String(effectiveFontSize));
  const isFontSizeFocused = useRef(false);
  useEffect(() => { if (!isFontSizeFocused.current) setFontSizeInput(String(effectiveFontSize)); }, [effectiveFontSize]);

  const commitFontSize = (valStr: string) => {
    let num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
    num = Math.max(12, Math.min(160, isNaN(num) ? effectiveFontSize : num));
    setFontSizeInput(String(num));
    applyFontSizeToSelectionOrTarget(String(num) as NoticeFontSize);
  };

  const handleStepFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(160, effectiveFontSize + delta));
    setFontSizeInput(String(next));
    applyFontSizeToSelectionOrTarget(String(next) as NoticeFontSize);
  };

  const effectiveLineHeight = lineHeight ?? 140;
  const [lineHeightInput, setLineHeightInput] = useState<string>(String(effectiveLineHeight));
  const isLineHeightFocused = useRef(false);
  useEffect(() => { if (!isLineHeightFocused.current) setLineHeightInput(String(effectiveLineHeight)); }, [effectiveLineHeight]);

  const commitLineHeight = (valStr: string) => {
    let num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
    num = Math.max(80, Math.min(300, isNaN(num) ? effectiveLineHeight : num));
    setLineHeightInput(String(num));
    onApplyLineHeight?.(num);
  };

  const handleStepLineHeight = (delta: number) => {
    const next = Math.max(80, Math.min(300, effectiveLineHeight + delta));
    setLineHeightInput(String(next));
    onApplyLineHeight?.(next);
  };

  const execCmd = (cmd: string, value?: string) => {
    const sel = window.getSelection();
    if ((!sel || sel.isCollapsed || sel.rangeCount === 0) && lastRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(lastRangeRef.current);
      lastEditableRef.current?.focus();
    }
    document.execCommand(cmd, false, value ?? "");
    dispatchInput(lastEditableRef.current || (document.activeElement as HTMLElement | null));
  };

  const applyColorToSelectionOrTarget = (color: string) => {
    const { range, sel } = getEffectiveRange();
    if (range) {
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      lastEditableRef.current?.focus();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, color);
      dispatchInput(getTargetEl(range));
      return;
    }
    onApplyColor?.(color);
  };

  const applyFontSizeToSelectionOrTarget = (sz: NoticeFontSize) => {
    onFontSizeChange(sz);
    const numSz = Number(sz);
    if (targetElement === "all") {
      onApplyFontSize?.(numSz);
      return;
    }
    const handledInline = applyInlineFontSize(numSz);
    if (!handledInline) {
      onApplyFontSize?.(numSz);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs divide-y divide-slate-200/80">
      {/* 1행: 상단 서식 편집 툴바 */}
      <div className="p-2.5 rounded-t-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 서식 적용 대상 선택 */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 font-bold text-xs select-none">
            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
            <span className="text-indigo-950/60 text-[11px] font-semibold shrink-0">대상:</span>
            <select
              value={targetElement ?? "all"}
              onChange={(e) => onTargetElementChange?.(e.target.value as BoardTargetElement)}
              className="bg-transparent font-bold text-indigo-800 text-xs focus:outline-none cursor-pointer py-0.5"
              title="서식을 적용할 대상을 선택하세요 (전체 일괄 또는 개별 글상자)"
            >
              <option value="all">전체 일괄 적용</option>
              <option value="dateBox">날짜</option>
              <option value="clockBox">시간/시계</option>
              <option value="routineBox">학생 업무</option>
              {routines && routines.map((r) => (
                <option key={r.id} value={r.id}>업무: {r.name}</option>
              ))}
              {(showEconomyShortcut || targetElement === "accountBox") && (
                <option value="accountBox">학생 계좌</option>
              )}
              {freeCards && freeCards.map((card, idx) => (
                <option key={card.id} value={card.id}>{card.label?.trim() || `자유 글상자 ${idx + 1}`}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 실행 취소 / 다시 실행 */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleUndo(); }}
              title="실행 취소 (Ctrl+Z)"
              disabled={canUndo === false}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                canUndo === false ? "opacity-30 pointer-events-none text-slate-400" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleRedo(); }}
              title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)"
              disabled={canRedo === false}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                canRedo === false ? "opacity-30 pointer-events-none text-slate-400" : "hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글꼴 드롭다운 */}
          <FontSelectorDropdown
            selectedFontId={selectedFontId}
            onSelectFont={applyFontFamilyToSelectionOrTarget}
          />

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글자 서식 (Bold / Italic / Strikethrough) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }}
              title="굵게"
              className="w-7 h-7 rounded hover:bg-slate-200 font-extrabold flex items-center justify-center transition-colors"
            >B</button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }}
              title="기울임"
              className="w-7 h-7 rounded hover:bg-slate-200 italic flex items-center justify-center transition-colors"
            >I</button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd("strikeThrough"); }}
              title="취소선"
              className="w-7 h-7 rounded hover:bg-slate-200 line-through text-slate-500 flex items-center justify-center transition-colors"
            >S</button>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글자 정렬 */}
          <div className="flex items-center gap-1">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyLeft"); onApplyAlign?.("left"); }} title="왼쪽 정렬" className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyCenter"); onApplyAlign?.("center"); }} title="가운데 정렬" className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900">
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyRight"); onApplyAlign?.("right"); }} title="오른쪽 정렬" className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900">
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글씨 색상 팔레트 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">색:</span>
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyColorToSelectionOrTarget(c.value); }}
                title={c.label}
                className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-slate-300 hover:ring-indigo-400 hover:scale-110 transition-all shrink-0"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글자 크기 */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <span className="text-slate-400 font-semibold text-[11px] pl-1">크기</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(-2); }}
              title="글자 크기 2px 축소"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="text"
              value={fontSizeInput}
              onFocus={() => { isFontSizeFocused.current = true; }}
              onChange={(e) => setFontSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  isFontSizeFocused.current = false;
                  commitFontSize(fontSizeInput);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={() => {
                isFontSizeFocused.current = false;
                commitFontSize(fontSizeInput);
              }}
              title="글자 크기 직접 입력 (Enter로 적용)"
              className="w-7 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none focus:bg-indigo-50/50 rounded"
            />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(2); }}
              title="글자 크기 2px 확대"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <select
              value={effectiveFontSize}
              onChange={(e) => commitFontSize(e.target.value)}
              title="글자 크기 프리셋"
              className="w-4 bg-transparent border-l border-slate-200 text-transparent focus:outline-none cursor-pointer text-xs"
            >
              {[24, 34, 42, 50, 58, 72].map((sz) => (
                <option key={sz} value={sz} className="text-slate-800">{sz}px</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 줄간격 */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <span className="text-slate-400 font-semibold text-[11px] pl-1">행간</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleStepLineHeight(-10); }}
              title="줄간격 10% 축소"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="relative flex items-center">
              <input
                type="text"
                value={lineHeightInput}
                onFocus={() => { isLineHeightFocused.current = true; }}
                onChange={(e) => setLineHeightInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    isLineHeightFocused.current = false;
                    commitLineHeight(lineHeightInput);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={() => {
                  isLineHeightFocused.current = false;
                  commitLineHeight(lineHeightInput);
                }}
                title="줄간격 직접 입력 (%) (Enter로 적용)"
                className="w-8 text-center text-xs font-bold text-slate-800 bg-transparent focus:outline-none focus:bg-indigo-50/50 rounded pr-1"
              />
              <span className="text-[10px] text-slate-400 font-semibold pointer-events-none select-none">%</span>
            </div>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleStepLineHeight(10); }}
              title="줄간격 10% 확대"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <select
              value={effectiveLineHeight}
              onChange={(e) => commitLineHeight(e.target.value)}
              title="줄간격 프리셋"
              className="w-4 bg-transparent border-l border-slate-200 text-transparent focus:outline-none cursor-pointer text-xs"
            >
              {[110, 120, 130, 140, 150, 160, 180, 200].map((lh) => (
                <option key={lh} value={lh} className="text-slate-800">{lh}%{lh === 140 ? " (기본)" : ""}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 칠판 테마 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">테마:</span>
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as BoardTheme)}
              className="rounded border border-slate-200 px-2 py-1 bg-white text-xs font-semibold focus:outline-none"
            >
              <option value="chalkboard">초록 칠판</option>
              <option value="navy">네이비</option>
              <option value="white">화이트보드</option>
              <option value="warm">따뜻한 원목</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* 미리보기 배율 조절 */}
          {onPreviewScaleChange && (
            <div className="flex items-center gap-0.5 bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/80 select-none">
              <button
                type="button"
                onClick={() => handleScaleChange(previewScale - 5)}
                disabled={previewScale <= 50}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white active:scale-95 disabled:opacity-30 text-slate-700 font-bold transition-all cursor-pointer"
                title="배율 축소 (-5%)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center">
                <input
                  type="text"
                  value={scaleInput}
                  onChange={(e) => setScaleInput(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(scaleInput, 10);
                    isNaN(n) ? setScaleInput(String(previewScale)) : handleScaleChange(n);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      if (e.key === "Escape") setScaleInput(String(previewScale));
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === "ArrowUp") { e.preventDefault(); handleScaleChange(previewScale + 5); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); handleScaleChange(previewScale - 5); }
                  }}
                  className="w-9 text-center font-bold text-slate-800 bg-white border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-indigo-500 font-mono"
                />
                <span className="text-[11px] font-bold text-slate-500 ml-0.5 mr-1">%</span>
              </div>
              <button
                type="button"
                onClick={() => handleScaleChange(previewScale + 5)}
                disabled={previewScale >= 100}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white active:scale-95 disabled:opacity-30 text-slate-700 font-bold transition-all cursor-pointer"
                title="배율 확대 (+5%)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3.5 bg-slate-300 mx-0.5" />
              <button type="button" onClick={() => handleScaleChange(75)} className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${previewScale === 75 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`} title="기본 배율 (75%) 복원">기본</button>
              <button type="button" onClick={() => handleScaleChange(100)} className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${previewScale === 100 ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`} title="100% 원본 배율">100%</button>
            </div>
          )}
          {/* 칠판 표시 업무 설정 버튼 */}
          {onOpenRoutineNoticeSettings && (
            <button
              type="button"
              onClick={onOpenRoutineNoticeSettings}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="알림장 칠판에 노출할 학생 업무 및 문구 서식을 설정합니다"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>칠판 표시 업무 설정</span>
            </button>
          )}
        </div>
      </div>

      {/* 글상자별 표시/미표시, 이름 변경, 요일 자동표시 바 */}
      {layouts && onUpdateLayouts && (
        <NoticeBoxVisibilityBar
          layouts={layouts}
          onUpdateLayouts={onUpdateLayouts}
          showEconomyShortcut={showEconomyShortcut}
          onToggleEconomyShortcut={onToggleEconomyShortcut}
          freeCards={freeCards}
          onToggleFreeCardVisibility={onToggleFreeCardVisibility}
          onUpdateFreeCard={onUpdateFreeCard}
          onAddFreeCard={onAddFreeCard}
          routines={routines}
          onUpdateRoutine={onUpdateRoutine}
        />
      )}

    </div>
  );
}
