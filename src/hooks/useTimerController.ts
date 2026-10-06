import { useCallback, useEffect, useRef, useState } from "react";
import { playFanfare, playClick } from "@/lib/pickSound";
import {
  postTimerState,
  loadTimerSettings,
  saveTimerSettings,
  MAX_TIMER_TOTAL_MS,
  type TimerMode,
  type CountdownStatus,
} from "@/lib/timerUtils";
import {
  getBuiltinDefs,
  getBuiltinBgmUrl,
  loadUploadTracks,
  saveUploadTrack,
  deleteUploadTrack,
  loadBgmSettings,
  saveBgmSettings,
  type BgmTrack,
} from "@/lib/timerAudio";

/** 수업용 프리셋 (초 단위: 1분·3분·5분·10분) */
export const TIMER_PRESET_SECONDS = [60, 180, 300, 600];
const TICK_MS = 200;

/**
 * 타이머 제어 로직 공용 훅 (밝은 제어판·어두운 전광판이 공유).
 * - 카운트다운: 시작·일시정지·리셋·프리셋·직접 입력·±1분
 * - 스톱워치: 시작·일시정지·리셋
 * - 최근 설정(모드·설정 시간) 기억, 전광판 동기화 전송
 */
export function useTimerController() {
  const [mode, setMode] = useState<TimerMode>("countdown");
  const [totalMs, setTotalMs] = useState(300_000);
  const [remainingMs, setRemainingMs] = useState(300_000);
  const [status, setStatus] = useState<CountdownStatus>("idle");
  const [swElapsedMs, setSwElapsedMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [minText, setMinText] = useState("5");
  const [secText, setSecText] = useState("0");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ---- 카운트다운 BGM ----
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([]);
  const [bgmTrackId, setBgmTrackId] = useState("builtin-tick");
  const [bgmRate, setBgmRate] = useState(1);
  const [bgmVolume, setBgmVolume] = useState(0.7);
  const [urgencySec, setUrgencySec] = useState(10);
  const [urgencyMult, setUrgencyMult] = useState(1.5);
  const [bgmHydrated, setBgmHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmUrlRef = useRef<string | null>(null);

  const endAtRef = useRef(0);
  const swBaseRef = useRef(0);
  const swAccumRef = useRef(0);
  const fanfareFiredRef = useRef(false);

  // 타임스탬프 기준 틱 (백그라운드 스로틀에도 마감시각은 정확)
  useEffect(() => {
    const active =
      (mode === "countdown" && status === "running") || (mode === "stopwatch" && swRunning);
    if (!active) return;
    const id = window.setInterval(() => {
      if (mode === "countdown" && status === "running") {
        const left = endAtRef.current - Date.now();
        if (left <= 0) {
          window.clearInterval(id);
          setRemainingMs(0);
          setStatus("done");
          if (!fanfareFiredRef.current) {
            fanfareFiredRef.current = true;
            playFanfare();
          }
        } else {
          setRemainingMs(left);
        }
      } else if (mode === "stopwatch" && swRunning) {
        setSwElapsedMs(swAccumRef.current + (Date.now() - swBaseRef.current));
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [mode, status, swRunning]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // 상태 변경 시 전광판(별도 창)에 실시간 전송 (실행 중 틱마다 자동 전송)
  useEffect(() => {
    postTimerState({ mode, status, totalMs, remainingMs, swElapsedMs, swRunning });
  }, [mode, status, totalMs, remainingMs, swElapsedMs, swRunning]);

  // 최근 설정(모드·설정 시간) 기억: 첫 렌더는 서버와 동일하게,
  // 마운트 후 저장값을 적용 (하이드레이션 불일치 방지)
  useEffect(() => {
    const saved = loadTimerSettings();
    setMode(saved.mode);
    setTotalMs(saved.totalMs);
    setRemainingMs(saved.totalMs);
    setMinText(String(Math.floor(saved.totalMs / 60000)));
    setSecText(String(Math.floor((saved.totalMs % 60000) / 1000)));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    saveTimerSettings({ mode, totalMs });
  }, [mode, totalMs, hydrated]);

  // BGM 초기화: 오디오 엘리먼트 + 내장 렌더 + 업로드 복원 + 설정 복원
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;
    let cancelled = false;
    (async () => {
      const builtinTracks: BgmTrack[] = getBuiltinDefs().map((d) => ({
        id: d.id,
        name: d.name,
        kind: "builtin" as const,
        url: null,
      }));
      let stored: { id: string; name: string; blob: Blob }[] = [];
      try {
        stored = await loadUploadTracks();
      } catch {
        stored = [];
      }
      if (cancelled) return;
      const uploads: BgmTrack[] = stored.map((s) => ({
        id: s.id,
        name: s.name,
        kind: "upload" as const,
        url: URL.createObjectURL(s.blob),
      }));
      setBgmTracks([...builtinTracks, ...uploads]);
      const settings = loadBgmSettings();
      const knownIds = new Set([
        ...builtinTracks.map((b) => b.id),
        ...uploads.map((u) => u.id),
        "off",
      ]);
      if (knownIds.has(settings.trackId)) setBgmTrackId(settings.trackId);
      setBgmRate(settings.rate);
      setBgmVolume(settings.volume);
      setUrgencySec(settings.urgencySec);
      setUrgencyMult(settings.urgencyMult);
      setBgmHydrated(true);
      for (const b of builtinTracks) {
        const url = await getBuiltinBgmUrl(b.id);
        if (cancelled) return;
        if (url) {
          setBgmTracks((prev) => prev.map((t) => (t.id === b.id ? { ...t, url } : t)));
        }
      }
    })();
    return () => {
      cancelled = true;
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // BGM 설정 저장
  useEffect(() => {
    if (!bgmHydrated) return;
    saveBgmSettings({
      trackId: bgmTrackId,
      rate: bgmRate,
      volume: bgmVolume,
      urgencySec,
      urgencyMult,
    });
  }, [bgmHydrated, bgmTrackId, bgmRate, bgmVolume, urgencySec, urgencyMult]);

  const activeBgmUrl = bgmTracks.find((t) => t.id === bgmTrackId)?.url ?? null;

  // BGM 재생/정지 (카운트다운 실행 중에만)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = true;
    a.volume = bgmVolume;
    const wantPlay = mode === "countdown" && status === "running" && activeBgmUrl !== null;
    if (wantPlay && activeBgmUrl) {
      if (bgmUrlRef.current !== activeBgmUrl) {
        bgmUrlRef.current = activeBgmUrl;
        a.src = activeBgmUrl;
      }
      if (a.paused) void a.play().catch(() => {});
    } else {
      if (!a.paused) a.pause();
      if (status === "done" || status === "idle") {
        try {
          a.currentTime = 0;
        } catch {
          // ignore
        }
      }
    }
  }, [mode, status, activeBgmUrl, bgmVolume]);

  // 재생 속도 (임박 구간은 더 빠르게)
  const bgmUrgent =
    mode === "countdown" && status === "running" && urgencySec > 0 && remainingMs <= urgencySec * 1000 && remainingMs > 0;
  const bgmEffectiveRate = bgmUrgent ? bgmRate * urgencyMult : bgmRate;
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = bgmEffectiveRate;
  }, [bgmEffectiveRate]);

  const startCountdown = useCallback(() => {
    playClick();
    const from = remainingMs <= 0 ? totalMs : remainingMs;
    setRemainingMs(from);
    endAtRef.current = Date.now() + from;
    fanfareFiredRef.current = false;
    setStatus("running");
  }, [remainingMs, totalMs]);

  const pauseCountdown = useCallback(() => {
    playClick();
    setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    setStatus("paused");
  }, []);

  const resetCountdown = useCallback(() => {
    playClick();
    fanfareFiredRef.current = false;
    setRemainingMs(totalMs);
    setStatus("idle");
  }, [totalMs]);

  const applyTotal = useCallback((ms: number) => {
    const clamped = Math.min(MAX_TIMER_TOTAL_MS, Math.max(10_000, ms));
    playClick();
    fanfareFiredRef.current = false;
    setTotalMs(clamped);
    setRemainingMs(clamped);
    setStatus("idle");
  }, []);

  const adjustRunning = useCallback(
    (deltaMs: number) => {
      playClick();
      if (status === "running") {
        endAtRef.current = Math.max(Date.now(), endAtRef.current + deltaMs);
        setTotalMs((prev) => Math.min(MAX_TIMER_TOTAL_MS, Math.max(10_000, prev + deltaMs)));
        setRemainingMs(Math.min(MAX_TIMER_TOTAL_MS, Math.max(0, endAtRef.current - Date.now())));
      } else {
        const nextTotal = Math.min(MAX_TIMER_TOTAL_MS, Math.max(10_000, totalMs + deltaMs));
        setTotalMs(nextTotal);
        setRemainingMs((prev) => Math.min(MAX_TIMER_TOTAL_MS, Math.max(0, prev + deltaMs)));
        fanfareFiredRef.current = false;
        if (status === "done") setStatus("idle");
      }
    },
    [status, totalMs]
  );

  const startStopwatch = useCallback(() => {
    playClick();
    swBaseRef.current = Date.now();
    setSwRunning(true);
  }, []);

  const pauseStopwatch = useCallback(() => {
    playClick();
    swAccumRef.current += Date.now() - swBaseRef.current;
    setSwElapsedMs(swAccumRef.current);
    setSwRunning(false);
  }, []);

  const resetStopwatch = useCallback(() => {
    playClick();
    swAccumRef.current = 0;
    setSwElapsedMs(0);
    setSwRunning(false);
  }, []);

  const switchMode = useCallback(
    (next: TimerMode) => {
      if (next === mode) return;
      playClick();
      setMode(next);
      // 모드를 바꾸면 양쪽 다 정지 상태로 되돌림
      fanfareFiredRef.current = false;
      setRemainingMs(totalMs);
      setStatus("idle");
      swAccumRef.current = 0;
      setSwElapsedMs(0);
      setSwRunning(false);
    },
    [mode, totalMs]
  );

  const toggleFullscreen = useCallback((el: HTMLElement | null) => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el?.requestFullscreen().catch(() => {});
    }
  }, []);

  const selectTrack = useCallback((id: string) => {
    playClick();
    setBgmTrackId(id);
  }, []);

  const uploadTrack = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const id = `upload-${Date.now()}`;
      const name = file.name.replace(/\.[^.]+$/, "") || "업로드 음악";
      await saveUploadTrack({ id, name, mime: file.type, blob: file });
      const url = URL.createObjectURL(file);
      setBgmTracks((prev) => [...prev, { id, name, kind: "upload" as const, url }]);
      setBgmTrackId(id);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  }, []);

  const removeUpload = useCallback(
    (id: string) => {
      playClick();
      const track = bgmTracks.find((t) => t.id === id);
      if (track?.url) {
        try {
          URL.revokeObjectURL(track.url);
        } catch {
          // ignore
        }
      }
      void deleteUploadTrack(id);
      setBgmTracks((prev) => prev.filter((t) => t.id !== id));
      if (bgmTrackId === id) setBgmTrackId("builtin-tick");
    },
    [bgmTracks, bgmTrackId]
  );

  const isCountdown = mode === "countdown";
  const done = isCountdown && status === "done";
  const progress = totalMs > 0 ? Math.min(100, (remainingMs / totalMs) * 100) : 0;

  return {
    mode,
    totalMs,
    remainingMs,
    status,
    swElapsedMs,
    swRunning,
    minText,
    secText,
    setMinText,
    setSecText,
    isFullscreen,
    isCountdown,
    done,
    progress,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    applyTotal,
    adjustRunning,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    switchMode,
    toggleFullscreen,
    bgmTracks,
    bgmTrackId,
    selectTrack,
    uploadTrack,
    removeUpload,
    uploading,
    bgmRate,
    setBgmRate,
    bgmVolume,
    setBgmVolume,
    urgencySec,
    setUrgencySec,
    urgencyMult,
    setUrgencyMult,
    bgmEffectiveRate,
  };
}

export type TimerControllerApi = ReturnType<typeof useTimerController>;
