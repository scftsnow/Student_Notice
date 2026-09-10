"use client";

import { useRef, useEffect, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, ClipboardList, Minus, Plus } from "lucide-react";
import { BoardTheme, NoticeFontSize, BoardTargetElement, BoardElementLayouts, FreeCardData } from "@/types/classroom";
import { CLASSROOM_FONTS } from "@/lib/classroomFonts";
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
}

export default function NoticeTab({
  fontSize,
  onFontSizeChange,
  theme,
  onThemeChange,
  targetElement = "noticeBox",
  onTargetElementChange,
  onApplyColor,
  onApplyFontSize,
  onApplyAlign,
  currentFontSize,
  currentFontFamily,
  onApplyFontFamily,
  lineHeight = 140,
  onApplyLineHeight,
  showEconomyShortcut = false,
  onToggleEconomyShortcut,
  onOpenRoutineNoticeSettings,
  layouts,
  onUpdateLayouts,
  freeCards,
  onToggleFreeCardVisibility,
  onUpdateFreeCard,
  onAddFreeCard,
}: NoticeTabProps) {
  const lastRangeRef = useRef<Range | null>(null);
  const lastEditableRef = useRef<HTMLElement | null>(null);

  const selectedFontId =
    CLASSROOM_FONTS.find((f) => f.family === currentFontFamily || f.id === currentFontFamily)?.id ||
    "pretendard";

  useEffect(() => {
    lastRangeRef.current = null;
    lastEditableRef.current = null;
  }, [targetElement]);

  const getEffectiveRange = (): { range: Range | null; sel: Selection | null } => {
    const isTextCard = targetElement === "noticeBox" || Boolean(targetElement?.startsWith("free-"));
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!isTextCard) return { range: null, sel };
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      return { range: sel.getRangeAt(0), sel };
    }
    return { range: lastRangeRef.current, sel };
  };

  const getTargetEl = (range: Range | null): HTMLElement | null => {
    if (!range) return lastEditableRef.current || (document.activeElement as HTMLElement | null);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement;
    return container?.closest<HTMLElement>("[contenteditable='true']") || lastEditableRef.current || (document.activeElement as HTMLElement | null);
  };

  const dispatchInput = (el?: HTMLElement | null) => {
    if (el && (el.getAttribute("contenteditable") === "true" || el.hasAttribute("contenteditable"))) {
      el.focus();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
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
        if (sel) {
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.addRange(newRange);
          lastRangeRef.current = newRange.cloneRange();
        }
        dispatchInput(getTargetEl(range));
        return;
      } catch {
        // Fallback to applying on target element
      }
    }
    onApplyFontFamily?.(fontFamily);
  };

  // 구글 독스 스타일 글자 크기 숫자 입력 및 +/- 스테퍼 로직
  const effectiveFontSize = currentFontSize ?? (Number(fontSize) || 42);
  const [fontSizeInput, setFontSizeInput] = useState<string>(String(effectiveFontSize));
  const isFontSizeFocused = useRef(false);

  useEffect(() => {
    if (!isFontSizeFocused.current) {
      setFontSizeInput(String(effectiveFontSize));
    }
  }, [effectiveFontSize]);

  const commitFontSize = (valStr: string) => {
    let num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) num = effectiveFontSize;
    num = Math.max(12, Math.min(160, num));
    setFontSizeInput(String(num));
    applyFontSizeToSelectionOrTarget(String(num) as NoticeFontSize);
  };

  const handleStepFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(160, effectiveFontSize + delta));
    setFontSizeInput(String(next));
    applyFontSizeToSelectionOrTarget(String(next) as NoticeFontSize);
  };

  // 구글 독스 스타일 줄간격 숫자 입력 및 +/- 스테퍼 로직
  const effectiveLineHeight = lineHeight ?? 140;
  const [lineHeightInput, setLineHeightInput] = useState<string>(String(effectiveLineHeight));
  const isLineHeightFocused = useRef(false);

  useEffect(() => {
    if (!isLineHeightFocused.current) {
      setLineHeightInput(String(effectiveLineHeight));
    }
  }, [effectiveLineHeight]);

  const commitLineHeight = (valStr: string) => {
    let num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) num = effectiveLineHeight;
    num = Math.max(80, Math.min(300, num));
    setLineHeightInput(String(num));
    onApplyLineHeight?.(num);
  };

  const handleStepLineHeight = (delta: number) => {
    const next = Math.max(80, Math.min(300, effectiveLineHeight + delta));
    setLineHeightInput(String(next));
    onApplyLineHeight?.(next);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
        const r = sel.getRangeAt(0);
        lastRangeRef.current = r.cloneRange();
        const container =
          r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? (r.commonAncestorContainer as HTMLElement)
            : r.commonAncestorContainer.parentElement;
        const editable = container?.closest<HTMLElement>("[contenteditable='true']");
        if (editable) {
          lastEditableRef.current = editable;
        }
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const getTargetLabel = (target?: BoardTargetElement) => {
    if (!target || target === "all") return "전체 일괄";
    if (target === "noticeBox") return "알림장 본문";
    if (target === "dateBox") return "날짜";
    if (target === "clockBox") return "시간";
    if (target === "routineBox") return "학생 업무";
    if (target === "accountBox") return "계좌 아이콘";
    if (target.startsWith("free-") || target === "freeCard") return "자유 글상자";
    return "선택 요소";
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
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
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
    const { range, sel } = getEffectiveRange();

    if (range) {
      try {
        const targetEl = getTargetEl(range);
        const targetText = targetEl ? (targetEl.innerText || targetEl.textContent || "") : "";
        if (targetText && targetText.trim() === range.toString().trim()) {
          onApplyFontSize?.(numSz);
          dispatchInput(targetEl);
          return;
        }

        const baseSize = effectiveFontSize || 42;
        const emRatio = (numSz / baseSize).toFixed(3);
        const span = document.createElement("span");
        span.style.fontSize = `${emRatio}em`;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        if (sel) {
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.addRange(newRange);
          lastRangeRef.current = newRange.cloneRange();
        }
        dispatchInput(targetEl);
        return;
      } catch {
        // Fallback to target
      }
    }
    onApplyFontSize?.(numSz);
  };

  return (
    <div className="space-y-3">
      {/* 상단 통합 편집 툴바 */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 서식 적용 대상 선택 드롭다운 */}
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
              <option value="noticeBox">알림장 본문</option>
              <option value="dateBox">날짜</option>
              <option value="clockBox">시간/시계</option>
              <option value="routineBox">학생 업무</option>
              {freeCards && freeCards.length > 0 && (
                <option value="freeCard">자유 글상자</option>
              )}
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글꼴 드롭다운 (분류 없는 단일 리스트 + 서체 이름 SVG 미리보기) */}
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
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyColorToSelectionOrTarget(c.value);
                }}
                title={c.label}
                className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-slate-300 hover:ring-indigo-400 hover:scale-110 transition-all shrink-0"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글자 크기 (구글 독스 스타일: - [숫자] + & 프리셋 드롭다운) */}
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

          {/* 줄간격 (구글 독스 스타일: - [숫자%] + & 프리셋 드롭다운) */}
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
        />
      )}
    </div>
  );
}

