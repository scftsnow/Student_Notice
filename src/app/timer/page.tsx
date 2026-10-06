import TimerPanel from "@/components/picks/TimerPanel";

// 수업용 타이머 단독 화면 (상단바 타이머 메뉴).
export const dynamic = "force-dynamic";

export default async function TimerPage() {
  return (
    <div className="max-w-md mx-auto w-full">
      <TimerPanel />
    </div>
  );
}
