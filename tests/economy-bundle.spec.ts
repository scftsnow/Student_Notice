import { test, expect } from "@playwright/test";

test.describe("복합 정산 수정/삭제 및 세금 자동 공제 E2E 테스트", () => {
  test("복합 정산 항목 추가, 수정 모달 오픈 및 삭제 동작 검증", async ({ page }) => {
    await page.goto("/economy");

    // 복합 정산 헤더 및 버튼 확인
    await expect(page.getByText("복합 정산", { exact: true })).toBeVisible();
    const addBtn = page.locator("button:has-text('+ 항목 추가')");
    await expect(addBtn).toBeVisible();

    // 1. 항목 추가 모달 열기
    await addBtn.click();
    await expect(page.locator("text=복합 정산 항목 등록")).toBeVisible();

    // 입력 필드 작성
    await page.fill('input[placeholder*="급식 당번비"]', "학급 청소 보상");
    await page.fill('input[placeholder="금액"]', "500");

    // 저장 클릭
    await page.click("button:has-text('복합 정산 등록')");

    // 2. 등록된 항목 확인
    await expect(page.locator("text=학급 청소 보상")).toBeVisible();

    // 3. Lucide 수정(Pencil) 아이콘 버튼 확인 및 클릭
    const editBtn = page.locator('button[aria-label="복합 정산 수정"]').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // 수정 모달 검증
    await expect(page.locator("text=복합 정산 항목 수정")).toBeVisible();
    await expect(page.locator("button:has-text('수정 완료')")).toBeVisible();

    // 항목명 수정
    await page.fill('input[placeholder*="급식 당번비"]', "학급 청소 특급 보상");
    await page.click("button:has-text('수정 완료')");

    // 수정 결과 반영 확인
    await expect(page.locator("text=학급 청소 특급 보상")).toBeVisible();

    // 4. Lucide 삭제(Trash2) 아이콘 버튼 확인 및 삭제 실행
    const deleteBtn = page.locator('button[aria-label="복합 정산 삭제"]').first();
    await expect(deleteBtn).toBeVisible();

    // confirm 다이얼로그 수락
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await deleteBtn.click();

    // 삭제 후 항목 미노출 검증
    await expect(page.locator("text=학급 청소 특급 보상")).not.toBeVisible();
  });

  test("특별 입금 시 세금 자동 공제 체크박스가 기본 활성화되어 있고 예상 세액이 계산된다", async ({ page }) => {
    await page.goto("/economy");

    // 입금 / 차감 버튼 클릭
    const depositBtn = page.locator("button:has-text('입금 / 차감')").first();
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    await expect(page.locator("text=학생 화폐 입금 및 차감")).toBeVisible();

    // 세금 공제 체크박스 확인 (기본 checked)
    const taxCheckbox = page.locator("input[type='checkbox']").last();
    await expect(taxCheckbox).toBeChecked();

    // 예상 세액 텍스트 노출 확인
    await expect(page.locator("text=1인당 예상 세액")).toBeVisible();

    await page.click("button:has-text('취소')");
  });
});
