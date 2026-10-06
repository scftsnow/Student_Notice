/**
 * 타이머 카운트다운 BGM 엔진.
 * - 내장 예시: WebAudio 오프라인 렌더 → WAV Blob URL (외부 파일·의존성 없음)
 * - 직접 업로드: File → IndexedDB 보관 (새로고침 후에도 유지)
 * - 재생은 단일 HTMLAudio 루프(loop=true: 타이머보다 짧으면 반복)
 */

export interface BgmTrack {
  id: string;
  name: string;
  kind: "builtin" | "upload";
  /** 재생 URL (내장은 렌더 전 null) */
  url: string | null;
}

export interface BgmSettings {
  trackId: string;
  rate: number;
  volume: number;
  urgencySec: number;
  urgencyMult: number;
}

export const BGM_SETTINGS_KEY = "classroom_timer_bgm";
const SAMPLE_RATE = 22050;

export const DEFAULT_BGM_SETTINGS: BgmSettings = {
  trackId: "builtin-tick",
  rate: 1,
  volume: 0.7,
  urgencySec: 10,
  urgencyMult: 1.5,
};

/* ---------- 내장 예시 신스 (루프용, 길이는 정확히 seconds) ---------- */

interface BuiltinDef {
  id: string;
  name: string;
  seconds: number;
  render: (ctx: OfflineAudioContext, dest: AudioNode) => void;
}

function blip(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  dur = 0.08,
  volume = 0.25,
  type: OscillatorType = "sine"
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function pad(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  dur: number,
  volume = 0.08
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + dur * 0.3);
  gain.gain.linearRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

const BUILTIN_DEFS: BuiltinDef[] = [
  {
    id: "builtin-tick",
    name: "초침",
    seconds: 8,
    render: (ctx, out) => {
      for (let s = 0; s < 8; s++) {
        blip(ctx, out, s, s % 2 === 0 ? 1000 : 800, 0.07, 0.22, "square");
      }
    },
  },
  {
    id: "builtin-arpeggio",
    name: "잔잔한 아르페지오",
    seconds: 16,
    render: (ctx, out) => {
      const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
      notes.forEach((freq, i) => {
        blip(ctx, out, i * 2, freq, 1.2, 0.16, "sine");
        blip(ctx, out, i * 2, freq * 2, 0.9, 0.05, "sine");
      });
    },
  },
  {
    id: "builtin-pad",
    name: "고요한 패드",
    seconds: 16,
    render: (ctx, out) => {
      [130.81, 164.81, 196.0, 261.63].forEach((freq) => {
        pad(ctx, out, 0, freq, 16, 0.06);
        pad(ctx, out, 0, freq * 1.005, 16, 0.04);
      });
    },
  },
];

export function getBuiltinDefs(): { id: string; name: string }[] {
  return BUILTIN_DEFS.map((d) => ({ id: d.id, name: d.name }));
}

const builtinUrlCache = new Map<string, string>();

/** 내장 예시를 WAV Blob URL로 렌더 (세션당 1회) */
export async function getBuiltinBgmUrl(id: string): Promise<string | null> {
  const cached = builtinUrlCache.get(id);
  if (cached) return cached;
  const def = BUILTIN_DEFS.find((d) => d.id === id);
  if (!def || typeof window === "undefined") return null;
  try {
    const ctx = new OfflineAudioContext(1, SAMPLE_RATE * def.seconds, SAMPLE_RATE);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    def.render(ctx, out);
    const buffer = await ctx.startRendering();
    const blob = encodeWav(buffer);
    const url = URL.createObjectURL(blob);
    builtinUrlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/** AudioBuffer → 16bit PCM WAV Blob */
function encodeWav(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0);
  const ab = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(ab);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([ab], { type: "audio/wav" });
}

/* ---------- 업로드 보관 (IndexedDB, 새로고침 유지) ---------- */

export interface StoredUpload {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
}

const IDB_NAME = "classroom-timer-bgm";
const IDB_STORE = "tracks";

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return idbOpen().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, mode);
        const req = run(tx.objectStore(IDB_STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function saveUploadTrack(track: StoredUpload): Promise<void> {
  return idbTx("readwrite", (store) => store.put(track)).then(() => undefined);
}

export function loadUploadTracks(): Promise<StoredUpload[]> {
  return idbTx("readonly", (store) => store.getAll()).catch(() => []);
}

export function deleteUploadTrack(id: string): Promise<void> {
  return idbTx("readwrite", (store) => store.delete(id))
    .then(() => undefined)
    .catch(() => undefined);
}

/* ---------- BGM 설정 저장 ---------- */

export function loadBgmSettings(): BgmSettings {
  const fallback = { ...DEFAULT_BGM_SETTINGS };
  try {
    const raw = localStorage.getItem(BGM_SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BgmSettings>;
    const num = (v: unknown, min: number, max: number, fb: number): number =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
    return {
      trackId: typeof parsed.trackId === "string" ? parsed.trackId : fallback.trackId,
      rate: num(parsed.rate, 0.5, 2, fallback.rate),
      volume: num(parsed.volume, 0, 1, fallback.volume),
      urgencySec: num(parsed.urgencySec, 0, 300, fallback.urgencySec),
      urgencyMult: num(parsed.urgencyMult, 1, 3, fallback.urgencyMult),
    };
  } catch {
    return fallback;
  }
}

export function saveBgmSettings(settings: BgmSettings): void {
  try {
    localStorage.setItem(BGM_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage error
  }
}
