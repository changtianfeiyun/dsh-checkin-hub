/**
 * Host half of the check-in hub bundle.
 *
 * The hub is a pure UI aggregator: it renders a sidebar panel in the Web GUI and
 * talks to the already-installed connect plugins over their loopback HTTP routes
 * (`/plugins/dsh-connect-workbuddy/...`, `/plugins/dsh-connect-trae/...`,
 * `/plugins/dsh-connect-qoder/...`). It owns no credentials, no tokens and no
 * upstream clients, so the host half only has to exist and prove the bundle
 * mounted.
 */
export function apply(ctx) {
  ctx.effect(() => {
    ctx.logger?.info?.("dsh-checkin-hub: panel served by dsh-checkin-hub/client.js");
  }, "dsh-checkin-hub: announce mount");
}
