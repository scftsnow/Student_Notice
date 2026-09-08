"use client";

import { useEffect, useState, useRef } from "react";
import { BoardTheme, NoticeFontSize, ClassroomRoutine, FreeCardData } from "@/types/classroom";

interface BoardCanvasProps {
  theme: BoardTheme;
  fontSize: NoticeFontSize;
  noticeText: string;
  onNoticeTextChange: (text: string) => void;
  routines: ClassroomRoutine[];
  freeCards: FreeCardData[];
  onAddFreeCard: () => void;
  onRemoveFreeCard: (id: string) => void;
  onUpdateFreeCard: (id: string, html: string) => void;
}

export default function BoardCanvas({
  theme,
  fontSize,
  noticeText,
  onNoticeTextChange,
  routines,
  freeCards,
  onAddFreeCard,
  onRemoveFreeCard,
  onUpdateFreeCard,
}: BoardCanvasProps) {
  const [clockStr, setClockStr] = useState("14:00:00");
  const [liveDateStr, setLiveDateStr] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  // Live clock and date
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setClockStr(`${h}:${m}:${s}`);

      const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const mo = now.getMonth() + 1;
      const d = now.getDate();
      const dayName = days[now.getDay()];
      setLiveDateStr(`${mo}월 ${d}일 ${dayName}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Theme styling
  const themeBg =
    theme === "chalkboard"
      ? "bg-[#1a382b] text-white"
      : theme === "white"
      ? "bg-white text-slate-900"
      : theme === "navy"
      ? "bg-[#0b132b] text-white"
      : "bg-[#faf5ea] text-amber-950";

  // Font size class mapping
  const fontClass =
    fontSize === "34"
      ? "text-lg sm:text-xl"
      : fontSize === "42"
      ? "text-xl sm:text-2xl"
      : fontSize === "50"
      ? "text-2xl sm:text-3xl"
      : "text-3xl sm:text-4xl";

  return (
    <div className="space-y-2">
      {/* 깔끔한 상단 툴바 */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700">🖥️ 전자칠판 미리보기</span>
        <button
          type="button"
          onClick={onAddFreeCard}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
        >
          ＋ 자유 글상자 추가
        </button>
      </div>

      {/* 16:9 캔버스 본체 (절대 좌표 기반 글상자 레이아웃 - 학생 화면과 100% 위치 일치) */}
      <div
        id="preview-16-9-wrapper"
        className="relative w-full overflow-hidden rounded-2xl shadow-lg border border-slate-300 aspect-video select-none"
      >
        <div className={`absolute inset-0 ${themeBg}`}>
          {/* 글상자 1: 날짜 글상자 (상단 좌측, 위치: left 2.5%, top 3.5%) */}
          <div
            className="absolute z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xs transition-colors cursor-default"
            style={{ left: "2.5%", top: "3.5%" }}
          >
            <span className="text-white/40 text-xs select-none" title="날짜 글상자">⠿</span>
            <span className="font-extrabold text-base sm:text-xl tracking-tight">
              {liveDateStr || "오늘 날짜"}
            </span>
          </div>

          {/* 글상자 2: 시각 글상자 (상단 우측, 위치: right 2.5%, top 3.5%) */}
          <div
            className="absolute z-10 flex items-center gap-2 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xs text-right transition-colors cursor-default"
            style={{ right: "2.5%", top: "3.5%" }}
          >
            <div>
              <span className="text-[10px] opacity-70 block">현재 시각</span>
              <span className="font-mono text-base sm:text-xl font-black tracking-wider block">
                {clockStr}
              </span>
            </div>
            <span className="text-white/40 text-xs select-none" title="시계 글상자">⠿</span>
          </div>

          {/* 글상자 3: 알림장 본문 글상자 (중앙, 위치: left 2.5%, top 16%, width 95%, bottom 20%) */}
          <div
            className="absolute z-10 overflow-hidden rounded-2xl p-3 border border-white/15 bg-white/5 hover:border-white/30 transition-colors"
            style={{ left: "2.5%", top: "16%", width: "95%", bottom: "20%" }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => onNoticeTextChange(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: noticeText }}
              className={`w-full h-full outline-none font-semibold leading-relaxed tracking-tight overflow-y-auto ${fontClass}`}
              data-placeholder="전달할 알림장 내용을 입력하세요..."
            />
          </div>

          {/* 글상자 4: 루틴 당번 목록 글상자 (하단, 위치: left 2.5%, bottom 3.5%, width 95%) */}
          <div
            className="absolute z-10 flex items-center gap-4 flex-wrap px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xs text-xs sm:text-sm font-semibold transition-colors"
            style={{ left: "2.5%", bottom: "3.5%", width: "95%" }}
          >
            <span className="text-white/40 text-xs select-none" title="루틴 당번 글상자">⠿</span>
            {routines.length === 0 ? (
              <span className="opacity-50 italic">등록된 업무 루틴이 없습니다.</span>
            ) : (
              routines.map((r) => {
                const currentWorkers =
                  r.order.length > 0
                    ? Array.from({ length: r.slots }, (_, i) => r.order[(r.currentIdx + i) % r.order.length]).join(", ")
                    : "배정 없음";

                return (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className="font-bold opacity-80">{r.icon} {r.name}:</span>
                    <span className="font-extrabold text-amber-300 drop-shadow-xs">{currentWorkers}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* 자유 글상자 레이어 */}
          {freeCards.map((card) => (
            <div
              key={card.id}
              className="absolute z-20 px-2 py-1 rounded-lg bg-black/40 border border-white/20 backdrop-blur-xs text-xs sm:text-sm"
              style={{ left: card.left || "20%", top: card.top || "40%" }}
            >
              <button
                type="button"
                onClick={() => onRemoveFreeCard(card.id)}
                className="opacity-40 hover:opacity-100 hover:text-rose-400 text-[10px] mr-1"
                title="글상자 삭제"
              >
                ✕
              </button>
              <span
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => onUpdateFreeCard(card.id, e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: card.html || "자유 메모" }}
                className="outline-none font-bold"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
