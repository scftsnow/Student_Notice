/**
 * 기본 글꼴(시스템 전체 UI용) 공용 헬퍼 — DRY.
 * 저장 키: localStorage "classroom_default_font_family"
 * 알림장 미리보기(BoardCanvas/BoardClient)는 이 값을 구독하지 않으므로 제외됨.
 */

export const DEFAULT_FONT_STORAGE_KEY = "classroom_default_font_family";

export const FALLBACK_FONT_FAMILY =
  "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

export function getStoredDefaultFontFamily(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(DEFAULT_FONT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 시스템 전체 UI 글꼴을 즉시 적용 (body 상속 — 인라인 fontFamily가 지정된 미리보기는 영향 없음) */
export function applyDefaultFontFamily(family: string): void {
  if (typeof document === "undefined") return;
  try {
    document.body.style.fontFamily = family;
  } catch {
    // noop
  }
}
