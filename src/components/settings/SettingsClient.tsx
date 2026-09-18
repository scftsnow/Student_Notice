"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, CheckCircle } from "lucide-react";
import { updateClassSettings } from "@/app/actions";
import type { ClassSetting } from "@/types";
import { CLASSROOM_FONTS, DEFAULT_CLASSROOM_FONT } from "@/lib/classroomFonts";
import {
  DEFAULT_FONT_STORAGE_KEY,
  applyDefaultFontFamily,
} from "@/lib/defaultFont";
import FontSelectorDropdown from "@/components/classroom/notice/FontSelectorDropdown";
import ResetSection from "./ResetSection";
import BackupSection from "./BackupSection";

interface SettingsClientProps {
  initialSetting: ClassSetting;
}

export default function SettingsClient({ initialSetting }: SettingsClientProps) {
  const [className, setClassName] = useState(initialSetting.className);
  const [currencyName, setCurrencyName] = useState(initialSetting.currencyName || "원");
  const [defaultFontFamily, setDefaultFontFamily] = useState(DEFAULT_CLASSROOM_FONT.family);
  const [defaultTaxRate] = useState(
    Math.round(initialSetting.defaultTaxRate * 100)
  );
  const [taxMethod] = useState(initialSetting.taxMethod);
  const [absencePolicy] = useState(initialSetting.absencePolicy);
  const [salaryPayoutMode] = useState(
    initialSetting.salaryPayoutMode
  );
  const [allowNegativeBalance] = useState(
    initialSetting.allowNegativeBalance
  );
  const [themeColor] = useState(initialSetting.themeColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedFont = localStorage.getItem(DEFAULT_FONT_STORAGE_KEY);
      if (savedFont) setDefaultFontFamily(savedFont);
      const savedRaw =
        localStorage.getItem("classroom_os_state_v3") ||
        localStorage.getItem("classroom_os_state_v2");
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.className) setClassName(parsed.className);
        if (parsed.currencyName) setCurrencyName(parsed.currencyName);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateClassSettings({
        className,
        currencyName,
        defaultTaxRate: defaultTaxRate / 100,
        taxMethod,
        absencePolicy,
        salaryPayoutMode,
        allowNegativeBalance,
        themeColor,
        schoolHolidays: initialSetting.schoolHolidays || "[]",
      });

      // Also sync to localStorage for client-side state
      try {
        for (const key of ["classroom_os_state_v3", "classroom_os_state_v2"]) {
          const savedRaw = localStorage.getItem(key);
          const parsed = savedRaw ? JSON.parse(savedRaw) : {};
          parsed.className = className;
          parsed.currencyName = currencyName;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
        localStorage.setItem(DEFAULT_FONT_STORAGE_KEY, defaultFontFamily);
        applyDefaultFontFamily(defaultFontFamily);
        const channel = new BroadcastChannel("classroom_os_sync");
        channel.postMessage({ className, currencyName, defaultFontFamily });
        channel.close();
      } catch {
        // Ignore
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "설정 저장 실패";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" />
            학급 기본 정보 설정
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            학급 명칭 및 기본 글꼴을 관리합니다 (화폐 및 세율/급여는 [학급 화폐], 대타는 [학생 업무]에서 설정).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 text-sm">
        {/* Class name */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">학급 명칭</label>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Currency name */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">화폐 단위 명칭</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={currencyName}
              onChange={(e) => setCurrencyName(e.target.value)}
              placeholder="예: 원, 포인트, 코인, 별"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400 whitespace-nowrap">화폐 기호 (예: 원)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">학급 경제 전반에서 표시될 화폐 단위 이름입니다.</p>
        </div>

        {/* Global Default Font Family */}
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1.5">
            기본 글꼴
          </label>
          <FontSelectorDropdown
            size="lg"
            selectedFontId={
              CLASSROOM_FONTS.find((f) => f.family === defaultFontFamily)?.id ||
              DEFAULT_CLASSROOM_FONT.id
            }
            onSelectFont={(fontId) => {
              const font = CLASSROOM_FONTS.find((f) => f.id === fontId);
              if (font) setDefaultFontFamily(font.family);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">
            시스템 전체 화면에 기본 적용되는 글꼴입니다 (알림장 미리보기는 제외, 완전 무료 오픈 폰트).
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          {saved ? (
            <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> 설정이 저장되었습니다.
            </span>
          ) : (
            <span className="text-sm text-slate-400">변경사항을 저장하세요.</span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "저장 중..." : "설정 저장하기"}
          </button>
        </div>
      </form>

      {/* 데이터 초기화 섹션 */}
      <ResetSection />

      {/* 전체 설정 백업 / 복원 */}
      <BackupSection />
    </div>
  );
}
