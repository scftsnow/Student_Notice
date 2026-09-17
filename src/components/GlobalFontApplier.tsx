"use client";

import { useEffect } from "react";
import {
  applyDefaultFontFamily,
  getStoredDefaultFontFamily,
} from "@/lib/defaultFont";

/**
 * 시스템 전체 기본 글꼴 적용기.
 * - 첫 로드 시 localStorage 값을 body에 적용
 * - 설정 저장 브로드캐스트(classroom_os_sync) 수신 시 즉시 반영
 * - 알림장 미리보기는 인라인 fontFamily를 자체 지정하므로 제외됨
 */
export default function GlobalFontApplier() {
  useEffect(() => {
    const stored = getStoredDefaultFontFamily();
    if (stored) applyDefaultFontFamily(stored);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_os_sync");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data?.defaultFontFamily) {
          applyDefaultFontFamily(e.data.defaultFontFamily);
        }
      };
    } catch {
      // BroadcastChannel 미지원 환경 무시
    }
    return () => {
      try {
        channel?.close();
      } catch {
        // noop
      }
    };
  }, []);

  return null;
}
