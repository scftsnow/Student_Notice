import { prisma } from "@/lib/prisma";
import { getDailyRoutineAssignments } from "@/lib/scheduler";
import BoardClient from "@/components/board/BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const now = new Date();
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayDateStr = `${y}-${m}-${d}`;
  const todayDayOfWeek = days[now.getDay()]; // Spec 2-1: Day of week is always today

  const targetDate = searchParams?.date || todayDateStr;

  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  const notice = await prisma.notice.findUnique({
    where: { date: targetDate },
  });

  const routinesData = await getDailyRoutineAssignments(targetDate);

  return (
    <BoardClient
      initialDateStr={todayDateStr}
      todayDayOfWeek={todayDayOfWeek}
      classNameTitle={setting?.className || "행복한 6학년 1반"}
      initialContent={notice?.content || ""}
      initialRoutines={routinesData}
    />
  );
}
