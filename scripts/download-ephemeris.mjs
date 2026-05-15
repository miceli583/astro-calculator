#!/usr/bin/env node
// Downloads the Swiss Ephemeris data files needed by sweph at runtime.
// Defaults to a small, accurate range (1800–2399 CE) sufficient for natal/transit
// charts of any living person and any near-future event. Override with EPHE_RANGE=full.
//
// Source: https://github.com/aloistr/swisseph/tree/master/ephe (official Astrodienst mirror).
// Files are AGPL-3.0, same as our project.

import { existsSync, mkdirSync, statSync, createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EPHE_DIR = join(__dirname, "..", "ephemeris");
const QUIET = process.argv.includes("--quiet");
const BASE = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe";

// Modern range: 1800 CE – 2399 CE. Covers everyone alive and near-future predictions.
// Each file is ~420KB. Total ~5MB.
const FILES = [
  "sepl_18.se1", // planets 1800–2399
  "semo_18.se1", // moon 1800–2399
  "seas_18.se1", // main asteroids 1800–2399
  "seplm18.se1", // planets minus (just in case some libs probe)
  "semom18.se1",
  "seasm18.se1",
];

// Optional historical files (uncomment or set EPHE_RANGE=full to fetch).
const HISTORICAL = [
  "sepl_12.se1",
  "semo_12.se1",
  "seas_12.se1",
  "sepl_24.se1",
  "semo_24.se1",
  "seas_24.se1",
];

const log = (msg) => {
  if (!QUIET) console.log(msg);
};

async function downloadFile(name) {
  const dest = join(EPHE_DIR, name);
  if (existsSync(dest) && statSync(dest).size > 1024) {
    log(`  ✓ ${name} (cached)`);
    return;
  }
  const url = `${BASE}/${name}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      log(`  - ${name} (not in upstream, skipping)`);
      return;
    }
    throw new Error(`Failed to fetch ${name}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(dest);
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end(buf);
  });
  log(`  ↓ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!existsSync(EPHE_DIR)) mkdirSync(EPHE_DIR, { recursive: true });

  const files = process.env.EPHE_RANGE === "full" ? [...FILES, ...HISTORICAL] : FILES;

  log(`\nFetching ${files.length} Swiss Ephemeris data file(s) → ${EPHE_DIR}`);
  for (const name of files) {
    try {
      await downloadFile(name);
    } catch (err) {
      // Don't fail install if network is unavailable. The app still runs;
      // just calls that need ephemeris will return an actionable error.
      console.warn(`  ! ${name}: ${err.message}`);
    }
  }
  log(`Done.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(0); // never fail install
});
