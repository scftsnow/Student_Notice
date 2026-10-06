"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  CheckSquare,
  FileText,
  Coins,
  Settings,
  Sparkles,
  Dices,
  Timer,
  BookOpenCheck,
} from "lucide-react";
import { ClassroomStudent, LedgerRecord } from "@/types/classroom";
import { openTimerWindow } from "@/lib/timerUtils";
import UnifiedLedgerModal from "@/components/classroom/economy/UnifiedLedgerModal";
import RecentLedgerPanel from "@/components/classroom/economy/RecentLedgerPanel";

interface NavbarProps {
  classNameTitle?: string;
  currencyName?: string;
  treasuryBalance?: number;
}

export default function Navbar({
  classNameTitle = "행복한 우리 반",
  currencyName = "원",
  treasuryBalance = 0,
}: NavbarProps) {
  const pathname = usePathname();
  const [liveClassName, setLiveClassName] = useState("");
  const [liveTreasury, setLiveTreasury] = useState(treasuryBalance);
  const [liveCurrency, setLiveCurrency] = useState(currencyName);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerModalFilter, setLedgerModalFilter] = useState<string>("treasury");
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);
  const [undoneLedgerHistory, setUndoneLedgerHistory] = useState<LedgerRecord[]>([]);

  const syncFromStorage = useCallback(() => {
    try {
      const saved =
        localStorage.getItem("classroom_os_state_v3") ||
        localStorage.getItem("classroom_os_state_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.className) setLiveClassName(parsed.className);
        else setLiveClassName(classNameTitle);
        if (currencyName && currencyName !== "미소" && (parsed.currencyName === "미소" || !parsed.currencyName)) {
          setLiveCurrency(currencyName);
        } else if (parsed.currencyName) {
          setLiveCurrency(parsed.currencyName);
        } else if (currencyName) {
          setLiveCurrency(currencyName);
        }
        if (typeof parsed.treasuryBalance === "number") setLiveTreasury(parsed.treasuryBalance);
        if (Array.isArray(parsed.students)) setStudents(parsed.students as ClassroomStudent[]);
        if (Array.isArray(parsed.ledgerHistory)) setLedgerHistory(parsed.ledgerHistory as LedgerRecord[]);
        if (Array.isArray(parsed.undoneLedgerHistory)) setUndoneLedgerHistory(parsed.undoneLedgerHistory as LedgerRecord[]);
      } else {
        setLiveClassName(classNameTitle);
      }
    } catch {
      setLiveClassName(classNameTitle);
    }
  }, [classNameTitle, currencyName]);

  // 타이머 메뉴는 새 창으로만 열기 (현재 메뉴 유지)
  const handleTimerMenu = useCallback(() => {
    openTimerWindow();
  }, []);

  const handleUndo = useCallback((id?: number | string) => {
    try {
      const channel = new BroadcastChannel("classroom_os_sync");
      channel.postMessage({ action: "undo_ledger", id });
      channel.close();
    } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent("classroom_undo_ledger", { detail: { id } }));
  }, []);

  const handleRedo = useCallback((id?: number | string) => {
    try {
      const channel = new BroadcastChannel("classroom_os_sync");
      channel.postMessage({ action: "redo_ledger", id });
      channel.close();
    } catch { /* noop */ }
    window.dispatchEvent(new CustomEvent("classroom_redo_ledger", { detail: { id } }));
  }, []);

  useEffect(() => {
    syncFromStorage();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_os_sync");
      channel.onmessage = (e) => {
        if (!e.data || typeof e.data !== "object") return;
        const data = e.data as {
          treasuryBalance?: number;
          currencyName?: string;
          className?: string;
          resetType?: string;
          students?: ClassroomStudent[];
          ledgerHistory?: LedgerRecord[];
          undoneLedgerHistory?: LedgerRecord[];
        };
        if (typeof data.treasuryBalance === "number") {
          setLiveTreasury(data.treasuryBalance);
        } else if (data.resetType === "economy" || data.resetType === "students") {
          setLiveTreasury(0);
        }
        if (data.currencyName) setLiveCurrency(data.currencyName);
        if (data.className) setLiveClassName(data.className);
        if (Array.isArray(data.students)) setStudents(data.students);
        if (Array.isArray(data.ledgerHistory)) setLedgerHistory(data.ledgerHistory);
        if (Array.isArray(data.undoneLedgerHistory)) setUndoneLedgerHistory(data.undoneLedgerHistory);
      };
    } catch {
      // noop
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "classroom_os_state_v3" || e.key === "classroom_os_state_v2") {
        syncFromStorage();
      }
    };
    window.addEventListener("storage", handleStorage);

    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        treasuryBalance?: number;
        currencyName?: string;
        className?: string;
        students?: ClassroomStudent[];
        ledgerHistory?: LedgerRecord[];
        undoneLedgerHistory?: LedgerRecord[];
      }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.treasuryBalance === "number") {
          setLiveTreasury(customEvent.detail.treasuryBalance);
        }
        if (customEvent.detail.currencyName) {
          setLiveCurrency(customEvent.detail.currencyName);
        }
        if (customEvent.detail.className) {
          setLiveClassName(customEvent.detail.className);
        }
        if (Array.isArray(customEvent.detail.students)) {
          setStudents(customEvent.detail.students);
        }
        if (Array.isArray(customEvent.detail.ledgerHistory)) {
          setLedgerHistory(customEvent.detail.ledgerHistory);
        }
        if (Array.isArray(customEvent.detail.undoneLedgerHistory)) {
          setUndoneLedgerHistory(customEvent.detail.undoneLedgerHistory);
        }
      } else {
        syncFromStorage();
      }
    };
    window.addEventListener("classroom_state_sync", handleCustomSync);

    return () => {
      channel?.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("classroom_state_sync", handleCustomSync);
    };
  }, [currencyName, classNameTitle, pathname, syncFromStorage]);

  const navItems = [
    { href: "/notice", label: "알림장", icon: FileText },
    { href: "/students", label: "학생 명단", icon: Users },
    { href: "/routines", label: "학생 업무", icon: CheckSquare },
    { href: "/homework", label: "학생 과제", icon: BookOpenCheck },
    { href: "/economy", label: "학급 화폐", icon: Coins },
    { href: "/picks", label: "뽑기", icon: Dices },
    { href: "/timer", label: "타이머", icon: Timer },
    { href: "/settings", label: "설정", icon: Settings },
  ];

  if (pathname?.startsWith("/board")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-4">
          {/* Left: Logo & Class Name + Nav Links grouped together */}
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            {/* Logo & Class Name */}
            <Link href="/notice" className="flex items-center gap-2 group shrink-0">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
              </div>
              <div>
                <span className="font-bold text-base lg:text-lg text-slate-800 tracking-tight flex items-center gap-1 whitespace-nowrap">
                  Teacher Helper-학급 운영
                </span>
                <span suppressHydrationWarning className="text-[11px] text-slate-400 block -mt-1 font-medium">{liveClassName || "우리 반"}</span>
              </div>
            </Link>

            {/* Nav Links (좁은 화면에서는 가로 스크롤, 우측 통계와 겹치지 않음) */}
            <nav className="hidden md:flex items-center gap-[1px] min-w-0 overflow-x-auto scrollbar-none">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const cls = `flex items-center gap-1 px-2 lg:px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`;
                const inner = (
                  <>
                    <Icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                    {item.label}
                  </>
                );
                // 타이머는 전광판 팝업 + 제어 화면 이동
                return item.href === "/timer" ? (
                  <button
                    key={item.href}
                    type="button"
                    onClick={handleTimerMenu}
                    className={`${cls} cursor-pointer`}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cls}
                  >
                    {inner}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Stats: 최근 지급 내역 */}
          <div className="flex items-center gap-2 lg:gap-2.5 shrink-0 justify-end min-w-0">
            {/* 최근 지급 내역 패널 */}
            <div className="hidden min-[1400px]:block w-full max-w-[510px] lg:max-w-[600px] min-w-[330px]">
              <RecentLedgerPanel
                records={ledgerHistory}
                undoneRecords={undoneLedgerHistory}
                currencyName={liveCurrency || currencyName}
                onUndo={handleUndo}
                onRedo={handleRedo}
                maxRows={4}
                isDropdown={true}
                onOpenModal={() => {
                  syncFromStorage();
                  setLedgerModalFilter("all");
                  setIsLedgerOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-100 gap-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const cls = `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
            isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`;
          const inner = (
            <>
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </>
          );
          return item.href === "/timer" ? (
            <button key={item.href} type="button" onClick={handleTimerMenu} className={cls}>
              {inner}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cls}
            >
              {inner}
            </Link>
          );
        })}
      </div>

      {/* 상단바 국고/최근지급 클릭 시 열리는 통합 입출금 내역 모달 */}
      <UnifiedLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        students={students}
        treasuryBalance={liveTreasury}
        ledgerHistory={ledgerHistory}
        undoneLedgerHistory={undoneLedgerHistory}
        onUndo={handleUndo}
        onRedo={handleRedo}
        initialStudentFilter={ledgerModalFilter}
        currencyName={liveCurrency || currencyName}
      />
    </header>
  );
}
