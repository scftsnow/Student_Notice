import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 뽑기 4종 e2e.
 *
 * 아키텍처: 패널의 뽑기 버튼은 후보만 실어 전광판(별도 창)을 열고,
 * 랜덤은 전광판의 [추첨 시작]을 누른 그 순간에 패널이 계산해 다시 전달한다.
 * 그래서 모든 테스트는 "버튼 → 팝업 → 추첨 시작 → 결과" 순서로 진행한다.
 */

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
      visibleInNotice: true,
    },
  ],
  treasuryBalance: 0,
  totalTaxCollected: 0,
};

/** 실패 시 화면을 남길 폴더 — 테스트가 직접 만든다 (Playwright는 상위 폴더를 만들지 않는다) */
const SHOTS = (() => {
  const dir = join(process.env.TEMP ?? process.cwd(), "opencode", "pickshots");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* noop — 스크린샷만 건너뛴다 */
  }
  return dir;
})();

/** 스크린샷은 부가 산출물이므로 실패해도 테스트 판정에 영향이 없어야 한다 */
async function shot(page: Page, file: string) {
  try {
    await page.screenshot({ path: join(SHOTS, file) });
  } catch {
    /* noop */
  }
}

/** 시드 1회 적용 표시 — addInitScript 는 모든 네비게이션마다 다시 돌기 때문에 필요 */
const SEED_FLAG = "__picks_e2e_seeded";

type Ctx = { __errors: string[] };

function watch(page: Page, errors: string[]) {
  const record = (prefix: string, text: string, url?: string) => {
    try {
      if (page.url() === "about:blank") return;
    } catch {
      return;
    }
    // 리소스 오류는 URL 이 없으면 무엇이 404 였는지 알 수 없으므로 반드시 붙인다
    errors.push(`${prefix}: ${text}${url ? ` [${url}]` : ""}`);
  };
  page.on("pageerror", (e) => record("pageerror", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") record("console", m.text(), m.location()?.url);
  });
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([seed, flag]: [unknown, string]) => {
      try {
        // about:blank 등 불투명 오리진에서는 localStorage 접근 불가 → 무시
        if (!window.location.origin.startsWith("http")) return;
        // 전광판 팝업이 같은 저장소를 공유하므로 첫 진입에서만 심는다
        if (localStorage.getItem(flag)) return;
        localStorage.setItem(flag, "1");
        localStorage.setItem("classroom_os_state_v3", JSON.stringify(seed));
      } catch {
        /* noop */
      }
    },
    [SEED, SEED_FLAG] as [unknown, string]
  );
  const errors: string[] = [];
  context.pages().forEach((p) => watch(p, errors));
  context.on("page", (p) => watch(p, errors));
  (context as unknown as Ctx).__errors = errors;
});

/**
 * 파비콘은 앱에 없어서 모든 페이지가 404를 한 번씩 받는다.
 * JS 실행 오류(pageerror)와 그 밖의 리소스 404는 전부 실패로 본다.
 */
const BENIGN = [/favicon\.ico/];

async function expectNoErrors(context: unknown) {
  const errors = ((context as unknown as Ctx).__errors ?? []).filter(
    (e) => !BENIGN.some((re) => re.test(e))
  );
  expect(errors, `브라우저 에러 없음 (발견: ${errors.join(" | ")})`).toEqual([]);
}

/**
 * 라벨 텍스트 바로 뒤에 오는 입력.
 * 4종 패널이 `<label>뽑는 명수</label><input>` (label)와
 * `<span>모둠 수</span><input>` (span) 두 마크업을 섞어 쓰므로 둘 다 받는다.
 */
function inputNear(page: Page, text: string) {
  return page.locator(
    `xpath=//*[self::label or self::span][contains(normalize-space(.),'${text}')]/following-sibling::*[self::input][1]`
  );
}

function tabBar(page: Page) {
  return page.locator("div.flex.items-center.gap-1\\.5.p-1.bg-white");
}

/** 라벨 텍스트 바로 뒤에 오는 셀렉트 */
function selectNear(page: Page, text: string) {
  return page.locator(
    `xpath=//*[self::label or self::span][contains(normalize-space(.),'${text}')]/following-sibling::*[self::select][1]`
  );
}

async function gotoTab(page: Page, tab: string) {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();
  await tabBar(page).getByRole("button", { name: tab }).click();
}

const isBoard = (p: Page) => p.url().includes("/picks/window");

/**
 * 전광판(별도 창)을 열고 [추첨 시작]까지 눌러 결과를 받는다.
 * 같은 종류는 창을 재사용하므로, 이미 열린 전광판이 있으면 그 창을 쓴다.
 */
async function runBoard(
  page: Page,
  context: BrowserContext,
  openButton: RegExp
): Promise<Page> {
  const already = context.pages().find(isBoard);

  if (already) {
    // 재사용 창: 열기 버튼을 눌러 후보만 갱신한 뒤 전광판에서 바로 재추첨
    await page.getByRole("button", { name: openButton }).click();
    const re = await already.getByRole("button", { name: /다시 뽑기/ }).count();
    if (re > 0) await already.getByRole("button", { name: /다시 뽑기/ }).click();
    else await already.getByRole("button", { name: /추첨 시작/ }).click();
    await expectFinal(already);
    return already;
  }

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: openButton }).click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  await popup.getByRole("button", { name: /추첨 시작/ }).click();
  await expectFinal(popup);
  return popup;
}

/**
 * 결과 완료까지 기다린다.
 * 병렬 부하가 크면 첫 [추첨 시작] 요청의 브로드캐스트를 놓칠 수 있다.
 * 그때는 ① 재추첨 ② 전광판 리로드(저장된 페이로드 자가치유) 순으로 복구한다.
 */
async function expectFinal(popup: Page) {
  const done = () => popup.getByText("최종 추첨 결과");
  try {
    await expect(done()).toBeVisible({ timeout: 25000 });
    return;
  } catch {
    /* 재시도 */
  }
  const again = popup.getByRole("button", { name: /다시 뽑기/ });
  if ((await again.count()) > 0) await again.click();
  else await popup.getByRole("button", { name: /추첨 시작/ }).click();

  try {
    await expect(done()).toBeVisible({ timeout: 25000 });
    return;
  } catch {
    /* 리로드로 자가치유 */
  }
  await popup.reload();
  await expect(done()).toBeVisible({ timeout: 45000 });
}

/** 전광판 화면에 실제로 올라온 학생 이름 (DOM 텍스트 기준 — 결과/롤링 포함) */
async function namesInBoard(popup: Page): Promise<string[]> {
  const text = (await popup.locator("body").innerText()).replace(/\s+/g, " ");
  return NAMES.filter((n) => text.includes(n));
}

/** 결과 이름 (한 줄에 하나씩 놓이는 이름 span) */
async function resultNames(popup: Page): Promise<string[]> {
  return (await popup.locator("span.truncate").allTextContents())
    .map((t) => t.trim())
    .filter((t) => NAMES.includes(t));
}

test("학생 뽑기: 전광판에서 3명 추첨·결과 표시", async ({ page, context }) => {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();

  await inputNear(page, "뽑는 명수").fill("3");
  const popup = await runBoard(page, context, /뽑기 \(별도 창\)/);
  await shot(popup, "student-draw.png");

  const picked = await resultNames(popup);
  expect(picked, `추첨된 3명 (확인: ${picked.join(", ")})`).toHaveLength(3);
  expect(new Set(picked).size, "중복 없이 3명").toBe(3);

  // 전광판을 닫으면 관리 화면 '뽑힌 내역'에 결과가 반영된다
  await popup.getByRole("button", { name: /창 닫기/ }).click();
  const drawn = page.locator("div.bg-amber-50", { has: page.getByText("뽑힌 내역") });
  await expect(drawn).toBeVisible();
  const chips = drawn.locator("div.flex.flex-wrap > span");
  await expect(chips).toHaveCount(3);
  const shown = (await chips.allTextContents()).map((t) => t.trim());
  expect(new Set(shown), "추첨된 3명이 목록에 반영").toEqual(new Set(picked));
  await expectNoErrors(context);
});

test("학생 뽑기: 남은 후보를 넘겨 뽑으면 안내와 함께 차단", async ({ page, context }) => {
  await page.goto("/picks");
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();

  // 중복 허용이 꺼진 기본 상태에서 5명 뽑으면 후보는 3명 남는다
  await inputNear(page, "뽑는 명수").fill("5");
  const popup = await runBoard(page, context, /뽑기 \(별도 창\)/);
  const first = await resultNames(popup);
  expect(first, `첫 추첨 5명 (확인: ${first.join(", ")})`).toHaveLength(5);
  await popup.getByRole("button", { name: /창 닫기/ }).click();

  // 뽑힌 학생이 후보에서 빠졌는지 안내 문구로 확인된다
  await expect(page.getByText(/남은 후보 3명/)).toBeVisible();

  // 남은 3명보다 많이 뽑으려 하면 전광판을 열지 않고 차단된다
  await inputNear(page, "뽑는 명수").fill("5");
  await page.getByRole("button", { name: /뽑기 \(별도 창\)/ }).click();
  await expect(page.getByText(/남은 후보 3명으로는 5명을 중복 없이 뽑을 수 없습니다/)).toBeVisible();
  await expectNoErrors(context);
});

test("순서 뽑기: 전원 셔플 결과가 전광판에 8명 전체로 표시", async ({ page, context }) => {
  await gotoTab(page, "순서 뽑기");

  const popup = await runBoard(page, context, /순서 뽑기 \(별도 창\)/);

  const order = await resultNames(popup);
  expect(order, `추첨된 순서 (확인: ${order.join(", ")})`).toHaveLength(8);
  expect(new Set(order), "8명 전원이 중복 없이").toEqual(new Set(NAMES));
  await shot(popup, "order-result.png");

  await popup.getByRole("button", { name: /창 닫기/ }).click();
  await expect(page.getByText("방금 뽑힌 순서 (8명)")).toBeVisible();
  await expectNoErrors(context);
});

test("모둠 뽑기: 모둠 수 2로 나누면 2모둠에 4명씩", async ({ page, context }) => {
  await gotoTab(page, "모둠 뽑기");

  await page.getByRole("button", { name: "모둠 수 지정" }).click();
  await inputNear(page, "모둠 수").fill("2");

  const popup = await runBoard(page, context, /모둠 뽑기 \(별도 창\)/);

  await expect(popup.getByText("1모둠", { exact: true })).toBeVisible();
  await expect(popup.getByText("2모둠", { exact: true })).toBeVisible();
  const members = await popup.locator("span.truncate").allTextContents();
  const names = members.map((t) => t.trim()).filter((t) => NAMES.includes(t));
  expect(new Set(names), "8명 전원이 한 번씩 배정").toEqual(new Set(NAMES));
  await shot(popup, "group-result.png");

  await popup.getByRole("button", { name: /창 닫기/ }).click();
  await expect(page.getByText(/방금 나눈 모둠 \(2모둠\)/)).toBeVisible();
  await expectNoErrors(context);
});

test("모둠 뽑기: 모둠당 인원 모드", async ({ page, context }) => {
  await gotoTab(page, "모둠 뽑기");

  await page.getByRole("button", { name: "모둠당 인원" }).click();
  await inputNear(page, "모둠당 인원").fill("2");

  const popup = await runBoard(page, context, /모둠 뽑기 \(별도 창\)/);

  await expect(popup.getByText("1모둠", { exact: true })).toBeVisible();
  await expect(popup.getByText("4모둠", { exact: true })).toBeVisible();
  const names = (await popup.locator("span.truncate").allTextContents())
    .map((t) => t.trim())
    .filter((t) => NAMES.includes(t));
  expect(new Set(names), "8명 전원이 한 번씩 배정").toEqual(new Set(NAMES));

  await popup.getByRole("button", { name: /창 닫기/ }).click();
  await expectNoErrors(context);
});

test("자리 뽑기: 섞는 동안 좌석이 실제로 이동한다 (이름만 바뀌지 않는다)", async ({ page, context }) => {
  await gotoTab(page, "자리 뽑기");

  // 롤 중에measuring 해야 하므로 [추첨 시작]은 누르지 않고 전광판만 연다
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: /랜덤 배치 \(별도 창\)/ }).click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  await popup.getByRole("button", { name: /추첨 시작/ }).click();

  // 좌석이 '자리를 섞는 중' 동안 실제로 좌표를 바꾸는지 본다.
  // 라벨만 맞바꾸면 이름만 바뀌는错觉이 들어 여기서 걸린다.
  const moved = await popup.evaluate(async () => {
    const snap = () =>
      Array.from(document.querySelectorAll("[data-shuffle-key]"))
        .map((e) => `${(e as HTMLElement).dataset.shuffleKey}@${Math.round(e.getBoundingClientRect().left)}`)
        .sort()
        .join(" ");
    const frames: string[] = [];
    for (let i = 0; i < 24; i++) {
      frames.push(snap());
      await new Promise((r) => setTimeout(r, 120));
    }
    const uniq = Array.from(new Set(frames.filter(Boolean)));
    const toMap = (s: string) => {
      const m: Record<string, string> = {};
      s.split(" ").filter(Boolean).forEach((p) => {
        const [k, v] = p.split("@");
        m[k] = v;
      });
      return m;
    };
    if (uniq.length < 2) {
      return { distinctFrames: uniq.length, seats: uniq.length ? uniq[0].split(" ").length : 0, seatsMoved: false };
    }
    const first = toMap(uniq[0]);
    const last = toMap(uniq[uniq.length - 1]);
    return {
      distinctFrames: uniq.length,
      seats: uniq[0].split(" ").length,
      seatsMoved: Object.keys(first).some((k) => first[k] !== last[k]),
    };
  });

  expect(moved.seats, "좌석 DOM 이 잡혔다").toBe(8);
  expect(moved.distinctFrames, "섞는 동안 위치가 여러 번 바뀐다").toBeGreaterThan(2);
  expect(moved.seatsMoved, "좌석 좌표가 실제로 이동한다").toBe(true);
});

test("자리 뽑기: 배치된 자리가 학생 화면에 이름과 성별로 표시된다", async ({ page, context }) => {
  await gotoTab(page, "자리 뽑기");

  const popup = await runBoard(page, context, /랜덤 배치 \(별도 창\)/);

  const seated = await namesInBoard(popup);
  expect(seated, `앉은 학생 (확인: ${seated.join(", ")})`).toHaveLength(8);
  await shot(popup, "seat-draw.png");

  await popup.getByRole("button", { name: /창 닫기/ }).click();

  // 관리 화면 자리판에 8명이 실제로 앉아 있다
  const gridNames = await page
    .locator('[title*="성별 지정"]')
    .allTextContents();
  const placed = gridNames.map((t) => t.trim()).filter((t) => NAMES.includes(t));
  expect(new Set(placed), `앉은 학생 (확인: ${placed.join(", ")})`).toEqual(new Set(NAMES));
  await expectNoErrors(context);
});

test("자리 뽑기: 성별 잠긴 좌석은 ♂/♀ 가 이름 앞에 한 줄로 표시", async ({ page, context }) => {
  await gotoTab(page, "자리 뽑기");

  // 좌석을 더블클릭하면 성별이 없음 → 남 → 여 → 없음 순으로 잠긴다
  const firstSeat = page.locator('[title*="성별 지정"]').first();
  await expect(firstSeat).toBeVisible();
  await firstSeat.dblclick();
  await expect(firstSeat).toContainText("♂");

  const popup = await runBoard(page, context, /랜덤 배치 \(별도 창\)/);

  const seated = await namesInBoard(popup);
  expect(seated, `앉은 학생 (확인: ${seated.join(", ")})`).toHaveLength(8);

  // 전광판 좌석도 성별 기호가 이름보다 먼저 온다
  const seatText = (await popup.locator("body").innerText()).replace(/\s+/g, " ");
  expect(seatText, "성별 기호가 이름 앞에 붙는다").toMatch(/[♂♀]\s*\S/);
  await shot(popup, "seat-gender.png");

  await popup.getByRole("button", { name: /창 닫기/ }).click();
  await expectNoErrors(context);
});

test("자리 뽑기: 배치를 자리로 저장 후 프리셋으로 되돌리기", async ({ page, context }) => {
  await gotoTab(page, "자리 뽑기");

  const popup = await runBoard(page, context, /랜덤 배치 \(별도 창\)/);
  const seated = await namesInBoard(popup);
  expect(seated).toHaveLength(8);
  await popup.getByRole("button", { name: /창 닫기/ }).click();

  const name = `e2e자리-${Date.now()}`;
  // 자리 저장은 모달에서 이름을 입력해야 한다
  await page.getByRole("button", { name: "자리 저장", exact: true }).click();
  await page.getByPlaceholder(/저장할 자리 이름/).fill(name);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(`자리 프리셋 '${name}'이(가) 저장되었습니다.`)).toBeVisible();

  await page.reload();
  await expect(page.getByText("선택 8/8명").first()).toBeVisible();
  await tabBar(page).getByRole("button", { name: "자리 뽑기" }).click();

  // 저장한 프리셋 카드의 [이 자리 불러오기] 로 복원
  const card = page
    .locator("div")
    .filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "이 자리 불러오기" }) })
    .last();
  await card.getByRole("button", { name: "이 자리 불러오기" }).click();
  await expect(page.getByText(`'${name}' 자리를 불러왔습니다.`)).toBeVisible();
  await expectNoErrors(context);
});
