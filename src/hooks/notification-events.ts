/**
 * Tiny client-side pub/sub so the top-bar bell can refresh its unread count
 * after actions taken elsewhere (e.g. the notifications page), without a global
 * store. Call `notifyNotificationsChanged()` after any mutation.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onNotificationsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyNotificationsChanged(): void {
  for (const listener of listeners) listener();
}
