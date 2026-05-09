#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.FAKE_STATUSPAGE_HOST ?? "127.0.0.1";
const port = process.env.FAKE_STATUSPAGE_PORT ?? "8787";
const fakeUrl = `http://${host}:${port}`;

const fake = spawn(process.execPath, ["scripts/fake-statuspage.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    FAKE_STATUSPAGE_HOST: host,
    FAKE_STATUSPAGE_PORT: port,
  },
});

const tauri = spawn("npm", ["run", "tauri:dev"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_FAKE_STATUSPAGE_URL: fakeUrl,
  },
});

let exiting = false;

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  fake.kill("SIGTERM");
  tauri.kill("SIGTERM");
  process.exit(code);
}

fake.on("exit", (code, signal) => {
  if (!exiting) {
    console.error(`[tauri-dev-fake] fake server exited: ${signal ?? code}`);
    shutdown(code ?? 1);
  }
});

tauri.on("exit", (code, signal) => {
  if (!exiting) {
    console.error(`[tauri-dev-fake] tauri dev exited: ${signal ?? code}`);
    shutdown(code ?? 0);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
