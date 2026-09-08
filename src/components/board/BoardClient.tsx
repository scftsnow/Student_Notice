"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { DailyRoutineAssignment } from "@/types";
import { ClassroomRoutine, FreeCardData, BoardTheme } from "@/types/classroom";

interface BoardClientProps {
  initialDateStr: string;
  todayDayOfWeek: string;
  classNameTitle: string;
  initialContent: string;
  initialRoutines?: DailyRoutineAssignment[];
}

export default function BoardClient({
  initialDateStr,
  todayDayOfWeek,
  initialContent,
}: BoardClientProps) {
  const [contentHtml, setContentHtml] = useState<string>(initialContent || "");
  const [fontSize, setFontSize] = useState<number>(42);
  const [theme, setTheme] = useState<BoardTheme>("chalkboard");
  const [routines, setRoutines] = useState<ClassroomRoutine[]>([]);
  const [freeCards, setFreeCards] = useState<FreeCardData[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [liveDateStr, setLiveDateStr] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Real-time clock and date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${h}:${m}:${s}`);

      const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      const dayName = days[now.getDay()];
      setLiveDateStr(`${mo}월 ${d}일 ${dayName}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // BroadcastChannel and localStorage hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("classroom_os_state_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.noticeText === "string") setContentHtml(parsed.noticeText);
        if (parsed.fontSize) setFontSize(Number(parsed.fontSize));
        if (parsed.theme) setTheme(parsed.theme);
        if (Array.isArray(parsed.routines)) setRoutines(parsed.routines);
        if (Array.isArray(parsed.freeCards)) setFreeCards(parsed.freeCards);
      }
    } catch {
      // Ignore parse errors
    }

    const channel = new BroadcastChannel("classroom_os_sync");

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.noticeText !== undefined) setContentHtml(data.noticeText);
      else if (data.content !== undefined) setContentHtml(data.content);

      if (data.fontSize !== undefined) setFontSize(Number(data.fontSize));
      if (data.theme !== undefined) setTheme(data.theme);
      if (Array.isArray(data.routines)) setRoutines(data.routines);
      if (Array.isArray(data.freeCards)) setFreeCards(data.freeCards);
    };

    return () => {
      channel.close();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getThemeClasses = () => {
    switch (theme) {
      case "white":
        return {
          bg: "bg-white text-slate-900",
          routineText: "text-slate-900",
          routineWorker: "text-indigo-700",
        };
      case "navy":
        return {
          bg: "bg-[#0b132b] text-slate-100",
          routineText: "text-slate-200",
          routineWorker: "text-amber-300",
        };
      case "warm":
        return {
          bg: "bg-[#faf5ea] text-amber-950",
          routineText: "text-amber-950",
          routineWorker: "text-rose-700",
        };
      case "chalkboard":
      default:
        return {
          bg: "bg-[#1a382b] text-white",
          routineText: "text-white/90",
          routineWorker: "text-amber-300",
        };
    }
  };

  const themeStyle = getThemeClasses();

  return (
    <div
      className={`fixed inset-0 z-50 w-screen h-screen select-none overflow-hidden ${themeStyle.bg}`}
      style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* 
        교사 미리보기(BoardCanvas)와 100% 동일한 절대 좌표 기반 글상자 배치
        단, 학생 화면 요구사항에 따라 카드 배경(bg)과 테두리(border)는 완전 투명(무배경·무테두리)
      */}

      {/* 글상자 1: 날짜 글상자 (위치: left 2.5%, top 3.5% - 교사 미리보기와 동일) */}
      <div
        className="absolute z-10 font-extrabold text-2xl sm:text-4xl tracking-tight opacity-95"
        style={{ left: "2.5%", top: "3.5%" }}
      >
        {liveDateStr || `${initialDateStr} (${todayDayOfWeek})`}
      </div>

      {/* 글상자 2: 시각 글상자 (위치: right 2.5%, top 3.5% - 교사 미리보기와 동일) */}
      <div
        className="absolute z-10 flex items-center gap-3 text-right"
        style={{ right: "2.5%", top: "3.5%" }}
      >
        <div className="font-mono text-2xl sm:text-4xl font-black tracking-wider opacity-90">
          {currentTime || "--:--:--"}
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1 opacity-30 hover:opacity-100 transition-opacity"
          title="전체화면 (F11)"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>
      </div>

      {/* 글상자 3: 알림장 본문 글상자 (위치: left 2.5%, top 16%, width 95%, bottom 20% - 교사 미리보기와 동일) */}
      <div
        className="absolute z-10 overflow-y-auto"
        style={{ left: "2.5%", top: "16%", width: "95%", bottom: "20%" }}
      >
        <div
          className="font-bold tracking-tight leading-relaxed transition-all"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: "1.6",
            letterSpacing: "-0.02em",
          }}
          dangerouslySetInnerHTML={{
            __html: contentHtml || "<span class='opacity-25 italic'>등록된 알림장 내용이 없습니다.</span>",
          }}
        />
      </div>

      {/* 글상자 4: 루틴 당번 글상자 (위치: left 2.5%, bottom 3.5%, width 95% - 교사 미리보기와 동일) */}
      <div
        className="absolute z-10 flex items-center gap-6 sm:gap-8 flex-wrap font-bold opacity-95 leading-snug"
        style={{ left: "2.5%", bottom: "3.5%", width: "95%", fontSize: `${fontSize}px` }}
      >
        {routines.map((r) => {
          const currentWorkers =
            r.order.length > 0
              ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + i) % r.order.length]).join(", ")
              : "배정 없음";

          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className={`opacity-80 ${themeStyle.routineText}`}>
                {r.icon} {r.name}:
              </span>
              <span className={`font-black drop-shadow-xs ${themeStyle.routineWorker}`}>
                {currentWorkers}
              </span>
            </div>
          );
        })}
      </div>

      {/* 자유 글상자 레이어 (무배경·무테두리) */}
      {freeCards.map((card) => (
        <div
          key={card.id}
          className="absolute z-20 text-lg sm:text-2xl font-bold"
          style={{ left: card.left || "20%", top: card.top || "40%" }}
          dangerouslySetInnerHTML={{ __html: card.html }}
        />
      ))}
    </div>
  );
}
