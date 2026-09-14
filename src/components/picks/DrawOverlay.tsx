"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X, RotateCcw, Copy, Check } from "lucide-react";
import {
  isMuted,
  setMuted,
  playTick,
  playPop,
  playFanfare,
  playClick,
} from "@/lib/pickSound";

interface DrawOverlayProps {
  open: boolean;
  title: string;
  rollingNames: string[];
  results: string[];
  onRedraw: () => void;
  onClose: () => void;
}

type Phase = "rolling" | "revealing" | "done";

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function DrawOverlay({
  open,
  title,
  rollingNames,
  results,
  onRedraw,
  onClose,
}: DrawOverlayProps) {
  const [phase, setPhase] = useState<Phase>("rolling");
  const [current, setCurrent] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const timers = useRef<number[]>([]);
  const rollingRef = useRef(rollingNames);
  rollingRef.current = rollingNames;
  const phaseRef = useRef<Phase>("rolling");
  phaseRef.current = phase;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    setMutedState(isMuted());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    clearTimers();
    setPhase("rolling");
    setRevealed(0);
    setCopied(false);
    setConfetti([]);

    const names = rollingRef.current.length > 0 ? rollingRef.current : ["?"];
    const steps = 15;
    let elapsed = 0;
    for (let i = 0; i < steps; i++) {
      const delay = Math.round(60 + i * i * 1.4);
      elapsed += delay;
      const at = elapsed;
      const step = i;
      later(() => {
        setCurrent(names[Math.floor(Math.random() * names.length)]);
        playTick(step);
      }, at);
    }
    later(() => {
      if (results.length === 0) {
        setPhase("done");
        return;
      }
      setPhase("revealing");
      results.forEach((_, idx) => {
        later(() => {
          setRevealed(idx + 1);
          playPop();
        }, idx * 500);
      });
      later(() => {
        setPhase("done");
        playFanfare();
        setConfetti(
          Array.from({ length: 70 }, (_, i) => ({
            left: (i * 97) % 100,
            delay: ((i * 13) % 40) / 100,
            duration: 2.2 + ((i * 7) % 15) / 10,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            size: 6 + ((i * 11) % 8),
          }))
        );
      }, results.length * 500 + 200);
    }, elapsed + 150);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.code === "Space" && !e.repeat && phaseRef.current === "done") {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName ?? "";
        if (tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        onRedraw();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      clearTimers();
      window.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results]);

  if (!open) return null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playClick();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(results.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 실패 무시
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 overflow-y-auto">
      {confetti.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute top-0"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 0.6,
                backgroundColor: c.color,
                animation: `pick-fall ${c.duration}s linear ${c.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}
      <style>{`@keyframes pick-fall { to { transform: translateY(105vh) rotate(720deg); } }`}</style>

      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-6 sm:p-10 text-center">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
            title={muted ? "소리 켜기" : "소리 끄기"}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <h2 className="text-lg sm:text-2xl font-black text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
            title="닫기 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === "rolling" && (
          <div className="py-14">
            <div className="inline-block min-w-[280px] px-10 py-6 rounded-2xl bg-indigo-600 text-white text-3xl sm:text-5xl font-black shadow-lg shadow-indigo-200">
              {current || "..."}
            </div>
            <p className="mt-6 text-sm text-slate-400 animate-pulse">뽑는 중...</p>
          </div>
        )}

        {phase !== "rolling" && (
          <div className="py-8 space-y-3">
            {results.slice(0, revealed).map((r, i) => (
              <div
                key={`${r}-${i}`}
                className="mx-auto max-w-xl px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-3xl sm:text-5xl font-black shadow-lg animate-[pick-pop_0.3s_ease-out]"
              >
                {r}
              </div>
            ))}
            {phase === "revealing" && (
              <p className="text-sm text-slate-400 animate-pulse">공개 중...</p>
            )}
            {phase === "done" && results.length === 0 && (
              <p className="text-sm text-slate-500">결과가 없습니다.</p>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                playClick();
                onRedraw();
              }}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200"
            >
              <RotateCcw className="w-4 h-4" />
              다시 뽑기
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "복사됨" : "결과 복사"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold"
            >
              닫기
            </button>
          </div>
        )}
        {phase === "done" && (
          <p className="mt-3 text-[11px] text-slate-400">스페이스: 다시 뽑기 · ESC: 닫기</p>
        )}
      </div>
      <style>{`@keyframes pick-pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
