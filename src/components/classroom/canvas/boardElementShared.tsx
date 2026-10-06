"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, User } from "lucide-react";
import type { BoardTheme } from "@/types/classroom";

/**
 * 칠판 텍스트 요소 공용 코드.
 *
 * 업무 요소(RoutineElementInCanvas)와 과제 요소(HomeworkBoardCard)는
 * 컨테이너·포털 메뉴·편집 가드가 모두 같고, 스펙이 다른 부분(본문/메뉴 항목)만 다르므로
 * 여기서 한 번만 정의하고 양쪽이 함께 쓴다.
 */

/** 이름(당번/미제출자) span 공통 클래스 — 테마 색상은 뒤에 덧붙인다 */
export const BOARD_NAME_SPAN_CLASS =
  "font-black underline decoration-2 cursor-pointer select-none whitespace-nowrap transition-all";

/** 테마별 이름 색상 */
export function boardNameColor(theme: BoardTheme | undefined): string {
  return theme === "white"
    ? "text-indigo-700"
    : theme === "warm"
      ? "text-rose-700"
      : "text-amber-300";
}

/** 테마별 본문 글자색 */
export function boardTextColor(theme: BoardTheme | undefined): string {
  return theme === "white"
    ? "text-slate-900"
    : theme === "warm"
      ? "text-amber-950"
      : theme === "navy"
        ? "text-slate-200"
        : "text-white/90";
}

/** 우클릭 메뉴 좌표 — 화면 안쪽으로 보정 */
export function contextMenuPos(e: { clientX: number; clientY: number }): { x: number; y: number } {
  return {
    x: Math.max(10, Math.min(e.clientX, window.innerWidth - 250)),
    y: Math.max(10, Math.min(e.clientY, window.innerHeight - 330)),
  };
}

/** 이름 클릭 팝오버를 붙일 기준 — 이름 span 의 화면 좌표 */
export type PopupAnchor = { top: number; bottom: number; left: number; right: number };

/**
 * 팝오버를 이름 바로 위에 붙인다 (높이는 렌더 후 실측).
 * 높이를 미리 고정하면 내용 길이가 다른 팝오버가 엉뚱한 곳에 뜨므로
 * 아래 BoardItemPopup 이 자기 높이를 재서 붙인다.
 */
export function popupAnchorFrom(el: HTMLElement): PopupAnchor {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

/** 클립보드 복사 — 실패 시 textarea 폴백 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* noop */
    }
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ------------------------------------------------------------------ */
/* 편집 가드                                                            */
/* ------------------------------------------------------------------ */

/** 선택 영역에 이름 토큰이 포함돼 있으면 삭제로 훼손될 수 있다 */
export function isSelectionDamagingTokens(
  sel: Selection,
  tokenAttr = "data-worker-index"
): boolean {
  if (!sel.rangeCount || sel.isCollapsed) return false;
  return Boolean(sel.getRangeAt(0).cloneContents().querySelector(`[${tokenAttr}]`));
}

/** 커서가 이름 토큰 바로 앞/뒤에 붙어 있는지 (Backspace/Delete 차단용) */
export function isTokenAdjacent(
  direction: "before" | "after",
  sel: Selection,
  editable: HTMLElement | null,
  tokenAttr = "data-worker-index"
): boolean {
  if (!sel.rangeCount || !editable) return false;
  const range = sel.getRangeAt(0);
  const { startContainer: node, startOffset: offset } = range;
  if (direction === "before") {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").slice(0, offset).replace(/\u200B/g, "").length > 0) {
      return false;
    }
    let curr: Node | null =
      node.nodeType === Node.TEXT_NODE && node.parentElement !== editable ? node.parentElement : node;
    if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
      curr = node.childNodes[offset - 1];
    }
    if (curr instanceof HTMLElement && curr.hasAttribute(tokenAttr)) return true;
    let prev = curr?.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent ?? "").replace(/\u200B/g, "") === "") {
      prev = prev.previousSibling;
    }
    return prev instanceof HTMLElement && prev.hasAttribute(tokenAttr);
  }
  if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").slice(offset).replace(/\u200B/g, "").length > 0) {
    return false;
  }
  let curr: Node | null =
    node.nodeType === Node.TEXT_NODE && node.parentElement !== editable ? node.parentElement : node;
  if (node.nodeType === Node.ELEMENT_NODE && offset < node.childNodes.length) {
    curr = node.childNodes[offset];
  }
  if (curr instanceof HTMLElement && curr.hasAttribute(tokenAttr)) return true;
  let next = curr?.nextSibling;
  while (next && next.nodeType === Node.TEXT_NODE && (next.textContent ?? "").replace(/\u200B/g, "") === "") {
    next = next.nextSibling;
  }
  return next instanceof HTMLElement && next.hasAttribute(tokenAttr);
}

/**
 * contenteditable 내용에서 템플릿 문자열을 복원한다.
 * 이름 토큰은 `?`, 인원 토큰(있을 때만)은 `#` 로 되돌린다.
 */
export function extractTemplateFromDOM(
  container: HTMLElement,
  opts: { nameAttr?: string; countAttr?: string } = {}
): string {
  const nameAttr = opts.nameAttr ?? "data-worker-index";
  const out: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.nodeValue ?? "");
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.hasAttribute(nameAttr)) {
        out.push("?");
        return;
      }
      if (opts.countAttr && node.hasAttribute(opts.countAttr)) {
        out.push("#");
        return;
      }
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(container.childNodes).forEach(walk);
  return out
    .join("")
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** contenteditable 키 처리 공통 — Enter 확정 / 토큰 훼손 방지 */
export function editableKeyGuard(
  e: React.KeyboardEvent<HTMLDivElement>,
  editable: HTMLElement | null
): void {
  if (e.key === "Enter") {
    e.preventDefault();
    editable?.blur();
    return;
  }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  if (
    isSelectionDamagingTokens(sel) &&
    (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1)
  ) {
    e.preventDefault();
    return;
  }
  if (
    sel.isCollapsed &&
    ((e.key === "Backspace" && isTokenAdjacent("before", sel, editable)) ||
      (e.key === "Delete" && isTokenAdjacent("after", sel, editable)))
  ) {
    e.preventDefault();
  }
}

/** contenteditable 붙여넣기 공통 — 토큰 포함 선택이면 막고 일반 텍스트만 삽입 */
export function editablePasteGuard(e: React.ClipboardEvent<HTMLDivElement>): void {
  e.preventDefault();
  const sel = window.getSelection();
  if (sel && isSelectionDamagingTokens(sel)) return;
  const text = e.clipboardData.getData("text/plain");
  if (!text) return;
  document.execCommand("insertText", false, text);
}

/* ------------------------------------------------------------------ */
/* 포털 셸                                                             */
/* ------------------------------------------------------------------ */

export type ContextMenuItem =
  | {
      key: string;
      label: string;
      icon?: ReactNode;
      labelClass?: string;
      trailing?: ReactNode;
      disabled?: boolean;
      onClick: () => void;
    }
  | { key: string; divider: true };

/** 전체화면 투명 백드롭 — 뒤쪽 요소 클릭 차단 */
function PortalBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[99998]"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    />
  );
}

/** 우클릭 컨텍스트 메뉴 창 (업무/과제 공용 껍데기) */
export function BoardContextMenu({
  pos,
  title,
  icon,
  items,
  onClose,
}: {
  pos: { x: number; y: number };
  title: string;
  icon?: ReactNode;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <PortalBackdrop onClose={onClose} />
      <div
        className="fixed z-[99999] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-white text-xs overflow-hidden select-none"
        style={{ left: pos.x, top: pos.y, minWidth: 210 }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
          {icon}
          <span className="font-bold text-white/90 truncate">{title}</span>
        </div>
        <div className="p-1.5 space-y-0.5">
          {items.map((it) =>
            "divider" in it ? (
              <div key={it.key} className="h-px bg-white/10 my-0.5" />
            ) : (
              <button
                key={it.key}
                type="button"
                disabled={it.disabled}
                onClick={it.onClick}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left ${
                  it.labelClass ?? "font-medium"
                }`}
              >
                {it.icon}
                <span className="font-semibold">{it.label}</span>
                {it.trailing && <span className="ml-auto">{it.trailing}</span>}
              </button>
            )
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * 이름 클릭 팝오버 창 (업무/과제 공용 껍데기).
 *
 * `anchor` 를 주면 이름 바로 위에, 자기 높이를 재서 붙인다.
 * 높이를 미리 정해두지 않으므로 내용 길이가 다른 두 팝오버가 제각각 맞아떨어진다.
 * (예전에 높이 298px 를 고정해서, 짧은 과제 팝오버가 300px 위쪽에 뜨던 문제)
 */
export function BoardItemPopup({
  anchor,
  header,
  onClose,
  children,
}: {
  anchor?: PopupAnchor | null;
  header: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  // 이름을 기준으로 위/아래 자리를 고르고, 가로로는 화면 안쪽에 맞춘다
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !anchor) return;
    const h = box.offsetHeight;
    const w = box.offsetWidth;
    let top = anchor.top - h - 8;
    if (top < 10) top = Math.min(window.innerHeight - h - 10, anchor.bottom + 8);
    const left = Math.max(10, Math.min(anchor.left, window.innerWidth - w - 10));
    box.style.top = `${Math.max(10, top)}px`;
    box.style.left = `${left}px`;
    // 위치를 재기 전까지는 감춰 두고, 자리 잡은 뒤에 드러낸다 (점프 현상 방지)
    box.style.visibility = "visible";
  }, [anchor, header, children]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <PortalBackdrop onClose={onClose} />
      <div
        ref={boxRef}
        className="fixed z-[99999] min-w-[220px] max-w-[280px] bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl text-xs space-y-2.5 text-white select-none"
        style={{ left: 0, top: 0, visibility: anchor ? "hidden" : "visible" }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          {header}
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-0.5 leading-none"
            title="닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}

/** 이름 클릭 팝오버 기본 헤더 — 이름 + (선택) 태그 */
export function BoardItemPopupHeader({
  name,
  nameClass = "text-amber-300",
  tag,
}: {
  name: string;
  nameClass?: string;
  tag?: ReactNode;
}) {
  return (
    <span className="font-extrabold text-white flex items-center gap-1">
      <User className="w-3.5 h-3.5" />
      <span className={nameClass}>{name}</span>
      {tag}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 컨테이너 셸                                                          */
/* ------------------------------------------------------------------ */

/** 칠판 텍스트 요소 컨테이너 — 바깥 구조와 클릭 배선을 담당 */
export function BoardElementShell({
  children,
  onSelect,
  onContextMenu,
}: {
  children: ReactNode;
  onSelect?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onContextMenu={onContextMenu}
      className="relative w-full group"
      style={{ fontSize: "inherit" }}
    >
      {children}
    </div>
  );
}

/** 포털 마운트 가드 (SSR-safe) */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** 요소 안의 이름 토큰 span 을 찾는 헬퍼 */
export function nameSpanFromEvent(
  e: React.MouseEvent | React.MouseEvent<HTMLElement>
): HTMLElement | null {
  return (e.target as HTMLElement).closest("[data-worker-index]") as HTMLElement | null;
}

/* ------------------------------------------------------------------ */
/* 커서 위치 보존                                                       */
/* ------------------------------------------------------------------ */

export interface Caret {
  start: number;
  end: number;
}

/** contenteditable 안의 커서 위치를 문자 오프셋으로 읽는다 */
export function captureCaret(el: HTMLElement): Caret | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const range = sel.getRangeAt(0);
  const before = (node: Node, offset: number): number => {
    const r = document.createRange();
    r.selectNodeContents(el);
    try {
      r.setEnd(node, offset);
    } catch {
      return 0;
    }
    return r.toString().length;
  };
  return { start: before(range.startContainer, range.startOffset), end: before(range.endContainer, range.endOffset) };
}

/** 문자 오프셋으로 커서 위치를 되돌린다 */
export function restoreCaret(el: HTMLElement, caret: Caret | null): void {
  if (!caret) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (startNode === null && seen + len >= caret.start) {
      startNode = node;
      startOff = Math.max(0, caret.start - seen);
    }
    if (endNode === null && seen + len >= caret.end) {
      endNode = node;
      endOff = Math.max(0, caret.end - seen);
      break;
    }
    seen += len;
    node = walker.nextNode() as Text | null;
  }
  if (!startNode || !endNode) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  try {
    range.setStart(startNode, Math.min(startOff, startNode.textContent?.length ?? 0));
    range.setEnd(endNode, Math.min(endOff, endNode.textContent?.length ?? 0));
  } catch {
    return;
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ------------------------------------------------------------------ */
/* 과제 미제출자 본문                                                   */
/* ------------------------------------------------------------------ */

/** 인원 수 토큰 속성 (`#` 토큰) */
export const HOMEWORK_COUNT_ATTR = "data-homework-token";

/** 전원 제출 시 표시할 문구 */
export const ALL_DONE_TEMPLATE = "모두 제출했습니다";

/** 템플릿 조각: 일반 텍스트 / 학생 이름(`?`) / 미제출 인원(`#`) */
export interface HomeworkSegment {
  type: "text" | "name" | "count";
  text: string;
}

/**
 * 표시 템플릿 기본값.
 * 미제출 인원수만큼 `?` 를 ', ' 로 이어 붙인다 (업무 요소의 기본 displayFormat 과 같은 방식).
 */
export function defaultHomeworkTemplate(unsubmittedCount: number): string {
  if (unsubmittedCount === 0) return ALL_DONE_TEMPLATE;
  return `미제출 #명: ${Array(unsubmittedCount).fill("?").join(", ")}`;
}

/** 템플릿 문자열 → 조각. `?` 는 이름 자리, `#` 는 미제출 인원 자리. */
export function parseHomeworkTemplate(template: string): HomeworkSegment[] {
  const out: HomeworkSegment[] = [];
  let buf = "";
  for (const ch of template) {
    if (ch === "?" || ch === "#") {
      if (buf) {
        out.push({ type: "text", text: buf });
        buf = "";
      }
      out.push({ type: ch === "?" ? "name" : "count", text: ch });
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ type: "text", text: buf });
  return out;
}

/**
 * 과제 미제출자 본문 HTML.
 * 편집 화면(HomeworkBoardCard)과 학생 화면(BoardClient)이 **같은 결과**를 갖도록
 * 한 곳에서 만든다. (两边이 따로 만들면 편집한 내용이 학생 화면에 반영되지 않는다)
 */
export function buildHomeworkHtml(input: {
  /** 저장된 표시 템플릿 (없으면 미제출 인원수로 기본 생성) */
  displayTemplate?: string;
  /** 미제출자 이름 목록 */
  unsubmitted: string[];
  /** 이름 토큰에 붙일 테마 색 클래스 (지정 색이 있으면 빈 문자열) */
  nameColorClass: string;
  /** 지정 색 (있으면 이름 토큰에 직접 입힌다) */
  nameColor?: string;
}): string {
  const template = input.displayTemplate?.trim() || defaultHomeworkTemplate(input.unsubmitted.length);
  const segments = parseHomeworkTemplate(template);
  const parts: string[] = ["\u200B"];
  let nameIdx = 0;
  segments.forEach((seg) => {
    if (seg.type === "text") {
      parts.push(escapeHtml(seg.text));
      return;
    }
    if (seg.type === "count") {
      parts.push(
        `<span ${HOMEWORK_COUNT_ATTR}="count" class="font-black">${input.unsubmitted.length}</span>`
      );
      return;
    }
    const name = input.unsubmitted[nameIdx];
    const idx = nameIdx;
    nameIdx++;
    if (!name) return;
    const style = input.nameColor ? ` style="color:${escapeHtml(input.nameColor)};"` : "";
    parts.push(
      `<span data-worker-index="${idx}" ${HOMEWORK_COUNT_ATTR}="name" contenteditable="false" class="${BOARD_NAME_SPAN_CLASS} ${input.nameColorClass}"${style} title="${escapeHtml(name)} — 클릭: 제출 처리">${escapeHtml(name)}</span>`,
      "\u200B"
    );
  });
  return parts.join("");
}
