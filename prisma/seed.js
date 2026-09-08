const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding clean initial settings...");

  await prisma.classSetting.upsert({
    where: { id: "singleton" },
    update: {
      className: "우리 반",
    },
    create: {
      id: "singleton",
      className: "우리 반",
      currencyName: "미소",
      defaultTaxRate: 0.1,
      taxMethod: "WITHHOLDING",
      absencePolicy: "PINCH_HITTER",
      salaryPayoutMode: "MANUAL_APPROVAL",
      allowNegativeBalance: false,
      themeColor: "indigo",
      schoolHolidays: JSON.stringify([]),
    },
  });

  const treasury = await prisma.account.findFirst({
    where: { accountType: "CLASS_TREASURY" },
  });

  if (!treasury) {
    await prisma.account.create({
      data: {
        accountType: "CLASS_TREASURY",
        name: "학급 국고",
        balance: 0,
      },
    });
  }

  console.log("Database initialized cleanly with no sample data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
