import PicksPageClient from "@/components/picks/PicksPageClient";

// 학생·업무·자리 프리셋은 모두 실명단(localStorage 교실 상태)에서 클라이언트가 직접 읽음.
export const dynamic = "force-dynamic";

export default async function PicksPage() {
  return <PicksPageClient />;
}