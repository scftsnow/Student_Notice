"use client";

import { useState } from "react";
import {
  FileText,
  Save,
  CheckCircle,
  Monitor,
  ExternalLink,
} from "lucide-react";
import { saveNotice } from "@/app/actions";
import type { DailyRoutineAssignment } from "@/types";

interface NoticeClientProps {
  initialTargetDate: string;
  initialContent: string;
  initialIncludeRoutines: boolean;
  todayDateStr: string;
  todayDayOfWeek: string;
  routinesData: DailyRoutineAssignment[];
}

export default function NoticeClient({
  initialTargetDate,
  initialContent,
  initialIncludeRoutines,
  todayDateStr,
  todayDayOfWeek,
  routinesData,
}: NoticeClientProps) {
  const [targetDate, setTargetDate] = useState(initialTargetDate);
  const [content, setContent] = useState(initialContent);
  const [includeRoutines, setIncludeRoutines] = useState(initialIncludeRoutines);
  const [fontSize, setFontSize] = useState<number>(42);
  const [theme, setTheme] = useState<string>("chalkboard");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tomorrow date calculation
  const getTomorrowDate = () => {
    const [y, m, d] = todayDateStr.split("-").map(Number);
    const tom = new Date(y, m - 1, d);
    tom.setDate(tom.getDate() + 1);
    const ty = tom.getFullYear();
    const tm = String(tom.getMonth() + 1).padStart(2, "0");
    const td = String(tom.getDate()).padStart(2, "0");
    return `${ty}-${tm}-${td}`;
  };

  const tomorrowDateStr = getTomorrowDate();

  const handleDateChange = (newDate: string) => {
    setTargetDate(newDate);
    window.location.href = `/notice?date=${newDate}`;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveNotice(targetDate, content, includeRoutines);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "알림장 저장 실패";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const openStudentBoardWindow = () => {
    window.open(
      `/board?date=${targetDate}`,
      "ClassroomStudentBoard",
      "width=1200,height=850,menubar=no,toolbar=no"
    );
  };

  const getThemeBgClass = () => {
    switch (theme) {
      case "white":
        return "bg-white text-slate-900 border-slate-300";
      case "navy":
        return "bg-[#0b132b] text-slate-100 border-slate-800";
      case "warm":
        return "bg-[#faf5ea] text-amber-950 border-amber-200";
      case "chalkboard":
      default:
        return "bg-[#1a382b] text-white border-[#2d5740]";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              알림장
            </h1>
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-slate-500">
            <span>오늘:</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
              {todayDateStr} ({todayDayOfWeek})
            </span>
            <span className="text-slate-300">|</span>
            <span>기준 일자: {targetDate}</span>
          </div>
        </div>

        {/* Date Switcher & Separate Window Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleDateChange(todayDateStr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                targetDate === todayDateStr
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => handleDateChange(tomorrowDateStr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                targetDate === tomorrowDateStr
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              내일
            </button>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs p-1.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-700 font-bold focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={openStudentBoardWindow}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>학생 화면 별도 창 열기</span>
          </button>
        </div>
      </div>

      {/* Main 2-Zone Grid: Left Editor & Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Teacher Editor */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800">전달사항</label>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                작성 대상: {targetDate}
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="전달사항을 입력하세요."
              className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />

            {/* Display Options */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  학생 화면 글자 크기
                </label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                >
                  <option value={34}>34px</option>
                  <option value={42}>42px (기본)</option>
                  <option value={50}>50px</option>
                  <option value={58}>58px</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  칠판 테마
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                >
                  <option value="chalkboard">🟢 칠판 녹색</option>
                  <option value="white">⚪ 깔끔 화이트</option>
                  <option value="navy">🔵 딥 네이비</option>
                  <option value="warm">🟡 따뜻한 미색</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeRoutines}
                onChange={(e) => setIncludeRoutines(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              하단에 학생 업무 루틴 카드 첨부
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> 저장되었습니다.
              </span>
            ) : (
              <span className="text-xs text-slate-400">변경사항을 저장하세요.</span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div
          className={`rounded-3xl p-6 shadow-xl flex flex-col justify-between border ${getThemeBgClass()}`}
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-current/20">
              <span className="text-xs font-bold opacity-80">미리보기</span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-black/10">
                {targetDate}
              </span>
            </div>

            <div className="py-6 space-y-5">
              <div
                className="font-medium whitespace-pre-wrap leading-relaxed min-h-[80px]"
                style={{ fontSize: `${Math.round(fontSize * 0.6)}px` }}
              >
                {content || "작성된 전달사항이 없습니다."}
              </div>

              {includeRoutines && (
                <div className="pt-4 border-t border-current/20">
                  <span className="text-xs font-bold block mb-2.5 opacity-80">
                    오늘의 당번:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {routinesData.length === 0 ? (
                      <span className="opacity-50">배정된 당번이 없습니다.</span>
                    ) : (
                      routinesData.map((r) => (
                        <div
                          key={r.routineId}
                          className="bg-black/15 p-3 rounded-2xl border border-current/10 flex justify-between items-center"
                        >
                          <span className="font-bold">{r.routineTitle}</span>
                          <span className="font-medium opacity-90">
                            {r.isHoliday
                              ? `(${r.holidayReason || "휴일"})`
                              : r.actualStudents.map((s) => s.name).join(", ") || "배정 없음"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-current/20 flex items-center justify-between text-xs opacity-75">
            <span>스마트보드 송출 화면</span>
            <button
              type="button"
              onClick={openStudentBoardWindow}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 font-semibold transition-all flex items-center gap-1.5"
            >
              <Monitor className="w-3.5 h-3.5" />
              크게 보기 ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
