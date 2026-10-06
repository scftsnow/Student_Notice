"use client";

import { useRef } from "react";
import { Music, Upload, X } from "lucide-react";
import type { TimerControllerApi } from "@/hooks/useTimerController";

interface BgmSectionProps {
  t: TimerControllerApi;
  /** true면 어두운 전광판 스타일 */
  dark?: boolean;
}

/**
 * 카운트다운 BGM 설정 (밝은 제어판·어두운 전광판 공용).
 * 내장 예시 + 직접 업로드(IndexedDB 보관), 반복재생, 속도·임박 가속·음량.
 */
export default function BgmSection({ t, dark = false }: BgmSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = t.bgmTracks.find((x) => x.id === t.bgmTrackId);

  const box = dark
    ? "rounded-xl border border-white/10 bg-white/5 p-2 space-y-1.5"
    : "rounded-xl border border-slate-200 bg-slate-50/60 p-2 space-y-1.5";
  const label = dark ? "text-slate-300" : "text-slate-600";
  const value = dark ? "text-white" : "text-slate-800";
  // 어두운 배경 select는 native 옵션 목록이 흰 바탕이라 색을 맞춰줘야 읽힌다
  const selectCls = dark
    ? "flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded-lg border border-white/10 bg-slate-800 text-white [&>option]:bg-slate-800 [&>option]:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
    : "flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const numCls = dark
    ? "w-12 px-1 py-0.5 text-[11px] rounded-lg border border-white/10 bg-slate-800 font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
    : "w-12 px-1 py-0.5 text-[11px] rounded-lg border border-slate-200 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const iconBtn = dark
    ? "p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
    : "p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0";
  const uploadBtn = dark
    ? "px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors shrink-0 flex items-center gap-1"
    : "px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-slate-600 text-[11px] font-bold transition-colors shrink-0 flex items-center gap-1";

  return (
    <div className={box}>
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-bold flex items-center gap-1 shrink-0 ${label}`}>
          <Music className="w-3 h-3" />
          BGM
        </span>
        <select
          value={t.bgmTrackId}
          onChange={(e) => t.selectTrack(e.target.value)}
          title="배경 음악 선택 (짧으면 반복재생)"
          className={selectCls}
        >
          <option value="off">끔</option>
          {t.bgmTracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
              {track.kind === "upload" ? " (업로드)" : ""}
              {track.url === null ? " (준비 중)" : ""}
            </option>
          ))}
        </select>
        {selected?.kind === "upload" && (
          <button type="button" onClick={() => t.removeUpload(selected.id)} title="업로드 삭제" className={iconBtn}>
            <X className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={t.uploading}
          title="음악 파일 직접 업로드 (저장됨)"
          className={uploadBtn}
        >
          <Upload className="w-3 h-3" />
          {t.uploading ? "저장 중" : "업로드"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void t.uploadTrack(f);
          }}
        />
      </div>

      <div className={`flex items-center gap-1.5 text-[11px] font-bold ${label}`}>
        <span className="shrink-0">속도</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={t.bgmRate}
          onChange={(e) => t.setBgmRate(Number(e.target.value))}
          className="flex-1 min-w-0 accent-indigo-600"
        />
        <span className={`font-mono shrink-0 ${value}`}>
          {t.bgmRate.toFixed(1)}x
          {t.bgmEffectiveRate !== t.bgmRate && ` → ${t.bgmEffectiveRate.toFixed(1)}x`}
        </span>
      </div>

      <div className={`flex items-center gap-1.5 text-[11px] font-bold ${label}`}>
        <span className="shrink-0">마지막</span>
        <input
          type="number"
          min={0}
          max={300}
          value={t.urgencySec}
          onChange={(e) => t.setUrgencySec(Math.max(0, Number(e.target.value) || 0))}
          title="임박 구간 (초)"
          className={numCls}
        />
        <span className="shrink-0">초</span>
        <input
          type="number"
          min={1}
          max={3}
          step={0.1}
          value={t.urgencyMult}
          onChange={(e) => t.setUrgencyMult(Math.min(3, Math.max(1, Number(e.target.value) || 1)))}
          title="임박 배속"
          className={numCls}
        />
        <span className="shrink-0">배속</span>
        <span className="shrink-0 opacity-70">·</span>
        <span className="shrink-0">음량</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={t.bgmVolume}
          onChange={(e) => t.setBgmVolume(Number(e.target.value))}
          className="flex-1 min-w-0 accent-indigo-600"
        />
      </div>
    </div>
  );
}
