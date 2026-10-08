// Where visit events are sent. Empty string disables logging entirely.
//  - Opened from localhost (the ./dev.sh preview): events go to the deployed server logger. The server files them as "dev",
//    so they never show up in the real numbers. Add ?logger=local to the URL to use the logger started by ./dev.sh instead.
//  - Opened from GitHub Pages: uses `prod`, which must be an HTTPS URL (GitHub Pages is HTTPS, so http:// would be blocked).
//    Keep it empty HERE: ./publish.sh injects the current tunnel address into the published copy (and removes `server`).
window.SITE_CONFIG = {
  server: "",
  local: "",
  prod: "https://enzyme-discussed-dans-asp.trycloudflare.com",
};
(function (c) {
  const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
  const wantLocal = new URLSearchParams(location.search).get("logger") === "local";
  c.logEndpoint = onLocalhost ? (wantLocal ? c.local : c.server) : c.prod;
})(window.SITE_CONFIG);
