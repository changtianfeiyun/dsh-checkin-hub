/**
 * Host half of the check-in hub bundle.
 *
 * The hub is a pure UI aggregator: it renders a sidebar panel in the Web GUI and
 * talks to the already-installed connect plugins over their loopback HTTP routes
 * (`/plugins/dsh-connect-workbuddy/...`, `/plugins/dsh-connect-trae/...`,
 * `/plugins/dsh-connect-qoder/...`). It owns no credentials, no tokens and no
 * upstream clients.
 *
 * The one thing a UI-only plugin cannot do for itself is **pool membership**.
 * Adding an account (`/accounts?action=add`, or an OAuth poll) only stores the
 * credential; every connect plugin keeps "which accounts take part in the daily
 * check-in" in its own Config slot (`regions.<region>.pool.memberAccountIds`),
 * and only the Host `settings` service can write that slot. So this half serves
 * one narrow route that appends or removes a single account id in that slot and
 * leaves every sibling field untouched.
 */

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

function readBody(req) {
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
      const text = await readBody(req);
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
  ctx.effect(() => {
    const web = ctx.get?.("webServer");
    if (web === undefined || typeof web.register !== "function") {
      ctx.logger?.info?.("dsh-checkin-hub: no webServer here, panel-only mount");
      return () => {};
    }
    // `exact` keeps the path ours alone; a second registration would throw.
    return web.register({ kind: "exact", path: MEMBERSHIP_PATH, handler: handleMembership(ctx) });
  }, "dsh-checkin-hub: pool membership route");
}
