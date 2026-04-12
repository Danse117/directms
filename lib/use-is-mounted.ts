import { useSyncExternalStore } from "react";

// Returns false on the server and during the first client render pass,
// then true for every subsequent render. Used as a hydration guard for
// client state that lives outside React (e.g. zustand persist → localStorage).
//
// React 19's react-hooks/set-state-in-effect rule flags the `useState + setState
// in useEffect` version of this pattern, so we use useSyncExternalStore instead.
const emptySubscribe = () => () => {};

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
