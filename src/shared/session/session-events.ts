// A revision changes only when the account changes or the session is cleared.
let revision = 0;
const listeners = new Set<() => void>();
export const getSessionRevision = () => revision;
export function notifySessionChanged() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
export function subscribeSessionChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
