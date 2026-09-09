"use client";

import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
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
}: NoticeTabProps) {
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? "");
  };

  const applyColorToSelectionOrTarget = (color: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const hasSelection = Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
    if (hasSelection) {
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
    const hasSelection = Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
    if (hasSelection && sel && sel.rangeCount > 0) {
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        span.style.fontSize = `${sz}px`;
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
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
          {/* 대상 요소 선택 (알림장, 날짜, 시간, 학생 업무, 전체) */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-bold">대상:</span>
            <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg text-[11px] font-bold">
              {(
                [
                  { id: "noticeBox", label: "알림장" },
                  { id: "dateBox", label: "날짜" },
                  { id: "clockBox", label: "시간" },
                  { id: "routineBox", label: "학생 업무" },
                  { id: "freeCard", label: "자유글" },
                  { id: "all", label: "전체" },
                ] as const
              ).map((item) => {
                const isActive =
                  item.id === "freeCard"
                    ? targetElement === "freeCard" || Boolean(targetElement?.startsWith("free-"))
                    : targetElement === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTargetElementChange?.(item.id)}
                    className={`px-2 py-0.5 rounded transition-all ${
                      isActive
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
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
      </div>
    </div>
  );
}

