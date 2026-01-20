/**
 * Auth refresh signal - used to coordinate between AuthProvider and AuthAdapter.
 * Separated to avoid require cycles.
 */

let lastAuthRefreshSignal = 0;

export function signalAuthRefresh() {
  lastAuthRefreshSignal = Date.now();
  console.log("[AuthSignal] Auth refresh signaled at", lastAuthRefreshSignal);
}

export function getLastAuthRefreshSignal() {
  return lastAuthRefreshSignal;
}
