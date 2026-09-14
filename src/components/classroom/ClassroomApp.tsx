"use client";

import { useState } from "react";
import { FileText, Users, CheckSquare, Coins, Bell, BarChart3, X } from "lucide-react";
import { useClassroomState } from "@/hooks/useClassroomState";
import ClassroomHeader from "./ClassroomHeader";
import BoardCanvas from "./canvas/BoardCanvas";
import NoticeTab from "./notice/NoticeTab";
import StudentTab from "./students/StudentTab";
import RoutineTab from "./routines/RoutineTab";
import EconomyTab from "./economy/EconomyTab";
import RoutineNoticeSettingsModal from "./canvas/RoutineNoticeSettingsModal";
import { BoardTargetElement } from "@/types/classroom";

type ActiveTab = "notice" | "students" | "routines" | "economy";

export default function ClassroomApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("notice");
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isRoutineNoticeSettingsOpen, setIsRoutineNoticeSettingsOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<BoardTargetElement>("all");
  const [currentFontSize, setCurrentFontSize] = useState<number>(42);
  const [currentLineHeight, setCurrentLineHeight] = useState<number>(140);
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

  const [appliedStyle, setAppliedStyle] = useState<{
    target: BoardTargetElement;
    color?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    fontFamily?: string;
    timestamp: number;
  } | null>(null);

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
    try { localStorage.setItem("classroom_preview_scale", String(clamped)); } catch {}
  };

  const state = useClassroomState();

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

  if (!state.isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-bold text-sm animate-pulse">
          학급 알림장 시스템 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-2 sm:p-4 w-full">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4 w-full">
        {/* 상단 헤더 */}
        <ClassroomHeader
          className={state.className}
          onClassNameChange={state.setClassName}
          onOpenQuickView={() => setIsQuickViewOpen(true)}
          onOpenBoardWindow={handleOpenBoardWindow}
          onAddFreeCard={handleAddFreeCard}
        />

        {/* 메인 네비게이션 탭 바 */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("notice")}
            className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "notice"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>알림장</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "students"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>학생 명단 ({state.students.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("routines")}
            className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "routines"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>학생 업무 ({state.routines.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("economy")}
            className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "economy"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>학급 화폐</span>
          </button>
        </div>

        {/* 탭 콘텐츠 영역 */}
        {activeTab === "notice" && (
          <div className="space-y-3">
            <NoticeTab
              fontSize={state.fontSize}
              onFontSizeChange={state.setFontSize}
              theme={state.theme}
              onThemeChange={state.setTheme}
              targetElement={targetElement}
              onTargetElementChange={setTargetElement}
              currentFontSize={currentFontSize}
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
              onOpenRoutineNoticeSettings={() => setIsRoutineNoticeSettingsOpen(true)}
              layouts={state.layouts}
              onUpdateLayouts={state.updateLayouts}
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
              ledgerHistory={state.ledgerHistory}
              undoneLedgerHistory={state.undoneLedgerHistory}
              onUndoLedgerEntry={state.undoLedgerEntry}
              onRedoLedgerEntry={state.redoLedgerEntry}
              currencyName={state.currencyName}
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
              onAdvanceAllRoutines={state.advanceAllRoutines}
              targetElement={targetElement}
              onSelectElement={setTargetElement}
              onCurrentFontSize={setCurrentFontSize}
              onCurrentLineHeight={setCurrentLineHeight}
              showEconomyShortcut={showEconomyShortcut}
              appliedStyle={appliedStyle}
              onOpenRoutineNoticeSettings={() => setIsRoutineNoticeSettingsOpen(true)}
              layouts={state.layouts}
              onUpdateLayouts={state.updateLayouts}
              previewScale={previewScale}
              taxConfig={state.taxConfig}
              ledgerHistory={state.ledgerHistory}
            />
          </div>
        )}

        {activeTab === "students" && (
          <StudentTab
            students={state.students}
            onAddStudents={state.addStudents}
            onDeleteStudent={state.deleteStudent}
          />
        )}

        {activeTab === "routines" && (
          <RoutineTab
            routines={state.routines}
            students={state.students}
            currencyName={state.currencyName}
            ledgerHistory={state.ledgerHistory}
            onAddRoutine={state.addRoutine}
            onDeleteRoutine={state.deleteRoutine}
            onAdvanceRoutine={state.advanceRoutine}
            onPayRoutineToday={state.payRoutineToday}
            onUpdateRoutineOrder={state.updateRoutineOrder}
            onUpdateRoutine={state.updateRoutine}
          />
        )}

        {activeTab === "economy" && (
          <EconomyTab
            students={state.students}
            routines={state.routines}
            treasuryBalance={state.treasuryBalance}
            totalTaxCollected={state.totalTaxCollected}
            taxConfig={state.taxConfig}
            currencyName={state.currencyName}
            onUpdateCurrencyName={state.setCurrencyName}
            customBundles={state.customBundles}
            ledgerHistory={state.ledgerHistory}
            onExecuteTransaction={state.executeTransaction}
            onExecuteBatchDeposit={state.executeBatchDeposit}
            onExecuteDirectTax={state.executeDirectTax}
            onExecuteBundle={state.executeBundle}
            onAddBundle={state.addCustomBundle}
            onUpdateBundle={state.updateCustomBundle}
            onDeleteBundle={state.deleteCustomBundle}
            onUpdateTaxConfig={state.updateTaxConfig}
            onUndoLedgerEntry={state.undoLedgerEntry}
            onRedoLedgerEntry={state.redoLedgerEntry}
            undoneLedgerHistory={state.undoneLedgerHistory}
          />
        )}
      </div>

      {/* 토스트 알림 */}
      {state.toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{state.toastMessage}</span>
        </div>
      )}

      {/* 간편 재정 조회 모달 */}
      {isQuickViewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setIsQuickViewOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-3 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h2 className="font-extrabold text-slate-800 text-base">학급 재정 간편 요약</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickViewOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors leading-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
              <div>
                <span className="text-slate-400 block text-xs">학급 국고 잔고</span>
                <span className="font-mono font-extrabold text-slate-800 text-sm">
                  {state.treasuryBalance.toLocaleString()} {state.currencyName || "화폐"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-xs">누적 세수</span>
                <span className="font-mono font-extrabold text-emerald-600 text-sm">
                  +{state.totalTaxCollected.toLocaleString()} {state.currencyName || "화폐"}
                </span>
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
              <div className="p-2 font-bold text-slate-500 bg-slate-100 grid grid-cols-2 text-center">
                <span>이름</span>
                <span className="text-right">잔액</span>
              </div>
              {state.students.length === 0 ? (
                <div className="p-4 text-center text-slate-400">등록된 학생이 없습니다.</div>
              ) : (
                state.students.map((s) => (
                  <div key={s.name} className="p-2 grid grid-cols-2 text-center items-center">
                    <span className="font-bold text-slate-800 text-left pl-4">{s.name}</span>
                    <span className="text-right font-mono font-bold text-indigo-600 pr-2">
                      {s.balance.toLocaleString()} {state.currencyName || "화폐"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 칠판 표시 학생 업무 설정 모달 */}
      <RoutineNoticeSettingsModal
        isOpen={isRoutineNoticeSettingsOpen}
        onClose={() => setIsRoutineNoticeSettingsOpen(false)}
        routines={state.routines}
        onUpdateRoutine={state.updateRoutine}
      />
    </div>
  );
}
