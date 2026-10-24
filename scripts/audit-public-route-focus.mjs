import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";

const projectRoot = path.resolve(import.meta.dirname, "..");
const ledgerPath = path.join(projectRoot, "Route_Certification_Ledger_2026-08-27.md");
const baseUrl = (process.env.AUDIT_BASE_URL || "https://lumafoundry.live").replace(/\/$/, "");
const executablePath = process.env.CHROMIUM_PATH || "/usr/bin/chromium";
const concurrency = Math.max(1, Math.min(Number(process.env.AUDIT_CONCURRENCY || 4), 6));
const navigationTimeoutMs = Math.max(5_000, Number(process.env.AUDIT_TIMEOUT_MS || 30_000));

function readRoutes(ledger) {
  const routes = ledger
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => ({
      number: cells[1],
      brand: cells[2],
      route: cells[4].replace(/`/g, ""),
    }));

  if (routes.length !== 50 || new Set(routes.map((item) => item.route)).size !== 50) {
    throw new Error(`Expected 50 unique official routes in the ledger; found ${routes.length}.`);
  }

  return routes;
}

async function inspectRoute(browser, item) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    const response = await page.goto(`${baseUrl}${item.route}`, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeoutMs,
    });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const tabSequence = [];
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("Tab");
      await new Promise((resolve) => setTimeout(resolve, 25));
      tabSequence.push(await page.evaluate(() => {
        const active = document.activeElement;
        const activeStyle = active instanceof HTMLElement ? getComputedStyle(active) : null;

        return active instanceof HTMLElement
          ? {
              tag: active.tagName,
              text: (active.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
              href: active.getAttribute("href"),
              ariaLabel: active.getAttribute("aria-label"),
              className: typeof active.className === "string" ? active.className : "",
              focusVisible: active.matches(":focus-visible"),
              visuallyFocused: active.matches(":focus-visible") || activeStyle?.outlineStyle !== "none" || activeStyle?.boxShadow !== "none",
              outlineStyle: activeStyle?.outlineStyle || null,
              outlineWidth: activeStyle?.outlineWidth || null,
              boxShadow: activeStyle?.boxShadow || null,
            }
          : null;
      }));
    }

    const pageState = await page.evaluate(() => {
      const hashLinks = [...document.querySelectorAll('a[href^="#"]')];
      const missingTargets = hashLinks
        .map((link) => link.getAttribute("href"))
        .filter((href) => href && href !== "#")
        .filter((href) => !document.getElementById(href.slice(1)));

      return {
        title: document.title,
        mains: document.querySelectorAll("main, [role='main']").length,
        hashLinkCount: hashLinks.length,
        missingTargets,
      };
    });

    return {
      ...item,
      url: `${baseUrl}${item.route}`,
      httpStatus: response?.status() ?? null,
      ok: response?.ok() ?? false,
      pageErrors,
      consoleErrors,
      ...pageState,
      firstFocusable: tabSequence[0] ?? null,
      tabSequence,
      auditError: null,
    };
  } catch (error) {
    return {
      ...item,
      url: `${baseUrl}${item.route}`,
      httpStatus: null,
      ok: false,
      title: null,
      mains: 0,
      hashLinkCount: 0,
      missingTargets: [],
      firstFocusable: null,
      tabSequence: [],
      pageErrors,
      consoleErrors,
      auditError: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runWithConcurrency(items, handler) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor++];
      results.push(await handler(current));
    }
  });
  await Promise.all(workers);
  return results.sort((a, b) => Number(a.number) - Number(b.number));
}

function hasVisibleKeyboardSequence(item) {
  if (!item.firstFocusable?.focusVisible || item.tabSequence.length === 0) return false;

  const cycleIndex = item.tabSequence.findIndex((control) => control?.tag === "BODY");
  const focusStops = cycleIndex === -1 ? item.tabSequence : item.tabSequence.slice(0, cycleIndex);

  return focusStops.length > 0 && focusStops.every((control) => control?.visuallyFocused);
}

const ledger = await fs.readFile(ledgerPath, "utf8");
const routes = readRoutes(ledger);
const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

try {
  const routesAudit = await runWithConcurrency(routes, (item) => inspectRoute(browser, item));
  const failures = routesAudit.filter((item) =>
    !item.ok ||
    item.auditError ||
    item.mains === 0 ||
    item.missingTargets.length > 0 ||
    item.tabSequence.length !== 6 ||
    !hasVisibleKeyboardSequence(item) ||
    item.pageErrors.length > 0,
  );
  const summary = {
    routeCount: routesAudit.length,
    reachable: routesAudit.filter((item) => item.ok).length,
    mainLandmarks: routesAudit.filter((item) => item.mains > 0).length,
    validHashTargets: routesAudit.filter((item) => item.missingTargets.length === 0).length,
    keyboardFocusVisible: routesAudit.filter((item) => item.firstFocusable?.focusVisible).length,
    visibleKeyboardSequence: routesAudit.filter(hasVisibleKeyboardSequence).length,
    naturalFocusCycles: routesAudit.filter((item) => item.tabSequence.some((control) => control?.tag === "BODY")).length,
    noPageErrors: routesAudit.filter((item) => item.pageErrors.length === 0).length,
    issueCount: failures.length,
  };
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewport: { width: 1280, height: 720 },
    summary,
    failures,
    routes: routesAudit,
  }, null, 2));
} finally {
  await browser.close();
}
