import { prisma } from "@/lib/prisma";
import { getDailyRoutineAssignments } from "@/lib/scheduler";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  let setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  if (!setting) {
    setting = await prisma.classSetting.create({
      data: {
        id: "singleton",
        className: "우리 반",
        currencyName: "원",
      },
    });
  }

  const students = await prisma.student.findMany({
    orderBy: { studentNumber: "asc" },
    include: { account: true },
  });

  const routinesData = await getDailyRoutineAssignments(todayStr);

  const notice = await prisma.notice.findUnique({
    where: { date: todayStr },
  });

  const treasury = await prisma.account.findFirst({
    where: { accountType: "CLASS_TREASURY" },
  });

  const pendingPayments = await prisma.pendingPayment.findMany({
    where: { status: "PENDING" },
    include: { student: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <DashboardClient
      initialDate={todayStr}
      setting={setting}
      students={students}
      routinesData={routinesData}
      notice={notice}
      treasury={treasury}
      pendingPayments={pendingPayments}
    />
  );
}
