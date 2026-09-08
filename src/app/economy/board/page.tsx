import { prisma } from "@/lib/prisma";
import EconomyBoardClient from "@/components/economy/EconomyBoardClient";

export const dynamic = "force-dynamic";

export default async function EconomyBoardPage() {
  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  return (
    <EconomyBoardClient
      initialCurrencyName={setting?.currencyName || "원"}
      initialClassName={setting?.className || "우리 반"}
    />
  );
}
