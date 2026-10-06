export interface PickGroupResult {
  label: string;
  members: string[];
}

/** 자리 뽑기용 자유 캔버스 스냅샷 셀 (교실 캔버스 % 좌표, 읽기 전용 렌더용) */
export interface PickSeatCell {
  key: string;
  x: number;
  y: number;
  label: string;
  enabled: boolean;
  lockedGender: "남" | "여" | null;
}

export interface PickWindowPayload {
  id: string;
  type: "student" | "order" | "group" | "seat";
  title: string;
  rollingNames: string[];
  results: string[];
  /**
   * 페이로드 세대 번호. payloads낼 때마다 1씩 증가(단조 증가 보장).
   * 이미 열려 있던 팝업 창이 브로드캐스트를 놓쳐 이전 결과를 계속 들고 있는
   * 경우(탭 정지·절전 등)를 판별해 self-heal 하는 기준값.
   */
  seq: number;
  /**
   * true면 추첨이 끝난 확정 페이로드, false면 후보만 실린 '추첨 전' 상태.
   *
   * 랜덤은 '추첨 시작'을 누른 그 순간에만 돌아야 한다. 그래서 패널은 버튼을
   * 누를 때 결과를 계산하지 않고 후보만 보내고, 팝업이 PICK_ROLL을 요청한
   * 뒤에야 실제로 뽑아 rolled=true로 다시 보낸다.
   */
  rolled: boolean;
  summaryText?: string;
  /** 모둠 뽑기용 구조화 결과 (있으면 행별 모둠 카드로 표시) */
  groups?: PickGroupResult[];
  /** 자리 뽑기용 좌표 스냅샷 (있으면 전광판에 동일 좌표 미니 캔버스로 표시) */
  seatCells?: PickSeatCell[];
}

/** 패널이 넘기는 입력. seq·rolled는 전송 시 부여된다. */
export type PickWindowPayloadInput = Omit<PickWindowPayload, "seq" | "rolled"> & {
  seq?: number;
  rolled?: boolean;
};

/** 팝업 ↔ 패널 동기화 채널명 */
export const PICK_SYNC_CHANNEL = "classroom_pick_sync";

/** 전광판이 결과를 받을 때 쓰는 localStorage 키 */
const PAYLOAD_KEY = "classroom_current_pick_payload";

/**
 * 세대 번호 부여. 직전 값보다 반드시 크게 만든다.
 * (같은 밀리초에 연속 뽑기해도 seq가 엄격히 증가해야 팝업이 최신임을 판별한다)
 */
function stampSeq(seq?: number): number {
  let prevSeq = 0;
  try {
    const raw = localStorage.getItem(PAYLOAD_KEY);
    if (raw) {
      const n = Number(JSON.parse(raw)?.seq);
      if (Number.isFinite(n)) prevSeq = n;
    }
  } catch {
    // ignore storage error
  }
  const now = Date.now();
  const base = Math.max(prevSeq, Number.isFinite(seq) ? (seq as number) : 0);
  return Math.max(base + 1, now);
}

/** 페이로드에 seq·기본값을 채운다 */
export function stampPayload(input: PickWindowPayloadInput): PickWindowPayload {
  return {
    ...input,
    results: input.results ?? [],
    rolled: input.rolled ?? true,
    seq: stampSeq(input.seq),
  };
}

/** 저장 + 브로드캐스트 (창 열기 없이 이미 열린 전광판에만 전달) */
export function broadcastPick(payload: PickWindowPayload): void {
  try {
    localStorage.setItem(PAYLOAD_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage error
  }
  try {
    const channel = new BroadcastChannel(PICK_SYNC_CHANNEL);
    channel.postMessage({ type: "PICK_START", payload });
    channel.close();
  } catch {
    // ignore broadcast error
  }
}

/**
 * 전광판을 연다(저장 + 브로드캐스트 + 창).
 * URL에 seq를 붙여 재사용 창도 반드시 실제 이동(재마운트)하게 한다 —
 * 브로드캐스트를 놓친 창이 옛 결과를 그대로 보여 주던 문제의 차단책.
 */
export function openPickWindow(input: PickWindowPayloadInput): Window | null {
  if (typeof window === "undefined") return null;

  const payload = stampPayload(input);
  broadcastPick(payload);

  const w = 1180;
  const h = 760;
  const left = Math.max(0, Math.round((window.screen.width - w) / 2));
  const top = Math.max(0, Math.round((window.screen.height - h) / 2));

  // 뽑기 종류별 별도 창: 같은 종류는 기존 창을 재사용하고, 다른 종류는 각자 창을 유지한다.
  const popup = window.open(
    `/picks/window?seq=${payload.seq}`,
    `ClassroomPickWindow_${payload.type}`,
    `width=${w},height=${h},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
  );

  if (popup && !popup.closed) {
    popup.focus();
  }

  return popup;
}

/**
 * 전광판 → 패널: '지금 뽑아라'.
 * 랜덤은 오직 이 요청이 있을 때만 돌아야 한다.
 * pickType을 함께 보내므로 4개 패널이 동시에 열려 있어도 해당 패널만 응답한다.
 */
export function requestPickRoll(id: string, pickType: PickWindowPayload["type"]): void {
  try {
    const channel = new BroadcastChannel(PICK_SYNC_CHANNEL);
    channel.postMessage({ type: "PICK_ROLL", id, pickType });
    channel.close();
  } catch {
    // ignore broadcast error
  }
}
