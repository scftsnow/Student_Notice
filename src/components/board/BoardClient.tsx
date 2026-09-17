"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Coins, Maximize2, Minimize2 } from "lucide-react";
import type { DailyRoutineAssignment } from "@/types";
import { ClassroomRoutine, ClassroomStudent, FreeCardData, BoardTheme, BoardElementLayouts, LedgerRecord } from "@/types/classroom";
import { resolveStudentName, parseRoutineFormat, parsePinchHitterDetails, getActiveRoutineWorkers } from "@/lib/routineUtils";
import { checkStudentRoutinePaid } from "@/lib/routinePayStatus";
import { isBoxVisibleToday, DEFAULT_LAYOUTS } from "@/lib/boardDefaults";
import { FALLBACK_FONT_FAMILY } from "@/lib/defaultFont";
import AnalogClock from "@/components/classroom/canvas/AnalogClock";

interface BoardClientProps {
  initialDateStr: string;
  todayDayOfWeek: string;
  classNameTitle: string;
  initialContent: string;
  initialRoutines?: DailyRoutineAssignment[];
}

interface BoardTextBoxProps {
  left: string;
  top: string;
  width?: string;
  height?: string;
  fontSizePx: number;
  color?: string;
  fontFamily?: string;
  lineHeight?: string;
  align?: "left" | "center" | "right";
  z?: string;
  html?: string;
  children?: ReactNode;
}

/**
 * 학생창 텍스트 박스 공용 껍데기 (업무 요소·자유 글상자 공통).
 * 박스 모델(p-2·overflow-hidden·border-box)과 인라인 흐름을 하나로 통일해
 * 요소별 너비 어긋남을 없앤다. html이 있으면 원시 HTML, 없으면 children 렌더.
 */
function BoardTextBox({
  left,
  top,
  width,
  height,
  fontSizePx,
  color,
  fontFamily,
  lineHeight,
  align,
  z = "z-20",
  html,
  children,
}: BoardTextBoxProps) {
  const cls = `absolute ${z} font-bold p-2 leading-relaxed tracking-tight overflow-hidden box-border`;
  const style = {
    left,
    top,
    width,
    height,
    fontSize: `${fontSizePx}px`,
    textAlign: align || "left",
    color: color || "inherit",
    fontFamily: fontFamily || undefined,
    lineHeight: lineHeight || "1.4",
    letterSpacing: "-0.02em",
    wordBreak: "break-word" as const,
  };
  if (html !== undefined) {
    return <div className={cls} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
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
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);
  const [freeCards, setFreeCards] = useState<FreeCardData[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [liveDateStr, setLiveDateStr] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showEconomyShortcut, setShowEconomyShortcut] = useState<boolean>(false);
  const [layouts, setLayouts] = useState<BoardElementLayouts>(DEFAULT_LAYOUTS);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    const updateSize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const scale = Math.min(viewport.width / 1000, viewport.height / 562.5);

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
        if (Array.isArray(parsed.ledgerHistory)) setLedgerHistory(parsed.ledgerHistory);
        if (Array.isArray(parsed.freeCards)) setFreeCards(parsed.freeCards);
      }
      const savedLayouts = localStorage.getItem("classroom_board_layouts");
      if (savedLayouts) {
        const parsedLayouts = JSON.parse(savedLayouts);
        if (parsedLayouts.dateBox && parsedLayouts.clockBox && parsedLayouts.routineBox) {
          setLayouts(parsedLayouts);
        }
      }
      const savedShowEconomy = localStorage.getItem("classroom_show_economy_shortcut");
      if (savedShowEconomy !== null) setShowEconomyShortcut(savedShowEconomy === "true");
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
      if (Array.isArray(data.ledgerHistory)) setLedgerHistory(data.ledgerHistory);
      if (Array.isArray(data.freeCards)) setFreeCards(data.freeCards);
      if (data.layouts) setLayouts(data.layouts);
      if (data.showEconomyShortcut !== undefined) setShowEconomyShortcut(Boolean(data.showEconomyShortcut));
    };

    return () => {
      channel.close();
    };
  }, []);

  const handleOpenAccountBoard = () => {
    if (typeof window !== "undefined") {
      const w = 1100;
      const h = 750;
      const left = Math.max(0, Math.round((window.screen.width - w) / 2));
      const top = Math.max(0, Math.round((window.screen.height - h) / 2));
      window.open(
        "/economy/board",
        "StudentEconomyBoardWindow",
        `width=${w},height=${h},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`,
      );
    }
  };

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
      className={`fixed inset-0 z-50 w-screen h-screen select-none overflow-hidden flex items-center justify-center ${themeStyle.bg}`}
      style={{ fontFamily: FALLBACK_FONT_FAMILY }}
    >
      {/* 
        교사 미리보기(BoardCanvas)의 1000x562.5 기준 캔버스를 100% 동일하게 스케일링하여 투영
        비율, 글자 크기, 행간, 줄바꿈이 미리보기와 완벽히 1:1 일치
      */}
      <div
        className="relative overflow-hidden aspect-video select-none"
        style={{
          width: "1000px",
          height: "562.5px",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
      >
      {/* 글상자 1: 날짜 글상자 */}
      {isBoxVisibleToday(layouts.dateBox?.visible, layouts.dateBox?.visibleDays) && (
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
          fontFamily: layouts.dateBox.fontFamily || undefined,
        }}
      >
        {liveDateStr || `${initialDateStr} (${todayDayOfWeek})`}
      </div>
      )}

      {/* 글상자 2: 시각 글상자 */}
      {isBoxVisibleToday(layouts.clockBox?.visible, layouts.clockBox?.visibleDays) && (
      <div
        className="absolute z-10 flex items-center"
        style={{
          left: layouts.clockBox.left,
          top: layouts.clockBox.top,
          width: layouts.clockBox.width || (layouts.clockBox.clockType === "analog" ? `${(layouts.clockBox.fontSize || fontSize || 42) * 2.2}px` : "auto"),
          height: layouts.clockBox.height || (layouts.clockBox.clockType === "analog" ? `${(layouts.clockBox.fontSize || fontSize || 42) * 2.2}px` : "auto"),
          color: layouts.clockBox.color || "inherit",
          justifyContent: layouts.clockBox.align === "left" ? "flex-start" : layouts.clockBox.align === "center" ? "center" : "flex-end",
        }}
      >
        {layouts.clockBox.clockType === "analog" ? (
          <div
            className="aspect-square flex items-center justify-center p-1 pointer-events-none"
            style={{
              width: "100%",
              height: "100%",
              maxWidth: layouts.clockBox.width ? "100%" : `${(layouts.clockBox.fontSize || fontSize || 42) * 2.2}px`,
              maxHeight: layouts.clockBox.height ? "100%" : `${(layouts.clockBox.fontSize || fontSize || 42) * 2.2}px`,
            }}
          >
            <AnalogClock color={layouts.clockBox.color || "currentColor"} size="100%" />
          </div>
        ) : (
          <div
            className="font-mono font-black tracking-wider opacity-90 whitespace-nowrap"
            style={{
              fontSize: `${layouts.clockBox.fontSize || fontSize || 42}px`,
              color: layouts.clockBox.color || "inherit",
            }}
          >
            {layouts.clockBox.clockFormat === "12h" && currentTime
              ? (() => {
                  const parts = currentTime.split(":");
                  const hourNum = parseInt(parts[0], 10);
                  const period = hourNum < 12 ? "오전" : "오후";
                  const h12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
                  return `${period} ${h12}:${parts[1]}:${parts[2]}`;
                })()
              : (currentTime || "--:--:--")}
          </div>
        )}
      </div>
      )}

      {/* 글상자 4: 루틴 당번 글상자 (각 업무별 독립 요소) */}
      {isBoxVisibleToday(layouts.routineBox?.visible, layouts.routineBox?.visibleDays) &&
        routines.filter((r) => r.visibleInNotice !== false).map((r, idx) => {
          const rawWorkers = getActiveRoutineWorkers(r, students, false);
          const pinchDetails = parsePinchHitterDetails(r.pinchHitterStudent);

          const segments = parseRoutineFormat(
            r.displayFormat,
            r.name,
            rawWorkers,
            r.icon
          );

          const left = r.layout?.left || `${2.5 + ((idx * 26.0) % 75)}%`;
          const top = r.layout?.top || `${82.0 + Math.floor((idx * 26.0) / 75) * 8.0}%`;
          const width = r.layout?.width || "auto";
          const height = r.layout?.height || "auto";
          const routineFontSize = r.layout?.fontSize || layouts.routineBox.fontSize || fontSize || 42;
          const routineColor = r.layout?.color || layouts.routineBox.color || "inherit";
          const routineLh = r.layout?.lineHeight || layouts.routineBox.lineHeight;

          return (
            <BoardTextBox
              key={r.id}
              z="z-10"
              left={left}
              top={top}
              width={width}
              height={height}
              fontSizePx={routineFontSize}
              color={routineColor}
              fontFamily={r.layout?.fontFamily || layouts.routineBox.fontFamily || undefined}
              lineHeight={
                routineLh
                  ? typeof routineLh === "number"
                    ? routineLh > 10 ? `${routineLh / 100}` : `${routineLh}`
                    : routineLh
                  : undefined
              }
            >
              {segments.map((seg, sIdx) => {
                if (seg.type === "text") {
                  return (
                    <span
                      key={`b-text-${sIdx}`}
                      className={`whitespace-pre ${routineColor ? "" : themeStyle.routineText}`}
                      style={routineColor ? { color: routineColor } : undefined}
                    >
                      {seg.text}
                    </span>
                  );
                }
                const workerIdx = seg.workerIndex ?? 0;
                const currentWorker = rawWorkers[workerIdx] || "";
                const detail = pinchDetails[workerIdx];
                const isSubstituted = Boolean(detail && detail.name && detail.name !== "none");
                const payStatus = checkStudentRoutinePaid(r, currentWorker, ledgerHistory);

                let workerColorCls = "";
                if (payStatus.isPaid) {
                  workerColorCls =
                    theme === "white"
                      ? "text-lime-700 bg-lime-100/90 px-1 rounded font-black drop-shadow-sm"
                      : "text-lime-300 font-extrabold drop-shadow-[0_0_8px_rgba(163,230,53,0.85)]";
                } else if (isSubstituted) {
                  workerColorCls = "text-amber-400 font-black drop-shadow-sm";
                } else {
                  workerColorCls = routineColor ? "" : themeStyle.routineWorker;
                }

                return (
                  <span
                    key={`b-worker-${sIdx}`}
                    // 주의: 기본 drop-shadow-sm을 두면 지급 형광(drop-shadow-[...])과
                    // 같은 filter 속성을 두고 경합해 형광이 지므로 두지 않는다 (미리보기 칩과 동일).
                    className={`font-black underline decoration-2 whitespace-nowrap transition-colors ${workerColorCls}`}
                    style={routineColor && !isSubstituted && !payStatus.isPaid ? { color: routineColor } : undefined}
                    title={payStatus.isPaid ? `${currentWorker} — ${payStatus.periodLabel} 지급 완료` : undefined}
                  >
                    {seg.text}
                  </span>
                );
              })}
            </BoardTextBox>
          );
        })}

      {/* 자유 글상자 레이어 (무배경·무테두리, 교사 미리보기와 1:1 완벽 일치) */}
      {freeCards
        .filter((card) => isBoxVisibleToday(card.visible, card.visibleDays))
        .map((card) => (
        <BoardTextBox
          key={card.id}
          left={card.left || "20%"}
          top={card.top || "40%"}
          width={card.width}
          height={card.height}
          fontSizePx={card.fontSize || fontSize || 42}
          align={card.align}
          color={card.color}
          fontFamily={card.fontFamily}
          lineHeight={
            card.lineHeight
              ? (typeof card.lineHeight === "number"
                ? card.lineHeight > 10 ? `${card.lineHeight / 100}` : `${card.lineHeight}`
                : card.lineHeight)
              : undefined
          }
          html={card.html}
        />
      ))}

      {/* 글상자 5: 학생 화폐 바로가기 아이콘 (동전 아이콘) */}
      {showEconomyShortcut && (
        <div
          className="absolute z-20 cursor-pointer select-none flex items-center justify-center p-1.5 transition-transform hover:scale-110 active:scale-95 overflow-hidden box-border"
          style={{
            left: layouts.accountBox?.left || "93.0%",
            top: layouts.accountBox?.top || "89.0%",
            width: layouts.accountBox?.width || "50px",
            height: layouts.accountBox?.height || "50px",
          }}
          onClick={handleOpenAccountBoard}
          title="학생 계좌(화폐 전광판) 열기"
        >
          <Coins
            className="w-full h-full text-amber-300 drop-shadow-md"
            style={layouts.accountBox?.color ? { color: layouts.accountBox.color } : undefined}
          />
        </div>
      )}
      </div>

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
