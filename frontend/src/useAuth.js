import { useEffect, useState } from 'react';

// Share only an in-flight request, including StrictMode's effect replay.
let pending;
function requestIdentity() {
  if (!pending) {
    pending = fetch('http://localhost:3000/auth/me', {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10000),
    }).then(async response => {
      if (response.status === 401) return { status: 'unauthenticated', user: null };
      if (!response.ok) throw new Error('identity_unavailable');
      const { user } = await response.json();
      if (typeof user?.id !== 'string' || typeof user?.displayName !== 'string') {
        throw new Error('identity_invalid');
      }
      return { status: 'authenticated', user: { id: user.id, displayName: user.displayName } };
    }).catch(() => ({ status: 'error', user: null })).finally(() => { pending = undefined; });
  }
  return pending;
}

export function useAuth() {
  const [auth, setAuth] = useState({ status: 'loading', user: null });
  useEffect(() => {
    let mounted = true;
    let running = false;
    async function refresh() {
      if (running) return;
      running = true;
      const result = await requestIdentity();
      running = false;
      if (mounted) setAuth(result);
    }
    refresh();
    window.addEventListener('focus', refresh);
    return () => { mounted = false; window.removeEventListener('focus', refresh); };
  }, []);
  return auth;
}
