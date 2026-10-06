import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * 알림장(전자칠판 편집기) e2e.
 *
 * 칠판 요소는 DOM 순서가 아니라 '안쪽 내용'으로 찾는다
 * (요소가 늘거나 순서가 바뀌어도 테스트가 깨지지 않게 하기 위함).
 */

const NAMES = ["김철수", "이영희", "박민수", "최지은", "정도현", "강서연", "윤태호", "신예린"];

/** 마감일이 미래인 과제 (칠판 요소로 렌더되도록) */
function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SEED = {
  className: "우리 반",
  currencyName: "원",
  students: NAMES.map((name, i) => ({ no: i + 1, name, balance: 0, gender: i % 2 ? "여" : "남" })),
  routines: [
    {
      id: "routine-notice",
      icon: "🧹",
      name: "청소",
      slots: 1,
      pay: 100,
      memo: "",
      order: [...NAMES],
      currentIdx: 0,
      visibleInNotice: true,
    },
  ],
  homeworks: [
    {
      id: "hw-notice",
      title: "서식대상과제",
      dueDate: futureDate(5),
      exempt: [],
      submitted: ["김철수", "박민수"],
      visibleDays: [0, 1, 2, 3, 4, 5, 6],
    },
  ],
  boardHomeworkIds: ["hw-notice"],
  treasuryBalance: 0,
  totalTaxCollected: 0,
};

/** 시드 1회 적용 표시 — addInitScript 는 모든 네비게이션마다 다시 돌기 때문에 필요 */
const SEED_FLAG = "__notice_e2e_seeded";

const NOTICE_EDITOR = "[data-placeholder='전달할 알림장 내용을 입력하세요...']";

/** 칠판 배경 레이어의 바로 아래 = 요소 박스들 */
function boxLayer(page: Page) {
  return page.locator("#preview-16-9-wrapper > div > div > div");
}

/** 안쪽 내용을 가진 요소 박스 하나 (data-card-id 편집기는 박스보다 2단계 안쪽이다) */
function boxOf(page: Page, inner: Locator) {
  return boxLayer(page).filter({ has: inner });
}

const dateBox = (page: Page) => boxOf(page, page.locator("#canvas-date-text"));
const clockBox = (page: Page) => boxOf(page, page.locator("#canvas-clock-text"));
const noticeBox = (page: Page) => boxOf(page, page.locator(NOTICE_EDITOR));
const routineBox = (page: Page) => boxOf(page, page.locator(".routine-text-editor"));

/** 자유 글상자 박스 — 편집기에서 2단계 위가 박스 루트다 */
function freeBox(page: Page, idx = 0) {
  return page.locator("[data-card-id^='free-']").nth(idx).locator("xpath=../..");
}

/** 툴바 '대상' 선택 (전체 일괄 적용 / 날짜 / 시간/시계 / 학생 업무 / 자유 글상자 N) */
const targetSelect = (page: Page) => page.locator("select").first();
/** 툴바 글자 크기 선택 */
const fontSizeSelect = (page: Page) => page.locator("select").nth(1);

test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(
    ([seed, flag]: [unknown, string]) => {
      try {
        if (!window.location.origin.startsWith("http")) return;
        if (localStorage.getItem(flag)) return;
        localStorage.setItem(flag, "1");
        localStorage.setItem("classroom_os_state_v3", JSON.stringify(seed));
      } catch {
        /* noop */
      }
    },
    [SEED, SEED_FLAG] as [unknown, string]
  );
  await page.goto("/notice");
  await expect(page.locator("#canvas-date-text")).toBeVisible();
});

test.describe("알림장 캔버스 자유 글상자 및 드래그/리사이즈 검증", () => {
  // 칠판 하단(업무/과제 요소)까지 실제 클릭하려면 세로가 충분해야 한다.
  // 기본 720px에서는 요소가 뷰포트 밖이라 Playwright 가 스크롤을 시도하다 타임아웃한다.
  test.use({ viewport: { width: 1440, height: 1200 } });
  test("상단 툴바에 정렬 3종과 글씨 색상 팔레트 및 글자 크기 드롭다운이 존재한다", async ({ page }) => {
    await expect(page.getByTitle("왼쪽 정렬")).toBeVisible();
    await expect(page.getByTitle("가운데 정렬")).toBeVisible();
    await expect(page.getByTitle("오른쪽 정렬")).toBeVisible();
    for (const label of ["흰색", "노랑", "빨강", "연두", "하늘", "분홍"]) {
      await expect(page.getByTitle(label)).toBeVisible();
    }
    await expect(fontSizeSelect(page)).toBeVisible();
    await expect(fontSizeSelect(page)).toHaveValue("42");
  });

  test("판서 요소마다 8개 크기 조절 핸들이 있고 화살표 글자가 없다", async ({ page }) => {
    const targets: [string, Locator][] = [
      ["날짜", dateBox(page)],
      ["시계", clockBox(page)],
      ["알림장 본문", noticeBox(page)],
      ["학생 업무", routineBox(page)],
    ];
    for (const [label, box] of targets) {
      await expect(box, `${label} 요소`).toBeVisible();
      await expect(box.locator("[data-handle]"), `${label} 리사이즈 핸들 8개`).toHaveCount(8);
      // 핸들에 화살표 텍스트가 없는지 확인
      const texts = await box.locator("[data-handle]").allTextContents();
      expect(texts.map((t) => t.trim()).join(""), `${label} 핸들 텍스트 없음`).toBe("");
    }
  });

  test("요소를 직접 드래그하면 요소의 위치가 실제로 이동한다", async ({ page }) => {
    const box = dateBox(page);
    await expect(box).toBeVisible();
    const before = await box.boundingBox();
    expect(before).not.toBeNull();

    // 편집 영역 위에서는 드래그가 취소되므로 박스 여백(왼쪽 위 모서리)을 잡는다
    if (before) {
      await page.mouse.move(before.x + 4, before.y + 4);
      await page.mouse.down();
      await page.mouse.move(before.x + 124, before.y + 54, { steps: 8 });
      await page.mouse.up();
    }

    const after = await box.boundingBox();
    expect(after).not.toBeNull();
    if (before && after) {
      expect(Math.round(after.x - before.x), "우측으로 이동").toBeGreaterThan(20);
      expect(Math.round(after.y - before.y), "아래로 이동").toBeGreaterThan(10);
    }
  });

  test("글자 크기 드롭다운 변경 시 본문 글씨 크기가 연동된다", async ({ page }) => {
    const editor = page.locator(NOTICE_EDITOR);
    await expect(editor).toBeVisible();
    await expect(editor).toHaveCSS("font-size", "42px");

    await fontSizeSelect(page).selectOption("50");
    await expect(editor).toHaveCSS("font-size", "50px");
  });

  test("알림장 본문 클릭 시 편집 모드로 진입하고 내용을 직접 입력할 수 있다", async ({ page }) => {
    const editor = page.locator(NOTICE_EDITOR);
    await editor.click();
    await expect(editor).toBeVisible();
    await page.keyboard.type("내일 준비물: 리코더");
    await expect(editor).toContainText("내일 준비물: 리코더");
  });

  test("자유 글상자 추가 시 새 카드가 생기고 서식 변경 및 삭제가 연동된다", async ({ page }) => {
    // 기본 1개(알림장 본문 = 자유 글상자 1)가 있으므로 새 카드는 2번째
    await page.getByTitle("새 자유 글상자를 칠판에 추가합니다").click();
    const cards = page.locator("[data-card-id^='free-']");
    await expect(cards).toHaveCount(1);

    const card = freeBox(page, 0);
    await expect(card).toBeVisible();
    await expect(card.locator("[data-handle]")).toHaveCount(8);

    // 대상을 새 자유 글상자로 잡고 연두 색상 적용
    await targetSelect(page).selectOption({ label: "자유 글상자 2" });
    await page.getByTitle("연두").click();
    const editor = cards.nth(0);
    await expect(editor).toHaveCSS("color", "rgb(134, 239, 172)"); // #86efac

    // 삭제
    const deleteBtn = card.getByTitle("글상자 삭제");
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await expect(cards).toHaveCount(0);
  });

  test("모든 판서 요소(날짜, 시계, 본문, 학생 업무)의 기본 폰트 크기가 42px이다", async ({ page }) => {
    await expect(page.locator("#canvas-date-text")).toHaveCSS("font-size", "42px");
    await expect(page.locator("#canvas-clock-text")).toHaveCSS("font-size", "42px");
    await expect(page.locator(NOTICE_EDITOR)).toHaveCSS("font-size", "42px");

    const routine = page.locator(".routine-text-editor");
    await expect(routine).toBeVisible();
    await expect(routine).toHaveCSS("font-size", "42px");
  });

  test("학생 업무 당번 클릭 시 급여·대타 팝오버가 노출되고 급여 지급이 동작한다", async ({ page }) => {
    const routine = page.locator(".routine-text-editor");
    await expect(routine).toBeVisible();

    // 당번 이름(토큰 span) 클릭 → 포털 팝오버
    const worker = routine.locator("[data-worker-index]").first();
    await expect(worker).toBeVisible();
    await worker.click();

    const popup = page.locator("div.fixed.z-\\[99999\\]").first();
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("button", { name: "이 학생 건너뛰기" })).toBeVisible();
    await expect(popup.getByRole("button", { name: /급여 지급 \(100원\)/ })).toBeVisible();

    // 급여 지급 → 지급 완료로 표시되고 이름 토큰 색이 바뀐다
    await popup.getByRole("button", { name: /급여 지급 \(100원\)/ }).click();
    await expect(worker).toHaveAttribute("title", /지급 완료/);
  });

  test("대상을 골라 날짜·시계·알림장 서식을 개별 조절할 수 있다", async ({ page }) => {
    // 날짜 → 노랑
    await targetSelect(page).selectOption({ label: "날짜" });
    await page.getByTitle("노랑").click();
    await expect(page.locator("#canvas-date-text")).toHaveCSS("color", "rgb(253, 224, 71)"); // #fde047

    // 시계 → 하늘 + 50px
    await targetSelect(page).selectOption({ label: "시간/시계" });
    await page.getByTitle("하늘").click();
    await fontSizeSelect(page).selectOption("50");
    await expect(page.locator("#canvas-clock-text")).toHaveCSS("color", "rgb(125, 211, 252)"); // #7dd3fc
    await expect(page.locator("#canvas-clock-text")).toHaveCSS("font-size", "50px");

    // 알림장 본문(자유 글상자 1) → 분홍 + 가운데 정렬
    await targetSelect(page).selectOption({ label: "자유 글상자 1" });
    await page.getByTitle("분홍").click();
    await page.getByTitle("가운데 정렬").click();
    const editor = page.locator(NOTICE_EDITOR);
    await expect(editor).toHaveCSS("color", "rgb(249, 168, 212)"); // #f9a8d4
    await expect(editor).toHaveCSS("text-align", "center");
  });

  test("알림장 본문에서 텍스트 블록 드래그 선택이 가능하다", async ({ page }) => {
    const editor = page.locator(NOTICE_EDITOR);
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.click();
    await page.keyboard.type("알림장 드래그 블록선택 테스트");

    const box = await editor.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 20, { steps: 8 });
      await page.mouse.up();
      const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
      expect(selected.length, "드래그로 텍스트 선택됨").toBeGreaterThan(0);
    }
  });

  test("글상자 배경은 투명하고 평상시 테두리도 투명하다가 호버 시에만 나타난다", async ({ page }) => {
    const box = noticeBox(page);
    await expect(box).toBeVisible();

    await expect(box).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.mouse.move(10, 10);
    await expect(box).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");

    await box.hover();
    const borderColor = await box.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  // ── 과제 요소 서식 (색/정렬/크기) ────────────────────────────────────

  const HW = "[data-card-id='hw-notice']";

  /**
   * 과제 요소를 서식 대상으로 잡는다.
   * 대상 드롭다운만으로 충분하다 — 요소 자체를 클릭하면 편집 영역 한가운데가
   * 이름 span 이라 '제출 처리' 팝오버가 뜨고 그 backdrop 이 툴바를 덮는다(앱의 정상 동작).
   */
  async function targetHomework(page: Page) {
    const el = page.locator(HW);
    await expect(el).toBeVisible();
    await targetSelect(page).selectOption({ label: "과제: 서식대상과제" });
    return el;
  }
  test("과제 요소에 지정한 색/정렬/크기가 편집 화면에 반영된다", async ({ page }) => {
    const el = await targetHomework(page);
    const before = await el.evaluate((e) => getComputedStyle(e).color);
    expect(before).not.toBe("rgb(248, 113, 113)"); // #f87171 빨강

    // 기본 글자 크기는 전체 기본(42px) 그대로다
    await expect(el).toHaveCSS("font-size", "42px");

    await page.getByTitle("빨강").click();
    await page.getByTitle("가운데 정렬").click();
    await fontSizeSelect(page).selectOption("58");

    // 편집 화면에 실제로 반영된다
    await expect(el).toHaveCSS("color", "rgb(248, 113, 113)");
    await expect(el).toHaveCSS("text-align", "center");
    await expect(el).toHaveCSS("font-size", "58px");

    // 툴바도 그 요소의 실제 값을 되읽는다
    await expect(fontSizeSelect(page)).toHaveValue("58");
  });

  test("색을 바꾸면 과제 요소의 이름 토큰도 같은 색이 된다", async ({ page }) => {
    const el = await targetHomework(page);
    const name = el.locator("[data-worker-index]").first();
    await expect(name).toBeVisible();

    // 기본(테마) 색과 목표 색이 달라야 검증이 의미가 있다
    const themeColor = await name.evaluate((e) => getComputedStyle(e).color);
    await page.getByTitle("빨강").click();
    await expect(name).toHaveCSS("color", "rgb(248, 113, 113)");
    expect(await name.evaluate((e) => getComputedStyle(e).color)).not.toBe(themeColor);
  });

  test("편집 영역에 커서를 둔 상태로 색을 바꿔도 이름 색이 바로 바뀐다", async ({ page }) => {
    const el = await targetHomework(page);
    const name = el.locator("[data-worker-index]").first();

    // 편집 영역에 포커스 + 선택을 만든다 (툴바 버튼이 mousedown 을 막아 포커스가 유지된다)
    await page.evaluate(() => {
      const node = document.querySelector<HTMLElement>("[data-card-id='hw-notice']");
      if (!node) return;
      node.focus();
      const target = node.firstChild;
      if (!target) return;
      const r = document.createRange();
      r.setStart(target, 0);
      r.setEnd(target, Math.min(3, target.textContent?.length ?? 0));
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    });
    const focused = await el.evaluate((e) => document.activeElement === e);
    expect(focused, "편집 영역에 포커스가 있다").toBe(true);

    // 편집 중이어도 색은 즉시 반영되어야 한다
    await page.getByTitle("빨강").click();
    await expect(name).toHaveCSS("color", "rgb(248, 113, 113)");

    // 커서도 살아 있어야 텍스트 편집이 이어진다
    const stillFocused = await el.evaluate((e) => document.activeElement === e);
    expect(stillFocused, "포커스가 유지된다").toBe(true);
  });

  test("과제 요소에 서식을 걸어도 이름 토큰이 사라지지 않는다", async ({ page }) => {
    const el = await targetHomework(page);
    const names = el.locator("[data-worker-index]");
    const before = await names.count();
    expect(before, "미제출자 이름 토큰").toBeGreaterThan(0);

    // 편집 영역에 선택을 만들어 둔 상태로 서식 적용 (기존 회귀 재현 조건).
    // 요소 클릭은 이름 span 을 눌러 팝오버가 뜨므로 선택만 직접 만든다.
    await page.evaluate(() => {
      const node = document.querySelector("[data-card-id='hw-notice']")?.firstChild;
      if (!node) return;
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, Math.min(3, node.textContent?.length ?? 0));
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    });

    await page.getByTitle("가운데 정렬").click();
    await page.getByTitle("빨강").click();
    await page.getByTitle("오른쪽 정렬").click();

    // 이름 토큰이 그대로 남아 있어야 한다
    await expect(el.locator("[data-worker-index]")).toHaveCount(before);
    await expect(el).toContainText("미제출");

    // execCommand 가 끼어 넣은 외부 노드가 없어야 한다 (있으면 다음 렌더에서 토큰이 파괴된다)
    const injected = await el.evaluate((e) => e.querySelectorAll("div").length);
    expect(injected, "과제 본문 안에 임의 div 가 생기지 않는다").toBe(0);
  });

  test("과제 요소 서식이 학생 화면(전자칠판)에도 반영된다", async ({ page }) => {
    const el = await targetHomework(page);
    await page.getByTitle("빨강").click();
    await fontSizeSelect(page).selectOption("58");
    await expect(el).toHaveCSS("font-size", "58px");

    // 저장된 상태에도 반영되어 있어야 학생 화면이 따라온다
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("classroom_os_state_v3") ?? "{}";
      const parsed = JSON.parse(raw) as { homeworks: { id: string; layout?: { fontSize?: number; color?: string } }[] };
      return parsed.homeworks.find((h) => h.id === "hw-notice")?.layout ?? null;
    });
    expect(saved, "homeworks[].layout 에 저장").toMatchObject({ fontSize: 58, color: "#f87171" });

    // 학생 화면이 편집 화면과 같은 내용·같은 서식으로 그린다
    await page.goto("/board");
    const board = page.locator("[data-card-id='hw-notice']");
    await expect(board).toBeVisible();
    await expect(board).toHaveCSS("font-size", "58px");
    await expect(board).toHaveCSS("color", "rgb(248, 113, 113)");

    // 이름 토큰도 같은 색이어야 한다
    await expect(board.locator("[data-worker-index]").first()).toHaveCSS("color", "rgb(248, 113, 113)");

    // 편집 화면과 같은 템플릿(미제출 N명: 이름, 이름)이 그대로 나온다
    const boardText = (await board.innerText()).replace(/\s+/g, " ");
    expect(boardText).toContain("미제출 6명:");
    for (const n of NAMES) {
      if (n === "김철수" || n === "박민수") continue;
      expect(boardText, `학생 화면에 ${n} 표시`).toContain(n);
    }

    // 편집 화면에 없는 제목은 학생 화면에도 없어야 한다 (요소가 그대로 반영되어야 한다)
    expect(boardText, "학생 화면에 요소 제목이 없다").not.toContain("서식대상과제");
  });

  // ── 서식 대상 분리 ─────────────────────────────────────────

  type Colors = Record<string, string>;

  /** 칠판 각 요소의 현재 글자색 */
  async function elementColors(page: Page): Promise<Colors> {
    return page.evaluate(() => {
      const pick = (sel: string) => {
        const e = document.querySelector(sel);
        return e ? getComputedStyle(e).color : "-";
      };
      return {
        날짜: pick("#canvas-date-text"),
        시계: pick("#canvas-clock-text"),
        업무: pick(".routine-text-editor"),
        과제: pick("[data-card-id='hw-notice']"),
        알림장: pick("[data-placeholder='전달할 알림장 내용을 입력하세요...']"),
      };
    });
  }

  /** 두 측정 사이에서 색이 바뀐 요소 이름들 */
  function changedKeys(before: Colors, after: Colors): string[] {
    return Object.keys(after).filter((k) => after[k] !== before[k]);
  }

  /** 요소에는 transition-all 이 있어 전이 중 값을 읽게 된다. 도착할 때까지 폴링한다. */
  async function expectColor(page: Page, key: string, rgb: [number, number, number]) {
    await expect
      .poll(async () => isNearColor((await elementColors(page))[key], rgb), {
        timeout: 5000,
        message: `${key} 색이 ${rgb} 로 도달해야 한다`,
      })
      .toBe(true);
  }

  const RED: [number, number, number] = [248, 113, 113];

  /** 두 색이 같은 색인지 (알파/표기 차이는 무시) */
  function isSameColor(a: string, b: string): boolean {
    const parse = (c: string) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
    };
    const pa = parse(a);
    const pb = parse(b);
    if (!pa || !pb) return a === b;
    return (
      Math.abs(pa[0] - pb[0]) <= 2 &&
      Math.abs(pa[1] - pb[1]) <= 2 &&
      Math.abs(pa[2] - pb[2]) <= 2 &&
      Math.abs(pa[3] - pb[3]) <= 0.1
    );
  }

  function isNearColor(c: string, rgb: [number, number, number]): boolean {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c);
    if (!m) return false;
    return (
      Math.abs(Number(m[1]) - rgb[0]) <= 8 &&
      Math.abs(Number(m[2]) - rgb[1]) <= 8 &&
      Math.abs(Number(m[3]) - rgb[2]) <= 8
    );
  }

  test("개별 대상을 고르면 그 요소만 바뀌고 다른 요소는 그대로다", async ({ page }) => {
    const cases: [string, string][] = [
      ["날짜", "날짜"],
      ["시간/시계", "시계"],
      ["학생 업무", "업무"],
      ["과제: 서식대상과제", "과제"],
      ["자유 글상자 1", "알림장"],
    ];

    for (const [label, key] of cases) {
      const before = await elementColors(page);
      await targetSelect(page).selectOption({ label });
      await page.getByTitle("빨강").click();
      await expect
        .poll(async () => changedKeys(before, await elementColors(page)), { timeout: 5000 })
        .toContain(key);

      const after = await elementColors(page);
      expect(changedKeys(before, after), `대상 "${label}" 은 오직 그 요소만 바뀐다`).toEqual([key]);
      await expectColor(page, key, RED);

      // 원복 — 대상이 그대로라 방금 바꾼 요소만 돌아간다
      await page.getByTitle("흰색").click();
      await expect
        .poll(async () => isSameColor((await elementColors(page))[key], before[key]), {
          timeout: 5000,
          message: `${key} 원복`,
        })
        .toBe(true);
    }
  });

  /** 칠판 각 요소의 현재 글자 크기 + 정렬 */
  async function elementMetrics(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => {
      const pick = (sel: string) => {
        const e = document.querySelector(sel);
        if (!e) return "-";
        const cs = getComputedStyle(e);
        return `${cs.fontSize}|${cs.textAlign}`;
      };
      return {
        날짜: pick("#canvas-date-text"),
        시계: pick("#canvas-clock-text"),
        업무: pick(".routine-text-editor"),
        과제: pick("[data-card-id='hw-notice']"),
        알림장: pick("[data-placeholder='전달할 알림장 내용을 입력하세요...']"),
      };
    });
  }

  test("개별 대상의 글자 크기·정렬도 그 요소에만 적용된다", async ({ page }) => {
    const sizeSelect = page.locator("select").nth(1);
    const cases: [string, string][] = [
      ["날짜", "날짜"],
      ["시간/시계", "시계"],
      ["학생 업무", "업무"],
      ["과제: 서식대상과제", "과제"],
      ["자유 글상자 1", "알림장"],
    ];

    for (const [label, key] of cases) {
      // 정렬
      let before = await elementMetrics(page);
      await targetSelect(page).selectOption({ label });
      await page.getByTitle("가운데 정렬").click();
      await expect
        .poll(async () => changedKeys(before, await elementMetrics(page)), { timeout: 5000 })
        .toContain(key);
      expect(changedKeys(before, await elementMetrics(page)), `정렬은 "${label}" 만`).toEqual([key]);
      await page.getByTitle("왼쪽 정렬").click();

      // 글자 크기
      before = await elementMetrics(page);
      await sizeSelect.selectOption("58");
      await expect
        .poll(async () => changedKeys(before, await elementMetrics(page)), { timeout: 5000 })
        .toContain(key);
      expect(changedKeys(before, await elementMetrics(page)), `크기는 "${label}" 만`).toEqual([key]);
      await sizeSelect.selectOption("42");
    }
  });

  test("다른 요소를 편집해 둔 상태에서도 선택한 대상에만 적용된다", async ({ page }) => {
    // 편집 흔적(마지막 선택)이 남아 있는 상태가 재현 조건
    const notice = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await notice.click();
    await page.keyboard.type("본문 입력");
    await page.waitForTimeout(300);

    const sizeSelect = page.locator("select").nth(1);
    const cases: [string, string][] = [
      ["날짜", "날짜"],
      ["과제: 서식대상과제", "과제"],
    ];

    for (const [label, key] of cases) {
      const colorsBefore = await elementColors(page);
      await targetSelect(page).selectOption({ label });
      await page.getByTitle("빨강").click();
      await expect
        .poll(async () => changedKeys(colorsBefore, await elementColors(page)), { timeout: 5000 })
        .toContain(key);
      expect(
        changedKeys(colorsBefore, await elementColors(page)),
        `색은 "${label}" 만 (편집 흔적이 있어도)`
      ).toEqual([key]);
      await page.getByTitle("흰색").click();
      await expect
        .poll(async () => isSameColor((await elementColors(page))[key], colorsBefore[key]), {
          timeout: 5000,
        })
        .toBe(true);

      const metricsBefore = await elementMetrics(page);
      await sizeSelect.selectOption("58");
      await expect
        .poll(async () => changedKeys(metricsBefore, await elementMetrics(page)), { timeout: 5000 })
        .toContain(key);
      expect(
        changedKeys(metricsBefore, await elementMetrics(page)),
        `크기는 "${label}" 만 (편집 흔적이 있어도)`
      ).toEqual([key]);
      await sizeSelect.selectOption("42");
    }
  });

  test("전체 일괄 적용이면 날짜·시계·업무·과제·알림장이 모두 바뀐다", async ({ page }) => {
    const before = await elementColors(page);
    await targetSelect(page).selectOption({ label: "전체 일괄 적용" });
    await page.getByTitle("빨강").click();

    await expect
      .poll(async () => changedKeys(before, await elementColors(page)), { timeout: 5000 })
      .toEqual(expect.arrayContaining(["날짜", "시계", "업무", "과제", "알림장"]));

    const after = await elementColors(page);
    for (const key of Object.keys(after)) {
      expect(changedKeys(before, after), "일괄 적용이면 모두 바뀐다").toContain(key);
      await expectColor(page, key, RED);
    }
  });
});
