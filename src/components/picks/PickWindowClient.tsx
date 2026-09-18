"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  RotateCcw,
  Copy,
  Check,
  Play,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  isMuted,
  setMuted,
  playTick,
  playPop,
  playFanfare,
  playClick,
  unlockAudio,
} from "@/lib/pickSound";
import { shuffle } from "@/lib/pickRandom";
import SeatMiniCanvas from "./SeatMiniCanvas";
import type { PickWindowPayload } from "@/lib/pickWindowHelper";

type Phase = "ready" | "rolling" | "revealing" | "done";

type ResultLayout = "hero" | "duo" | "trio" | "quad" | "grid" | "dense4" | "dense5";

const POP_ANIM = "animate-[pop-in_0.35s_cubic-bezier(0.175,0.885,0.32,1.275)]";

/** 인원수→레이아웃 (순서·모둠 공통) */
function layoutForCount(n: number): ResultLayout {
  if (n <= 1) return "hero";
  if (n === 2) return "duo";
  if (n === 3) return "trio";
  if (n === 4) return "quad";
  if (n <= 12) return "grid";
  if (n <= 20) return "dense4";
  return "dense5";
}
function resultContainerClass(layout: ResultLayout, rolling = false): string {
  // 섞는 중에는 FLIP 이동으로 스크롤바가 깜빡이지 않도록 스크롤 잠금
  const scroll = rolling
    ? "overflow-hidden"
    : layout === "dense4" || layout === "dense5"
      ? "max-h-[80vh] overflow-y-auto"
      : layout === "grid"
        ? "max-h-[70vh] overflow-y-auto"
        : "";
  switch (layout) {
    case "hero":
      return "flex items-center justify-center p-2 w-full";
    case "duo":
      return "grid grid-cols-1 sm:grid-cols-2 gap-4 p-2 w-full max-w-5xl";
    case "trio":
      return "grid grid-cols-1 sm:grid-cols-3 gap-4 p-2 w-full max-w-6xl";
    case "quad":
      return "grid grid-cols-2 gap-4 p-2 w-full max-w-5xl";
    case "dense4":
      return `grid grid-cols-2 sm:grid-cols-4 gap-4 ${scroll} p-2 w-full max-w-5xl mx-auto`;
    case "dense5":
      return `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 ${scroll} p-2 w-full max-w-6xl mx-auto`;
    case "grid":
    default:
      return `grid grid-cols-1 sm:grid-cols-2 gap-3 ${scroll} p-2`;
  }
}

/** 결과 카드 (animate=false면 섞는 중 표시용) */
function resultCardClass(layout: ResultLayout, animate = true): string {
  const anim = animate ? ` ${POP_ANIM}` : "";
  const base =
    "bg-gradient-to-r from-indigo-900/70 to-violet-900/70 border border-indigo-500/30 text-white font-black flex items-center";
  switch (layout) {
    case "hero":
      return `px-12 py-10 sm:px-16 sm:py-12 rounded-3xl text-6xl sm:text-8xl shadow-2xl${anim}`;
    case "duo":
      return `px-8 py-8 rounded-3xl text-4xl sm:text-5xl shadow-xl justify-center gap-3 ${base}${anim}`;
    case "trio":
      return `px-6 py-7 rounded-3xl text-3xl sm:text-4xl shadow-xl justify-center gap-3 ${base}${anim}`;
    case "quad":
      return `px-6 py-6 rounded-2xl text-3xl sm:text-4xl shadow-lg justify-center gap-3 ${base}${anim}`;
    case "dense4":
      return `px-6 py-5 rounded-2xl text-3xl sm:text-4xl shadow-lg gap-3 ${base}${anim}`;
    case "dense5":
      return `px-5 py-4 rounded-2xl text-2xl sm:text-3xl shadow-lg gap-2.5 ${base}${anim}`;
    case "grid":
    default:
      return `px-6 py-4 rounded-2xl text-2xl sm:text-3xl shadow-lg gap-3 ${base}${anim}`;
  }
}

/** 순서 숫자 배지 */
function resultBadgeClass(layout: ResultLayout): string {
  const base =
    "bg-indigo-500/30 text-indigo-200 font-bold flex items-center justify-center shrink-0 border border-indigo-400/30";
  switch (layout) {
    case "duo":
    case "trio":
    case "quad":
    case "dense4":
      return `w-10 h-10 rounded-xl text-base ${base}`;
    case "dense5":
      return `w-9 h-9 rounded-xl text-sm ${base}`;
    case "grid":
    default:
      return `w-8 h-8 rounded-xl bg-indigo-500/30 text-indigo-300 text-sm font-bold flex items-center justify-center shrink-0 border border-indigo-400/30`;
  }
}

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function PickWindowClient() {
  const [payload, setPayload] = useState<PickWindowPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [current, setCurrent] = useState("");
  const [rollingList, setRollingList] = useState<string[]>([]);
  const [rollingGroups, setRollingGroups] = useState<string[][]>([]);
  const [revealed, setRevealed] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const timers = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const payloadRef = useRef<PickWindowPayload | null>(null);
  payloadRef.current = payload;
  // 섞기 FLIP 모션용: 칸 DOM의 이전 위치
  const shuffleGridRef = useRef<HTMLDivElement>(null);
  const prevCellPosRef = useRef(new Map<string, { left: number; top: number }>());

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // 1. 초기 페이로드 로드 (localStorage 및 BroadcastChannel 수신)
  useEffect(() => {
    setMutedState(isMuted());

    try {
      const saved = localStorage.getItem("classroom_current_pick_payload");
      if (saved) {
        const parsed = JSON.parse(saved) as PickWindowPayload;
        setPayload(parsed);
        setPhase("ready");
      }
    } catch {
      // ignore
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_pick_sync");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "PICK_START" || e.data?.type === "PICK_UPDATE") {
          const next = e.data.payload as PickWindowPayload;
          if (next) {
            // 다른 종류 뽑기의 추첨은 무시 (종류별 별도 창 유지)
            const currentType = payloadRef.current?.type;
            if (currentType && next.type !== currentType) return;
            clearTimers();
            setPayload(next);
            setPhase("ready");
            setCurrent("");
            setRollingList([]);
            setRollingGroups([]);
            setRevealed(0);
            setConfetti([]);
            setCopied(false);
          }
        }
      };
    } catch {
      // ignore
    }

    return () => {
      clearTimers();
      if (channel) channel.close();
    };
  }, []);

  // FLIP: 순서 섞기 시 카드가 제자리에서 바뀌는 게 아니라 실제 칸을 이동하도록 재생
  useLayoutEffect(() => {
    if (phaseRef.current !== "rolling") return;
    const grid = shuffleGridRef.current;
    if (!grid) return;
    const prev = prevCellPosRef.current;
    const next = new Map<string, { left: number; top: number }>();
    grid.querySelectorAll<HTMLElement>("[data-shuffle-key]").forEach((el) => {
      const key = el.dataset.shuffleKey;
      if (!key) return;
      const rect = el.getBoundingClientRect();
      next.set(key, { left: rect.left, top: rect.top });
      const old = prev.get(key);
      if (old) {
        const dx = old.left - rect.left;
        const dy = old.top - rect.top;
        if (dx !== 0 || dy !== 0) {
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = "transform 0.3s ease";
            el.style.transform = "";
          });
        }
      }
    });
    prevCellPosRef.current = next;
  }, [rollingList, rollingGroups]);

  // 2. 시작 버튼 클릭 시 추첨 애니메이션 실행
  const startDraw = useCallback(() => {
    if (!payloadRef.current) return;
    unlockAudio();
    playClick();
    // 관리 화면에 실제 추첨 시작을 통지 (학생 뽑기 중복 제외 확정용)
    try {
      const channel = new BroadcastChannel("classroom_pick_sync");
      channel.postMessage({ type: "PICK_COMMIT", id: payloadRef.current.id });
      channel.close();
    } catch {
      // ignore
    }
    clearTimers();

    setPhase("rolling");
    setRevealed(0);
    setCopied(false);
    setConfetti([]);

    const names =
      payloadRef.current.rollingNames.length > 0
        ? payloadRef.current.rollingNames
        : ["..."];
    const results = payloadRef.current.results;
    // 순서·모둠 뽑기는 결과 칸 그대로 이름만 뒤섞이는 모션 사용
    const isOrderShuffle = payloadRef.current.type === "order";
    const isGroupShuffle = payloadRef.current.type === "group";
    prevCellPosRef.current = new Map();

    const steps = 16;
    let elapsed = 0;
    for (let i = 0; i < steps; i++) {
      const delay = Math.round(50 + i * i * 1.5);
      elapsed += delay;
      const at = elapsed;
      const step = i;
      later(() => {
        if (isOrderShuffle) {
          setRollingList(shuffle(names));
        } else if (isGroupShuffle) {
          // 최종 모둠 칸 크기에 맞춰 나눠 담고 매 틱 뒤섞기
          const sizes = (payloadRef.current?.groups ?? []).map((g) => g.members.length);
          const total = sizes.reduce((a, b) => a + b, 0);
          const shape = total === names.length && sizes.length > 0 ? sizes : [names.length];
          const shuffledAll = shuffle(names);
          const chunked: string[][] = [];
          let off = 0;
          shape.forEach((sz) => {
            chunked.push(shuffledAll.slice(off, off + sz));
            off += sz;
          });
          if (off < shuffledAll.length && chunked.length > 0) {
            chunked[chunked.length - 1].push(...shuffledAll.slice(off));
          }
          setRollingGroups(chunked);
        } else {
          setCurrent(names[Math.floor(Math.random() * names.length)]);
        }
        playTick(step);
      }, at);
    }

    later(() => {
      if (results.length === 0) {
        setPhase("done");
        return;
      }
      // 인원수별 공개 속도: 소수는 한 명씩 여유 있게, 순서 전체(13명+)는 1위부터 빠르게 순차 공개
      // 모둠은 한 모둠씩 400ms 간격 공개
      const revealInterval =
        payloadRef.current?.type === "group"
          ? 400
          : results.length <= 4
            ? 450
            : results.length <= 12
              ? 300
              : 120;
      setPhase("revealing");
      results.forEach((_, idx) => {
        later(() => {
          setRevealed(idx + 1);
          playPop();
        }, idx * revealInterval);
      });

      later(() => {
        setPhase("done");
        playFanfare();
        setConfetti(
          Array.from({ length: 80 }, (_, i) => ({
            left: (i * 97) % 100,
            delay: ((i * 13) % 40) / 100,
            duration: 2.2 + ((i * 7) % 15) / 10,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            size: 8 + ((i * 11) % 8),
          }))
        );
      }, results.length * revealInterval + 200);
    }, elapsed + 150);
  }, []);

  // 3. 다시 뽑기 핸들러 (부모 창에 알림 및 로컬 재실행)
  const handleRedraw = useCallback(() => {
    try {
      const channel = new BroadcastChannel("classroom_pick_sync");
      channel.postMessage({ type: "REQUEST_REDRAW" });
      channel.close();
    } catch {
      // ignore
    }
    // 부모 창 응답 전이라도 로컬 준비 상태로 즉시 복귀하여 바로 다시 시작 가능하도록 처리
    setPhase("ready");
    setRevealed(0);
    setConfetti([]);
  }, []);

  // 4. 단축키 (Space: 시작/다시뽑기, ESC: 닫기, F: 전체화면, M: 소리 켜기/끄기)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        return;
      }

      if (e.key === "Escape") {
        if (!document.fullscreenElement) {
          window.close();
        }
        return;
      }

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        if (phaseRef.current === "ready") {
          startDraw();
        } else if (phaseRef.current === "done") {
          handleRedraw();
        }
      }

      if ((e.key === "f" || e.key === "F") && !e.repeat) {
        toggleFullscreen();
      }

      if ((e.key === "m" || e.key === "M") && !e.repeat) {
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [startDraw, handleRedraw, muted]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    setMutedState(next);
    if (!next) playClick();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleCopy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.results.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  // 모둠 구조화 결과 (payload.groups 우선, 없으면 "N모둠: a, b" 문자열 파싱)
  // ※ early return보다 앞에서 호출해야 hooks 순서가 유지됨
  const parsedGroups = useMemo(() => {
    if (!payload) return [];
    if (payload.groups && payload.groups.length > 0) return payload.groups;
    return payload.results
      .map((r) => {
        const idx = r.indexOf(":");
        if (idx === -1) return null;
        return {
          label: r.slice(0, idx).trim(),
          members: r
            .slice(idx + 1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      })
      .filter(
        (g): g is { label: string; members: string[] } =>
          g !== null && g.members.length > 0
      );
  }, [payload]);

  // 자리 뽑기 좌표 스냅샷 (있으면 전광판에 동일 좌표 미니 캔버스로 표시, 없으면 기존 텍스트 목록)
  const seatCells = useMemo(() => {
    if (!payload || payload.type !== "seat") return [];
    return (payload.seatCells ?? []).filter((c) => c.enabled);
  }, [payload]);
  const isSeatBoard = payload?.type === "seat" && seatCells.length > 0;
  /** 미니 높이 기준 행 수 (셀 key `분단-행-열`에서 복원, 실패 시 4:3 기존 비율) */
  const seatRows = useMemo(() => {
    let max = -1;
    for (const c of seatCells) {
      const m = /^(\d+)-(\d+)-(\d+)$/.exec(c.key);
      if (m) {
        const r = Number(m[2]);
        if (Number.isFinite(r) && r > max) max = r;
      }
    }
    return max >= 0 ? max + 1 : undefined;
  }, [seatCells]);

  if (!payload) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Shuffle className="w-12 h-12 text-slate-600 mb-4 animate-bounce" />
        <h1 className="text-xl font-bold mb-2">대기 중인 추첨이 없습니다</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          학급 관리 화면의 [학급 뽑기] 메뉴에서 추첨 항목을 선택하고 [뽑기]를 눌러주세요.
        </p>
        <button
          type="button"
          onClick={() => window.close()}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold"
        >
          창 닫기
        </button>
      </div>
    );
  }

  // 인원수별 맞춤 레이아웃: 1명 가운데 · 2명 좌우 · 3명 좌중우 · 4명 2x2 · 12명까지 일반 · 20명까지 4열 대형 · 초과 시 5열
  const resultCount = payload.results.length;
  const resultLayout = layoutForCount(resultCount);
  const isDenseLayout = resultLayout === "dense4" || resultLayout === "dense5";

  const isGroupBoard = payload.type === "group" && parsedGroups.length > 0;
  const groupTotal = parsedGroups.reduce((n, g) => n + g.members.length, 0);
  const groupMemberLayout = layoutForCount(Math.max(groupTotal, 1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col select-none overflow-x-hidden relative">
      {/* 폭죽(컨페티) 이펙트 */}
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 rounded-sm shadow-sm"
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

      {/* 중앙 메인 스테이지 (상·하단 바 없이 뽑기 화면만) */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-5 text-center relative z-10 min-h-screen">
        {/* PHASE 1: READY (시작 대기 화면) */}
        {phase === "ready" && (
          <div className="max-w-2xl w-full flex flex-col items-center space-y-8 animate-[fade-in_0.3s_ease-out]">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold tracking-wide">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>추첨 준비 완료 · 후보 {payload.rollingNames.length}명</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                {payload.title}
              </h2>
              <p className="text-base sm:text-lg text-slate-400">
                선생님께서 아래 <span className="text-indigo-400 font-bold">[추첨 시작]</span> 버튼을 누르면 시작됩니다.
              </p>
            </div>

            {/* 거대한 시작 버튼 */}
            <button
              type="button"
              onClick={startDraw}
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-6 sm:px-14 sm:py-7 rounded-3xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-black text-2xl sm:text-3xl shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-indigo-400/40"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </div>
              <span>추첨 시작</span>
            </button>

            <p className="text-xs text-slate-500">
              단축키: <kbd className="px-2 py-1 rounded-md bg-white/10 text-slate-300 font-mono">Space</kbd> 시작/재추첨 · <kbd className="px-2 py-1 rounded-md bg-white/10 text-slate-300 font-mono">F</kbd> 전체화면 · <kbd className="px-2 py-1 rounded-md bg-white/10 text-slate-300 font-mono">M</kbd> 소리 · <kbd className="px-2 py-1 rounded-md bg-white/10 text-slate-300 font-mono">ESC</kbd> 닫기
            </p>

            {/* 후보자 태그 프리뷰 */}
            {payload.rollingNames.length > 0 && (
              <div className="w-full mt-4 pt-6 border-t border-white/10">
                <p className="text-xs font-bold text-slate-400 mb-3 text-left">참여 학생 명단</p>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 rounded-2xl bg-white/5 border border-white/10 justify-center">
                  {payload.rollingNames.map((name, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2: ROLLING (순서·모둠은 결과 칸 그대로 섞기, 그 외는 이름 깜빡이기) */}
        {phase === "rolling" &&
          (payload.type === "order" ? (
            <div className="py-4 space-y-4 w-full animate-[scale-up_0.2s_ease-out]">
              <div ref={shuffleGridRef} className={resultContainerClass(resultLayout, true)}>
                {(rollingList.length > 0 ? rollingList : payload.rollingNames)
                  .slice(0, Math.max(resultCount, 1))
                  .map((name, i) => (
                    <div
                      key={name}
                      data-shuffle-key={name}
                      className={resultCardClass(resultLayout, false)}
                    >
                      {resultLayout !== "hero" && (
                        <span className={resultBadgeClass(resultLayout)}>{i + 1}</span>
                      )}
                      <span className="truncate flex-1 text-center">{name}</span>
                    </div>
                  ))}
              </div>
              <div className="flex items-center justify-center gap-2 text-base font-bold text-indigo-300 animate-pulse">
                <Sparkles className="w-5 h-5" />
                <span>순서를 섞는 중...</span>
              </div>
            </div>
          ) : isGroupBoard ? (
            <div className="py-4 space-y-4 w-full animate-[scale-up_0.2s_ease-out]">
              <div
                ref={shuffleGridRef}
                className="w-full max-w-6xl mx-auto space-y-3 max-h-[70vh] overflow-hidden p-2"
              >
                {(rollingGroups.length > 0
                  ? rollingGroups
                  : parsedGroups.map((g) => g.members)
                ).map((members, gi) => (
                  <div key={gi} className="flex items-center gap-3">
                    <span className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500/40 border border-indigo-400/40 text-white text-lg sm:text-xl font-black shadow">
                      {parsedGroups[gi]?.label ?? `${gi + 1}모둠`}
                    </span>
                    <div className="flex-1 flex flex-wrap gap-2">
                      {members.map((name) => (
                        <div
                          key={name}
                          data-shuffle-key={name}
                          className={`${resultCardClass(groupMemberLayout, false)} flex-1 min-w-[130px]`}
                        >
                          <span className="truncate flex-1 text-center">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 text-base font-bold text-indigo-300 animate-pulse">
                <Sparkles className="w-5 h-5" />
                <span>모둠을 섞는 중...</span>
              </div>
            </div>
          ) : (
            <div className="py-12 space-y-8 animate-[scale-up_0.2s_ease-out]">
              <div className="inline-block min-w-[300px] sm:min-w-[420px] px-12 py-8 rounded-3xl bg-indigo-600 text-white text-4xl sm:text-6xl font-black shadow-2xl shadow-indigo-500/50 border border-indigo-400/40 animate-pulse">
                {current || "..."}
              </div>
              <div className="flex items-center justify-center gap-2 text-base font-bold text-indigo-300 animate-pulse">
                <Sparkles className="w-5 h-5" />
                <span>두구두구... 추첨하는 중!</span>
              </div>
            </div>
          ))}

        {/* PHASE 3 & 4: REVEALING / DONE (공개 및 결과 완료 화면) */}
        {(phase === "revealing" || phase === "done") && (
          <div
            className={
              isDenseLayout
                ? "w-full space-y-3 animate-[fade-in_0.3s_ease-out]"
                : "w-full max-w-3xl space-y-6 animate-[fade-in_0.3s_ease-out]"
            }
          >
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <h3
                className={
                  isDenseLayout
                    ? "text-lg font-black text-white"
                    : "text-xl sm:text-2xl font-black text-white"
                }
              >
                {phase === "revealing" ? "결과 공개 중..." : "🎉 최종 추첨 결과"}
              </h3>
            </div>

            {/* 결과 목록 (모둠은 행별 모둠 카드, 자리는 동일 좌표 미니 캔버스, 그 외 인원수별 맞춤 배치·크기) */}
            {isGroupBoard ? (
              <div className="w-full max-w-6xl mx-auto space-y-3 max-h-[70vh] overflow-y-auto p-2">
                {parsedGroups.slice(0, revealed).map((g, gi) => (
                  <div key={`${g.label}-${gi}`} className={`flex items-center gap-3 ${POP_ANIM}`}>
                    <span className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500/40 border border-indigo-400/40 text-white text-lg sm:text-xl font-black shadow">
                      {g.label}
                    </span>
                    <div className="flex-1 flex flex-wrap gap-2">
                      {g.members.map((m) => (
                        <div
                          key={`${gi}-${m}`}
                          className={`${resultCardClass(groupMemberLayout)} flex-1 min-w-[130px]`}
                        >
                          <span className="truncate flex-1 text-center">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : isSeatBoard ? (
              <div className="w-full max-w-4xl mx-auto p-2">
                <SeatMiniCanvas cells={seatCells} dark cardExtraClass={POP_ANIM} rows={seatRows} />
              </div>
            ) : (
            <div className={resultContainerClass(resultLayout)}>
              {payload.results.slice(0, revealed).map((r, i) => (
                <div key={`${r}-${i}`} className={resultCardClass(resultLayout)}>
                  {resultLayout !== "hero" && (
                    <span className={resultBadgeClass(resultLayout)}>
                      {i + 1}
                    </span>
                  )}
                  <span className="truncate flex-1 text-center">{r}</span>
                </div>
              ))}
            </div>
            )}

            {/* 완료 시 액션 버튼 모음 */}
            {phase === "done" && (
              <div
                className={
                  isDenseLayout
                    ? "pt-1 flex flex-wrap items-center justify-center gap-2"
                    : "pt-4 flex flex-wrap items-center justify-center gap-3"
                }
              >
                <button
                  type="button"
                  onClick={handleRedraw}
                  className={
                    isDenseLayout
                      ? "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                      : "px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                  }
                >
                  <RotateCcw className="w-4 h-4" />
                  다시 뽑기 (Space)
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={
                    isDenseLayout
                      ? "px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition-colors"
                      : "px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center gap-2 transition-colors"
                  }
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "복사 완료" : "결과 복사"}
                </button>
                <button
                  type="button"
                  onClick={() => window.close()}
                  className={
                    isDenseLayout
                      ? "px-4 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors"
                      : "px-6 py-3 rounded-2xl border border-white/20 hover:bg-white/10 text-slate-300 font-bold text-sm transition-colors"
                  }
                >
                  창 닫기 (ESC)
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes pop-in {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
