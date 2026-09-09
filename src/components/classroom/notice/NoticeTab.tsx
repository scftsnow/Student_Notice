"use client";

import { useRef, useEffect, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, ClipboardList, Coins, Minus, Plus } from "lucide-react";
import { BoardTheme, NoticeFontSize, BoardTargetElement } from "@/types/classroom";

const TEXT_COLORS = [
  { label: "흰색", value: "#ffffff" },
  { label: "노랑", value: "#fde047" },
  { label: "연두", value: "#86efac" },
  { label: "하늘", value: "#7dd3fc" },
  { label: "분홍", value: "#f9a8d4" },
  { label: "주황", value: "#fb923c" },
  { label: "빨강", value: "#f87171" },
  { label: "검정", value: "#1e293b" },
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
  lineHeight?: number;
  onApplyLineHeight?: (lineHeight: number) => void;
  showEconomyShortcut?: boolean;
  onToggleEconomyShortcut?: (show: boolean) => void;
  onOpenRoutineNoticeSettings?: () => void;
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
  lineHeight = 140,
  onApplyLineHeight,
  showEconomyShortcut = false,
  onToggleEconomyShortcut,
  onOpenRoutineNoticeSettings,
}: NoticeTabProps) {
  const lastRangeRef = useRef<Range | null>(null);

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
    onApplyFontSize?.(num);
  };

  const handleStepFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(160, effectiveFontSize + delta));
    setFontSizeInput(String(next));
    applyFontSizeToSelectionOrTarget(String(next) as NoticeFontSize);
    onApplyFontSize?.(next);
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
        lastRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const getTargetLabel = (target?: BoardTargetElement) => {
    if (!target || target === "noticeBox") return "알림장 본문";
    if (target === "dateBox") return "날짜";
    if (target === "clockBox") return "시간";
    if (target === "routineBox") return "학생 업무";
    if (target.startsWith("free-") || target === "freeCard") return "자유 글상자";
    if (target === "all") return "전체";
    return "선택 요소";
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? "");
  };

  const applyColorToSelectionOrTarget = (color: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    let range: Range | null = null;
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      range = sel.getRangeAt(0);
    } else if (lastRangeRef.current) {
      range = lastRangeRef.current;
    }

    if (range) {
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, color);
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.getAttribute("contenteditable") === "true" || activeEl.hasAttribute("contenteditable"))) {
        activeEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    onApplyColor?.(color);
  };

  const applyFontSizeToSelectionOrTarget = (sz: NoticeFontSize) => {
    onFontSizeChange(sz);
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    let range: Range | null = null;
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      range = sel.getRangeAt(0);
    } else if (lastRangeRef.current) {
      range = lastRangeRef.current;
    }

    if (range) {
      try {
        const span = document.createElement("span");
        span.style.fontSize = `${sz}px`;
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        if (sel) {
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.addRange(newRange);
        }
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.getAttribute("contenteditable") === "true" || activeEl.hasAttribute("contenteditable"))) {
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      } catch {
        // Fallback to applying on target
      }
    }
    onApplyFontSize?.(Number(sz));
  };

  return (
    <div className="space-y-3">
      {/* 상단 통합 편집 툴바 */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 현재 선택된 요소 안내 뱃지 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-indigo-700 font-bold text-xs select-none">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span>선택: {getTargetLabel(targetElement)}</span>
          </div>

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
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd("justifyLeft");
                onApplyAlign?.("left");
              }}
              title="왼쪽 정렬"
              className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd("justifyCenter");
                onApplyAlign?.("center");
              }}
              title="가운데 정렬"
              className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execCmd("justifyRight");
                onApplyAlign?.("right");
              }}
              title="오른쪽 정렬"
              className="w-7 h-7 rounded hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900"
            >
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
              onClick={() => handleStepFontSize(-2)}
              title="글자 크기 2px 축소"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="text"
              value={fontSizeInput}
              onFocus={() => {
                isFontSizeFocused.current = true;
              }}
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
              onClick={() => handleStepFontSize(2)}
              title="글자 크기 2px 확대"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <select
              value={effectiveFontSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                commitFontSize(String(val));
              }}
              title="글자 크기 프리셋"
              className="w-4 bg-transparent border-l border-slate-200 text-transparent focus:outline-none cursor-pointer text-xs"
            >
              <option value="24" className="text-slate-800">24px</option>
              <option value="34" className="text-slate-800">34px</option>
              <option value="42" className="text-slate-800">42px</option>
              <option value="50" className="text-slate-800">50px</option>
              <option value="58" className="text-slate-800">58px</option>
              <option value="72" className="text-slate-800">72px</option>
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 줄간격 (구글 독스 스타일: - [숫자%] + & 프리셋 드롭다운) */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            <span className="text-slate-400 font-semibold text-[11px] pl-1">행간</span>
            <button
              type="button"
              onClick={() => handleStepLineHeight(-10)}
              title="줄간격 10% 축소"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <div className="relative flex items-center">
              <input
                type="text"
                value={lineHeightInput}
                onFocus={() => {
                  isLineHeightFocused.current = true;
                }}
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
              onClick={() => handleStepLineHeight(10)}
              title="줄간격 10% 확대"
              className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <select
              value={effectiveLineHeight}
              onChange={(e) => {
                const val = Number(e.target.value);
                commitLineHeight(String(val));
              }}
              title="줄간격 프리셋"
              className="w-4 bg-transparent border-l border-slate-200 text-transparent focus:outline-none cursor-pointer text-xs"
            >
              <option value="110" className="text-slate-800">110%</option>
              <option value="120" className="text-slate-800">120%</option>
              <option value="130" className="text-slate-800">130%</option>
              <option value="140" className="text-slate-800">140% (기본)</option>
              <option value="150" className="text-slate-800">150%</option>
              <option value="160" className="text-slate-800">160%</option>
              <option value="180" className="text-slate-800">180%</option>
              <option value="200" className="text-slate-800">200%</option>
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
          {/* 학생 계좌 창 새로 띄우기 아이콘 토글 체크박스 */}
          {onToggleEconomyShortcut && (
            <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer select-none px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs">
              <input
                type="checkbox"
                checked={Boolean(showEconomyShortcut)}
                onChange={(e) => onToggleEconomyShortcut(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>학생 계좌 아이콘</span>
            </label>
          )}

          {/* 칠판 표시 업무 설정 버튼 */}
          {onOpenRoutineNoticeSettings && (
            <button
              type="button"
              onClick={onOpenRoutineNoticeSettings}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
              title="알림장 칠판에 노출할 학생 업무 및 문구 서식을 설정합니다"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>칠판 표시 업무 설정</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

