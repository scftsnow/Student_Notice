/** 타이머 상태 동기화 (제어 화면 ↔ 별도 표시 창, 뽑기 창과 같은 방식) */

export type TimerMode = "countdown" | "stopwatch";
export type CountdownStatus = "idle" | "running" | "paused" | "done";

export interface TimerSyncState {
  mode: TimerMode;
  status: CountdownStatus;
  totalMs: number;
  remainingMs: number;
  swElapsedMs: number;
  swRunning: boolean;
}

export const TIMER_SYNC_CHANNEL = "classroom_timer_sync";
const TIMER_STORAGE_KEY = "classroom_current_timer";

/** ms → "MM:SS" (카운트다운은 올림: 1:00이 마지막 1초까지 표시) */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** ms → "MM:SS" (스톱워치는 내림) */
export function formatStopwatch(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** 현재 타이머 상태를 저장 + 열려 있는 표시 창에 실시간 전송 */
export function postTimerState(state: TimerSyncState): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage error
  }
  try {
    const channel = new BroadcastChannel(TIMER_SYNC_CHANNEL);
    channel.postMessage({ type: "TIMER_STATE", state });
    channel.close();
  } catch {
    // ignore broadcast error
  }
}

/** 표시 창 초기 로드용 저장 상태 읽기 */
export function readTimerState(): TimerSyncState | null {
  try {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as TimerSyncState;
    if (!parsed || (parsed.mode !== "countdown" && parsed.mode !== "stopwatch")) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 타이머 표시 창 열기 (제어 화면과 동일한 스타일·동기화, 차단 방지용 클릭 핸들러에서 호출) */
export function openTimerWindow(): Window | null {
  if (typeof window === "undefined") return null;
  const w = 960;
  const h = 640;
  const left = Math.max(0, Math.round((window.screen.width - w) / 2));
  const top = Math.max(0, Math.round((window.screen.height - h) / 2));
  const popup = window.open(
    "/timer/window",
    "ClassroomTimerWindow",
    `width=${w},height=${h},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
  );
  if (popup && !popup.closed) {
    popup.focus();
  }
  return popup;
}

export const DEFAULT_TIMER_TOTAL_MS = 300_000;
export const MAX_TIMER_TOTAL_MS = 5_999_000; // 99:59
const TIMER_SETTINGS_KEY = "classroom_timer_settings";

export interface TimerSettings {
  mode: TimerMode;
  totalMs: number;
}

/** 최근 타이머 설정(모드·설정 시간) 읽기 */
export function loadTimerSettings(): TimerSettings {
  const fallback: TimerSettings = { mode: "countdown", totalMs: DEFAULT_TIMER_TOTAL_MS };
  try {
    const raw = localStorage.getItem(TIMER_SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    const mode = parsed.mode === "stopwatch" ? "stopwatch" : "countdown";
    const totalMs =
      typeof parsed.totalMs === "number" && Number.isFinite(parsed.totalMs)
        ? Math.min(MAX_TIMER_TOTAL_MS, Math.max(10_000, Math.round(parsed.totalMs)))
        : fallback.totalMs;
    return { mode, totalMs };
  } catch {
    return fallback;
  }
}

/** 최근 타이머 설정 저장 */
export function saveTimerSettings(settings: TimerSettings): void {
  try {
    localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage error
  }
}
