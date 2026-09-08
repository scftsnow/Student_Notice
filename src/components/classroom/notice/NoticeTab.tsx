"use client";

import { BoardTheme, NoticeFontSize } from "@/types/classroom";

interface NoticeTabProps {
  noticeTarget: "today" | "tomorrow";
  onNoticeTargetChange: (target: "today" | "tomorrow") => void;
  fontSize: NoticeFontSize;
  onFontSizeChange: (size: NoticeFontSize) => void;
  theme: BoardTheme;
  onThemeChange: (theme: BoardTheme) => void;
}

export default function NoticeTab({
  noticeTarget,
  onNoticeTargetChange,
  fontSize,
  onFontSizeChange,
  theme,
  onThemeChange,
}: NoticeTabProps) {
  const executeCmd = (cmd: string) => {
    document.execCommand(cmd, false);
  };

  return (
    <div className="space-y-3">
      {/* 1. 상단 통합 편집 툴바 */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 오늘 / 내일 전환 */}
          <div className="inline-flex p-0.5 bg-slate-200/80 rounded-lg font-bold">
            <button
              type="button"
              onClick={() => onNoticeTargetChange("today")}
              className={`px-3 py-1 rounded-md transition-all ${
                noticeTarget === "today"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              오늘 알림장
            </button>
            <button
              type="button"
              onClick={() => onNoticeTargetChange("tomorrow")}
              className={`px-3 py-1 rounded-md transition-all ${
                noticeTarget === "tomorrow"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              내일 알림장
            </button>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 서식 툴 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCmd("bold");
              }}
              title="굵게"
              className="w-7 h-7 rounded hover:bg-slate-200 font-extrabold flex items-center justify-center transition-colors"
            >
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCmd("italic");
              }}
              title="기울임"
              className="w-7 h-7 rounded hover:bg-slate-200 italic flex items-center justify-center transition-colors"
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCmd("strikeThrough");
              }}
              title="취소선"
              className="w-7 h-7 rounded hover:bg-slate-200 line-through text-slate-500 flex items-center justify-center transition-colors"
            >
              S
            </button>
          </div>

          <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />

          {/* 글자 크기 */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-semibold">크기:</span>
            <select
              value={fontSize}
              onChange={(e) => onFontSizeChange(e.target.value as NoticeFontSize)}
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
