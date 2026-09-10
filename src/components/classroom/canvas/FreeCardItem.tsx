import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
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
  // true when the contentEditable div has browser focus (consecutive click context)
  const isFocused = useRef(false);

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
      bounds="parent"
      position={{ x, y }}
      size={{ width, height }}
      minWidth={120}
      disableDragging={isEditing}
      enableResizing={RESIZE_ENABLE}
      resizeHandleComponent={RESIZE_HANDLES}
      onDragStop={(_e, d) => {
        const left = `${((d.x / containerSize.width) * 100).toFixed(1)}%`;
        const top = `${((d.y / containerSize.height) * 100).toFixed(1)}%`;
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
        onSelect?.(card.id);
        // Non-consecutive: not yet focused -> enter edit + select all
        // Consecutive: already focused -> browser handles cursor placement naturally
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
          ? "border-indigo-400/60 ring-1 ring-indigo-400/40"
          : isSelected
          ? "border-transparent hover:border-indigo-400/60 hover:ring-1 hover:ring-indigo-400/30 cursor-grab active:cursor-grabbing"
          : "border-transparent hover:border-white/30 cursor-grab active:cursor-grabbing"
      }`}
    >
      {/* 글상자 삭제/비우기 버튼 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(card.id);
        }}
        className={`transition-opacity absolute top-1.5 right-1.5 z-30 text-white/50 hover:text-rose-400 p-0.5 rounded ${
          isEditing || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        title={isMainNotice ? "알림장 내용 비우기" : "글상자 삭제"}
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* 자유 글상자 본문 — contentEditable 항상 활성, pointer-events로 편집 진입 제어 */}
      <div className="p-2 flex-1 w-full h-full">
        <div
          ref={editorRef}
          contentEditable
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
            isEditing ? "cursor-text select-text" : "pointer-events-none select-none"
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
