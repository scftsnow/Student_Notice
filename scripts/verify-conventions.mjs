#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { execSync } from "child_process";

console.log("\n========================================================");
console.log("   🔍 학급 알림장 코딩 컨벤션 및 정적 무결성 점검 시스템");
console.log("========================================================\n");

let totalViolations = 0;
const results = [];

function recordResult(ruleName, passed, details = "") {
  if (!passed) totalViolations++;
  results.push({ ruleName, passed, details });
}

// 1. Scan directory recursively
function getAllFiles(dir, exts, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        getAllFiles(filePath, exts, fileList);
      }
    } else {
      if (exts.includes(extname(file))) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

// Check 1: Zero 'any' policy
const sourceFiles = getAllFiles(join(process.cwd(), "src"), [".ts", ".tsx"]);
let anyViolations = [];

const anyRegex = /:\s*any\b|<any>|\bas\s+any\b/g;

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    // Exclude comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    if (anyRegex.test(line)) {
      anyViolations.push(`${basename(file)}:${idx + 1} -> ${trimmed}`);
    }
  });
}

if (anyViolations.length === 0) {
  recordResult("1. Zero 'any' 타입 안전성 규칙", true, "모든 소스 파일에서 'any' 키워드 0건 확인");
} else {
  recordResult(
    "1. Zero 'any' 타입 안전성 규칙",
    false,
    `${anyViolations.length}건의 'any' 타입 검출:\n   ` + anyViolations.slice(0, 5).join("\n   ")
  );
}

// Check 2: Component Naming Convention (PascalCase)
const componentFiles = getAllFiles(join(process.cwd(), "src", "components"), [".tsx"]);
let namingViolations = [];
const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]+\.tsx$/;

for (const file of componentFiles) {
  const fileName = basename(file);
  if (!pascalCaseRegex.test(fileName)) {
    namingViolations.push(fileName);
  }
}

if (namingViolations.length === 0) {
  recordResult("2. React 컴포넌트 PascalCase 명명 규칙", true, "모든 컴포넌트 파일이 PascalCase 준수");
} else {
  recordResult(
    "2. React 컴포넌트 PascalCase 명명 규칙",
    false,
    `비준수 파일: ${namingViolations.join(", ")}`
  );
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

// Check 3: Prisma Schema Validation
try {
  execSync(`${npxCmd} prisma validate`, { stdio: "pipe" });
  recordResult("3. Prisma 데이터베이스 스키마 무결성", true, "schema.prisma 구문 및 모델 관계 정상");
} catch (err) {
  recordResult("3. Prisma 데이터베이스 스키마 무결성", false, "스키마 검증 에러 발생");
}

// Check 4: TypeScript Strict Typecheck (tsc --noEmit)
try {
  execSync(`${npxCmd} tsc --noEmit`, { stdio: "pipe" });
  recordResult("4. TypeScript Strict 타입 체킹 (tsc)", true, "0 Type Errors");
} catch (err) {
  const output = err.stdout ? err.stdout.toString() : err.message;
  recordResult("4. TypeScript Strict 타입 체킹 (tsc)", false, output.slice(0, 200));
}

// Check 5: Next.js Core Web Vitals ESLint
try {
  execSync(`${npxCmd} next lint`, { stdio: "pipe" });
  recordResult("5. Next.js Core Web Vitals ESLint 규칙", true, "0 ESLint Warnings & Errors");
} catch (err) {
  recordResult("5. Next.js Core Web Vitals ESLint 규칙", false, "린트 검사 실패");
}

// Check 6: Separation of Concerns - Single File Line Limit
const MAX_LINES_PER_COMPONENT = 550;
let oversizedComponents = [];
for (const file of componentFiles) {
  const lineCount = readFileSync(file, "utf-8").split("\n").length;
  if (lineCount > MAX_LINES_PER_COMPONENT) {
    oversizedComponents.push(`${basename(file)} (${lineCount}줄 > ${MAX_LINES_PER_COMPONENT}줄)`);
  }
}

if (oversizedComponents.length === 0) {
  recordResult("6. 책임 분리 및 컴포넌트 모듈성 규칙", true, `모든 컴포넌트가 ${MAX_LINES_PER_COMPONENT}줄 이하로 관심사 분리 준수`);
} else {
  recordResult(
    "6. 책임 분리 및 컴포넌트 모듈성 규칙",
    false,
    `과대 컴포넌트 발견:\n   ` + oversizedComponents.join("\n   ")
  );
}

// Check 7: No Monolithic Static Files in public/
const publicHtmlFiles = getAllFiles(join(process.cwd(), "public"), [".html"]);
let monolithicPublicFiles = [];
for (const file of publicHtmlFiles) {
  const lineCount = readFileSync(file, "utf-8").split("\n").length;
  if (lineCount > 100) {
    monolithicPublicFiles.push(`${basename(file)} (${lineCount}줄)`);
  }
}

if (monolithicPublicFiles.length === 0) {
  recordResult("7. 정적 모놀리스 방지 규칙", true, "public/ 디렉토리에 비정규 거대 모놀리식 HTML 파일 없음");
} else {
  recordResult(
    "7. 정적 모놀리스 방지 규칙",
    false,
    `public/ 내 거대 파일 검출:\n   ` + monolithicPublicFiles.join("\n   ")
  );
}

// Summary Report
console.log("--------------------------------------------------------");
console.log("                점검 결과 상세 내역");
console.log("--------------------------------------------------------\n");

results.forEach((r) => {
  const icon = r.passed ? "✅ [통과]" : "❌ [실패]";
  console.log(`${icon} ${r.ruleName}`);
  if (r.details) {
    console.log(`   └ ${r.details}`);
  }
});

console.log("\n========================================================");
if (totalViolations === 0) {
  console.log("   🎉 모든 표준 코딩 컨벤션 검증을 완벽히 통과하였습니다!");
  console.log("========================================================\n");
  process.exit(0);
} else {
  console.error(`   🚨 총 ${totalViolations}건의 컨벤션 위반이 발견되었습니다.`);
  console.log("========================================================\n");
  process.exit(1);
}
