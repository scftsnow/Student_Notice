"use client";

import { useState } from "react";
import { useClassroomState } from "@/hooks/useClassroomState";
import NoticeTab from "@/components/classroom/notice/NoticeTab";
import BoardCanvas from "@/components/classroom/canvas/BoardCanvas";
import { BoardTargetElement } from "@/types/classroom";

export default function NoticePageClient() {
  const state = useClassroomState();
  const [targetElement, setTargetElement] = useState<BoardTargetElement>("noticeBox");
  const [currentFontSize, setCurrentFontSize] = useState<number>(42);
  const [appliedStyle, setAppliedStyle] = useState<{
    target: BoardTargetElement;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    timestamp: number;
  } | null>(null);

  const handleOpenBoardWindow = () => {
    const width = 1280;
    const height = 720;
    const left = window.screen.width ? (window.screen.width - width) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - height) / 2 : 100;
    window.open(
      "/board",
      "StudentBoardWindow",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no,resizable=yes`
    );
  };

  const handleAddFreeCard = () => {
    const newId = `free-${Date.now()}`;
    state.setFreeCards((prev) => [
      ...prev,
      { id: newId, html: "자유 메모", left: "25%", top: "45%" },
    ]);
  };

  const handleRemoveFreeCard = (id: string) => {
    state.setFreeCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateFreeCard = (
    id: string,
    html: string,
    updates?: Partial<import("@/types/classroom").FreeCardData>
  ) => {
    state.setFreeCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, html, ...updates } : c))
    );
  };

  if (!state.isMounted) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-slate-400 font-bold text-sm animate-pulse">알림장 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 알림장 상단 헤더 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            📝
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">알림장 & 전자칠판</h1>
            <p className="text-xs text-slate-500">
              전달사항을 입력하고 전자칠판 판서 화면을 실시간으로 미리보기 및 송출합니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenBoardWindow}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          title="전자칠판/프로젝터 송출 전용 화면을 별도 창으로 엽니다"
        >
          <span>↗</span>
          <span>학생 화면 별도 창 열기</span>
        </button>
      </div>

      {/* 알림장 툴바 및 16:9 판서 캔버스 */}
      <div className="space-y-3">
        <NoticeTab
          fontSize={state.fontSize}
          onFontSizeChange={state.setFontSize}
          theme={state.theme}
          onThemeChange={state.setTheme}
          targetElement={targetElement}
          onTargetElementChange={setTargetElement}
          currentFontSize={currentFontSize}
          onApplyColor={(color) =>
            setAppliedStyle({ target: targetElement, color, timestamp: Date.now() })
          }
          onApplyFontSize={(size) =>
            setAppliedStyle({ target: targetElement, fontSize: size, timestamp: Date.now() })
          }
          onApplyAlign={(align) =>
            setAppliedStyle({ target: targetElement, align, timestamp: Date.now() })
          }
        />
        <BoardCanvas
          theme={state.theme}
          fontSize={state.fontSize}
          noticeText={state.noticeText}
          onNoticeTextChange={state.setNoticeText}
          routines={state.routines}
          freeCards={state.freeCards}
          onAddFreeCard={handleAddFreeCard}
          onRemoveFreeCard={handleRemoveFreeCard}
          onUpdateFreeCard={handleUpdateFreeCard}
          students={state.students}
          currencyName={state.currencyName}
          onPayRoutineToday={state.payRoutineToday}
          onUpdateRoutine={state.updateRoutine}
          onAdvanceRoutine={state.advanceRoutine}
          onAdvanceAllRoutines={state.advanceAllRoutines}
          targetElement={targetElement}
          onSelectElement={setTargetElement}
          onCurrentFontSize={setCurrentFontSize}
          appliedStyle={appliedStyle}
        />
      </div>
    </div>
  );
}
