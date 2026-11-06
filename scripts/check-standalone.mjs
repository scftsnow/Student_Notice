// 설치 패키지 전제조건 검사. .next/standalone이 없으면 즉시 실패한다.
// (next dev 기동이 .next를 정리해서 standalone이 사라지는 사고 방지)
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const required = [
  ".next/standalone/server.js",
  ".next/standalone/package.json",
  ".next/standalone/node_modules/next/package.json",
  ".next/standalone/node_modules/@prisma/client/package.json",
];

let failed = false;
for (const rel of required) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    console.error(`[check-standalone] MISSING: ${rel} -> 먼저 'npm run build'를 실행하세요.`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("[check-standalone] standalone OK");
