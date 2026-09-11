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
  LayoutDashboard,
} from "lucide-react";
import { ClassroomStudent, LedgerRecord } from "@/types/classroom";
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
    { href: "/economy", label: "학급 화폐", icon: Coins },
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    { href: "/settings", label: "설정", icon: Settings },
  ];

  if (pathname?.startsWith("/board")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Class Name */}
          <div className="flex items-center gap-3">
            <Link href="/notice" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
                  Teacher Helper-학급 운영
                </span>
                <span suppressHydrationWarning className="text-xs text-slate-400 block -mt-1 font-medium">{liveClassName || "우리 반"}</span>
              </div>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Stats: Date, Real-time Clock, Treasury Balance */}
          <div className="flex items-center gap-3">
            {/* 최근 지급 내역 패널 (구 날짜/시간 배지 위치 대체) */}
            <div className="hidden sm:block w-52 md:w-64 lg:w-72">
              <RecentLedgerPanel
                records={ledgerHistory}
                undoneRecords={undoneLedgerHistory}
                currencyName={liveCurrency || currencyName}
                onUndo={handleUndo}
                onRedo={handleRedo}
                maxRows={4}
              />
            </div>

            {/* Treasury Balance Pill -> Opens Ledger History Modal */}
            <button
              type="button"
              onClick={() => {
                syncFromStorage();
                setIsLedgerOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
              title="국고 입출금 이력 보기 (클릭 시 오늘 이력 표시)"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>국고:</span>
              <span className="font-mono text-amber-700 font-bold">
                {liveTreasury.toLocaleString()} {liveCurrency || currencyName}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 border-t border-slate-100 gap-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* 상단바 국고 배지 클릭 시 열리는 통합 입출금 내역 모달 */}
      <UnifiedLedgerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        students={students}
        treasuryBalance={liveTreasury}
        ledgerHistory={ledgerHistory}
        initialStudentFilter="treasury"
        currencyName={liveCurrency || currencyName}
      />
    </header>
  );
}
