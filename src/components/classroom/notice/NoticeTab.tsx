"use client";

import { useRef, useEffect } from "react";
import { AlignLeft, AlignCenter, AlignRight, ClipboardList, Coins } from "lucide-react";
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

          {/* 글자 크기 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">크기:</span>
            <select
              value={currentFontSize ?? fontSize}
              onChange={(e) => {
                applyFontSizeToSelectionOrTarget(e.target.value as NoticeFontSize);
              }}
              className="rounded border border-slate-200 px-2 py-1 bg-white text-xs font-semibold focus:outline-none"
            >
              <option value="34">작게 (34px)</option>
              <option value="42">보통 (42px)</option>
              <option value="50">크게 (50px)</option>
              <option value="58">아주 크게 (58px)</option>
            </select>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 줄간격 (디폴트 140%) */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">줄간격:</span>
            <select
              value={lineHeight ?? 140}
              onChange={(e) => onApplyLineHeight?.(Number(e.target.value))}
              className="rounded border border-slate-200 px-2 py-1 bg-white text-xs font-semibold focus:outline-none"
            >
              <option value="110">110%</option>
              <option value="120">120%</option>
              <option value="130">130%</option>
              <option value="140">140% (기본)</option>
              <option value="150">150%</option>
              <option value="160">160%</option>
              <option value="180">180%</option>
              <option value="200">200%</option>
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

