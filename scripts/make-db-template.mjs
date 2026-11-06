// 설치 패키지용 빈 DB 템플릿 생성.
// 스키마만 적용된 classroom-template.db를 prisma/ 아래에 만든다.
// 앱 첫 실행 시 userData로 복사된다 (electron/main.cjs ensureDatabase).
// 데이터가 아닌 뼈대만 들어가므로 사용자 DB와 충돌하지 않는다.
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templatePath = path.join(root, "prisma", "classroom-template.db");

for (const suffix of ["", "-shm", "-wal", "-journal"]) {
  rmSync(templatePath + suffix, { force: true });
}

const res = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "push",
    "--schema",
    "prisma/schema.prisma",
    "--skip-generate",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./classroom-template.db" },
  }
);

if ((res.status ?? 1) !== 0) {
  console.error("[db-template] prisma db push failed");
  process.exit(res.status ?? 1);
}
console.log("[db-template] created prisma/classroom-template.db");
