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
  summaryText?: string;
  /** 모둠 뽑기용 구조화 결과 (있으면 행별 모둠 카드로 표시) */
  groups?: PickGroupResult[];
  /** 자리 뽑기용 좌표 스냅샷 (있으면 전광판에 동일 좌표 미니 캔버스로 표시) */
  seatCells?: PickSeatCell[];
}

export function openPickWindow(payload: PickWindowPayload): Window | null {
  if (typeof window === "undefined") return null;

  // 1. localStorage에 즉시 보관 (새로 열릴 창에서 초기 로드시 읽음)
  try {
    localStorage.setItem("classroom_current_pick_payload", JSON.stringify(payload));
  } catch {
    // ignore storage error
  }

  // 2. 이미 열려있는 창에 실시간 브로드캐스트
  try {
    const channel = new BroadcastChannel("classroom_pick_sync");
    channel.postMessage({ type: "PICK_START", payload });
    channel.close();
  } catch {
    // ignore broadcast error
  }

  // 3. 브라우저 팝업 창 동기식 열기 (사용자 클릭 이벤트 핸들러 내에서 호출되어 차단 방지)
  const w = 1180;
  const h = 760;
  const left = Math.max(0, Math.round((window.screen.width - w) / 2));
  const top = Math.max(0, Math.round((window.screen.height - h) / 2));

  // 뽑기 종류별 별도 창: 같은 종류는 기존 창을 재사용하고, 다른 종류는 각자 창을 유지한다.
  const popup = window.open(
    "/picks/window",
    `ClassroomPickWindow_${payload.type}`,
    `width=${w},height=${h},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
  );

  if (popup && !popup.closed) {
    popup.focus();
  }

  return popup;
}
