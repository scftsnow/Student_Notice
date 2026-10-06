"use client";

import { useRef } from "react";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Hourglass,
  AlarmClock,
  ExternalLink,
} from "lucide-react";
import { openTimerWindow } from "@/lib/timerUtils";
import { formatCountdown, formatStopwatch, type TimerMode } from "@/lib/timerUtils";
import { useTimerController, TIMER_PRESET_SECONDS } from "@/hooks/useTimerController";
import BgmSection from "./BgmSection";

/**
 * 수업용 타이머 밝은 제어판 (/timer 화면용, 다른 제어판과 같은 스타일).
 * 로직은 useTimerController 공유 (어두운 전광판과 동일 동작).
 */
export default function TimerPanel() {
  const t = useTimerController();
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl border shadow-sm p-3 space-y-2.5 ${
        t.done ? "border-rose-400 animate-pulse" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-indigo-600" />
          타이머
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openTimerWindow()}
            title="새 창으로 열기 (전자칠판용)"
            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => t.toggleFullscreen(cardRef.current)}
            title={t.isFullscreen ? "전체화면 끝내기" : "전체화면 (전자칠판용)"}
            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            {t.isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
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
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
              t.mode === o.v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <o.Icon className="w-3.5 h-3.5" />
            {o.label}
          </button>
        ))}
      </div>

      <div
        className={`rounded-xl text-center py-3 font-mono font-black tabular-nums select-none ${
          t.done ? "bg-rose-50 text-rose-600" : "bg-slate-900 text-white"
        }`}
      >
        <div className="text-5xl tracking-tight">
          {t.isCountdown ? formatCountdown(t.remainingMs) : formatStopwatch(t.swElapsedMs)}
        </div>
        {t.done ? (
          <div className="text-sm font-bold mt-1">시간 종료!</div>
        ) : (
          <div className="text-[11px] font-bold text-slate-400 mt-1">
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
      </div>

      {t.isCountdown && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${t.done ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${t.progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {t.isCountdown ? (
          t.status === "running" ? (
            <button
              type="button"
              onClick={t.pauseCountdown}
              className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
              일시정지
            </button>
          ) : (
            <button
              type="button"
              onClick={t.startCountdown}
              className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {t.status === "done" ? "다시 시작" : "시작"}
            </button>
          )
        ) : t.swRunning ? (
          <button
            type="button"
            onClick={t.pauseStopwatch}
            className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            일시정지
          </button>
        ) : (
          <button
            type="button"
            onClick={t.startStopwatch}
            className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            시작
          </button>
        )}
        <button
          type="button"
          onClick={t.isCountdown ? t.resetCountdown : t.resetStopwatch}
          title="리셋"
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          리셋
        </button>
      </div>

      {t.isCountdown && (
        <div className="space-y-1.5 pt-0.5">
          <div className="grid grid-cols-4 gap-1">
            {TIMER_PRESET_SECONDS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => t.applyTotal(sec * 1000)}
                disabled={t.status === "running"}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 ${
                  t.totalMs === sec * 1000 && t.status !== "running"
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {sec / 60}분
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={99}
              value={t.minText}
              onChange={(e) => t.setMinText(e.target.value)}
              disabled={t.status === "running"}
              title="분"
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
            />
            <span className="text-xs font-bold text-slate-400 shrink-0">분</span>
            <input
              type="number"
              min={0}
              max={59}
              value={t.secText}
              onChange={(e) => t.setSecText(e.target.value)}
              disabled={t.status === "running"}
              title="초"
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
            />
            <span className="text-xs font-bold text-slate-400 shrink-0">초</span>
            <button
              type="button"
              onClick={() =>
                t.applyTotal((Math.max(0, Number(t.minText) || 0) * 60 + Math.max(0, Number(t.secText) || 0)) * 1000)
              }
              disabled={t.status === "running"}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition-colors shrink-0"
            >
              설정
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => t.adjustRunning(60_000)}
              className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
            >
              +1분
            </button>
            <button
              type="button"
              onClick={() => t.adjustRunning(-60_000)}
              className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
            >
              −1분
            </button>
          </div>
          <BgmSection t={t} />
        </div>
      )}
    </div>
  );
}
