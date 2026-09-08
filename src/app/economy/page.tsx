import { prisma } from "@/lib/prisma";
import EconomyPageClient from "@/components/economy/EconomyPageClient";

export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  return (
    <EconomyPageClient
      initialCurrencyName={setting?.currencyName || "원"}
      initialClassName={setting?.className || "우리 반"}
    />
  );
}
