/**
 * boardLabels.ts
 * BoardTargetElement 값을 사용자 표시용 한글 레이블로 변환하는 공용 유틸리티.
 * 이전에는 NoticeTab 컴포넌트 내부에만 인라인으로 존재하여 재사용이 불가능했음.
 */

import { BoardTargetElement } from "@/types/classroom";

/** BoardTargetElement 를 사용자에게 보여줄 한글 레이블로 변환. */
export function getTargetLabel(target?: BoardTargetElement): string {
  if (!target || target === "all") return "전체 일괄";
  if (target === "noticeBox") return "알림장 본문";
  if (target === "dateBox") return "날짜";
  if (target === "clockBox") return "시간/시계";
  if (target === "routineBox") return "학생 업무";
  if (target === "accountBox") return "계좌 아이콘";
  if (target.startsWith("routine-")) return "업무 요소";
  if (target.startsWith("free-") || target === "freeCard") return "자유 글상자";
  return "선택 요소";
}
