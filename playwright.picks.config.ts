import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/picks",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    screenshot: "only-on-failure",
  },
  timeout: 90000,
});
