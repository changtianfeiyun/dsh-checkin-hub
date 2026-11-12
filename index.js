/**
 * Host half of the check-in hub bundle.
 *
 * The hub itself is a pure UI aggregator: it renders a sidebar panel in the Web
 * GUI and talks to the already-installed connect plugins over their loopback
 * HTTP routes (/plugins/dsh-connect-workbuddy/..., /plugins/dsh-connect-trae/...,
 * /plugins/dsh-connect-qoder/...). It owns no credentials and no upstream clients.
 *
 * This host half additionally owns two host-only duties a UI plugin cannot do
 * for itself:
 *
 * 1. POOL MEMBERSHIP — adding an account only stores the credential; every
 *    connect plugin keeps "which accounts take part in the daily check-in" in
 *    its own Config slot (regions.<region>.pool.memberAccountIds), and only the
 *    Host settings service can write that slot.
 *
 * 2. the DAILY AUTO CHECK-IN scheduler:
 *   - once the configured local time (default 10:00 Asia/Shanghai) has passed,
 *     it claims the daily credits on all three platforms;
 *   - a run missed while the app was closed is caught up on the next mount;
 *   - the panel reads GET /plugins/dsh-checkin-hub/schedule, changes the time or
 *     pauses it with POST .../schedule/settings, and triggers a run with
 *     POST .../schedule/run.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const API_BASE = "/plugins/dsh-checkin-hub";
const DEFAULT_TIME = "10:00";
const DEFAULT_TIMEZONE = "Asia/Shanghai";
const TICK_MS = 60000;

/** The claim routes, in the order the panel lists them. */
const PROVIDERS = [
  { key: "trae", label: "Trae", path: "/plugins/dsh-connect-trae/pool?action=checkin&region=cn" },
  { key: "workbuddy", label: "WorkBuddy", path: "/plugins/dsh-connect-workbuddy/pool?action=checkin&region=cn" },
  { key: "qoder", label: "Qoder", path: "/plugins/dsh-connect-qoder/checkin?region=qoder-cn" },
  { key: "minimax", label: "MiniMax Code", path: "/plugins/dsh-connect-minimax/api/checkin" },
];

function dataDir() {
  const override = process.env.DSH_CHECKIN_HUB_DATA_DIR;
  if (typeof override === "string" && override.trim().length > 0) return override.trim();
  return join(homedir(), ".dsh", "daily-checkin");
}

function statePath() {
  return join(dataDir(), "scheduler.json");
}

function minutesOf(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? "").trim());
  if (match === null) return Number.POSITIVE_INFINITY;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
}

/** Local wall clock of the configured zone: day key, minutes since midnight, HH:MM. */
function clockOf(timezone) {
  const now = new Date();
  let parts = null;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = null;
  }
  if (parts === null) {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const iso = local.toISOString();
    return {
      day: iso.slice(0, 10),
      minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
      localTime: iso.slice(11, 16),
    };
  }
  const pick = (type) => {
    const found = parts.find((part) => part.type === type);
    return found === undefined ? "" : found.value;
  };
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  return {
    day: pick("year") + "-" + pick("month") + "-" + pick("day"),
    minutes: hour * 60 + minute,
    localTime: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"),
  };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1000000) return;
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (text.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(text);
        resolve(parsed !== null && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Claim one platform. Both answer shapes are normalised to counts:
 * { rows: [{ status }] } for the pool platforms and
 * { claimed, alreadyClaimed } for the single-account Qoder route.
 */
async function claimOne(origin, provider) {
  const row = {
    provider: provider.key,
    label: provider.label,
    ok: false,
    httpStatus: 0,
    claimed: 0,
    already: 0,
    failed: 0,
  };
  let response;
  try {
    response = await fetch(origin + provider.path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: "{}",
    });
  } catch (error) {
    row.failed = 1;
    row.message = error?.message ?? String(error);
    return row;
  }
  row.httpStatus = response.status;
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    row.failed = 1;
    row.message = payload?.message ?? payload?.error ?? "HTTP " + response.status;
    return row;
  }
  const rows = Array.isArray(payload?.rows) ? payload.rows : null;
  if (rows !== null) {
    for (const item of rows) {
      const status = item?.status;
      if (status === "claimed") row.claimed += 1;
      else if (status === "already") row.already += 1;
      else row.failed += 1;
    }
    row.raw = rows.map((item) => ({
      accountName: item?.accountName,
      status: item?.status,
      credit: item?.credit,
    }));
    row.ok = row.failed === 0;
    return row;
  }
  if (payload?.claimed === true) row.claimed = 1;
  else if (payload?.alreadyClaimed === true) row.already = 1;
  else row.failed = 1;
  row.ok = row.claimed + row.already > 0;
  return row;
}

function createScheduler(ctx) {
  let config = { enabled: true, time: DEFAULT_TIME, timezone: DEFAULT_TIMEZONE };
  let lastRunDay = null;
  let lastRunAt = null;
  let lastResult = [];
  let lastSummary = null;
  let running = false;
  let timer = null;
  let bootTimer = null;
  let disposed = false;

  const snapshot = () => {
    const clock = clockOf(config.timezone);
    return {
      version: "1.1.0",
      enabled: config.enabled,
      time: config.time,
      timezone: config.timezone,
      localTime: clock.localTime,
      localDay: clock.day,
      due: config.enabled && clock.minutes >= minutesOf(config.time),
      doneToday: lastRunDay === clock.day,
      running,
      lastRunDay,
      lastRunAt,
      lastResult,
      lastSummary,
      providers: PROVIDERS.map((provider) => ({ key: provider.key, label: provider.label })),
      statePath: statePath(),
    };
  };

  const persist = async () => {
    const body = {
      enabled: config.enabled,
      time: config.time,
      timezone: config.timezone,
      lastRunDay,
      lastRunAt,
      lastResult,
      lastSummary,
    };
    try {
      await mkdir(dataDir(), { recursive: true });
      await writeFile(statePath(), JSON.stringify(body, null, 2) + "\n", "utf8");
    } catch (error) {
      ctx.logger?.warn?.(
        "dsh-checkin-hub: cannot persist scheduler state: " + (error?.message ?? String(error)),
      );
    }
  };

  const load = async () => {
    let stored = null;
    try {
      stored = JSON.parse(await readFile(statePath(), "utf8"));
    } catch {
      stored = null;
    }
    if (stored === null || typeof stored !== "object") return;
    if (typeof stored.enabled === "boolean") config.enabled = stored.enabled;
    if (/^\d{1,2}:\d{2}$/.test(String(stored.time ?? ""))) config.time = String(stored.time);
    if (typeof stored.timezone === "string" && stored.timezone.length > 0) config.timezone = stored.timezone;
    if (typeof stored.lastRunDay === "string") lastRunDay = stored.lastRunDay;
    if (typeof stored.lastRunAt === "string") lastRunAt = stored.lastRunAt;
    if (Array.isArray(stored.lastResult)) lastResult = stored.lastResult;
    if (stored.lastSummary !== null && typeof stored.lastSummary === "object") lastSummary = stored.lastSummary;
  };

  const run = async (manual) => {
    if (running) return { ok: false, reason: "running", schedule: snapshot() };
    running = true;
    const clock = clockOf(config.timezone);
    try {
      const origin = ctx.webServer.getOrigin();
      const results = [];
      for (const provider of PROVIDERS) results.push(await claimOne(origin, provider));
      const summary = { claimed: 0, already: 0, failed: 0 };
      for (const row of results) {
        summary.claimed += row.claimed;
        summary.already += row.already;
        summary.failed += row.failed;
      }
      lastResult = results;
      lastSummary = summary;
      lastRunAt = new Date().toISOString();
      // A manual run BEFORE the configured time must not consume today's slot:
      // the scheduled run still has to happen at the configured time.
      const counts = clock.minutes >= minutesOf(config.time) || manual !== true;
      if (counts) lastRunDay = clock.day;
      await persist();
      return { ok: true, manual, counted: counts, schedule: snapshot(), summary, results };
    } catch (error) {
      const message = error?.message ?? String(error);
      ctx.logger?.warn?.("dsh-checkin-hub: scheduled check-in failed: " + message);
      return { ok: false, reason: message, schedule: snapshot() };
    } finally {
      running = false;
    }
  };

  const tick = async () => {
    if (disposed || running || !config.enabled) return;
    const clock = clockOf(config.timezone);
    if (clock.minutes < minutesOf(config.time)) return;
    if (lastRunDay === clock.day) return;
    await run(false);
  };

  const saveSettings = async (patch) => {
    if (typeof patch?.enabled === "boolean") config.enabled = patch.enabled;
    if (typeof patch?.time === "string" && /^\d{1,2}:\d{2}$/.test(patch.time.trim())) {
      config.time = patch.time.trim();
    }
    if (typeof patch?.timezone === "string" && patch.timezone.trim().length > 0) {
      config.timezone = patch.timezone.trim();
    }
    await persist();
    return snapshot();
  };

  const start = () => {
    timer = setInterval(() => {
      void tick();
    }, TICK_MS);
    if (timer !== null && typeof timer.unref === "function") timer.unref();
    bootTimer = setTimeout(() => {
      void tick();
    }, 5000);
    if (bootTimer !== null && typeof bootTimer.unref === "function") bootTimer.unref();
  };

  const stop = () => {
    disposed = true;
    if (timer !== null) clearInterval(timer);
    if (bootTimer !== null) clearTimeout(bootTimer);
    timer = null;
    bootTimer = null;
  };

  return { snapshot, run, tick, saveSettings, start, stop, load };
}

/* ------------------------------------------------------------------ */
/* pool membership (host-only: only the settings service can write it)  */
/* ------------------------------------------------------------------ */

const MEMBERSHIP_PATH = "/plugins/dsh-checkin-hub/membership";

/** Package name whose Config row owns each platform's pool slot. */
const PLATFORM_PACKAGES = {
  workbuddy: "dsh-connect-workbuddy",
  trae: "dsh-connect-trae",
  qoder: "dsh-connect-qoder",
};

const REGION_PATTERN = /^[a-z][a-z0-9-]{0,23}$/;
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Config values may be schemastery volatiles; unwrap the reactive `.get()`. */
function unwrap(value) {
  if (value !== null && typeof value === "object" && typeof value.get === "function") {
    try {
      return value.get();
    } catch {
      return value;
    }
  }
  return value;
}

/** Same rule the connect plugins apply: an absent Origin is a local caller. */
function loopbackOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  return /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
}

function readBodyCapped(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on("data", (chunk) => {
      if (over) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        over = true;
        reject(new Error("request body too large"));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!over) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

/**
 * Find the Config row of one connect plugin.
 *
 * Loader entry ids are profile-scoped (`include:dsh-connect-qoder`), so the row
 * is matched by substring — exactly what the connect plugins do when they look
 * up their own namespace.
 */
function settingsRowOf(settings, packageName) {
  let rows = [];
  try {
    rows = settings.describe() ?? [];
  } catch {
    return undefined;
  }
  return rows.find((row) => String(row.ns ?? "").includes(packageName));
}

/**
 * Append or drop one account id in `regions.<region>.pool.memberAccountIds`.
 *
 * The write is a single path-level `set` of that array, so every sibling field
 * of the pool slot — `enabled`, `targetModelId`, `orderAccountIds`,
 * `probeInputTokens`, `autoCheckin` — keeps whatever the connect plugin put
 * there. Replacing the whole slot (what `__save` on the connect plugins does)
 * would silently reset the probe budget and the account order.
 */
async function updateMembership(settings, packageName, region, accountId, member) {
  const row = settingsRowOf(settings, packageName);
  if (row === undefined) {
    return { ok: false, status: 503, error: `${packageName} settings namespace is unavailable` };
  }
  const value = unwrap(row.value) ?? {};
  const regions = isPlainRecord(value.regions) ? value.regions : {};
  const slot = isPlainRecord(regions[region]) ? regions[region] : {};
  const pool = isPlainRecord(slot.pool) ? slot.pool : {};
  const current = Array.isArray(pool.memberAccountIds)
    ? pool.memberAccountIds.filter((id) => typeof id === "string" && id !== "")
    : [];

  if (!member && !current.includes(accountId)) {
    return { ok: true, status: 200, memberAccountIds: current };
  }
  if (member && current.includes(accountId)) {
    return { ok: true, status: 200, memberAccountIds: current };
  }

  const next = member ? [...current, accountId] : current.filter((id) => id !== accountId);
  const ops = [{ op: "set", path: ["regions", region, "pool", "memberAccountIds"], value: next }];
  // A pool whose switch is off would accept the id but still check in nothing.
  if (member && pool.enabled !== true) {
    ops.push({ op: "set", path: ["regions", region, "pool", "enabled"], value: true });
  }
  await settings.mutate(row.ns, ops, undefined);
  return { ok: true, status: 200, memberAccountIds: next };
}

function handleMembership(ctx) {
  return async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
    if (!loopbackOrigin(req)) return sendJson(res, 403, { error: "forbidden" });

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const platform = url.searchParams.get("platform") ?? "";
    const region = url.searchParams.get("region") ?? "cn";
    const packageName = PLATFORM_PACKAGES[platform];
    if (packageName === undefined) {
      return sendJson(res, 400, { error: "platform must be workbuddy, trae or qoder" });
    }
    if (!REGION_PATTERN.test(region)) {
      return sendJson(res, 400, { error: "region must be a lowercase region id" });
    }

    const settings = ctx.get?.("settings");
    if (settings === undefined) {
      return sendJson(res, 503, { error: "settings service is unavailable to this plugin" });
    }

    let body;
    try {
      const text = await readBodyCapped(req);
      body = text === "" ? {} : JSON.parse(text);
    } catch {
      return sendJson(res, 400, { error: "invalid JSON body" });
    }
    const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
    if (accountId === "" || accountId.length > 200) {
      return sendJson(res, 400, { error: "accountId must be a non-empty string" });
    }
    const member = body?.member !== false;

    try {
      const result = await updateMembership(settings, packageName, region, accountId, member);
      if (result.ok === false) {
        return sendJson(res, result.status ?? 500, { error: result.error ?? "pool write failed" });
      }
      return sendJson(res, 200, {
        ok: true,
        platform,
        region,
        accountId,
        member,
        memberAccountIds: result.memberAccountIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return sendJson(res, 500, { error: message });
    }
  };
}


export function apply(ctx) {
  ctx.inject(["webServer"], (webCtx) => {
    const scheduler = createScheduler(webCtx);
    const ready = scheduler.load().then(() => {
      scheduler.start();
    });

    const disposeSchedule = webCtx.webServer.register({
      kind: "exact",
      path: API_BASE + "/schedule",
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
        await ready;
        json(res, 200, scheduler.snapshot());
      },
    });

    const disposeRun = webCtx.webServer.register({
      kind: "exact",
      path: API_BASE + "/schedule/run",
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
        await ready;
        const answer = await scheduler.run(true);
        json(res, answer.ok ? 200 : 409, answer);
      },
    });

    const disposeSettings = webCtx.webServer.register({
      kind: "exact",
      path: API_BASE + "/schedule/settings",
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
        await ready;
        const patch = await readBody(req);
        json(res, 200, await scheduler.saveSettings(patch));
      },
    });

    // Pool membership: the panel posts here after an account is added, and when
    // the user joins an out-of-pool account back in.
    const disposeMembership = webCtx.webServer.register({
      kind: "exact",
      path: MEMBERSHIP_PATH,
      handler: handleMembership(ctx),
    });

    webCtx.effect(() => () => {
      disposeSchedule();
      disposeRun();
      disposeSettings();
      disposeMembership();
      scheduler.stop();
    });

    ctx.logger?.info?.(
      "dsh-checkin-hub: daily auto check-in scheduler + pool membership mounted",
    );
  });

  ctx.effect(() => {
    ctx.logger?.info?.("dsh-checkin-hub: panel served by dsh-checkin-hub/client.js");
  }, "dsh-checkin-hub: announce mount");
}
