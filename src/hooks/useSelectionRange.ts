/**
 * useSelectionRange.ts
 * contenteditable 요소의 Selection/Range 상태 관리 커스텀 훅.
 * NoticeTab 에서 인라인으로 정의되어 있던 로직을 추출하여 재사용 가능하게 함.
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/** isTextCard: noticeBox 또는 free-* 접두어를 가진 대상인지 여부 */
function isTextCardElement(targetElement?: string): boolean {
  return targetElement === "noticeBox" || Boolean(targetElement?.startsWith("free-"));
}

/** 컨테이너 내부의 모든 고정/인라인 font-size 및 font[size] 속성을 제거하여 상위 컨테이너 font-size 상속 복원 */
export function cleanChildFontSizes(container: HTMLElement | DocumentFragment): void {
  const styled = container.querySelectorAll<HTMLElement>("[style*='font-size'], [style*='fontSize'], font[size]");
  styled.forEach((el) => {
    el.style.fontSize = "";
    if (el.tagName.toLowerCase() === "font") {
      el.removeAttribute("size");
    }
    if (el.tagName.toLowerCase() === "span" && !el.getAttribute("style") && !el.className && !el.id) {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    }
  });
}

export interface SelectionRangeHandle {
  getEffectiveRange(): { range: Range | null; sel: Selection | null };
  getTargetEl(range: Range | null): HTMLElement | null;
  dispatchInput(el?: HTMLElement | null): void;
  selectAndCacheNode(node: Node, sel: Selection | null): Range;
  setCachedRange(range: Range | null): void;
  lastRangeRef: React.RefObject<Range | null>;
  lastEditableRef: React.RefObject<HTMLElement | null>;
  detectedFontSize: number | null;
  applyInlineFontSize(numSz: number): boolean;
}

export function useSelectionRange(targetElement?: string): SelectionRangeHandle {
  const lastRangeRef = useRef<Range | null>(null);
  const lastEditableRef = useRef<HTMLElement | null>(null);
  const [detectedFontSize, setDetectedFontSize] = useState<number | null>(null);

  // targetElement 변경 시 이전 요소의 Range 참조를 즉시 폐기 — cross-element 서식 오염 차단
  useEffect(() => {
    lastRangeRef.current = null;
    lastEditableRef.current = null;
    setDetectedFontSize(null);
  }, [targetElement]);

  // document selectionchange 리스너: contenteditable 내부 텍스트 드래그 선택 시 Range 및 font-size 캐싱
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      const container =
        r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (r.commonAncestorContainer as HTMLElement)
          : r.commonAncestorContainer.parentElement;
      const editable = container?.closest<HTMLElement>("[contenteditable='true']");
      if (!editable) return;

      if (!sel.isCollapsed && sel.toString().trim().length > 0) {
        lastRangeRef.current = r.cloneRange();
        lastEditableRef.current = editable;

        // 선택 영역의 현재 폰트 크기 감지
        let curr: HTMLElement | null = container;
        let foundSize: number | null = null;
        while (curr && curr !== editable.parentElement) {
          if (curr.style?.fontSize) {
            const px = parseInt(curr.style.fontSize, 10);
            if (!isNaN(px) && px > 0) {
              foundSize = px;
              break;
            }
          }
          curr = curr.parentElement;
        }
        setDetectedFontSize(foundSize);
      } else {
        setDetectedFontSize(null);
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function getEffectiveRange(): { range: Range | null; sel: Selection | null } {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!isTextCardElement(targetElement)) return { range: null, sel };
    if (sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      const r = sel.getRangeAt(0);
      const container =
        r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (r.commonAncestorContainer as HTMLElement)
          : r.commonAncestorContainer.parentElement;
      const editable = container?.closest<HTMLElement>("[contenteditable='true']");
      if (editable) {
        return { range: r, sel };
      }
    }
    return { range: lastRangeRef.current, sel };
  }

  function getTargetEl(range: Range | null): HTMLElement | null {
    if (range) {
      const container =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement;
      const editable = container?.closest<HTMLElement>("[contenteditable='true']");
      if (editable) return editable;
    }
    if (targetElement && typeof document !== "undefined") {
      const byCardId = document.querySelector<HTMLElement>(`[data-card-id="${targetElement}"]`);
      if (byCardId) return byCardId;
      if (targetElement === "noticeBox") {
        const byClass = document.querySelector<HTMLElement>("[data-card-id='noticeBox'], .freecard-editor-text");
        if (byClass) return byClass;
      }
    }
    return (
      lastEditableRef.current ||
      (typeof document !== "undefined" && document.activeElement?.getAttribute("contenteditable") === "true"
        ? (document.activeElement as HTMLElement)
        : null)
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

  const applyInlineFontSize = useCallback((numSz: number): boolean => {
    const { range, sel } = getEffectiveRange();
    const targetEl = getTargetEl(range);
    if (!range || !targetEl) {
      if (targetEl) {
        cleanChildFontSizes(targetEl);
        dispatchInput(targetEl);
      }
      return false;
    }

    try {
      const targetText = (targetEl.innerText || targetEl.textContent || "").replace(/\s/g, "");
      const rangeText = range.toString().replace(/\s/g, "");
      const isFull = !targetText || !rangeText || targetText === rangeText;
      if (isFull) {
        cleanChildFontSizes(targetEl);
        dispatchInput(targetEl);
        return false;
      }

      // 부분 선택: 자식의 기존 font-size 정리 후 지정된 px 크기로 span 래핑
      const frag = range.extractContents();
      cleanChildFontSizes(frag);
      const span = document.createElement("span");
      span.style.fontSize = `${numSz}px`;
      span.appendChild(frag);
      range.insertNode(span);
      if (sel) {
        selectAndCacheNode(span, sel);
      }
      setDetectedFontSize(numSz);
      dispatchInput(targetEl);
      return true;
    } catch {
      if (targetEl) {
        cleanChildFontSizes(targetEl);
        dispatchInput(targetEl);
      }
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetElement]);

  return {
    getEffectiveRange,
    getTargetEl,
    dispatchInput,
    selectAndCacheNode,
    setCachedRange,
    lastRangeRef,
    lastEditableRef,
    detectedFontSize,
    applyInlineFontSize,
  };
}
