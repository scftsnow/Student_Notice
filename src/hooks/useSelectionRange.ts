/**
 * useSelectionRange.ts
 * contenteditable 요소의 Selection/Range 상태 관리 커스텀 훅.
 * NoticeTab 에서 인라인으로 정의되어 있던 로직을 추출하여 재사용 가능하게 함.
 *
 * 책임:
 *  - lastRangeRef / lastEditableRef 생명주기 관리
 *  - document selectionchange 리스너 등록/해제
 *  - targetElement 변경 시 선택 상태 자동 초기화 (cross-element 오염 방지)
 *  - getEffectiveRange / getTargetEl / dispatchInput / restoreForExecCmd 제공
 */

"use client";

import { useRef, useEffect } from "react";

/** isTextCard: noticeBox 또는 free-* 접두어를 가진 대상인지 여부 */
function isTextCardElement(targetElement?: string): boolean {
  return targetElement === "noticeBox" || Boolean(targetElement?.startsWith("free-"));
}

export interface SelectionRangeHandle {
  /**
   * 현재 유효한 Range 와 Selection 을 반환.
   * targetElement 가 텍스트 카드 계열이 아니면 range = null.
   */
  getEffectiveRange(): { range: Range | null; sel: Selection | null };
  /**
   * Range 의 조상 contenteditable 요소를 반환.
   * range 가 null 이면 lastEditableRef 또는 activeElement 로 폴백.
   */
  getTargetEl(range: Range | null): HTMLElement | null;
  /**
   * contenteditable 요소에 focus + input 이벤트를 디스패치.
   * React 상태 동기화를 위해 서식 적용 후 반드시 호출.
   */
  dispatchInput(el?: HTMLElement | null): void;
  /**
   * node 내용 전체를 선택하고 Selection과 캐시(lastRangeRef)를 갱신.
   */
  selectAndCacheNode(node: Node, sel: Selection | null): Range;
  /**
   * 캐시된 Range 수동 갱신.
   */
  setCachedRange(range: Range | null): void;
  /**
   * 현재 캐싱된 Range Ref (직접 참조가 필요한 경우에만 사용).
   */
  lastRangeRef: React.RefObject<Range | null>;
  /**
   * 마지막으로 포커스된 contenteditable 요소 Ref.
   */
  lastEditableRef: React.RefObject<HTMLElement | null>;
}

export function useSelectionRange(targetElement?: string): SelectionRangeHandle {
  const lastRangeRef = useRef<Range | null>(null);
  const lastEditableRef = useRef<HTMLElement | null>(null);

  // targetElement 변경 시 이전 요소의 Range 참조를 즉시 폐기 — cross-element 서식 오염 차단
  useEffect(() => {
    lastRangeRef.current = null;
    lastEditableRef.current = null;
  }, [targetElement]);

  // document selectionchange 리스너: 텍스트 드래그 선택 시 Range 를 캐싱
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
        const r = sel.getRangeAt(0);
        lastRangeRef.current = r.cloneRange();
        const container =
          r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? (r.commonAncestorContainer as HTMLElement)
            : r.commonAncestorContainer.parentElement;
        const editable = container?.closest<HTMLElement>("[contenteditable='true']");
        if (editable) {
          lastEditableRef.current = editable;
        }
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function getEffectiveRange(): { range: Range | null; sel: Selection | null } {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!isTextCardElement(targetElement)) return { range: null, sel };
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      return { range: sel.getRangeAt(0), sel };
    }
    return { range: lastRangeRef.current, sel };
  }

  function getTargetEl(range: Range | null): HTMLElement | null {
    if (!range) {
      return lastEditableRef.current || (document.activeElement as HTMLElement | null);
    }
    const container =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement;
    return (
      container?.closest<HTMLElement>("[contenteditable='true']") ||
      lastEditableRef.current ||
      (document.activeElement as HTMLElement | null)
    );
  }

  function dispatchInput(el?: HTMLElement | null): void {
    if (
      el &&
      (el.getAttribute("contenteditable") === "true" || el.hasAttribute("contenteditable"))
    ) {
      el.focus();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function selectAndCacheNode(node: Node, sel: Selection | null): Range {
    const newRange = document.createRange();
    newRange.selectNodeContents(node);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    lastRangeRef.current = newRange.cloneRange();
    return newRange;
  }

  function setCachedRange(range: Range | null): void {
    lastRangeRef.current = range ? range.cloneRange() : null;
  }

  return {
    getEffectiveRange,
    getTargetEl,
    dispatchInput,
    selectAndCacheNode,
    setCachedRange,
    lastRangeRef,
    lastEditableRef,
  };
}
