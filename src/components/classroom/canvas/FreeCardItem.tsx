import { useState, useRef, useEffect } from "react";
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
  top: <div title="크기 조절 핸들" data-handle="top" className="w-full h-full" />,
  right: <div title="크기 조절 핸들" data-handle="right" className="w-full h-full" />,
  bottom: <div title="크기 조절 핸들" data-handle="bottom" className="w-full h-full" />,
  left: <div title="크기 조절 핸들" data-handle="left" className="w-full h-full" />,
  topLeft: <div title="크기 조절 핸들" data-handle="topLeft" className="w-full h-full" />,
  topRight: <div title="크기 조절 핸들" data-handle="topRight" className="w-full h-full" />,
  bottomLeft: <div title="크기 조절 핸들" data-handle="bottomLeft" className="w-full h-full" />,
  bottomRight: <div title="크기 조절 핸들" data-handle="bottomRight" className="w-full h-full" />,
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
      cancel={isEditing ? "[contenteditable='true'], .freecard-editor-text" : undefined}
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
      onClick={() => {
        // 드래그 직후에 발생하는 클릭 이벤트는 텍스트 편집 모드로 전환하지 않음
        if (isDraggingRef.current) return;

        onSelect?.(card.id);
        // 비연속 클릭: 미포커스 상태에서 첫 진입 시 편집 모드 + 전체 블록 선택
        // 연속 클릭: 이미 포커스된 상태에서는 브라우저 기본 커서 위치 이동
        if (!isFocused.current) {
          setIsEditing(true);
          setTimeout(() => {
            editorRef.current?.focus();
            selectAllContent();
          }, 30);
        }
      }}
      className={`z-20 group rounded-2xl border transition-colors flex flex-col bg-transparent ${
        isEditing
          ? "border-indigo-400/60 ring-1 ring-indigo-400/40 cursor-text"
          : isSelected
          ? "border-transparent hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30 cursor-grab active:cursor-grabbing"
          : "border-transparent hover:border-white/30 cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* 상단 드래그 핸들 및 닫기 버튼 바 */}
      <div
        className={`transition-opacity flex items-center justify-between px-2.5 py-1 bg-slate-900/40 backdrop-blur-xs rounded-t-2xl border-b border-white/10 select-none ${
          isEditing || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
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
      <div className="p-2 flex-1 w-full h-full">
        <div
          ref={editorRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onFocus={() => {
            isFocused.current = true;
            setIsEditing(true);
          }}
          onBlur={() => {
            isFocused.current = false;
            setIsEditing(false);
          }}
          onPaste={handlePaste}
          onInput={(e) => onUpdate(card.id, e.currentTarget.innerHTML)}
          className={`w-full h-full outline-none font-bold overflow-y-auto leading-relaxed tracking-tight ${
            isEditing
              ? "cursor-text select-text freecard-editor-text"
              : "select-none cursor-grab active:cursor-grabbing"
          }`}
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
