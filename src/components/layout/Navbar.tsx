"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Clock,
  Users,
  CheckSquare,
  FileText,
  Coins,
  Settings,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";

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
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [liveClassName, setLiveClassName] = useState("");
  const [liveTreasury, setLiveTreasury] = useState(treasuryBalance);
  const [liveCurrency, setLiveCurrency] = useState(currencyName);

  useEffect(() => {
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
      } else {
        setLiveClassName(classNameTitle);
      }
    } catch {
      setLiveClassName(classNameTitle);
    }
  }, [currencyName, classNameTitle]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const day = days[now.getDay()];

      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      setCurrentDate(`${year}년 ${month}월 ${date}일 (${day})`);
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
            {/* Realtime Date & Clock */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>{currentDate || "로딩 중..."}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-slate-700 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{currentTime}</span>
              </div>
            </div>

            {/* Treasury Balance Pill */}
            <Link
              href="/economy"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>국고:</span>
              <span className="font-mono text-amber-700">
                {liveTreasury.toLocaleString()} {liveCurrency || currencyName}
              </span>
            </Link>
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
    </header>
  );
}
