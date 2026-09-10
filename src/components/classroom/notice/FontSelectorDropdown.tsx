"use client";

import { useState, useRef, useEffect } from "react";
import { Type, ChevronDown, Check } from "lucide-react";
import { CLASSROOM_FONTS } from "@/lib/classroomFonts";

interface FontSelectorDropdownProps {
  selectedFontId: string;
  onSelectFont: (fontId: string) => void;
}

export default function FontSelectorDropdown({
  selectedFontId,
  onSelectFont,
}: FontSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedFont =
    CLASSROOM_FONTS.find((f) => f.id === selectedFontId) ||
    CLASSROOM_FONTS[0];

  // 바깥 영역 클릭 또는 Escape 키 입력 시 드롭다운 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* 트리거 버튼: onMouseDown preventDefault로 에디터 블록/포커스 풀림 방지 */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-7 px-2 py-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 focus:outline-none focus:border-indigo-400 cursor-pointer shadow-2xs transition-colors"
        title="글꼴 변경 (블록 선택 시 해당 글자, 미선택 시 현재 요소 전체에 적용)"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Type className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="truncate max-w-[95px]">{selectedFont.name}</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 펼쳐진 서체 목록 (분류 없는 단일 플랫 리스트 + 서체 이름 SVG 미리보기) */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 z-[100] w-64 max-h-72 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl p-1.5 space-y-0.5"
          role="listbox"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 select-none border-b border-slate-100 mb-1">
            글꼴 선택 ({CLASSROOM_FONTS.length}종 완전 무료)
          </div>
          {CLASSROOM_FONTS.map((font) => {
            const isSelected = font.id === selectedFont.id;
            return (
              <button
                key={font.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault(); // 에디터 텍스트 블록 해제 방지
                  onSelectFont(font.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50/90 text-indigo-700 ring-1 ring-indigo-300/60"
                    : "hover:bg-slate-100/80 text-slate-700"
                }`}
              >
                {/* 서체 이름으로 미리보기 SVG */}
                <svg
                  viewBox="0 0 170 28"
                  className="w-44 h-7 shrink-0 pointer-events-none"
                  aria-label={font.name}
                >
                  <text
                    x="2"
                    y="20"
                    style={{ fontFamily: font.family }}
                    className="text-[15px] fill-slate-800 font-normal select-none"
                  >
                    {font.name}
                  </text>
                </svg>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
