import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Test dei flussi principali sul sito in locale (database Supabase locale + npm run dev).
// Usa Microsoft Edge già presente su Windows: nessun browser da scaricare.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
