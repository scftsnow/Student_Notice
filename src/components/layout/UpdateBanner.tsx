"use client";

import { useEffect, useState } from "react";

interface UpdateStatus {
  status: "available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api || typeof api.onUpdateStatus !== "function") return;
    api.onUpdateStatus((payload: UpdateStatus) => {
      setStatus(payload);
    });
  }, []);

  if (!status) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-indigo-600 text-white px-4 py-2 text-sm font-bold shadow-md">
      {status.status === "available" && <span>새 버전 {status.version}을 다운로드 중입니다...</span>}
      {status.status === "downloading" && (
        <>
          <span>업데이트 다운로드 중... {status.percent ?? 0}%</span>
          <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${status.percent ?? 0}%` }} />
          </div>
        </>
      )}
      {status.status === "downloaded" && (
        <>
          <span>새 버전 {status.version} 다운로드 완료.</span>
          <button
            type="button"
            onClick={() => (window as any).electronAPI?.restartToUpdate?.()}
            className="px-3 py-1 rounded-md bg-white text-indigo-700 text-xs font-black"
          >
            지금 재시작
          </button>
        </>
      )}
      {status.status === "error" && <span className="text-rose-100">업데이트 오류: {status.message}</span>}
    </div>
  );
}
