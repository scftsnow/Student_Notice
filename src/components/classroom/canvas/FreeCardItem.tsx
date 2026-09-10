import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from "react";
import { X, GripHorizontal } from "lucide-react";
import { Rnd } from "react-rnd";
import { FreeCardData } from "@/types/classroom";

interface FreeCardItemProps {
  card: FreeCardData;
  containerSize: { width: number; height: number };
  onUpdate: (id: string, html: string, updates?: Partial<FreeCardData>) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  placeholder?: string;
  isMainNotice?: boolean;
}

const RESIZE_ENABLE = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
};

const RESIZE_HANDLES = {
  top: <div title="크기 조절" data-handle="top" className="w-full h-full cursor-ns-resize" />,
  right: (
    <div title="크기 조절" data-handle="right" className="w-full h-full flex items-center justify-end cursor-ew-resize">
      <div className="w-1 h-8 rounded-full bg-white/40 group-hover:bg-indigo-400 transition-colors mr-0.5" />
    </div>
  ),
  bottom: (
    <div title="크기 조절" data-handle="bottom" className="w-full h-full flex items-end justify-center cursor-ns-resize pb-0.5">
      <div className="w-8 h-1 rounded-full bg-white/40 group-hover:bg-indigo-400 transition-colors" />
    </div>
  ),
  left: <div title="크기 조절" data-handle="left" className="w-full h-full cursor-ew-resize" />,
  topLeft: <div title="크기 조절" data-handle="topLeft" className="w-full h-full cursor-nwse-resize" />,
  topRight: <div title="크기 조절" data-handle="topRight" className="w-full h-full cursor-nesw-resize" />,
  bottomLeft: <div title="크기 조절" data-handle="bottomLeft" className="w-full h-full cursor-nesw-resize" />,
  bottomRight: (
    <div title="크기 조절" data-handle="bottomRight" className="w-full h-full flex items-end justify-end p-1 cursor-nwse-resize">
      <div className="w-3 h-3 border-r-2 border-b-2 border-white/70 group-hover:border-indigo-400 transition-colors rounded-br-xs" />
    </div>
  ),
};

export default function FreeCardItem({
  card,
  containerSize,
  onUpdate,
  onRemove,
  isSelected = false,
  onSelect,
  placeholder = "메모를 입력하세요...",
  isMainNotice = false,
}: FreeCardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  // isFocused: 텍스트 에디터 브라우저 포커스 여부
  const isFocused = useRef(false);
  const wasFocusedRef = useRef(false);
  // isDraggingRef: 드래그 이동과 단순 클릭을 구별하기 위한 플래그
  const isDraggingRef = useRef(false);

  const parsePercent = (val: string | undefined, fallback: number) => {
    if (!val) return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  // Sync external card.html when editor is not focused
  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      if (editorRef.current.innerHTML !== (card.html || "")) {
        editorRef.current.innerHTML = card.html || "";
      }
    }
  }, [card.html]);

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
      onDragStop={(_e, d) => {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 150);
        const cardW = typeof width === "number" ? width : 160;
        const cardH = typeof height === "number" ? height : 80;
        const clampedX = Math.max(-cardW + 40, Math.min(d.x, containerSize.width - 40));
        const clampedY = Math.max(-cardH + 40, Math.min(d.y, containerSize.height - 40));
        const left = `${((clampedX / containerSize.width) * 100).toFixed(1)}%`;
        const top = `${((clampedY / containerSize.height) * 100).toFixed(1)}%`;
        onUpdate(card.id, card.html, { left, top });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        const w = `${((parseFloat(ref.style.width) / containerSize.width) * 100).toFixed(1)}%`;
        const h = `${((parseFloat(ref.style.height) / containerSize.height) * 100).toFixed(1)}%`;
        const left = `${((position.x / containerSize.width) * 100).toFixed(1)}%`;
        const top = `${((position.y / containerSize.height) * 100).toFixed(1)}%`;
        onUpdate(card.id, card.html, { width: w, height: h, left, top });
      }}
      onClick={(e: ReactMouseEvent<HTMLElement>) => {
        // 드래그 이동 직후에 발생하는 클릭 이벤트는 무시
        if (isDraggingRef.current) return;

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
      className={`z-20 group rounded-2xl border transition-colors flex flex-col overflow-hidden ${
        isSelected
          ? "border-indigo-400 ring-2 ring-indigo-400/40 bg-white/5"
          : isMainNotice
          ? "border-white/20 hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30 bg-transparent"
          : "border-dashed border-white/20 hover:border-white/40 bg-transparent"
      } cursor-grab active:cursor-grabbing`}
    >
      {/* 상단 드래그 핸들 및 닫기 버튼 바 */}
      <div
        className={`transition-opacity flex items-center justify-between px-2.5 py-1 bg-slate-900/40 backdrop-blur-xs rounded-t-2xl border-b border-white/10 select-none cursor-grab active:cursor-grabbing ${
          isEditing || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
            {isMainNotice ? "알림장 본문" : "자유 글상자"}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(card.id);
          }}
          className="text-white/50 hover:text-rose-400 p-0.5 rounded transition-colors"
          title={isMainNotice ? "알림장 내용 비우기" : "글상자 삭제"}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 자유 글상자 본문 */}
      <div className="p-2 flex-1 w-full min-h-0 overflow-hidden cursor-grab active:cursor-grabbing">
        <div
          ref={editorRef}
          contentEditable={true}
          suppressContentEditableWarning
          onMouseDown={() => {
            wasFocusedRef.current = document.activeElement === editorRef.current;
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
          className="w-full h-full outline-none font-bold overflow-y-auto leading-relaxed tracking-tight cursor-text select-text freecard-editor-text"
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
          }}
          data-placeholder={placeholder}
        />
      </div>
    </Rnd>
  );
}
