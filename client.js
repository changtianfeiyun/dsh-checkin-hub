/**
 * Client half of the check-in hub.
 *
 * A single sidebar panel that aggregates the daily check-in and credit state of
 * the three agent tools the user runs locally:
 *
 *   WorkBuddy  -> /plugins/dsh-connect-workbuddy/...
 *   Trae       -> /plugins/dsh-connect-trae/...
 *   Qoder      -> /plugins/dsh-connect-qoder/...
 *
 * All reads and writes go through the loopback HTTP routes owned by the
 * installed connect plugins. This bundle stores no credential and never talks to
 * a platform API directly.
 */
window.__ModuleLoader__.load({
  id: "dsh-checkin-hub",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    /* ------------------------------------------------------------------ */
    /* styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS_ID = "dsh-checkin-hub/client.css";

    const HUB_CSS = `
.dshck-page{box-sizing:border-box;height:100%;width:100%;display:flex;flex-direction:column;gap:18px;padding:26px clamp(20px,3.4vw,44px) 44px;overflow:auto;color:var(--dsw-alias-label-primary,#e6e6e6)}
.dshck-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.dshck-head-main{display:flex;flex-direction:column;gap:6px;min-width:0}
.dshck-back{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:8px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;align-self:flex-start;font-size:13px;line-height:20px}
.dshck-back:hover{color:var(--dsw-alias-label-primary)}
.dshck-back-caret{width:7px;height:7px;border-left:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(45deg)}
.dshck-title{margin:0;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-.3px}
.dshck-desc{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.dshck-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshck-btn{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:7px 14px;font-size:13px;line-height:20px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);display:inline-flex;align-items:center;gap:6px}
.dshck-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.dshck-btn:disabled{opacity:.55;cursor:default}
.dshck-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff;font-weight:600}
.dshck-btn-primary:hover:not(:disabled){filter:brightness(1.08)}
.dshck-btn-ghost{background:transparent}
.dshck-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dshck-btn-sm{padding:3px 9px;font-size:12px;line-height:18px;border-radius:6px}
.dshck-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:0.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dshck-stat{display:flex;flex-direction:column;gap:2px;padding:12px 14px;min-width:0}
.dshck-stat + .dshck-stat{border-left:0.5px solid var(--dsw-alias-border-l2)}
.dshck-stat-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dshck-stat-value{font-size:19px;line-height:26px;font-weight:650;font-variant-numeric:tabular-nums}
.dshck-stat-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);opacity:.85}
.dshck-cards{display:flex;flex-direction:column;gap:14px}
.dshck-card{border:0.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;overflow:hidden}
.dshck-card-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}
.dshck-brand{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex:none;letter-spacing:.2px}
.dshck-brand-wb{background:linear-gradient(135deg,#3D7BF7,#5B4BE8)}
.dshck-brand-trae{background:linear-gradient(135deg,#12141A,#3B4252)}
.dshck-brand-qoder{background:linear-gradient(135deg,#0EA5A0,#1F7AE0)}
.dshck-card-titles{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 180px}
.dshck-card-name{font-size:15px;line-height:22px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshck-card-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshck-card-metrics{display:flex;align-items:baseline;gap:6px;font-variant-numeric:tabular-nums}
.dshck-metric-value{font-size:20px;line-height:26px;font-weight:650}
.dshck-metric-unit{font-size:11px;color:var(--dsw-alias-label-secondary)}
.dshck-card-body{display:flex;flex-direction:column}
.dshck-empty{padding:16px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:6px}
.dshck-rows{display:flex;flex-direction:column}
.dshck-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 16px;border-top:0.5px solid var(--dsw-alias-border-l2)}
.dshck-row:first-child{border-top:0}
.dshck-row-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.dshck-row-name{font-size:13px;line-height:19px;font-weight:550;display:flex;align-items:center;gap:6px;min-width:0}
.dshck-row-name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshck-row-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;flex-wrap:wrap}
.dshck-row-credits{font-size:14px;line-height:20px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.dshck-row-side{display:flex;align-items:center;gap:6px}
.dshck-badge{font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;border:0.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dshck-badge-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dshck-badge-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.dshck-badge-brand{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dshck-badge-mute{opacity:.75}
.dshck-foot{display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);flex-wrap:wrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.dshck-packs{display:flex;flex-direction:column;gap:0;border-top:0.5px solid var(--dsw-alias-border-l2)}
.dshck-pack{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;padding:6px 16px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dshck-pack-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshck-notices{display:flex;flex-direction:column;gap:6px}
.dshck-notice{font-size:12px;line-height:18px;padding:7px 12px;border-radius:8px;border:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);display:flex;gap:8px;align-items:flex-start}
.dshck-notice-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.dshck-notice-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dshck-notice-warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}
.dshck-form{display:flex;flex-direction:column;gap:8px;padding:12px 16px;border-top:0.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dshck-form-row{display:flex;gap:8px;flex-wrap:wrap}
.dshck-input{flex:1 1 200px;min-width:0;font:inherit;font-size:13px;line-height:20px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-sizing:border-box}
.dshck-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dshck-hint{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.dshck-loading{padding:16px;font-size:13px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px}
.dshck-spinner{width:12px;height:12px;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:dshck-spin .8s linear infinite}
@keyframes dshck-spin{to{transform:rotate(360deg)}}
.dshck-icon{width:18px;height:18px;display:block}
@media (max-width:640px){.dshck-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.dshck-stat:nth-child(3){border-left:0}}
`;

    if (typeof document !== "undefined") {
      if (!document.querySelector('style[data-plugin-css="' + CSS_ID + '"]')) {
        const styleTag = document.createElement("style");
        styleTag.dataset.plugin = "dsh-checkin-hub";
        styleTag.dataset.pluginCss = CSS_ID;
        styleTag.textContent = HUB_CSS;
        document.head.appendChild(styleTag);
      }
    }

    /* ------------------------------------------------------------------ */
    /* copy                                                                */
    /* ------------------------------------------------------------------ */

    const zh = {
      "nav.panel": "积分签到",
      "page.title": "积分签到中心",
      "page.desc": "一键为 WorkBuddy、Trae、Qoder 的全部账号签到，并查看积分余额与使用情况。",
      "page.refresh": "刷新",
      "page.checkinAll": "一键全部签到",
      "page.checking": "签到中…",
      "page.back": "返回对话",
      "summary.balance": "可用积分合计",
      "summary.balanceHint": "三个平台合计",
      "summary.accounts": "账号总数",
      "summary.checkedIn": "今日已签到",
      "summary.pending": "待签到账号",
      "summary.credits": "积分",
      "platform.workbuddy": "WorkBuddy",
      "platform.workbuddyDesc": "CodeBuddy 个人版 · 每日签到 100 积分",
      "platform.trae": "Trae",
      "platform.traeDesc": "国内版 · 每日签到领取通用积分",
      "platform.qoder": "Qoder",
      "platform.qoderDesc": "使用 PAT 添加账号 · 每日签到大模型积分",
      "state.signedOut": "未登录",
      "state.notInstalled": "连接插件未安装，请先在插件中心启用",
      "state.loading": "正在读取…",
      "state.error": "读取失败",
      "state.outOfPool": "未加入号池",
      "state.current": "当前账号",
      "action.checkin": "签到",
      "action.checkinOne": "单独签到",
      "action.refresh": "刷新",
      "action.remove": "移除",
      "action.confirmRemove": "确认移除",
      "action.cancel": "取消",
      "action.addAccount": "添加账号",
      "action.joinPool": "加入号池",
      "action.details": "积分明细",
      "action.hideDetails": "收起明细",
      "account.done": "今日已签到",
      "account.pending": "今日未签到",
      "account.expiring": "{n} 积分即将过期",
      "account.expireIn": "{n} 天后过期",
      "credits.consumed": "已用 {n}",
      "credits.available": "可用 {n}",
      "credits.empty": "暂无积分数据",
      "credits.total": "余额 {n}",
      "credits.accountCount": "{n} 个账号",
      "checkin.streak": "连续签到 {n} 天",
      "checkin.daily": "每日 +{n}",
      "add.pat": "Qoder PAT",
      "add.patPlaceholder": "粘贴 Qoder Personal Access Token",
      "add.name": "备注名（可选）",
      "add.namePlaceholder": "例如：主号",
      "add.submit": "添加",
      "add.traeHint": "Trae 账号请先在 Trae 连接插件中登录，登录后会出现在这里。",
      "add.qoderHint": "在下方粘贴 Qoder PAT 即可添加账号，支持添加多个。",
      "add.wbHint": "点击下方按钮将通过浏览器登录 WorkBuddy，登录成功后账号会自动加入。",
      "add.wbButton": "浏览器登录 WorkBuddy",
      "add.wbWaiting": "等待浏览器授权…",
      "add.opening": "已打开授权页面，请在新窗口完成登录…",
      "notice.checkinNone": "没有可签到的账号",
      "notice.checkinSummary": "{name}：{claimed} 个账号领取成功，{already} 个今日已签到",
      "notice.checkinFailed": "{name}：{n} 个账号签到失败",
      "notice.removed": "已移除 {name}",
      "notice.added": "已添加 {name}",
      "notice.error": "{name}：{message}",
      "notice.wbDone": "WorkBuddy 新账号已加入：{name}",
      "notice.joined": "{name} 已加入号池，可以签到了",
    };

    const en = {
      "nav.panel": "Check-in Hub",
      "page.title": "Check-in Hub",
      "page.desc": "Claim daily credits for every WorkBuddy, Trae and Qoder account, then review balances and usage.",
      "page.refresh": "Refresh",
      "page.checkinAll": "Check in everywhere",
      "page.checking": "Checking in…",
      "page.back": "Back to chat",
      "summary.balance": "Total credits",
      "summary.balanceHint": "All three platforms",
      "summary.accounts": "Accounts",
      "summary.checkedIn": "Checked in today",
      "summary.pending": "Still pending",
      "summary.credits": "credits",
      "platform.workbuddy": "WorkBuddy",
      "platform.workbuddyDesc": "CodeBuddy personal · 100 credits per day",
      "platform.trae": "Trae",
      "platform.traeDesc": "CN edition · daily general-credit claim",
      "platform.qoder": "Qoder",
      "platform.qoderDesc": "PAT sign-in · daily model credits",
      "state.signedOut": "Not signed in",
      "state.notInstalled": "Connect plugin is not installed — enable it in Settings → Plugins",
      "state.loading": "Loading…",
      "state.error": "Failed to load",
      "state.outOfPool": "Not in pool",
      "state.current": "Current",
      "action.checkin": "Check in",
      "action.checkinOne": "Check in",
      "action.refresh": "Refresh",
      "action.remove": "Remove",
      "action.confirmRemove": "Confirm",
      "action.cancel": "Cancel",
      "action.addAccount": "Add account",
      "action.joinPool": "Join pool",
      "action.details": "Credit breakdown",
      "action.hideDetails": "Hide breakdown",
      "account.done": "Checked in",
      "account.pending": "Not checked in",
      "account.expiring": "{n} credits expiring",
      "account.expireIn": "Expires in {n} d",
      "credits.consumed": "{n} used",
      "credits.available": "{n} available",
      "credits.empty": "No credit data yet",
      "credits.total": "balance {n}",
      "credits.accountCount": "{n} accounts",
      "checkin.streak": "{n}-day streak",
      "checkin.daily": "+{n} per day",
      "add.pat": "Qoder PAT",
      "add.patPlaceholder": "Paste a Qoder personal access token",
      "add.name": "Label (optional)",
      "add.namePlaceholder": "e.g. main",
      "add.submit": "Add",
      "add.traeHint": "Sign in to Trae through the Trae connect plugin first; the account then shows up here.",
      "add.qoderHint": "Paste a Qoder PAT below to add an account — any number of accounts is supported.",
      "add.wbHint": "Sign in through the browser; the account is added automatically when it succeeds.",
      "add.wbButton": "Sign in to WorkBuddy",
      "add.wbWaiting": "Waiting for browser approval…",
      "add.opening": "Authorization page opened — finish signing in there.",
      "notice.checkinNone": "No account is eligible for check-in",
      "notice.checkinSummary": "{name}: {claimed} claimed, {already} already done",
      "notice.checkinFailed": "{name}: {n} failed",
      "notice.removed": "Removed {name}",
      "notice.added": "Added {name}",
      "notice.error": "{name}: {message}",
      "notice.wbDone": "WorkBuddy account added: {name}",
      "notice.joined": "{name} joined the pool and can check in now",
    };

    function fill(template, vars) {
      return String(template).replace(/\{(\w+)\}/g, (whole, key) => (vars && vars[key] !== undefined ? String(vars[key]) : whole));
    }

    /* ------------------------------------------------------------------ */
    /* platform plumbing                                                   */
    /* ------------------------------------------------------------------ */

    const PANEL_ID = "dsh-checkin-hub";
    const NAMESPACE = "plugin.dsh-checkin-hub";
    const REGION = "cn";
    /** Host route that writes one account into the pool membership slot. */
    const MEMBERSHIP = (key) => `/plugins/dsh-checkin-hub/membership?platform=${encodeURIComponent(key)}&region=${REGION}`;

    const PLATFORMS = [
      {
        key: "workbuddy",
        nameKey: "platform.workbuddy",
        descKey: "platform.workbuddyDesc",
        brand: "WB",
        brandClass: "dshck-brand-wb",
        usage: `/plugins/dsh-connect-workbuddy/usage?region=${REGION}`,
        poolCheckin: `/plugins/dsh-connect-workbuddy/pool?action=checkin&region=${REGION}`,
        addable: "oauth",
        removable: (id) => `/plugins/dsh-connect-workbuddy/pool?action=remove&region=${REGION}&accountId=${encodeURIComponent(id)}`,
      },
      {
        key: "trae",
        nameKey: "platform.trae",
        descKey: "platform.traeDesc",
        brand: "TR",
        brandClass: "dshck-brand-trae",
        usage: `/plugins/dsh-connect-trae/usage?region=${REGION}`,
        poolCheckin: `/plugins/dsh-connect-trae/pool?action=checkin&region=${REGION}`,
        singleCheckin: `/plugins/dsh-connect-trae/checkin`,
        addable: "hint",
        removable: (id) => `/plugins/dsh-connect-trae/pool?action=delete&region=${REGION}&accountId=${encodeURIComponent(id)}`,
      },
      {
        key: "qoder",
        nameKey: "platform.qoder",
        descKey: "platform.qoderDesc",
        brand: "QD",
        brandClass: "dshck-brand-qoder",
        usage: `/plugins/dsh-connect-qoder/usage?region=${REGION}`,
        poolCheckin: `/plugins/dsh-connect-qoder/pool?action=checkin&region=${REGION}`,
        addable: "pat",
        addPath: `/plugins/dsh-connect-qoder/accounts?action=add&region=${REGION}`,
        removable: (id) => `/plugins/dsh-connect-qoder/pool?action=remove&region=${REGION}&accountId=${encodeURIComponent(id)}`,
      },
    ];

    async function requestJson(url, init) {
      const options = Object.assign({ credentials: "same-origin" }, init || {});
      const res = await fetch(url, options);
      const text = await res.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      if (!res.ok) {
        const detail = body && typeof body === "object" ? body.error || body.message || body.reason || body.code : body;
        const error = new Error(typeof detail === "string" && detail ? detail : `HTTP ${res.status}`);
        error.status = res.status;
        error.body = body;
        throw error;
      }
      return body;
    }

    function postJson(url, payload) {
      return requestJson(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload === undefined ? {} : payload),
      });
    }

    function fmt(n) {
      if (typeof n !== "number" || !isFinite(n)) return "—";
      const abs = Math.abs(n);
      if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
      if (abs >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function daysUntil(ms) {
      if (typeof ms !== "number" || !isFinite(ms)) return null;
      return Math.ceil((ms - Date.now()) / 86400000);
    }

    function sumBy(list, pick) {
      let total = 0;
      let seen = false;
      for (const item of list || []) {
        const value = pick(item);
        if (typeof value === "number" && isFinite(value)) {
          total += value;
          seen = true;
        }
      }
      return seen ? total : null;
    }

    function packagesOf(list, nameOf) {
      return (list || [])
        .map((item) => ({
          name: nameOf(item) || "—",
          remain: typeof item.remain === "number" ? item.remain : null,
          size: typeof item.size === "number" ? item.size : null,
          expiresAtMs: typeof item.expiresAtMs === "number" ? item.expiresAtMs : null,
        }))
        .sort((a, b) => (b.remain ?? 0) - (a.remain ?? 0))
        .slice(0, 6);
    }

    function viewOfWorkbuddy(payload) {
      const rows = payload?.pool?.accounts ?? [];
      const accounts = rows.map((row) => ({
        id: row.accountId,
        name: row.accountName || row.accountId,
        credits: typeof row.credits === "number" ? row.credits : null,
        checkedInToday: row.checkedInToday === true,
        member: row.member !== false,
        current: row.current === true,
        expiringSoon: typeof row.expiringSoon === "number" ? row.expiringSoon : 0,
        nearestExpiryMs: row.nearestExpiryMs,
        outOfPool: false,
      }));
      const known = new Set(accounts.map((a) => a.id));
      for (const account of payload?.accounts ?? []) {
        if (!account || known.has(account.id)) continue;
        accounts.push({
          id: account.id,
          name: account.accountName || account.id,
          credits: null,
          checkedInToday: false,
          member: false,
          current: account.selected === true,
          expiringSoon: 0,
          nearestExpiryMs: null,
          outOfPool: true,
        });
      }
      const rowBalance = sumBy(accounts, (account) => account.credits);
      return {
        signedIn: payload?.status === "signed-in",
        balance: rowBalance !== null ? rowBalance : typeof payload?.credits?.total === "number" ? payload.credits.total : null,
        consumed: null,
        available: null,
        checkedInToday: payload?.checkin?.todayCheckedIn === true,
        checkinActive: payload?.checkin?.active !== false,
        streakDays: payload?.checkin?.streakDays,
        dailyCredit: payload?.checkin?.dailyCredit,
        accounts,
        packs: packagesOf(payload?.credits?.packages, (item) => item.packageName),
        expiringSoon: typeof payload?.credits?.expiringSoon === "number" ? payload.credits.expiringSoon : null,
        checkinSupported: payload?.pool?.checkinSupported !== false,
        message: payload?.message,
      };
    }

    function viewOfTrae(payload) {
      const rows = payload?.pool?.accounts ?? [];
      const accounts = rows.map((row) => ({
        id: row.accountId,
        name: row.accountName || row.accountId,
        credits: typeof row.generalAvailable === "number" ? row.generalAvailable : typeof row.credits === "number" ? row.credits : null,
        checkedInToday: row.checkedInToday === true,
        member: row.member !== false,
        current: row.current === true,
        expiringSoon: typeof row.expiringSoon === "number" ? row.expiringSoon : 0,
        nearestExpiryMs: null,
        reachable: row.reachable !== false,
        outOfPool: false,
      }));
      const balance = sumBy(accounts, (a) => a.credits);
      return {
        signedIn: payload?.status === "signed-in",
        balance,
        consumed: typeof payload?.credits?.consumed === "number" ? payload.credits.consumed : null,
        available: typeof payload?.credits?.available === "number" ? payload.credits.available : null,
        checkedInToday: payload?.checkin?.checkedIn === true,
        checkinActive: payload?.checkin?.enabled !== false,
        streakDays: null,
        dailyCredit: typeof payload?.checkin?.credits === "number" ? payload.checkin.credits : null,
        accounts,
        packs: packagesOf(payload?.credits?.accounts, (item) => item.displayDesc),
        expiringSoon: typeof payload?.credits?.expiry?.within7d?.total === "number" ? payload.credits.expiry.within7d.total : null,
        checkinSupported: payload?.pool?.checkinSupported !== false,
        message: payload?.message,
      };
    }

    function viewOfQoder(payload) {
      const rows = payload?.pool?.accounts ?? [];
      const accounts = rows.map((row) => ({
        id: row.accountId,
        name: row.accountName || row.accountId,
        credits: typeof row.credits === "number" ? row.credits : null,
        checkedInToday: row.checkedInToday === true,
        member: row.member !== false,
        current: row.current === true,
        expiringSoon: typeof row.expiringSoon === "number" ? row.expiringSoon : 0,
        nearestExpiryMs: row.nearestExpiryMs,
        outOfPool: false,
      }));
      const known = new Set(accounts.map((a) => a.id));
      for (const account of payload?.accounts ?? []) {
        if (!account || known.has(account.id)) continue;
        accounts.push({
          id: account.id,
          name: account.accountName || account.id,
          credits: null,
          checkedInToday: false,
          member: false,
          current: account.selected === true,
          expiringSoon: 0,
          nearestExpiryMs: null,
          outOfPool: true,
        });
      }
      const rowBalance = sumBy(accounts, (account) => account.credits);
      return {
        signedIn: payload?.status === "signed-in",
        balance: rowBalance !== null ? rowBalance : typeof payload?.credits?.total === "number" ? payload.credits.total : null,
        consumed: null,
        available: null,
        checkedInToday: accounts.some((a) => a.checkedInToday),
        checkinActive: true,
        streakDays: null,
        dailyCredit: null,
        accounts,
        packs: packagesOf(payload?.credits?.packages, (item) => item.packageName),
        expiringSoon: typeof payload?.credits?.expiringSoon === "number" ? payload.credits.expiringSoon : null,
        checkinSupported: payload?.pool?.checkinSupported !== false,
        message: payload?.message,
      };
    }

    const VIEWS = { workbuddy: viewOfWorkbuddy, trae: viewOfTrae, qoder: viewOfQoder };

    /* ------------------------------------------------------------------ */
    /* components                                                          */
    /* ------------------------------------------------------------------ */

    function Spinner() {
      return h("span", { className: "dshck-spinner", "aria-hidden": "true" });
    }

    function Badge(props) {
      return h("span", { className: "dshck-badge" + (props.tone ? " dshck-badge-" + props.tone : "") }, props.children);
    }

    function AccountRow(props) {
      const row = props.account;
      const t = props.t;
      const state = props.stateOf;
      const confirm = props.confirm === row.id;
      const meta = [];
      if (!row.member) meta.push(t("state.outOfPool"));
      if (row.current) meta.push(t("state.current"));
      if (row.expiringSoon) meta.push(fill(t("account.expiring"), { n: fmt(row.expiringSoon) }));
      if (!row.expiringSoon && row.nearestExpiryMs) {
        const days = daysUntil(row.nearestExpiryMs);
        if (days !== null && days >= 0 && days <= 30) meta.push(fill(t("account.expireIn"), { n: days }));
      }
      return h(
        "div",
        { className: "dshck-row" },
        h(
          "div",
          { className: "dshck-row-main" },
          h(
            "div",
            { className: "dshck-row-name" },
            h("span", { className: "dshck-row-name-text", title: row.name }, row.name),
            row.checkedInToday
              ? h(Badge, { tone: "ok" }, t("account.done"))
              : h(Badge, { tone: "warn" }, t("account.pending")),
          ),
          meta.length ? h("div", { className: "dshck-row-meta" }, meta.join(" · ")) : null,
        ),
        h("div", { className: "dshck-row-credits" }, row.credits === null ? "—" : fmt(row.credits)),
        h(
          "div",
          { className: "dshck-row-side" },
          row.member === false
            ? h(
                "button",
                {
                  type: "button",
                  className: "dshck-btn dshck-btn-sm dshck-btn-primary",
                  disabled: props.busy,
                  title: t("action.joinPool"),
                  onClick: () => props.onJoinPool(row),
                },
                t("action.joinPool"),
              )
            : null,
          props.canCheckinOne && !row.checkedInToday
            ? h(
                "button",
                {
                  type: "button",
                  className: "dshck-btn dshck-btn-sm",
                  disabled: props.busy,
                  onClick: () => props.onCheckinOne(row),
                },
                t("action.checkinOne"),
              )
            : null,
          props.canRemove
            ? h(
                "button",
                {
                  type: "button",
                  className: "dshck-btn dshck-btn-sm" + (confirm ? " dshck-btn-danger" : " dshck-btn-ghost"),
                  disabled: props.busy,
                  title: t("action.remove"),
                  onClick: () => (confirm ? props.onRemove(row) : props.onAskRemove(row.id)),
                },
                confirm ? t("action.confirmRemove") : t("action.remove"),
              )
            : null,
        ),
      );
    }

    function PlatformCard(props) {
      const item = props.platform;
      const t = props.t;
      const state = props.state;
      const view = state.view;
      const [showPacks, setShowPacks] = useState(false);
      const [showAdd, setShowAdd] = useState(false);
      const [pat, setPat] = useState("");
      const [patName, setPatName] = useState("");
      const [adding, setAdding] = useState(false);
      const [wbLogin, setWbLogin] = useState(null);

      useEffect(() => {
        if (!wbLogin?.loginId) return undefined;
        let cancelled = false;
        const timer = setInterval(async () => {
          try {
            const answer = await postJson(`/plugins/dsh-connect-workbuddy/oauth?action=poll&region=${REGION}`, {
              loginId: wbLogin.loginId,
            });
            if (cancelled) return;
            if (answer?.done === true) {
              clearInterval(timer);
              setWbLogin(null);
              setShowAdd(false);
              if (answer.error) {
                props.notify("err", props.name + ": " + answer.error);
              } else {
                // The Host answers {done, accountId, accountName} and has already
                // stored the credential; the pool slot is still untouched.
                const label = answer.accountName || answer.accountId || "";
                props.notify("ok", fill(t("notice.wbDone"), { name: label }));
                if (typeof answer.accountId === "string" && answer.accountId !== "") {
                  try {
                    await postJson(MEMBERSHIP(item.key), { accountId: answer.accountId, member: true });
                    props.notify("ok", fill(t("notice.joined"), { name: label }));
                  } catch (joinError) {
                    props.notify("err", fill(t("notice.error"), { name: label, message: joinError?.message || String(joinError) }));
                  }
                }
                props.reload();
              }
            }
          } catch {
            /* keep polling: transient poll failures are expected */
          }
        }, 3000);
        return () => {
          cancelled = true;
          clearInterval(timer);
        };
      }, [wbLogin?.loginId]);

      const accounts = view?.accounts ?? [];
      const canRemove = item.removable !== undefined;
      const busy = props.busy || state.loading;

      const head = h(
        "div",
        { className: "dshck-card-head" },
        h("div", { className: "dshck-brand " + item.brandClass, "aria-hidden": "true" }, item.brand),
        h(
          "div",
          { className: "dshck-card-titles" },
          h(
            "div",
            { className: "dshck-card-name" },
            t(item.nameKey),
            view?.signedIn ? null : h(Badge, { tone: "mute" }, t("state.signedOut")),
            view?.checkedInToday ? h(Badge, { tone: "ok" }, t("account.done")) : null,
            typeof view?.streakDays === "number" && view.streakDays > 0
              ? h(Badge, null, fill(t("checkin.streak"), { n: view.streakDays }))
              : null,
          ),
          h(
            "div",
            { className: "dshck-card-sub", title: t(item.descKey) },
            view?.signedIn
              ? [t(item.descKey), typeof view.dailyCredit === "number" ? fill(t("checkin.daily"), { n: fmt(view.dailyCredit) }) : null]
                  .filter(Boolean)
                  .join(" · ")
              : t(item.descKey),
          ),
        ),
        h(
          "div",
          { className: "dshck-card-metrics" },
          view && view.signedIn === false
            ? null
            : [
                h("span", { className: "dshck-metric-value", key: "value" }, fmt(view?.balance)),
                h("span", { className: "dshck-metric-unit", key: "unit" }, t("summary.credits")),
              ],
        ),
        h(
          "div",
          { className: "dshck-row-side" },
          h(
            "button",
            {
              type: "button",
              className: "dshck-btn dshck-btn-sm",
              disabled: busy || !view?.signedIn || !view?.checkinSupported,
              onClick: () => props.onCheckin(item.key),
            },
            props.busy ? t("page.checking") : t("action.checkin"),
          ),
          h(
            "button",
            {
              type: "button",
              className: "dshck-btn dshck-btn-sm dshck-btn-ghost",
              disabled: state.loading,
              onClick: () => props.onReload(item.key),
            },
            t("action.refresh"),
          ),
        ),
      );

      let body;
      if (state.loading && !view) {
        body = h("div", { className: "dshck-loading" }, h(Spinner), t("state.loading"));
      } else if (state.error) {
        body = h(
          "div",
          { className: "dshck-empty" },
          h("div", null, t("state.error") + ": " + state.error),
          state.status === 404 ? h("div", { className: "dshck-hint" }, t("state.notInstalled")) : null,
        );
      } else if (!view || accounts.length === 0) {
        body = h(
          "div",
          { className: "dshck-empty" },
          h("div", null, view?.signedIn ? t("credits.empty") : view?.message || t("state.signedOut")),
          item.addable === "pat"
            ? h("div", { className: "dshck-hint" }, t("add.qoderHint"))
            : null,
        );
      } else {
        body = h(
          "div",
          { className: "dshck-rows" },
          accounts.map((account) =>
            h(AccountRow, {
              key: account.id,
              account,
              t,
              busy,
              canRemove,
              canCheckinOne: Boolean(item.singleCheckin),
              confirm: props.confirmRemove?.key === item.key && props.confirmRemove?.id === account.id,
              onAskRemove: (id) => props.onAskRemove(item.key, id),
              onRemove: (row) => props.onRemove(item.key, row),
              onCheckinOne: (row) => props.onCheckinOne(item, row),
              onJoinPool: (row) => props.onJoinPool(item, row),
            }),
          ),
        );
      }

      const usageBits = [];
      if (view) {
        if (typeof view.consumed === "number") usageBits.push(fill(t("credits.consumed"), { n: fmt(view.consumed) }));
        if (typeof view.available === "number") usageBits.push(fill(t("credits.available"), { n: fmt(view.available) }));
        if (typeof view.expiringSoon === "number" && view.expiringSoon > 0)
          usageBits.push(fill(t("account.expiring"), { n: fmt(view.expiringSoon) }));
        if (usageBits.length === 0 && typeof view.balance === "number") {
          usageBits.push(fill(t("credits.total"), { n: fmt(view.balance) }));
          if (view.accounts.length > 0) usageBits.push(fill(t("credits.accountCount"), { n: view.accounts.length }));
        }
      }

      const packs = view?.packs ?? [];
      const foot = h(
        "div",
        { className: "dshck-foot" },
        usageBits.length ? h("span", null, usageBits.join(" · ")) : null,
        packs.length
          ? h(
              "button",
              { type: "button", className: "dshck-btn dshck-btn-sm dshck-btn-ghost", onClick: () => setShowPacks((v) => !v) },
              showPacks ? t("action.hideDetails") : t("action.details"),
            )
          : null,
        props.addableUi
          ? h(
              "button",
              {
                type: "button",
                className: "dshck-btn dshck-btn-sm dshck-btn-ghost",
                onClick: () => setShowAdd((v) => !v),
              },
              t("action.addAccount"),
            )
          : null,
      );

      const details =
        showPacks && packs.length
          ? h(
              "div",
              { className: "dshck-packs" },
              packs.map((pack, index) =>
                h(
                  "div",
                  { className: "dshck-pack", key: pack.name + "-" + index },
                  h("span", { className: "dshck-pack-name", title: pack.name }, pack.name),
                  h("span", null, (pack.remain === null ? "—" : fmt(pack.remain)) + (pack.size ? " / " + fmt(pack.size) : "")),
                  h("span", null, pack.expiresAtMs ? `${Math.max(0, daysUntil(pack.expiresAtMs) ?? 0)} d` : ""),
                ),
              ),
            )
          : null;

      let addUi = null;
      if (showAdd && item.addable === "pat") {
        addUi = h(
          "div",
          { className: "dshck-form" },
          h(
            "div",
            { className: "dshck-form-row" },
            h("input", {
              className: "dshck-input",
              placeholder: t("add.patPlaceholder"),
              value: pat,
              spellCheck: false,
              autoComplete: "off",
              onChange: (event) => setPat(event.target.value),
            }),
          ),
          h(
            "div",
            { className: "dshck-form-row" },
            h("input", {
              className: "dshck-input",
              placeholder: t("add.namePlaceholder"),
              value: patName,
              onChange: (event) => setPatName(event.target.value),
            }),
            h(
              "button",
              {
                type: "button",
                className: "dshck-btn",
                disabled: adding || pat.trim() === "",
                onClick: async () => {
                  setAdding(true);
                  try {
                    const payload = { pat: pat.trim() };
                    if (patName.trim()) payload.name = patName.trim();
                    const answer = await postJson(item.addPath, payload);
                    const addedName = answer?.accountName || patName.trim() || "";
                    props.notify("ok", fill(t("notice.added"), { name: addedName }));
                    // Adding a credential never enrolls it, so put it in the pool here.
                    if (typeof answer?.accountId === "string" && answer.accountId !== "") {
                      try {
                        await postJson(MEMBERSHIP(item.key), { accountId: answer.accountId, member: true });
                        props.notify("ok", fill(t("notice.joined"), { name: addedName }));
                      } catch (joinError) {
                        props.notify("err", fill(t("notice.error"), { name: addedName, message: joinError?.message || String(joinError) }));
                      }
                    }
                    setPat("");
                    setPatName("");
                    setShowAdd(false);
                    props.reload();
                  } catch (error) {
                    props.notify("err", props.name + ": " + (error?.message || String(error)));
                  } finally {
                    setAdding(false);
                  }
                },
              },
              adding ? t("state.loading") : t("add.submit"),
            ),
          ),
        );
      } else if (showAdd && item.addable === "oauth") {
        addUi = h(
          "div",
          { className: "dshck-form" },
          h("div", { className: "dshck-hint" }, wbLogin ? t("add.wbWaiting") : t("add.wbHint")),
          h(
            "div",
            { className: "dshck-form-row" },
            h(
              "button",
              {
                type: "button",
                className: "dshck-btn",
                disabled: Boolean(wbLogin),
                onClick: async () => {
                  try {
                    const answer = await postJson(`/plugins/dsh-connect-workbuddy/oauth?action=start&region=${REGION}`, {});
                    const url = answer?.verificationUri || answer?.url;
                    if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
                    if (answer?.loginId) {
                      setWbLogin({ loginId: answer.loginId });
                      props.notify("warn", t("add.opening"));
                    } else {
                      props.notify("err", props.name + ": " + (answer?.error || "no loginId"));
                    }
                  } catch (error) {
                    props.notify("err", props.name + ": " + (error?.message || String(error)));
                  }
                },
              },
              wbLogin ? t("add.wbWaiting") : t("add.wbButton"),
            ),
            wbLogin
              ? h(
                  "button",
                  { type: "button", className: "dshck-btn dshck-btn-ghost", onClick: () => setWbLogin(null) },
                  t("action.cancel"),
                )
              : null,
          ),
        );
      } else if (showAdd && item.addable === "hint") {
        addUi = h("div", { className: "dshck-form" }, h("div", { className: "dshck-hint" }, t("add.traeHint")));
      }

      return h(
        "section",
        { className: "dshck-card" },
        head,
        h("div", { className: "dshck-card-body" }, body),
        addUi,
        details,
        foot,
      );
    }

    function HubPanel(props) {
      const t = typeof props.t === "function" ? props.t : (key) => key;
      const [states, setStates] = useState({
        workbuddy: { loading: true, view: null, error: null, status: 0 },
        trae: { loading: true, view: null, error: null, status: 0 },
        qoder: { loading: true, view: null, error: null, status: 0 },
      });
      const [busyAll, setBusyAll] = useState(false);
      const [busyOf, setBusyOf] = useState({});
      const [notices, setNotices] = useState([]);
      const [confirmRemove, setConfirmRemove] = useState(null);
      const aliveRef = useRef(true);
      const noticesRef = useRef([]);

      useEffect(() => {
        aliveRef.current = true;
        return () => {
          aliveRef.current = false;
        };
      }, []);

      const pushNotice = useCallback((tone, text) => {
        const entry = { id: Date.now() + Math.random(), tone, text };
        noticesRef.current = [entry, ...noticesRef.current].slice(0, 6);
        setNotices(noticesRef.current);
      }, []);

      const load = useCallback(
        async (key, silent) => {
          const item = PLATFORMS.find((candidate) => candidate.key === key);
          setStates((prev) => ({ ...prev, [key]: { ...prev[key], loading: true } }));
          try {
            const payload = await requestJson(item.usage, { method: "GET" });
            if (!aliveRef.current) return;
            setStates((prev) => ({
              ...prev,
              [key]: { loading: false, view: VIEWS[key](payload), error: null, status: 200 },
            }));
          } catch (error) {
            if (!aliveRef.current) return;
            setStates((prev) => ({
              ...prev,
              [key]: {
                loading: false,
                view: prev[key].view,
                error: error?.message || String(error),
                status: error?.status || 0,
              },
            }));
            if (!silent) {
              const label = t(item.nameKey);
              pushNotice("err", fill(t("notice.error"), { name: label, message: error?.message || String(error) }));
            }
          }
        },
        [pushNotice, t],
      );

      const loadAll = useCallback(
        (silent) => {
          for (const item of PLATFORMS) load(item.key, silent);
        },
        [load],
      );

      useEffect(() => {
        loadAll(true);
        const timer = setInterval(() => loadAll(true), 300000);
        return () => clearInterval(timer);
      }, [loadAll]);

      const runPoolCheckin = useCallback(
        async (item) => {
          setBusyOf((prev) => ({ ...prev, [item.key]: true }));
          try {
            const answer = await postJson(item.poolCheckin, {});
            const rows = Array.isArray(answer?.rows) ? answer.rows : [];
            const claimed = rows.filter((row) => row.status === "claimed").length;
            const already = rows.filter((row) => row.status === "already").length;
            const failed = rows.filter((row) => row.status === "failed").length;
            const label = t(item.nameKey);
            if (rows.length === 0) pushNotice("warn", label + ": " + t("notice.checkinNone"));
            else pushNotice(failed > 0 || claimed === 0 ? "warn" : "ok", fill(t("notice.checkinSummary"), { name: label, claimed, already }));
            if (failed > 0) pushNotice("err", fill(t("notice.checkinFailed"), { name: label, n: failed }));
            await load(item.key, true);
            return { claimed, already, failed, rows };
          } catch (error) {
            const label = t(item.nameKey);
            const message = error?.message || String(error);
            const reason =
              error?.body?.reason === "no-members" || error?.body?.reason === "no-live-members"
                ? t("notice.checkinNone")
                : error?.body?.reason === "checkin-unsupported"
                  ? t("state.notInstalled")
                  : message;
            pushNotice("err", fill(t("notice.error"), { name: label, message: reason }));
            return { claimed: 0, already: 0, failed: 0, rows: [] };
          } finally {
            if (aliveRef.current) setBusyOf((prev) => ({ ...prev, [item.key]: false }));
          }
        },
        [load, pushNotice, t],
      );

      const checkinOne = useCallback(
        async (item, row) => {
          setBusyOf((prev) => ({ ...prev, [item.key]: true }));
          try {
            if (item.singleCheckin) {
              const answer = await postJson(item.singleCheckin, { accountId: row.id });
              const label = item.nameKey === "platform.trae" ? t("platform.trae") : t(item.nameKey);
              if (answer?.alreadyCheckedIn) pushNotice("warn", label + ": " + t("account.done"));
              else pushNotice("ok", fill(t("notice.checkinSummary"), { name: label, claimed: 1, already: 0 }));
            } else {
              await runPoolCheckin(item);
              return;
            }
            await load(item.key, true);
          } catch (error) {
            pushNotice("err", fill(t("notice.error"), { name: t(item.nameKey), message: error?.message || String(error) }));
          } finally {
            if (aliveRef.current) setBusyOf((prev) => ({ ...prev, [item.key]: false }));
          }
        },
        [load, pushNotice, runPoolCheckin, t],
      );

      const joinPool = useCallback(
        async (item, row) => {
          setBusyOf((prev) => ({ ...prev, [item.key]: true }));
          try {
            await postJson(MEMBERSHIP(item.key), { accountId: row.id, member: true });
            pushNotice("ok", fill(t("notice.joined"), { name: row.name }));
            await load(item.key, true);
          } catch (error) {
            pushNotice("err", fill(t("notice.error"), { name: t(item.nameKey), message: error?.message || String(error) }));
          } finally {
            if (aliveRef.current) setBusyOf((prev) => ({ ...prev, [item.key]: false }));
          }
        },
        [load, pushNotice, t],
      );

      const checkinAll = useCallback(async () => {
        setBusyAll(true);
        try {
          for (const item of PLATFORMS) {
            const state = states[item.key];
            if (state?.view && state.view.signedIn === false) continue;
            await runPoolCheckin(item);
          }
        } finally {
          if (aliveRef.current) setBusyAll(false);
        }
      }, [pushNotice, runPoolCheckin, states, t]);

      const removeAccount = useCallback(
        async (key, row) => {
          const item = PLATFORMS.find((candidate) => candidate.key === key);
          setConfirmRemove(null);
          try {
            await postJson(item.removable(row.id), {});
            pushNotice("ok", fill(t("notice.removed"), { name: row.name }));
            await load(key, true);
          } catch (error) {
            pushNotice("err", fill(t("notice.error"), { name: t(item.nameKey), message: error?.message || String(error) }));
          }
        },
        [load, pushNotice, t],
      );

      const views = PLATFORMS.map((item) => states[item.key].view).filter(Boolean);
      const totalBalance = sumBy(
        views,
        (view) => view.balance,
      );
      const totalAccounts = views.reduce((count, view) => count + (view.accounts?.length ?? 0), 0);
      const checkedInCount = views.reduce(
        (count, view) => count + (view.accounts ?? []).filter((account) => account.checkedInToday).length,
        0,
      );
      const pending = Math.max(0, totalAccounts - checkedInCount);
      const anyBusy = busyAll || Object.values(busyOf).some(Boolean);
      const backToConversation = typeof props.closePanel === "function" ? props.closePanel : null;

      return h(
        "div",
        { className: "dshck-page" },
        h(
          "div",
          { className: "dshck-head" },
          h(
            "div",
            { className: "dshck-head-main" },
            backToConversation
              ? h(
                  "button",
                  { type: "button", className: "dshck-back", onClick: backToConversation },
                  h("span", { className: "dshck-back-caret", "aria-hidden": "true" }),
                  t("page.back"),
                )
              : null,
            h("h1", { className: "dshck-title" }, t("page.title")),
            h("p", { className: "dshck-desc" }, t("page.desc")),
          ),
          h(
            "div",
            { className: "dshck-actions" },
            h(
              "button",
              {
                type: "button",
                className: "dshck-btn",
                disabled: anyBusy,
                onClick: () => loadAll(false),
              },
              t("page.refresh"),
            ),
            h(
              "button",
              {
                type: "button",
                className: "dshck-btn dshck-btn-primary",
                disabled: anyBusy,
                onClick: checkinAll,
              },
              anyBusy ? t("page.checking") : t("page.checkinAll"),
            ),
          ),
        ),
        h(
          "div",
          { className: "dshck-summary" },
          h(
            "div",
            { className: "dshck-stat" },
            h("span", { className: "dshck-stat-label" }, t("summary.balance")),
            h("span", { className: "dshck-stat-value" }, fmt(totalBalance)),
            h("span", { className: "dshck-stat-hint" }, t("summary.balanceHint")),
          ),
          h(
            "div",
            { className: "dshck-stat" },
            h("span", { className: "dshck-stat-label" }, t("summary.accounts")),
            h("span", { className: "dshck-stat-value" }, String(totalAccounts)),
          ),
          h(
            "div",
            { className: "dshck-stat" },
            h("span", { className: "dshck-stat-label" }, t("summary.checkedIn")),
            h("span", { className: "dshck-stat-value" }, String(checkedInCount)),
          ),
          h(
            "div",
            { className: "dshck-stat" },
            h("span", { className: "dshck-stat-label" }, t("summary.pending")),
            h("span", { className: "dshck-stat-value" }, String(pending)),
          ),
        ),
        notices.length
          ? h(
              "div",
              { className: "dshck-notices" },
              notices.map((notice) =>
                h("div", { key: notice.id, className: "dshck-notice dshck-notice-" + notice.tone }, notice.text),
              ),
            )
          : null,
        h(
          "div",
          { className: "dshck-cards" },
          PLATFORMS.map((item) =>
            h(PlatformCard, {
              key: item.key,
              platform: item,
              name: t(item.nameKey),
              state: states[item.key],
              busy: Boolean(busyOf[item.key]) || busyAll,
              addableUi: item.addable !== undefined,
              confirmRemove,
              t,
              notify: pushNotice,
              reload: () => load(item.key, false),
              onReload: (key) => load(key, false),
              onCheckin: () => runPoolCheckin(PLATFORMS.find((candidate) => candidate.key === item.key)),
              onCheckinOne: checkinOne,
              onAskRemove: (key, id) => setConfirmRemove({ key, id }),
              onRemove: (key, row) => removeAccount(key, row),
              onJoinPool: joinPool,
            }),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* slot registration                                                   */
    /* ------------------------------------------------------------------ */

    const liveSlotEntries = new Map();

    function releaseSlotEntry(identity, entryOnly) {
      const held = liveSlotEntries.get(identity);
      if (held === undefined) return;
      liveSlotEntries.delete(identity);
      if (held.disposeEntry !== undefined) {
        try {
          held.disposeEntry();
        } catch {
          /* the host already dropped it */
        }
      }
      if (!entryOnly && held.disposeInject !== undefined) {
        try {
          held.disposeInject();
        } catch {
          /* the slot itself is gone */
        }
      }
    }

    function registerSlotEntry(ctx, identity, slotKey, register, describe) {
      const hold = {};
      const fail = (error) => {
        console.error("[dsh-checkin-hub] " + describe + " failed to register (host provider unaffected):", error);
      };
      const run = () => {
        releaseSlotEntry(identity, true);
        try {
          const disposeEntry = register();
          hold.disposeEntry = disposeEntry;
          const current = liveSlotEntries.get(identity);
          if (current === undefined) liveSlotEntries.set(identity, hold);
          else current.disposeEntry = disposeEntry;
          return disposeEntry;
        } catch (error) {
          fail(error);
          return () => {};
        }
      };
      try {
        const disposeInject = ctx.slots.inject(slotKey, () => {
          try {
            return run();
          } catch (error) {
            fail(error);
            return () => {};
          }
        });
        hold.disposeInject = disposeInject;
        const current = liveSlotEntries.get(identity);
        if (current === undefined) liveSlotEntries.set(identity, hold);
        else current.disposeInject = disposeInject;
        return () => releaseSlotEntry(identity);
      } catch (error) {
        releaseSlotEntry(identity);
        fail(error);
        return () => {};
      }
    }

    function HubIcon(props) {
      const edge = typeof props?.size === "number" && props.size > 0 ? props.size : 16;
      return h(
        "svg",
        {
          className: "dshck-icon",
          viewBox: "0 0 64 64",
          width: edge,
          height: edge,
          "aria-hidden": "true",
          focusable: "false",
        },
        h(
          "defs",
          null,
          h(
            "linearGradient",
            { id: "dshckHubGradient", x1: "8", y1: "6", x2: "56", y2: "58", gradientUnits: "userSpaceOnUse" },
            h("stop", { offset: "0", stopColor: "#7C6CF5" }),
            h("stop", { offset: "1", stopColor: "#4F8DF7" }),
          ),
        ),
        h("rect", { x: "4", y: "4", width: "56", height: "56", rx: "16", fill: "url(#dshckHubGradient)" }),
        h("path", {
          d: "M20 34.2 28.1 42 44 24",
          fill: "none",
          stroke: "#FFFFFF",
          strokeWidth: "5.2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
        h("circle", { cx: "46", cy: "45", r: "7", fill: "#FFFFFF", opacity: "0.92" }),
        h("path", {
          d: "M46 41.6v4.2M46 48.2v.4",
          stroke: "#4F8DF7",
          strokeWidth: "2.1",
          strokeLinecap: "round",
        }),
      );
    }

    function apply(ctx) {
      const locale = ctx.locale;
      ctx.effect(() => locale.register(NAMESPACE, { zh, en }), "dsh-checkin-hub: settings copy");
      const bound = locale.bind(NAMESPACE);
      const t = (key, vars) => {
        let text = key;
        try {
          const resolved = bound(key);
          text = typeof resolved === "string" && resolved !== key ? resolved : zh[key] ?? key;
        } catch {
          text = zh[key] ?? key;
        }
        return vars ? fill(text, vars) : text;
      };

      const softGet = (name) => {
        try {
          return ctx.get(name);
        } catch {
          return undefined;
        }
      };

      const closePanel = () => {
        const layout = softGet("layout");
        if (layout !== undefined && typeof layout.selectPanel === "function") layout.selectPanel(null);
      };

      registerSlotEntry(
        ctx,
        "sidebar.panellist#" + PANEL_ID,
        "sidebar.panellist",
        () =>
          ctx.slots.register(
            { name: "sidebar.panellist", id: PANEL_ID, order: 5, label: () => t("nav.panel"), locale: NAMESPACE },
            HubIcon,
          ),
        "sidebar panel row",
      );

      registerSlotEntry(
        ctx,
        "main#" + PANEL_ID,
        "main",
        () =>
          ctx.slots.register(
            { name: "main", key: PANEL_ID, locale: NAMESPACE, inject: () => ({ t, surface: "page", closePanel }) },
            HubPanel,
          ),
        "sidebar panel page",
      );
    }

    return { name: "dsh-checkin-hub", inject: ["slots", "locale"], apply };
  },
});
