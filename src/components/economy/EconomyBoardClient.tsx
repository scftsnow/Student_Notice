"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Coins, Users, User, ChevronUp, ChevronDown, Wallet } from "lucide-react";
import { ClassroomStudent, BoardTheme } from "@/types/classroom";
import BoardManagePanel from "./BoardManagePanel";

interface EconomyBoardClientProps {
  initialClassName?: string;
  initialCurrencyName?: string;
}

export default function EconomyBoardClient({
  initialClassName = "우리 반",
  initialCurrencyName = "원",
}: EconomyBoardClientProps) {
  const [className, setClassName] = useState<string>(initialClassName);
  const [currencyName, setCurrencyName] = useState<string>(initialCurrencyName);
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [theme, setTheme] = useState<BoardTheme>("chalkboard");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [liveDateStr, setLiveDateStr] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"input" | "name" | "balance_desc">("input");
  const [isManageOpen, setIsManageOpen] = useState(false);

  // 실시간 시계 및 날짜
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

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${className ? `${className} ` : ""}${currencyName} 현황판`;
    }
  }, [className, currencyName]);

  // localStorage 하이드레이션 및 BroadcastChannel 실시간 수신
  useEffect(() => {
    try {
      const savedV3 = localStorage.getItem("classroom_os_state_v3");
      const savedV2 = localStorage.getItem("classroom_os_state_v2");
      const saved = savedV3 || savedV2;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.className) setClassName(parsed.className);
        if (parsed.currencyName && parsed.currencyName !== "미소") setCurrencyName(parsed.currencyName);
        if (Array.isArray(parsed.students)) setStudents(parsed.students);
        if (typeof parsed.treasuryBalance === "number") setTreasuryBalance(parsed.treasuryBalance);
        if (parsed.theme) setTheme(parsed.theme);
      }
    } catch {
      // Ignore parse errors
    }

    const channel = new BroadcastChannel("classroom_os_sync");

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.className) setClassName(data.className);
      if (data.currencyName && data.currencyName !== "미소") setCurrencyName(data.currencyName);
      if (Array.isArray(data.students)) setStudents(data.students);
      if (typeof data.treasuryBalance === "number") setTreasuryBalance(data.treasuryBalance);
      if (data.theme) setTheme(data.theme);
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

  // 정렬된 학생 목록 (입력순 / 이름순 / 잔액순)
  const sortedStudents =
    sortBy === "input"
      ? [...students]
      : [...students].sort((a, b) => {
          if (sortBy === "balance_desc") {
            return b.balance - a.balance || a.name.localeCompare(b.name, "ko");
          }
          return a.name.localeCompare(b.name, "ko");
        });

  const totalCirculation = students.reduce((acc, s) => acc + s.balance, 0);

  // 테마별 스타일
  const getThemeStyles = () => {
    switch (theme) {
      case "white":
        return {
          bg: "bg-slate-50 text-slate-900",
          headerBorder: "border-slate-200 bg-white/90",
          cardBg: "bg-white border-slate-200 text-slate-900 shadow-sm",
          badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          balanceText: "text-indigo-600",
          statBg: "bg-slate-100 text-slate-700",
        };
      case "navy":
        return {
          bg: "bg-[#0b132b] text-slate-100",
          headerBorder: "border-white/10 bg-black/20",
          cardBg: "bg-white/10 border-white/15 text-white backdrop-blur-sm",
          badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/30",
          balanceText: "text-amber-300",
          statBg: "bg-white/10 text-slate-200",
        };
      case "warm":
        return {
          bg: "bg-[#faf5ea] text-amber-950",
          headerBorder: "border-amber-200/80 bg-amber-50/90",
          cardBg: "bg-white border-amber-200/80 text-amber-950 shadow-sm",
          badgeBg: "bg-amber-100 text-amber-800 border-amber-300",
          balanceText: "text-amber-700",
          statBg: "bg-amber-100/80 text-amber-900",
        };
      case "chalkboard":
      default:
        return {
          bg: "bg-[#1a382b] text-white",
          headerBorder: "border-white/15 bg-black/25",
          cardBg: "bg-white/10 border-white/20 text-white backdrop-blur-sm",
          badgeBg: "bg-emerald-400/20 text-emerald-200 border-emerald-400/30",
          balanceText: "text-amber-300 drop-shadow-sm",
          statBg: "bg-white/10 text-white/90",
        };
    }
  };

  const style = getThemeStyles();

  return (
    <div
      className={`fixed inset-0 z-50 w-screen h-screen select-none overflow-hidden flex flex-col ${style.bg}`}
      style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* 상단 헤더 바 */}
      <header className={`px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0 backdrop-blur-md ${style.headerBorder}`}>
        {/* 좌측: 타이틀 및 국고 배지 */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 shrink-0" />
            <h1 className="font-black text-2xl sm:text-3xl lg:text-4xl tracking-tight">
              {className ? `${className} ` : ""}{currencyName} 현황판
            </h1>
          </div>

          {/* 우측 배지: 국고 단독 노출 및 대형 폰트 */}
          <div className="flex items-center">
            <span className={`px-4 py-1.5 rounded-xl border border-white/20 font-black text-base sm:text-lg lg:text-xl flex items-center gap-2 shadow-sm ${style.statBg}`}>
              <span className="opacity-80 font-bold">국고</span>
              <span className="font-mono text-amber-300 drop-shadow-sm">
                {treasuryBalance.toLocaleString()} {currencyName}
              </span>
            </span>
          </div>
        </div>

        {/* 우측: 날짜/시간 및 제어 버튼 */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs opacity-75 font-semibold">{liveDateStr}</div>
            <div className="font-mono text-lg font-black tracking-wider leading-none">{currentTime}</div>
          </div>

          {/* 정렬 토글 */}
          <div className="inline-flex p-0.5 rounded-lg bg-black/20 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSortBy("input")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === "input" ? "bg-white text-slate-900 shadow-sm" : "opacity-75 hover:opacity-100"
              }`}
            >
              입력 순
            </button>
            <button
              type="button"
              onClick={() => setSortBy("name")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === "name" ? "bg-white text-slate-900 shadow-sm" : "opacity-75 hover:opacity-100"
              }`}
            >
              이름순
            </button>
            <button
              type="button"
              onClick={() => setSortBy("balance_desc")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sortBy === "balance_desc" ? "bg-white text-slate-900 shadow-sm" : "opacity-75 hover:opacity-100"
              }`}
            >
              잔액순
            </button>
          </div>

          {/* 전체화면 버튼 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 transition-all opacity-80 hover:opacity-100"
            title="전체화면 (F11)"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 본문: 학생 계좌 카드 그리드 (1행 단일 행 정렬 및 대형 폰트) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {students.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-60 font-bold text-base space-y-2">
            <Users className="w-12 h-12" />
            <p>등록된 학생 계좌가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
            {sortedStudents.map((s) => (
              <div
                key={s.name}
                className={`px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 shadow-sm ${style.cardBg}`}
              >
                {/* 1행 좌측: 학생 이름 */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 opacity-60 shrink-0" />
                  <span className="font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate">
                    {s.name}
                  </span>
                </div>

                {/* 1행 우측: 학생 잔액 */}
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className={`font-mono font-black text-2xl sm:text-3xl lg:text-4xl tracking-tight ${style.balanceText}`}>
                    {s.balance.toLocaleString()}
                  </span>
                  <span className="text-sm sm:text-base font-bold opacity-80">{currencyName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 하단 학급돈 관리 패널 (접기/펼치기) */}
      <div className={`shrink-0 border-t ${style.headerBorder}`}>
        <button
          type="button"
          onClick={() => setIsManageOpen((prev) => !prev)}
          className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-black tracking-tight hover:opacity-80 transition-opacity"
        >
          <Wallet className="w-4 h-4 text-amber-400" />
          <span>학급돈 관리</span>
          {isManageOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {isManageOpen && (
          <div className="max-h-[46vh] overflow-y-auto bg-slate-50 text-slate-900 border-t border-white/10">
            <BoardManagePanel />
          </div>
        )}
      </div>
    </div>
  );
}
