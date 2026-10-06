import { useEffect, useState } from "react";

/** 눈 아이콘(표시/숨김) 상태 공용 훅. localStorage에 저장되어 새로고침·탭 이동 후에도 유지된다. */
export function usePersistentFlag(storageKey: string, defaultValue: boolean): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState(defaultValue);

  // 첫 렌더는 서버와 동일하게, 마운트 후 저장값 적용 (하이드레이션 불일치 방지)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "1" || raw === "0") setValue(raw === "1");
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value ? "1" : "0");
    } catch {
      // ignore
    }
  }, [storageKey, value]);

  return [value, setValue];
}
