"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

/** 전광판 등 크롬 없는 전체화면이 필요한 경로 */
const CHROMELESS_PATHS = ["/picks/window", "/timer/window"];

interface ConditionalChromeProps {
  classNameTitle: string;
  currencyName: string;
  treasuryBalance: number;
  children: React.ReactNode;
}

export default function ConditionalChrome({
  classNameTitle,
  currencyName,
  treasuryBalance,
  children,
}: ConditionalChromeProps) {
  const pathname = usePathname();

  // 뽑기 전광판 팝업: 내비게이션·여백 없이 뽑기 화면만 표시
  if (pathname && CHROMELESS_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar
        classNameTitle={classNameTitle}
        currencyName={currencyName}
        treasuryBalance={treasuryBalance}
      />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </>
  );
}
