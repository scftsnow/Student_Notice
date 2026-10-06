/**
 * FLIP (First, Last, Invert, Play).
 *
 * 컨테이너 안의 카드들이 자리를 옮길 때, 이름만 바꾸는 게 아니라
 * 실제로 이동하는 애니메이션을 만든다. 순서 뽑기·자리 뽑기가 함께 쓴다.
 */

export interface FlipPos {
  left: number;
  top: number;
}

/** 기준 변환에 픽셀 오프셋을 합성한다 (예: translate(-50%,-50%) + 이동량) */
function composeTranslate(base: string, dx: number, dy: number): string {
  const m = base.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!m) return `translate(${dx}px, ${dy}px)`;
  const shift = (v: string, d: number) =>
    v.includes("%") ? `calc(${v.trim()} + ${d}px)` : `${parseFloat(v) + d}px`;
  return `translate(${shift(m[1], dx)}, ${shift(m[2], dy)})`;
}

/**
 * 직전 위치와 현재 위치를 비교해 이동 애니메이션을 건다.
 * `[data-shuffle-key]` 를 가진 요소만 추적하며, 다음 프레임을 위해 새 위치 맵을 돌려준다.
 */
export function applyFlip(
  container: HTMLElement | null,
  prev: Map<string, FlipPos>,
  baseTransform: string,
  durationMs = 300
): Map<string, FlipPos> {
  const next = new Map<string, FlipPos>();
  if (!container) return next;

  container.querySelectorAll<HTMLElement>("[data-shuffle-key]").forEach((el) => {
    const key = el.dataset.shuffleKey;
    if (!key) return;
    const rect = el.getBoundingClientRect();
    next.set(key, { left: rect.left, top: rect.top });

    const old = prev.get(key);
    if (!old) return;
    const dx = old.left - rect.left;
    const dy = old.top - rect.top;
    if (dx === 0 && dy === 0) return;

    el.style.transition = "none";
    el.style.transform = composeTranslate(baseTransform, dx, dy);
    requestAnimationFrame(() => {
      el.style.transition = `transform ${durationMs}ms ease`;
      el.style.transform = baseTransform;
    });
  });

  return next;
}