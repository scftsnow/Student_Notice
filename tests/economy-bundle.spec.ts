import { test, expect, type Page } from "@playwright/test";

/** 학급 화폐 탭의 모달 (fixed inset-0 래퍼) */
function modal(page: Page, text: string) {
  return page.locator("div.fixed").filter({ hasText: text }).last();
}

const NAMES = ["김철수", "이영희", "박민수", "최지은", "정도현", "강서연", "윤태호", "신예린"];

/**
 * 시드를 심는다. 이 테스트가 시드 없이 돌면 localStorage 가 비어 앱이 DB 스냅샷으로
 * 폴백하는데, 그 값은 다른 테스트가 남긴 것이라 세율/금액이 달라져 검증이 흔들린다.
 */
const SEED = {
  className: "우리 반",
  currencyName: "원",
  students: NAMES.map((name, i) => ({ no: i + 1, name, balance: 1000, gender: i % 2 ? "여" : "남" })),
  routines: [],
  treasuryBalance: 0,
  totalTaxCollected: 0,
};

const SEED_FLAG = "__economy_e2e_seeded";

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
  await page.goto("/economy");
});

const NAME_FIELD = "input[placeholder*='급식 당번비']";
const AMOUNT_FIELD = "input[placeholder*='금액']";

test.describe("복합 정산 수정/삭제 및 세금 자동 공제 E2E 테스트", () => {
  test("복합 정산 항목 추가, 수정 모달 오픈 및 삭제 동작 검증", async ({ page }) => {
    // 복합 정산 섹션과 추가 버튼 확인
    await expect(page.getByText("복합 정산", { exact: true })).toBeVisible();
    const addBtn = page.locator("button:has-text('+ 항목 추가')");
    await expect(addBtn).toBeVisible();

    // 앱에 기본 항목이 있을 수 있으므로 절대 개수 대신 증감으로 검증한다
    const list = page.locator("main");
    const rows = list.locator("button[aria-label='복합 정산 삭제']");
    const base = await rows.count();

    // 1. 항목 추가 모달 열기
    await addBtn.click();
    await expect(page.getByText("복합 정산 항목 등록")).toBeVisible();

    // 입력 필드 작성
    await page.fill(NAME_FIELD, "학급 청소 보상");
    await page.fill(AMOUNT_FIELD, "500");

    await page.click("button:has-text('복합 정산 등록')");

    // 2. 항목이 하나 늘고 이름이 보인다 (토스트와 겹치지 않도록 본문 영역 기준)
    await expect(rows).toHaveCount(base + 1);
    await expect(list.getByText("학급 청소 보상", { exact: true }).first()).toBeVisible();

    // 3. 수정 아이콘 버튼 확인 및 클릭
    const editBtn = list.locator("button[aria-label='복합 정산 수정']").first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 수정 모달 검증
    await expect(page.getByText("복합 정산 항목 수정")).toBeVisible();
    await expect(page.locator("button:has-text('수정 완료')")).toBeVisible();

    // 항목명 수정 — 이름이 바뀌고 항목 수는 그대로여야 한다 (새 항목이 생기면 안 된다)
    await page.fill(NAME_FIELD, "학급 청소 특급 보상");
    await page.click("button:has-text('수정 완료')");
    await expect(list.getByText("학급 청소 특급 보상", { exact: true }).first()).toBeVisible();
    await expect(rows).toHaveCount(base + 1);

    // 4. 삭제 아이콘 버튼 확인 및 삭제 실행
    const deleteBtn = rows.first();
    await expect(deleteBtn).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await deleteBtn.click();

    // 삭제 후 항목이 원래대로 줄어든다
    await expect(rows).toHaveCount(base);
    await expect(list.getByText("학급 청소 특급 보상", { exact: true }).first()).toBeHidden();
  });

  test("입금 시 세금 부과가 기본 켜져 있고 1인당 세금이 계산된다", async ({ page }) => {
    await page.locator("button:has-text('입금 / 차감')").first().click();

    const dlg = modal(page, "학생 화폐 입금 및 차감");
    await expect(dlg.getByText("학생 화폐 입금 및 차감")).toBeVisible();

    // 금액을 200원으로 고정 (기본값에 의존하지 않는다)
    await dlg.locator("input[type='number']").first().fill("200");

    // 세금 부과 체크박스는 기본 켜진 상태
    const tax = dlg.locator("input[type='checkbox']").first();
    await expect(tax).toBeChecked();
    await expect(dlg.getByText(/세금 부과 \(10% 국고 귀속\)/)).toBeVisible();

    // 200원에 10% → 1인당 20원 세금
    await expect(dlg.getByText(/1인당 세금 부과: 20 원/)).toBeVisible();

    await dlg.locator("button:has-text('취소')").click();
  });
});
