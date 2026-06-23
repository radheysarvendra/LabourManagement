/**
 * cronSync.js — runs Neon → Local sync every 24 hours
 * Run on your LOCAL machine: node scripts/cronSync.js
 */

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SCRIPT = path.join(__dirname, "syncLiveToLocal.js");
const LOG_FILE = path.join(__dirname, "..", "backups", "cron.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch { /* log file write failure is non-fatal */ }
}

function runSync() {
  log("Starting Neon → Local sync...");
  execFile(process.execPath, [SCRIPT, "--restore"], (error, stdout, stderr) => {
    if (stdout) stdout.trim().split("\n").forEach((l) => log("  " + l));
    if (stderr) stderr.trim().split("\n").forEach((l) => log("  WARN: " + l));
    if (error) {
      log(`Sync FAILED: ${error.message}`);
    } else {
      log("Sync complete ✓");
    }
    log(`Next sync in 24 hours (${new Date(Date.now() + SYNC_INTERVAL_MS).toLocaleString()})`);
  });
}

log("Cron sync started — schedule: every 24 hours");
log(`Log file: ${LOG_FILE}`);

// Run once immediately on start
runSync();

// Then every 24 hours
setInterval(runSync, SYNC_INTERVAL_MS);
