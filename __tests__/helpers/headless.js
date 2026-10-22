// Shared headless mode for every e2e test. 'shell' (chrome-headless-shell) is the default because the new headless mode
// does not reliably complete the login form on some machines. HEADLESS=false shows the browser; E2E_HEADLESS_MODE=true
// selects the new headless mode.
function headlessMode() {
  if (process.env.HEADLESS === 'false') return false;
  const m = process.env.E2E_HEADLESS_MODE;
  if (m === 'true') return true;
  return m || 'shell';
}
module.exports = { headlessMode };
