import { test, expect, type Page } from "@playwright/test";

const NAMES = ["김철수", "이영희", "박민수", "최지은", "정도현", "강서연", "윤태호", "신예린"];
const GENDERS = ["남", "여", "남", "여", "남", "여", "남", "여"];

const SEED = {
  className: "우리 반",
  currencyName: "원",
  students: NAMES.map((name, i) => ({
    no: i + 1,
    name,
    balance: 0,
    gender: GENDERS[i],
  })),
  routines: [
    {
      id: "routine-test-clean",
      icon: "🧹",
      name: "청소",
      slots: 1,
      pay: 0,
      memo: "",
      order: [...NAMES],
      currentIdx: 0,
    },
  ],
  treasuryBalance: 0,
  totalTaxCollected: 0,
};

const SHOTS = "C:/Users/USER-2~1/AppData/Local/Temp/opencode/pickshots";
type Ctx = { __errors: string[] };

function watch(page: Page, errors: string[]) {
  const record = (prefix: string, text: string) => {
    try {
      if (page.url() === "about:blank") return;
    } catch {
      return;
    }
    errors.push(`${prefix}: ${text}`);
  };
  page.on("pageerror", (e) => record("pageerror", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") record("console", m.text());
  });
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (seed: unknown) => {
      try {
        // about:blank 등 불투명 오리진에서는 localStorage 접근 불가 → 무시
        if (!window.location.origin.startsWith("http")) return;
        localStorage.setItem("classroom_os_state_v3", JSON.stringify(seed));
      } catch {
        /* noop */
      }
    },
    SEED
  );
  const errors: string[] = [];
  context.pages().forEach((p) => watch(p, errors));
  context.on("page", (p) => watch(p, errors));
  (context as unknown as Ctx).__errors = errors;
});

async function expectNoErrors(context: unknown) {
  const errors = (context as unknown as Ctx).__errors ?? [];
  expect(errors, `브라우저 에러 없음 (발견: ${errors.join(" | ")})`).toEqual([]);
}

function inputAfterLabel(page: Page, label: string) {
  return page.locator(
    `xpath=//label[contains(normalize-space(.),'${label}')]/following-sibling::input[1]`
  );
}

function tabBar(page: Page) {
  return page.locator("div.flex.items-center.gap-1\\.5.p-1.bg-white");
}

async function gotoTab(page: Page, tab: string) {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();
  await tabBar(page).getByRole("button", { name: tab }).click();
}

/** 같은 이름 버튼이 탭+그리기 2개일 때 그리기 버튼 (두 번째) */
function drawButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).nth(1);
}

function saveSelect(page: Page, index: 0 | 1) {
  return page
    .locator("select", {
      has: page.locator("option", { hasText: "불러올 항목 선택" }),
    })
    .nth(index);
}

test("학생 뽑기: 8명 표시·3명 추첨·연출·결과", async ({ page, context }) => {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();

  // 소리 합성 실행 스파이: OscillatorNode 생성 횟수 계수
  await page.evaluate(() => {
    (window as unknown as { __oscCount: number }).__oscCount = 0;
    const proto = window.AudioContext.prototype;
    const orig = proto.createOscillator;
    proto.createOscillator = function (...args: []) {
      (window as unknown as { __oscCount: number }).__oscCount++;
      return orig.apply(this, args);
    };
  });

  await inputAfterLabel(page, "뽑는 명수").fill("3");
  await page.getByRole("button", { name: "뽑기", exact: true }).click();

  await expect(page.getByRole("button", { name: "다시 뽑기" })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${SHOTS}/student-draw.png` });

  // 결과 글자 42px 이상 (연출창, sm viewport → text-5xl = 48px)
  const overlayResults = page.locator("div.fixed.inset-0 div.bg-gradient-to-r");
  await expect(overlayResults).toHaveCount(3);
  const fontSize = await overlayResults
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  expect(
    parseFloat(fontSize),
    `연출 결과 글자 42px 이상 (측정: ${fontSize})`
  ).toBeGreaterThanOrEqual(42);

  await page.getByRole("button", { name: "닫기", exact: true }).click();

  const resultBox = page.locator("div.bg-white.rounded-2xl", {
    has: page.locator("h3", { hasText: "뽑기 결과" }),
  });
  await expect(resultBox).toBeVisible();
  const chips = resultBox.locator("span");
  await expect(chips).toHaveCount(3);
  const picked = await chips.allTextContents();
  expect(new Set(picked).size).toBe(3);
  expect(picked.every((t) => /^\d+번 /.test(t))).toBe(true);

  // 효과음 합성 실측: 롤링틱+팝+팡파레가 Oscillator를 생성했는지
  const oscCount = await page.evaluate(
    () => (window as unknown as { __oscCount: number }).__oscCount ?? 0
  );
  expect(oscCount, `Oscillator 생성 횟수 (측정: ${oscCount})`).toBeGreaterThan(10);
  await expectNoErrors(context);
});

test("학생 뽑기: 중복불가 초과 차단", async ({ page, context }) => {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();

  await inputAfterLabel(page, "뽑는 명수").fill("5");
  await inputAfterLabel(page, "회차 수").fill("2");
  await page.getByRole("button", { name: "뽑기", exact: true }).click();

  await expect(page.getByText(/필요하지만 8명만 선택/)).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 뽑기" })).toHaveCount(0);
  await expectNoErrors(context);
});

test("순서 뽑기: 전원 셔플·업무 적용·localStorage 반영", async ({ page, context }) => {
  await gotoTab(page, "순서 뽑기");

  await page.locator("select").first().selectOption("routine-test-clean");
  await drawButton(page, "순서 뽑기").click();
  await expect(page.getByRole("button", { name: "다시 뽑기" })).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  const items = page.locator("ol li span.font-medium");
  await expect(items).toHaveCount(8);
  const firstShown = (await items.first().textContent()) ?? "";
  expect(firstShown).toMatch(/^\d+번 /);

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "업무 순서에 적용" }).click();
  await expect(page.getByText(/업무 순서에 적용했습니다/)).toBeVisible();

  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("classroom_os_state_v3") ?? "{}";
    const parsed = JSON.parse(raw) as {
      routines: { id: string; order: string[] }[];
    };
    return parsed.routines.find((r) => r.id === "routine-test-clean")?.order ?? [];
  });
  expect(stored.length).toBe(8);
  expect(firstShown).toContain(stored[0]);
  await expectNoErrors(context);
});

test("모둠 뽑기: 2모둠 균등·저장·새로고침 후 불러오기·삭제", async ({ page, context }) => {
  await gotoTab(page, "모둠 뽑기");

  await inputAfterLabel(page, "모둠 수").fill("2");
  await page.getByText("남녀 균등 분산").click();
  await drawButton(page, "모둠 뽑기").click();
  await expect(page.getByRole("button", { name: "다시 뽑기" })).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await expect(page.getByText("1모둠 (4명)")).toBeVisible();
  await expect(page.getByText("2모둠 (4명)")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/group-result.png` });

  const groupName = `e2e-${Date.now()}`;
  await page.getByPlaceholder(/모둠 결과 이름/).fill(groupName);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(`'${groupName}' 모둠을 저장했습니다.`)).toBeVisible();

  await page.reload();
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();
  await tabBar(page).getByRole("button", { name: "모둠 뽑기" }).click();
  await saveSelect(page, 0).selectOption({ label: groupName });
  await page.getByRole("button", { name: "열기", exact: true }).click();
  await expect(page.getByText("1모둠 (4명)")).toBeVisible();
  await expect(page.getByText("2모둠 (4명)")).toBeVisible();

  page.on("dialog", (d) => d.accept());
  await page.getByTitle("삭제").click();
  await expect(page.getByText("모둠 결과를 삭제했습니다.")).toBeVisible();
  await expectNoErrors(context);
});

test("자리 뽑기: 생성·고정·랜덤·틀/배치 저장왕복", async ({ page, context }) => {
  await gotoTab(page, "자리 뽑기");

  await inputAfterLabel(page, "분단 수").fill("2");
  await page.getByRole("button", { name: "자리 생성", exact: true }).click();
  await expect(page.getByText("칠판")).toBeVisible();
  await expect(page.getByText("빈자리")).toHaveCount(8);

  // 미배치 풀 → 첫 빈자리로 드래그 = 몰래 고정
  await page.getByText("1번 김철수").dragTo(page.getByText("빈자리").first());

  // 고정 표시 켜기 전에는 자물쇠가 DOM에 없음
  await expect(page.getByTitle("고정 배치됨")).toHaveCount(0);
  await page.getByRole("button", { name: "고정 표시" }).click();
  await expect(page.getByText(/고정 1자리/)).toBeVisible();
  await expect(page.getByTitle("고정 배치됨")).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/seat-fixed.png` });

  // 랜덤 배치 → 연출에서 고정 흔적 없음 + 8명 전원 배치
  await page.getByRole("button", { name: "랜덤 배치", exact: true }).click();
  const overlay = page.locator("div.fixed.inset-0");
  await expect(page.getByRole("button", { name: "다시 뽑기" })).toBeVisible({ timeout: 60000 });
  await expect(overlay.getByText("분단")).toHaveCount(8);
  await expect(overlay.getByTitle("고정 배치됨")).toHaveCount(0);
  await expect(overlay.getByText(/김철수 →/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/seat-draw.png` });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByText(/배치 8명/)).toBeVisible();

  // 고정 유지 확인: 전원 배치, 미배치 0명
  await expect(page.getByText("미배치 학생 (0명)")).toBeVisible();

  // 틀 저장 + 배치 저장
  const stamp = Date.now();
  await page.getByPlaceholder(/자리 틀 이름/).fill(`e2e틀-${stamp}`);
  await page.getByRole("button", { name: "저장", exact: true }).nth(0).click();
  await expect(page.getByText(/자리 틀 'e2e틀-/)).toBeVisible();
  await page.getByPlaceholder(/배치 결과 이름/).fill(`e2e배치-${stamp}`);
  await page.getByRole("button", { name: "저장", exact: true }).nth(1).click();
  await expect(page.getByText(/자리 배치 'e2e배치-/)).toBeVisible();

  // 새로고침 → 틀/배치 불러오기 왕복
  await page.reload();
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();
  await tabBar(page).getByRole("button", { name: "자리 뽑기" }).click();
  await saveSelect(page, 0).selectOption({ label: `e2e틀-${stamp}` });
  await page.getByRole("button", { name: "열기", exact: true }).nth(0).click();
  await expect(page.getByText("칠판")).toBeVisible();
  await saveSelect(page, 1).selectOption({ label: `e2e배치-${stamp}` });
  await page.getByRole("button", { name: "열기", exact: true }).nth(1).click();
  await expect(page.getByText(/배치 8명/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/seat-loaded.png` });

  // 뒷정리: 배치·틀 삭제
  page.on("dialog", (d) => d.accept());
  await page.getByTitle("삭제").nth(1).click();
  await expect(page.getByText("자리 배치를 삭제했습니다.")).toBeVisible();
  await page.getByTitle("삭제").nth(0).click();
  await expect(page.getByText("자리 틀을 삭제했습니다.")).toBeVisible();
  await expectNoErrors(context);
});
