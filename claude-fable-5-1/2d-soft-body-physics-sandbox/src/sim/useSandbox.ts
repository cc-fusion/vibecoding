import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Sandbox } from './Sandbox';

export const SandboxContext = createContext<Sandbox | null>(null);

/** Returns the sandbox and re-renders the caller whenever it emits a change. */
export function useSandbox(): Sandbox {
  const sb = useContext(SandboxContext);
  if (!sb) throw new Error('SandboxContext missing');
  useSyncExternalStore(sb.subscribe, () => sb.version, () => sb.version);
  return sb;
}
