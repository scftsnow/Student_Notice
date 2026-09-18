"use client";

import { useRef, useState } from "react";
import { DatabaseBackup, Download, Upload, CheckCircle2 } from "lucide-react";
import { saveClassroomSnapshot, restoreClassIdentity } from "@/app/actions";
import { DEFAULT_FONT_STORAGE_KEY } from "@/lib/defaultFont";

/** 백업에 포함하는 로컬 저장소 키 (일회성 뽑기 연출 페이로드 제외). */
const BACKUP_KEYS = [
  "classroom_os_state_v3",
  "classroom_os_state_v2",
  "classroom_board_layouts",
  "classroom_saved_orders",
  "classroom_saved_groups",
  "classroom_saved_seats",
  "classroom_bundle_order",
  "classroom_preview_scale",
  "classroom_show_economy_shortcut",
  DEFAULT_FONT_STORAGE_KEY,
] as const;

interface BackupFile {
  app: "classroom-os";
  version: 1;
  exportedAt: string;
  summary: { className: string; students: number; routines: number };
  data: Record<string, string | null>;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function buildSummary(v3raw: string | null): BackupFile["summary"] {
  try {
    const parsed = v3raw ? (JSON.parse(v3raw) as Record<string, unknown>) : {};
    const students = Array.isArray(parsed.students) ? parsed.students.length : 0;
    const routines = Array.isArray(parsed.routines) ? parsed.routines.length : 0;
    return {
      className: typeof parsed.className === "string" ? parsed.className : "우리 반",
      students,
      routines,
    };
  } catch {
    return { className: "우리 반", students: 0, routines: 0 };
  }
}

/**
 * 전체 설정 백업/복원.
 * 백업 파일에 앱 저장소 키 전체를 담고, 복원 시 같은 키에 그대로 쓴 뒤
 * 새로고침으로 통상 로드 경로를 태워 백업 시점과 완전히 동일한 상태로 되돌린다.
 */
export default function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleBackup = () => {
    setError("");
    setNotice("");
    try {
      const data: Record<string, string | null> = {};
      for (const key of BACKUP_KEYS) data[key] = readKey(key);
      const v3raw = data.classroom_os_state_v3;
      if (!v3raw) {
        setError("백업할 학급 데이터가 없습니다 (저장된 상태가 비어 있습니다).");
        return;
      }
      const payload: BackupFile = {
        app: "classroom-os",
        version: 1,
        exportedAt: new Date().toISOString(),
        summary: buildSummary(v3raw),
        data,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `학급설정백업_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const s = payload.summary;
      setNotice(`백업 완료 (${s.className} · 학생 ${s.students}명 · 업무 ${s.routines}개).`);
    } catch {
      setError("백업 파일 생성에 실패했습니다.");
    }
  };

  const handleRestoreFile = async (file: File) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupFile>;
      if (!parsed || parsed.app !== "classroom-os" || typeof parsed.data !== "object" || parsed.data === null) {
        setError("학급 설정 백업 파일이 아닙니다.");
        return;
      }
      const v3raw = parsed.data.classroom_os_state_v3;
      if (typeof v3raw !== "string" || v3raw.length === 0) {
        setError("백업 파일에 학급 데이터(v3)가 없습니다.");
        return;
      }
      // 메인 상태 파싱 검증 (깨진 백업 적용 방지)
      const v3check = JSON.parse(v3raw) as Record<string, unknown>;
      if (!v3check || typeof v3check !== "object") {
        setError("백업 파일의 학급 데이터가 손상되었습니다.");
        return;
      }
      const summary = buildSummary(v3raw);
      const ok = confirm(
        `백업 시점으로 되돌리겠습니까?\n(${summary.className} · 학생 ${summary.students}명 · 업무 ${summary.routines}개)\n현재 상태는 백업 내용으로 덮어씌워집니다.`
      );
      if (!ok) return;

      // 1) 저장소 키 복원 + 즉시 재확인 (쓰기 검증)
      for (const key of BACKUP_KEYS) {
        const value = parsed.data[key];
        try {
          if (value === undefined || value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          setError(`복원 중 저장소 쓰기에 실패했습니다 (${key}).`);
          return;
        }
      }
      for (const key of BACKUP_KEYS) {
        const expected = parsed.data[key] ?? null;
        if (readKey(key) !== expected) {
          setError(`복원 검증에 실패했습니다 (${key} 불일치). 새로고침하지 않았습니다.`);
          return;
        }
      }

      // 2) 서버 스냅샷도 백업 시점으로 (실패해도 로컬 복원은 유지, 다음 자동 동기화가 따라잡음)
      try {
        await saveClassroomSnapshot(v3raw);
      } catch {
        // ignore — debounced background sync covers it
      }

      // 2b) 서버 학급 정보(학급명·화폐명)도 백업 시점으로 — 상단 크롬 타이틀이 DB를 직접 읽기 때문.
      // 나머지는 UI에서 바꿀 수 없어 손대지 않는다.
      try {
        const v3 = JSON.parse(v3raw) as Record<string, unknown>;
        const cn = typeof v3.className === "string" ? v3.className : undefined;
        const cur = typeof v3.currencyName === "string" ? v3.currencyName : undefined;
        if (cn !== undefined && cur !== undefined) {
          await restoreClassIdentity(cn, cur);
        }
      } catch {
        // ignore — 다음 설정 저장 시 따라잡음
      }

      // 3) 통상 로드 경로로 재시작 → 백업 시점과 동일한 상태
      window.location.reload();
    } catch {
      setError("백업 파일을 읽지 못했습니다 (JSON 형식을 확인해 주세요).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 text-sm">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="w-5 h-5 text-indigo-600" />
        <div>
          <h2 className="font-extrabold text-slate-800 text-base">전체 설정 백업 / 복원</h2>
          <p className="text-xs text-slate-500">
            명단·업무·알림장·화폐·뽑기 저장 등 모든 설정을 파일로 백업하고, 필요할 때 백업 시점으로 그대로 되돌립니다.
          </p>
        </div>
      </div>

      {notice && (
        <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleBackup}
          className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          지금 상태 백업하기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {busy ? "복원 중..." : "백업 파일로 복원하기"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleRestoreFile(file);
          }}
        />
      </div>
    </div>
  );
}
