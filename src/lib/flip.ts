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
 *
 * 측정 전에 진행 중인 전이를 끊고 기준 변환으로 되돌린다(First). 전이 중간의
 * 좌표를 그대로 읽으면 어긋난 중간값이 기준이 되어 이동량 오차가 단계마다
 * 누적되고, 카드가 미로 캔버스 밖으로 밀려나 보이지 않는다.
 */
export function applyFlip(
  container: HTMLElement | null,
  prev: Map<string, FlipPos>,
  baseTransform: string,
  durationMs = 300
): Map<string, FlipPos> {
  const next = new Map<string, FlipPos>();
  if (!container) return next;

  const els = Array.from(container.querySelectorAll<HTMLElement>("[data-shuffle-key]"));
  if (els.length === 0) return next;

  // 1) First: 기준 위치(레이아웃 좌표)를 깨끗하게 읽을 수 있게 초기화 (쓰기 먼저)
  for (const el of els) {
    if (!el.dataset.shuffleKey) continue;
    el.style.transition = "none";
    el.style.transform = baseTransform;
  }

  // 2) Last: 실제 배치 좌표를 읽고 이동량을 계산한다 (읽기는 몰아서)
  const moves: Array<{ el: HTMLElement; dx: number; dy: number }> = [];
  for (const el of els) {
    const key = el.dataset.shuffleKey;
    if (!key) continue;
    const rect = el.getBoundingClientRect();
    next.set(key, { left: rect.left, top: rect.top });

    const old = prev.get(key);
    if (!old) continue;
    const dx = old.left - rect.left;
    const dy = old.top - rect.top;
    if (dx === 0 && dy === 0) continue;
    moves.push({ el, dx, dy });
  }

  // 3) Invert: 기준 변환 위에 이동량을 합성해 이전 위치에 있는 것처럼 보이게 한다
  for (const m of moves) {
    m.el.style.transform = composeTranslate(baseTransform, m.dx, m.dy);
  }

  // 4) Play: 다음 프레임에 원래 위치로 되돌리며 이동 애니메이션을 재생한다
  requestAnimationFrame(() => {
    for (const m of moves) {
      m.el.style.transition = `transform ${durationMs}ms ease`;
      m.el.style.transform = baseTransform;
    }
  });

  return next;
}