import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from "react";
import { X, GripHorizontal } from "lucide-react";
import { Rnd } from "react-rnd";
import { FreeCardData } from "@/types/classroom";
import { RESIZE_ENABLE, RESIZE_HANDLES } from "./CanvasResizeHandles";
import { parsePercent, makeDragSaveHandler, makeResizeSaveHandler } from "@/lib/canvasUtils";

interface FreeCardItemProps {
  card: FreeCardData;
  containerSize: { width: number; height: number };
  onUpdate: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  placeholder?: string;
  scale?: number;
}

/** 컨테이너 내부의 모든 인라인 font-size 스타일을 제거하여 컨테이너의 font-size 상속을 복원한다 */
function removeChildFontSizes(container: HTMLElement): boolean {
  let changed = false;
  const styled = container.querySelectorAll<HTMLElement>("[style]");
  styled.forEach((el) => {
    if (el.style.fontSize) {
      el.style.fontSize = "";
      changed = true;
    }
    // font[size] 속성 레거시 제거
    if (el.tagName.toLowerCase() === "font" && el.getAttribute("size")) {
      el.removeAttribute("size");
      changed = true;
    }
  });
  return changed;
}

export default function FreeCardItem({
  card,
  containerSize,
  onUpdate,
  onRemove,
  isSelected = false,
  onSelect,
  placeholder = "메모를 입력하세요...",
  scale,
}: FreeCardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const wasFocusedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const prevFontSizeRef = useRef<number | undefined>(card.fontSize);

  // Sync external card.html when editor is not focused
  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      if (editorRef.current.innerHTML !== (card.html || "")) {
        editorRef.current.innerHTML = card.html || "";
      }
    }
  }, [card.html]);

  // card.fontSize가 외부에서 변경되면 내부 인라인 font-size 오버라이드를 제거하여
  // 컨테이너 style.fontSize(= card.fontSize px)가 즉각 반영되도록 한다.
  useEffect(() => {
    if (prevFontSizeRef.current === card.fontSize) return;
    prevFontSizeRef.current = card.fontSize;
    if (!editorRef.current || isFocused.current) return;
    const changed = removeChildFontSizes(editorRef.current);
    if (changed) {
      // 정리된 HTML을 React 상태와 동기화
      onUpdate(card.id, editorRef.current.innerHTML);
    }
  }, [card.fontSize, card.id, onUpdate]);

  // Exit edit mode when deselected from outside
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
      isFocused.current = false;
      wasFocusedRef.current = false;
    }
  }, [isSelected]);

  const selectAllContent = () => {
    if (!editorRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const success = document.execCommand("insertText", false, text);
    if (!success) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    if (editorRef.current) {
      onUpdate(card.id, editorRef.current.innerHTML);
    }
  };

  const x = (parsePercent(card.left, 20) / 100) * containerSize.width;
  const y = (parsePercent(card.top, 40) / 100) * containerSize.height;
  const width = card.width
    ? (parsePercent(card.width, 20) / 100) * containerSize.width
    : 160;
  const height = card.height
    ? (parsePercent(card.height, 15) / 100) * containerSize.height
    : "auto";

  return (
    <Rnd
      scale={scale}
      position={{ x, y }}
      size={{ width, height }}
      minWidth={120}
      cancel="[contenteditable='true'], .freecard-editor-text, .canvas-text-space, input, textarea, button"
      enableUserSelectHack={false}
      enableResizing={RESIZE_ENABLE}
      resizeHandleComponent={RESIZE_HANDLES}
      onDragStart={() => {
        isDraggingRef.current = true;
      }}
      onDragStop={(e, d) => {
        setTimeout(() => { isDraggingRef.current = false; }, 150);
        const cardW = typeof width === "number" ? width : 160;
        const cardH = typeof height === "number" ? height : 80;
        makeDragSaveHandler(
          containerSize,
          cardW,
          cardH,
          (left, top) => onUpdate(card.id, card.html, { left, top }),
        )(e, d);
      }}
      onResizeStop={makeResizeSaveHandler(
        containerSize,
        (w, h, left, top) => onUpdate(card.id, card.html, { width: w, height: h, left, top }),
      )}
      onClick={(e: ReactMouseEvent<HTMLElement>) => {
        // 드래그 이동 직후에 발생하는 클릭 이벤트는 무시
        if (isDraggingRef.current) return;
        e.stopPropagation();
        onSelect?.(card.id);

        // 텍스트 에디터 내부 클릭일 때만 블록 선택 / 커서 분기 수행
        const isTargetEditor = editorRef.current && (e.target === editorRef.current || editorRef.current.contains(e.target as Node));
        if (!isTargetEditor) return;

        const sel = window.getSelection();
        const isRangeInThis = sel && !sel.isCollapsed && sel.toString().length > 0 &&
          Boolean(editorRef.current && (
            editorRef.current.contains(sel.anchorNode) ||
            editorRef.current.contains(sel.focusNode)
          ));

        // 비연속 클릭: 미포커스 상태에서 첫 진입 시 편집 모드 + 전체 블록 선택
        // (단, 사용자가 드래그하여 일부 텍스트를 지정한 경우 전체 선택으로 덮어쓰지 않음)
        if (!isRangeInThis && !wasFocusedRef.current) {
          setIsEditing(true);
          wasFocusedRef.current = true;
          setTimeout(() => {
            editorRef.current?.focus();
            selectAllContent();
          }, 30);
        }
      }}
      className={`z-20 group rounded-2xl border transition-colors flex flex-col overflow-hidden relative ${
        isSelected
          ? "border-indigo-400 ring-2 ring-indigo-400/40 bg-white/5"
          : "border-white/20 hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30 bg-transparent"
      } cursor-grab active:cursor-grabbing`}
    >
      {/* 상단 드래그 핸들 및 닫기 버튼 바 (오버레이로 배치하여 학생 화면과 1:1 레이아웃 일치) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-opacity flex items-center justify-between px-2.5 py-1 bg-slate-900/60 backdrop-blur-xs rounded-t-2xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
          isEditing || isSelected
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(card.id);
        }}
      >
        <div
          className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-white/70 hover:text-white py-0.5"
          title="드래그하여 글상자 이동"
        >
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold tracking-tight opacity-75">
            {card.label || "글상자"}
          </span>
        </div>
        {card.id !== "noticeBox" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(card.id);
            }}
            className="text-white/50 hover:text-rose-400 p-0.5 rounded transition-colors"
            title="글상자 삭제"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 자유 글상자 본문 */}
      <div className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing flex flex-col">
        <div
          ref={editorRef}
          data-card-id={card.id}
          contentEditable={true}
          suppressContentEditableWarning
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(card.id);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            wasFocusedRef.current = document.activeElement === editorRef.current;
            onSelect?.(card.id);
          }}
          onFocus={() => {
            isFocused.current = true;
            setIsEditing(true);
            onSelect?.(card.id);
          }}
          onBlur={() => {
            isFocused.current = false;
            wasFocusedRef.current = false;
            setIsEditing(false);
          }}
          onPaste={handlePaste}
          onInput={(e) => onUpdate(card.id, e.currentTarget.innerHTML)}
          className="w-full h-full p-2 outline-none font-bold overflow-y-auto overflow-x-hidden leading-relaxed tracking-tight cursor-text select-text freecard-editor-text box-border"
          style={{
            fontSize: `${card.fontSize || 42}px`,
            textAlign: card.align || "left",
            color: card.color || "inherit",
            fontFamily: card.fontFamily || undefined,
            lineHeight: card.lineHeight
              ? typeof card.lineHeight === "number"
                ? card.lineHeight > 10 ? `${card.lineHeight / 100}` : `${card.lineHeight}`
                : card.lineHeight
              : "1.4",
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
          }}
          data-placeholder={placeholder}
        />
      </div>
    </Rnd>
  );
}
