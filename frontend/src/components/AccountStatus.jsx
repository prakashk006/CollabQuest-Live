import { useAuth } from '../useAuth';

export function AccountStatus() {
  const { status, user } = useAuth();
  return <section className="account-status" aria-label="Twitch account">
    <p role="status">
      {status === 'loading' && 'Checking Twitch account…'}
      {status === 'authenticated' && <>● Twitch connected · <strong>{user.displayName}</strong></>}
      {status === 'unauthenticated' && 'Viewing public mission updates.'}
      {status === 'error' && 'Unable to check your account. Mission updates remain available. Refocus this window to retry.'}
    </p>
    {status === 'unauthenticated' && <a href="http://localhost:3000/auth/twitch">Connect Twitch</a>}
  </section>;
}
