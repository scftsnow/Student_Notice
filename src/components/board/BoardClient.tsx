"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { DailyRoutineAssignment } from "@/types";
import { ClassroomRoutine, ClassroomStudent, FreeCardData, BoardTheme, BoardElementLayouts } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat } from "@/lib/routineUtils";

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
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [freeCards, setFreeCards] = useState<FreeCardData[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [liveDateStr, setLiveDateStr] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [layouts, setLayouts] = useState<BoardElementLayouts>({
    dateBox: { left: "2.5%", top: "3.0%", fontSize: 42 },
    clockBox: { left: "68.0%", top: "3.0%", fontSize: 42 },
    noticeBox: { left: "2.5%", top: "16.0%", width: "95.0%", height: "62.0%", fontSize: 42 },
    routineBox: { left: "2.5%", top: "82.0%", width: "95.0%", fontSize: 42 },
  });

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
      const saved = localStorage.getItem("classroom_os_state_v3");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.noticeText === "string") setContentHtml(parsed.noticeText);
        if (parsed.fontSize) setFontSize(Number(parsed.fontSize));
        if (parsed.theme) setTheme(parsed.theme);
        if (Array.isArray(parsed.routines)) setRoutines(parsed.routines);
        if (Array.isArray(parsed.students)) setStudents(parsed.students);
        if (Array.isArray(parsed.freeCards)) setFreeCards(parsed.freeCards);
      }
      const savedLayouts = localStorage.getItem("classroom_board_layouts");
      if (savedLayouts) {
        const parsedLayouts = JSON.parse(savedLayouts);
        if (parsedLayouts.dateBox && parsedLayouts.clockBox && parsedLayouts.noticeBox && parsedLayouts.routineBox) {
          setLayouts(parsedLayouts);
        }
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
      if (Array.isArray(data.students)) setStudents(data.students);
      if (Array.isArray(data.freeCards)) setFreeCards(data.freeCards);
      if (data.layouts) setLayouts(data.layouts);
    };

    return () => {
      channel.close();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
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

      {/* 글상자 1: 날짜 글상자 */}
      <div
        className="absolute z-10 font-extrabold tracking-tight opacity-95 whitespace-nowrap"
        style={{
          left: layouts.dateBox.left,
          top: layouts.dateBox.top,
          width: layouts.dateBox.width,
          height: layouts.dateBox.height,
          fontSize: `${layouts.dateBox.fontSize || fontSize || 42}px`,
          color: layouts.dateBox.color || "inherit",
          textAlign: layouts.dateBox.align || "left",
        }}
      >
        {liveDateStr || `${initialDateStr} (${todayDayOfWeek})`}
      </div>

      {/* 글상자 2: 시각 글상자 */}
      <div
        className="absolute z-10 flex items-center gap-3 text-right"
        style={{
          left: layouts.clockBox.left,
          top: layouts.clockBox.top,
          width: layouts.clockBox.width,
          height: layouts.clockBox.height,
          color: layouts.clockBox.color || "inherit",
        }}
      >
        <div
          className="font-mono font-black tracking-wider opacity-90 whitespace-nowrap"
          style={{
            fontSize: `${layouts.clockBox.fontSize || fontSize || 42}px`,
            color: layouts.clockBox.color || "inherit",
          }}
        >
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

      {/* 글상자 3: 알림장 본문 글상자 (자유 글상자 형식 연동) */}
      <div
        className="absolute z-10 overflow-y-auto"
        style={{
          left: layouts.noticeBox.left,
          top: layouts.noticeBox.top,
          width: layouts.noticeBox.width || "95.0%",
          height: layouts.noticeBox.height || "62.0%",
          color: layouts.noticeBox.color || "inherit",
        }}
      >
        <div
          className="font-bold tracking-tight leading-relaxed transition-all p-2"
          style={{
            fontSize: `${layouts.noticeBox.fontSize || fontSize || 42}px`,
            color: layouts.noticeBox.color || "inherit",
            textAlign: layouts.noticeBox.align || "left",
            lineHeight: "1.6",
            letterSpacing: "-0.02em",
          }}
          dangerouslySetInnerHTML={{
            __html: contentHtml || "<span class='opacity-25 italic'>등록된 알림장 내용이 없습니다.</span>",
          }}
        />
      </div>

      {/* 글상자 4: 루틴 당번 글상자 */}
      <div
        className="absolute z-10 flex items-center gap-6 sm:gap-8 flex-wrap font-bold opacity-95 leading-snug"
        style={{
          left: layouts.routineBox.left,
          top: layouts.routineBox.top,
          width: layouts.routineBox.width || "95.0%",
          height: layouts.routineBox.height,
          fontSize: `${layouts.routineBox.fontSize || fontSize || 42}px`,
          color: layouts.routineBox.color || "inherit",
        }}
      >
        {routines.filter((r) => r.visibleInNotice !== false).map((r) => {
          const rawWorkers =
            r.order.length > 0
              ? Array.from({ length: r.slots }, (_, i) => {
                  const raw = r.order[(r.currentIdx + i) % r.order.length];
                  return resolveStudentName(raw, students);
                })
              : [];
          const pinchHitter =
            r.pinchHitterStudent && r.pinchHitterStudent !== "none"
              ? resolveStudentName(r.pinchHitterStudent, students)
              : "";
          const workerList = rawWorkers.map((originalName, idx) => {
            const isSubstituted = Boolean(pinchHitter && idx === 0);
            return isSubstituted ? `${pinchHitter} (대타)` : originalName;
          });

          const segments = parseRoutineFormat(
            r.displayFormat,
            r.name,
            workerList,
            r.icon
          );

          return (
            <div key={r.id} className="flex items-center gap-1 flex-wrap leading-snug">
              {segments.map((seg, sIdx) => {
                if (seg.type === "text") {
                  return (
                    <span
                      key={`b-text-${sIdx}`}
                      className={`opacity-80 whitespace-pre ${layouts.routineBox.color ? "" : themeStyle.routineText}`}
                      style={layouts.routineBox.color ? { color: layouts.routineBox.color } : undefined}
                    >
                      {seg.text}
                    </span>
                  );
                }
                return (
                  <span
                    key={`b-worker-${sIdx}`}
                    className={`font-black drop-shadow-xs ${themeStyle.routineWorker}`}
                  >
                    {seg.text}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 자유 글상자 레이어 (무배경·무테두리) */}
      {freeCards.map((card) => (
        <div
          key={card.id}
          className="absolute z-20 font-bold"
          style={{
            left: card.left || "20%",
            top: card.top || "40%",
            width: card.width,
            height: card.height,
            fontSize: `${card.fontSize || fontSize || 42}px`,
            textAlign: card.align || "left",
            color: card.color || "inherit",
          }}
          dangerouslySetInnerHTML={{ __html: card.html }}
        />
      ))}

      {/* 전체화면 / 창화면 전환 플로팅 버튼 (우측 하단) */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="fixed bottom-4 right-4 z-50 p-2.5 rounded-2xl bg-black/40 hover:bg-black/60 active:scale-95 text-white/70 hover:text-white backdrop-blur-md border border-white/20 transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold select-none cursor-pointer"
        title={isFullscreen ? "창 화면으로 복귀 (Esc)" : "전체화면 전환 (F11)"}
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="w-4 h-4" />
            <span className="opacity-90">창화면</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4" />
            <span className="opacity-90">전체화면</span>
          </>
        )}
      </button>
    </div>
  );
}
