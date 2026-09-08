import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/settings/SettingsClient";
import type { ClassSetting } from "@/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const setting = await prisma.classSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      className: "행복한 6학년 1반",
      currencyName: "원",
      defaultTaxRate: 0.1,
    },
  });

  const formattedSetting: ClassSetting = {
    id: setting.id,
    className: setting.className,
    currencyName: setting.currencyName,
    defaultTaxRate: setting.defaultTaxRate,
    taxMethod: setting.taxMethod,
    absencePolicy: setting.absencePolicy,
    salaryPayoutMode: setting.salaryPayoutMode,
    allowNegativeBalance: setting.allowNegativeBalance,
    themeColor: setting.themeColor,
    schoolHolidays: setting.schoolHolidays,
    updatedAt: setting.updatedAt,
  };

  return <SettingsClient initialSetting={formattedSetting} />;
}
