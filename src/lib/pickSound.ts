/** Web Audio API 합성 효과음 (외부 파일·의존성 없음, 오프라인 동작) */

const MUTE_KEY = "pick_sound_muted";

let audioCtx: AudioContext | null = null;
let mutedCache: boolean | null = null;

export function isMuted(): boolean {
  if (mutedCache !== null) return mutedCache;
  try {
    mutedCache = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    mutedCache = false;
  }
  return mutedCache;
}

export function setMuted(muted: boolean): void {
  mutedCache = muted;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // 저장 실패해도 소리 동작에는 영향 없음
  }
}

function getContext(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.18
): void {
  const ctx = getContext();
  if (!ctx || isMuted()) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + startAt;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // 효과음 실패는 무시 (본 기능에 영향 없음)
  }
}

/** 버튼 클릭 */
export function playClick(): void {
  tone(660, 0, 0.08, "triangle", 0.12);
}

/** 룰렛 틱. rate가 높을수록 고음 (감속 연출과 함께 호출) */
export function playTick(rate = 0): void {
  tone(440 + rate * 40, 0, 0.05, "square", 0.06);
}

/** 단일 결과 공개 팝 */
export function playPop(): void {
  tone(520, 0, 0.09, "sine", 0.2);
  tone(780, 0.07, 0.12, "sine", 0.2);
}

/** 최종 확정 팡파레 (상행 아르페지오) */
export function playFanfare(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    tone(freq, i * 0.11, 0.22, "triangle", 0.2);
  });
  tone(1318.5, notes.length * 0.11, 0.4, "triangle", 0.18);
}

/** 입력 오류 버즈 */
export function playError(): void {
  tone(180, 0, 0.16, "sawtooth", 0.12);
  tone(140, 0.14, 0.2, "sawtooth", 0.12);
}
