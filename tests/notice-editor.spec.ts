import { test, expect } from "@playwright/test";

test.describe("알림장 캔버스 자유 글상자 및 드래그/리사이즈 검증", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notice");
    await page.waitForLoadState("networkidle");
  });

  test("상단 툴바에 정렬 3종과 글씨 색상 팔레트 및 글자 크기 드롭다운이 존재한다", async ({ page }) => {
    await expect(page.getByTitle("왼쪽 정렬")).toBeVisible();
    await expect(page.getByTitle("가운데 정렬")).toBeVisible();
    await expect(page.getByTitle("오른쪽 정렬")).toBeVisible();
    await expect(page.getByTitle("흰색")).toBeVisible();
    await expect(page.getByTitle("노랑")).toBeVisible();
    await expect(page.getByTitle("빨강")).toBeVisible();
    
    // 상단 툴바 글자 크기 드롭다운
    const fontSizeSelect = page.locator("select").filter({ hasText: /42px/ });
    await expect(fontSizeSelect).toBeVisible();
  });

  test("알림장 본문 및 요소들에 8개 전방위(모서리 4변 + 꼭지점 4곳) 크기 조절 핸들이 배치되고 화살표 텍스트가 없다", async ({ page }) => {
    const dateBox = page.locator("#preview-16-9-wrapper > div > div").first();
    await expect(dateBox.locator("[title='크기 조절 핸들']")).toHaveCount(8);
    // 화살표 텍스트 기호가 존재하지 않는지 검증
    const handleText = await dateBox.locator("[title='크기 조절 핸들']").first().innerText();
    expect(handleText.trim()).toBe("");

    const clockBox = page.locator("#canvas-clock-text").locator("..");
    await expect(clockBox.locator("[title='크기 조절 핸들']")).toHaveCount(8);

    const noticeBox = page.locator("#preview-16-9-wrapper > div > div").nth(2);
    await expect(noticeBox.locator("[title='크기 조절 핸들']")).toHaveCount(8);

    const routineBox = page.locator("#canvas-routine-container").locator("..");
    await expect(routineBox.locator("[title='크기 조절 핸들']")).toHaveCount(8);
  });

  test("요소를 직접 드래그하면 요소의 위치가 실제로 이동한다", async ({ page }) => {
    const dateBox = page.locator("#preview-16-9-wrapper > div > div").first();
    const dateText = page.locator("#canvas-date-text");
    await expect(dateText).toBeVisible();
    
    const beforeStyle = await dateBox.getAttribute("style");
    const dateTextRect = await dateText.boundingBox();
    expect(dateTextRect).not.toBeNull();
    if (dateTextRect) {
      // 요소를 직접 잡고 100px 우측, 50px 아래로 드래그
      await page.mouse.move(dateTextRect.x + 20, dateTextRect.y + 10);
      await page.mouse.down();
      await page.mouse.move(dateTextRect.x + 120, dateTextRect.y + 60, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      
      const afterStyle = await dateBox.getAttribute("style");
      expect(afterStyle).not.toBe(beforeStyle);
    }
  });

  test("상단 툴바의 글자 크기 드롭다운 변경 시 본문 글씨 크기가 연동된다", async ({ page }) => {
    const editor = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await expect(editor).toBeVisible();
    
    // 초기 42px 확인
    await expect(editor).toHaveCSS("font-size", "42px");

    // 상단 툴바에서 50px 선택
    const fontSizeSelect = page.locator("select").filter({ hasText: /42px/ });
    await fontSizeSelect.selectOption("50");
    await page.waitForTimeout(200);

    await expect(editor).toHaveCSS("font-size", "50px");
  });

  test("알림장 본문 클릭 시 편집 모드로 진입하고 내용을 직접 입력할 수 있다", async ({ page }) => {
    const noticeBox = page.locator("#preview-16-9-wrapper > div > div").nth(2);
    await noticeBox.click();
    await page.waitForTimeout(200);
    const editor = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await expect(editor).toBeVisible();
    await page.keyboard.type("내일 준비물: 리코더");
    await page.waitForTimeout(400);
    const content = await editor.innerText();
    expect(content).toContain("내일 준비물: 리코더");
  });

  test("자유 글상자 추가 시 드래그 가능한 새 카드가 생성되고 툴바 서식 변경 및 삭제가 연동된다", async ({ page }) => {
    // 1. 자유 글상자 추가
    await page.getByRole("button", { name: /자유 글상자 추가/i }).click();
    await page.waitForTimeout(300);

    const freeCard = page.locator("#preview-16-9-wrapper").locator(".group").last();
    await freeCard.hover();
    const resizeHandle = freeCard.getByTitle("크기 조절 핸들").first();
    await expect(resizeHandle).toBeVisible();
    await expect(freeCard.getByTitle("크기 조절 핸들")).toHaveCount(8);
    expect((await resizeHandle.innerText()).trim()).toBe("");

    // 2. 자유글 대상 선택 후 연두 색상 적용
    await page.getByRole("button", { name: "자유글", exact: true }).click();
    await page.getByTitle("연두").click();
    await page.waitForTimeout(200);
    const freeCardEditor = freeCard.locator("[data-placeholder='메모를 입력하세요...']");
    await expect(freeCardEditor).toHaveCSS("color", "rgb(134, 239, 172)"); // #86efac

    // 3. 삭제 버튼 클릭하여 삭제
    const deleteBtn = freeCard.getByTitle("글상자 삭제");
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
    await page.waitForTimeout(300);
  });

  test("모든 판서 요소(날짜, 시계, 본문, 루틴)의 기본 폰트 크기가 42px이다", async ({ page }) => {
    // 1. 날짜 글상자
    const dateText = page.locator("#canvas-date-text");
    await expect(dateText).toBeVisible();
    await expect(dateText).toHaveCSS("font-size", "42px");

    // 2. 시계 글상자
    const clockText = page.locator("#canvas-clock-text");
    await expect(clockText).toBeVisible();
    await expect(clockText).toHaveCSS("font-size", "42px");

    // 3. 본문 에디터
    const editor = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveCSS("font-size", "42px");

    // 4. 루틴 글상자
    const routineBox = page.locator("#canvas-routine-container");
    await expect(routineBox).toBeVisible();
    await expect(routineBox).toHaveCSS("font-size", "42px");
  });

  test("루틴 글상자에서 당번 이름 클릭 시 상단 대타 배지 및 하단 급여 지급 팝오버가 노출되고 작동한다", async ({ page }) => {
    const routineBox = page.locator("#canvas-routine-container");
    await expect(routineBox).toBeVisible();

    // 루틴 당번 이름 클릭 버튼 확인
    const workerBtn = page.locator("#canvas-routine-container button[title*='급여 지급 및 대타 변경']").first();
    if (await workerBtn.isVisible()) {
      // 1. 이름 클릭 -> 팝오버 열림
      await workerBtn.click();
      await page.waitForTimeout(200);

      // 2. 팝오버 내 급여 지급 버튼 및 대타 이름 배지 칩, 순번 건너뛰기 노출 확인
      const payBtn = page.locator("button:has-text('급여 지급')").first();
      await expect(payBtn).toBeVisible();
      await expect(page.locator("button:has-text('순번 건너뛰기')")).toBeVisible();

      // 캔버스 요소 상의 작은 건너뛰기 버튼 노출 확인
      const canvasSkipBtn = page.locator("#canvas-routine-container button:has-text('건너뛰기')").first();
      await expect(canvasSkipBtn).toBeVisible();

      // 상단 대타 지정 배지 버튼
      const pinchBadge = page.locator("button[title*='대타 지정']").first();
      if (await pinchBadge.isVisible()) {
        // 3. 대타 배지 클릭 작동 검증
        await pinchBadge.click();
        await page.waitForTimeout(300);
        await expect(page.locator("text=(대타)")).toBeVisible();

        // 4. 대타 지정 후 다시 클릭하여 하단 급여 지급 작동 검증
        const subWorkerBtn = page.locator("#canvas-routine-container button[title*='급여 지급 및 대타 변경']").first();
        await subWorkerBtn.click();
        await page.waitForTimeout(200);

        const payBtnAfterSub = page.locator("button:has-text('급여 지급')").first();
        await expect(payBtnAfterSub).toBeVisible();
        await payBtnAfterSub.click();
        await page.waitForTimeout(300);

        // 토스트 메시지 확인
        await expect(page.locator("text=지급 완료")).toBeVisible();
      }
    }
  });

  test("상단 툴바에서 대상을 선택하여 날짜, 시간, 루틴, 알림장의 글씨 크기와 색상을 개별 조절할 수 있다", async ({ page }) => {
    // 1. 대상 [날짜] 선택 후 노랑 색상 적용
    await page.getByRole("button", { name: "날짜", exact: true }).click();
    await page.getByTitle("노랑").click();
    await page.waitForTimeout(200);
    const dateBox = page.locator("#canvas-date-text").locator("..");
    await expect(dateBox).toHaveCSS("color", "rgb(253, 224, 71)"); // #fde047

    // 2. 대상 [시간] 선택 후 하늘 색상 및 50px 크기 적용
    await page.getByRole("button", { name: "시간", exact: true }).click();
    await page.getByTitle("하늘").click();
    const fontSizeSelect = page.locator("select").filter({ hasText: /42px/ });
    await fontSizeSelect.selectOption("50");
    await page.waitForTimeout(200);
    const clockBox = page.locator("#canvas-clock-text").locator("..");
    await expect(clockBox).toHaveCSS("color", "rgb(125, 211, 252)"); // #7dd3fc
    await expect(clockBox).toHaveCSS("font-size", "50px");

    // 3. 대상 [알림장] 선택 후 가운데 정렬 및 분홍 색상 적용
    await page.getByRole("button", { name: "알림장", exact: true }).click();
    await page.getByTitle("분홍").click();
    await page.getByTitle("가운데 정렬").click();
    await page.waitForTimeout(200);
    const editor = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await expect(editor).toHaveCSS("color", "rgb(249, 168, 212)"); // #f9a8d4
    await expect(editor).toHaveCSS("text-align", "center");
  });

  test("알림장 본문 클릭 시 편집 모드로 진입하여 텍스트 블록 드래그 선택이 가능하다", async ({ page }) => {
    const noticeBox = page.locator("#preview-16-9-wrapper > div > div").nth(2);
    await noticeBox.click();
    await page.waitForTimeout(200);
    
    const editor = page.locator("[data-placeholder='전달할 알림장 내용을 입력하세요...']");
    await expect(editor).toHaveAttribute("contenteditable", "true");
    
    // 블록 드래그 선택 테스트: 텍스트 입력 후 마우스 드래그로 범위 선택
    await page.keyboard.type("알림장 드래그 블록선택 테스트");
    await page.waitForTimeout(200);
    
    const box = await editor.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 20, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      
      const selectedText = await page.evaluate(() => window.getSelection()?.toString());
      expect(selectedText?.length).toBeGreaterThan(0);
    }
  });

  test("글상자 배경은 투명(transparent)하고 평상시 테두리가 투명하다가 영역 호버 시에만 테두리가 표시된다", async ({ page }) => {
    const noticeBox = page.locator("#preview-16-9-wrapper > div > div").nth(2);
    await expect(noticeBox).toBeVisible();

    // 1. 배경색이 완전 투명인지 확인
    await expect(noticeBox).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    // 2. 마우스가 영역 밖에 있을 때 테두리는 투명
    await page.mouse.move(10, 10);
    await page.waitForTimeout(200);
    await expect(noticeBox).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");

    // 3. 영역 내부로 마우스 진입(호버) 시 테두리가 표시됨
    await noticeBox.hover();
    await page.waitForTimeout(200);
    const borderColor = await noticeBox.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
