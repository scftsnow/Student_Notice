"use client";

import { useEffect } from "react";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Hourglass,
  AlarmClock,
  X,
} from "lucide-react";
import { formatCountdown, formatStopwatch, type TimerMode } from "@/lib/timerUtils";
import { useTimerController, TIMER_PRESET_SECONDS } from "@/hooks/useTimerController";
import BgmSection from "./BgmSection";

/**
 * 타이머 전광판 (별도 창, 뽑기 전광판과 같은 어두운 스타일).
 * 표시+설정 일체형. 로직은 useTimerController 공유 (제어판과 동일 동작).
 */
export default function TimerWindowView() {
  const t = useTimerController();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        window.close();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none relative">
      <button
        type="button"
        onClick={() => window.close()}
        title="창 닫기"
        className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-full max-w-2xl flex flex-col items-center space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold tracking-wide">
          <Timer className="w-4 h-4 text-indigo-400" />
          <span>타이머 · {t.isCountdown ? "카운트다운" : "스톱워치"}</span>
        </div>

        <div
          className={`font-mono font-black tabular-nums tracking-tight leading-none text-8xl sm:text-9xl ${
            t.done ? "text-rose-400 animate-pulse" : "text-white"
          }`}
        >
          {t.isCountdown ? formatCountdown(t.remainingMs) : formatStopwatch(t.swElapsedMs)}
        </div>

        {t.done ? (
          <div className="text-2xl sm:text-3xl font-black text-rose-400 animate-pulse">
            시간 종료!
          </div>
        ) : (
          <div className="text-sm font-bold text-slate-400">
            {t.isCountdown
              ? t.status === "running"
                ? "진행 중"
                : t.status === "paused"
                  ? "일시정지 중"
                  : `설정 ${formatCountdown(t.totalMs)}`
              : t.swRunning
                ? "측정 중"
                : "대기 중"}
          </div>
        )}

        {t.isCountdown && (
          <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${t.done ? "bg-rose-500" : "bg-indigo-500"}`}
              style={{ width: `${t.progress}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
            {(
              [
                { v: "countdown", label: "카운트다운", Icon: Hourglass },
                { v: "stopwatch", label: "스톱워치", Icon: AlarmClock },
              ] as { v: TimerMode; label: string; Icon: typeof Hourglass }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => t.switchMode(o.v)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  t.mode === o.v
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <o.Icon className="w-3.5 h-3.5" />
                {o.label}
              </button>
            ))}
          </div>
          {t.isCountdown ? (
            t.status === "running" ? (
              <button
                type="button"
                onClick={t.pauseCountdown}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Pause className="w-4 h-4" />
                일시정지
              </button>
            ) : (
              <button
                type="button"
                onClick={t.startCountdown}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4" />
                {t.status === "done" ? "다시 시작" : "시작"}
              </button>
            )
          ) : t.swRunning ? (
            <button
              type="button"
              onClick={t.pauseStopwatch}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <Pause className="w-4 h-4" />
              일시정지
            </button>
          ) : (
            <button
              type="button"
              onClick={t.startStopwatch}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4" />
              시작
            </button>
          )}
          <button
            type="button"
            onClick={t.isCountdown ? t.resetCountdown : t.resetStopwatch}
            className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            리셋
          </button>
        </div>

        {t.isCountdown && (
          <div className="w-full max-w-xl space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {TIMER_PRESET_SECONDS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => t.applyTotal(sec * 1000)}
                  disabled={t.status === "running"}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-colors disabled:opacity-40 ${
                    t.totalMs === sec * 1000 && t.status !== "running"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                      : "bg-white/10 border-white/10 text-slate-200 hover:bg-white/20"
                  }`}
                >
                  {sec / 60}분
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={99}
                value={t.minText}
                onChange={(e) => t.setMinText(e.target.value)}
                disabled={t.status === "running"}
                title="분"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/10 bg-white/10 font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
              />
              <span className="text-sm font-bold text-slate-400 shrink-0">분</span>
              <input
                type="number"
                min={0}
                max={59}
                value={t.secText}
                onChange={(e) => t.setSecText(e.target.value)}
                disabled={t.status === "running"}
                title="초"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/10 bg-white/10 font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
              />
              <span className="text-sm font-bold text-slate-400 shrink-0">초</span>
              <button
                type="button"
                onClick={() =>
                  t.applyTotal((Math.max(0, Number(t.minText) || 0) * 60 + Math.max(0, Number(t.secText) || 0)) * 1000)
                }
                disabled={t.status === "running"}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-bold transition-colors shrink-0"
              >
                설정
              </button>
              <button
                type="button"
                onClick={() => t.adjustRunning(60_000)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors shrink-0"
              >
                +1분
              </button>
              <button
                type="button"
                onClick={() => t.adjustRunning(-60_000)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors shrink-0"
              >
                −1분
              </button>
            </div>
            <BgmSection t={t} dark />
          </div>
        )}

        <p className="text-xs text-slate-500">ESC 닫기</p>
      </div>
    </div>
  );
}
