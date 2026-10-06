import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    channel: "chrome",
  },
  // 뽑기 e2e 는 실제 별도 창(전광판)을 열고 BroadcastChannel 로 통신한다.
  // 워커가 많으면 창 열기와 롤 요청이 서로를 밀어 실패하므로 worker 를 제한한다.
  workers: 2,
  timeout: 90_000,
});
