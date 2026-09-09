import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "학급 관리 OS (Classroom Manager)",
  description: "학생 명단, 업무 루틴, 알림장, 학급 화폐 통합 관리 솔루션",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const setting = await prisma.classSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      className: "우리 반",
      currencyName: "원",
      defaultTaxRate: 0.1,
    },
  });

  const treasury = await prisma.account.findFirst({
    where: { accountType: "CLASS_TREASURY" },
  });

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-800">
        <Navbar
          classNameTitle={setting.className}
          currencyName={setting.currencyName}
          treasuryBalance={treasury?.balance ?? 0}
        />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
