"use client";

import { useState } from "react";
import { FileText, Bell } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import NoticeTab from "@/components/classroom/notice/NoticeTab";
import BoardCanvas from "@/components/classroom/canvas/BoardCanvas";
import PageHeader from "@/components/layout/PageHeader";
import { BoardTargetElement } from "@/types/classroom";

export default function NoticePageClient() {
  const state = useClassroomState();
  const [targetElement, setTargetElement] = useState<BoardTargetElement>("all");
  const [currentFontSize, setCurrentFontSize] = useState<number>(42);
  const [currentLineHeight, setCurrentLineHeight] = useState<number>(140);
  const [currentFontFamily, setCurrentFontFamily] = useState<string | undefined>(undefined);
  const [showEconomyShortcut, setShowEconomyShortcut] = useState<boolean>(() => {
    try {
      return localStorage.getItem("classroom_show_economy_shortcut") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleEconomyShortcut = (show: boolean) => {
    setShowEconomyShortcut(show);
    try {
      localStorage.setItem("classroom_show_economy_shortcut", String(show));
      const ch = new BroadcastChannel("classroom_os_sync");
      ch.postMessage({ showEconomyShortcut: show });
      ch.close();
    } catch {}
  };

  const [previewScale, setPreviewScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("classroom_preview_scale");
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 50 && n <= 100) return n;
      }
    } catch {}
    return 75;
  });

  const handlePreviewScaleChange = (next: number) => {
    const clamped = Math.max(50, Math.min(100, Math.round(next)));
    setPreviewScale(clamped);
    try {
      localStorage.setItem("classroom_preview_scale", String(clamped));
    } catch {}
  };

  const [appliedStyle, setAppliedStyle] = useState<{
    target: BoardTargetElement;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    fontFamily?: string;
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
    if (id === "noticeBox") return;
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

  const handleToggleFreeCardVisibility = (id: string, visible: boolean) => {
    state.setFreeCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible } : c))
    );
  };

  if (!state.isLoaded) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 font-bold text-xs animate-pulse">알림장 및 전자칠판 불러오는 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
      {/* 알림장 상단 헤더 */}
      <PageHeader
        icon={<FileText className="w-4 h-4" />}
        title="알림장 & 전자칠판"
        description="전달사항을 입력하고 전자칠판 판서 화면을 실시간으로 미리보기 및 송출합니다."
        actions={
          <button
            type="button"
            onClick={handleOpenBoardWindow}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="전자칠판/프로젝터 송출 전용 화면을 별도 창으로 엽니다"
          >
            <span>↗</span>
            <span>학생 화면 별도 창 열기</span>
          </button>
        }
      />

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
          currentFontFamily={currentFontFamily}
          lineHeight={currentLineHeight}
          onApplyLineHeight={(lh) => {
            setCurrentLineHeight(lh);
            setAppliedStyle({ target: targetElement, lineHeight: lh, timestamp: Date.now() });
          }}
          showEconomyShortcut={showEconomyShortcut}
          onToggleEconomyShortcut={handleToggleEconomyShortcut}
          onApplyColor={(color) =>
            setAppliedStyle({ target: targetElement, color, timestamp: Date.now() })
          }
          onApplyFontSize={(size) =>
            setAppliedStyle({ target: targetElement, fontSize: size, timestamp: Date.now() })
          }
          onApplyAlign={(align) =>
            setAppliedStyle({ target: targetElement, align, timestamp: Date.now() })
          }
          onApplyFontFamily={(fontFamily) =>
            setAppliedStyle({ target: targetElement, fontFamily, timestamp: Date.now() })
          }
          layouts={state.layouts}
          onUpdateLayouts={state.updateLayouts}
          homeworks={state.homeworks}
          boardHomeworkIds={state.boardHomeworkIds}
          students={state.students}
          onAddBoardHomework={state.addBoardHomework}
          onRemoveBoardHomework={state.removeBoardHomework}
          onUpdateHomework={state.updateHomework}
          freeCards={state.freeCards}
          onToggleFreeCardVisibility={handleToggleFreeCardVisibility}
          onUpdateFreeCard={handleUpdateFreeCard}
          onAddFreeCard={handleAddFreeCard}
          previewScale={previewScale}
          onPreviewScaleChange={handlePreviewScaleChange}
          routines={state.routines}
          onUpdateRoutine={state.updateRoutine}
          onUndo={state.undo}
          onRedo={state.redo}
          canUndo={state.canUndo}
          canRedo={state.canRedo}
        />
        <BoardCanvas
          theme={state.theme}
          fontSize={state.fontSize}
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
          onRewindRoutine={state.rewindRoutine}
          onSkipRoutineWorker={state.skipRoutineWorker}
          onCancelSkipRoutineWorker={state.cancelSkipRoutineWorker}
          onAdvanceAllRoutines={state.advanceAllRoutines}
          targetElement={targetElement}
          onSelectElement={setTargetElement}
          onCurrentFontSize={setCurrentFontSize}
          onCurrentLineHeight={setCurrentLineHeight}
          onCurrentFontFamily={setCurrentFontFamily}
          showEconomyShortcut={showEconomyShortcut}
          appliedStyle={appliedStyle}
          layouts={state.layouts}
          onUpdateLayouts={state.updateLayouts}
          previewScale={previewScale}
          taxConfig={state.taxConfig}
          ledgerHistory={state.ledgerHistory}
          onUndoLedgerEntry={state.undoLedgerEntry}
          boardHomeworks={state.boardHomeworks}
          onUpdateHomework={state.updateHomework}
          onRemoveBoardHomework={state.removeBoardHomework}
        />
      </div>
      </div>

      {/* 토스트 알림 */}
      {state.toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{state.toastMessage}</span>
        </div>
      )}
    </>
  );
}
