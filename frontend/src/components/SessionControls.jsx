import { useEffect, useState } from 'react';
import { missionSocket } from '../socket';
import { PrivateClue } from './PrivateClue';
import { OverlayLink } from './OverlayLink';

export function SessionControls() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  async function request(action = 'current') {
    const response = await fetch(`http://localhost:3000/api/sessions/${action}`, {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(action !== 'current' ? { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-CollabQuest-CSRF': '1',
      }, body: JSON.stringify(action === 'join' ? { inviteCode: code.trim() } : {}) } : {}),
    });
    if (response.status === 401) return { unauthorized: true };
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Request failed.');
    return value;
  }
  useEffect(() => {
    let live = true, timer;
    async function poll() {
      try { const value = await request(); if (live) { setData(value); setError(''); } }
      catch { if (live) { setData(null); setError('Cannot load session. Retrying…'); } }
      if (live) timer = setTimeout(poll, 5000);
    }
    poll(); return () => { live = false; clearTimeout(timer); };
  }, []);
  async function act(action) {
    if (action === 'leave' && !window.confirm('Leave this session? Host departure closes it; guest departure resets its mission.')) return;
    setBusy(true); setError('');
    try { setData(await request(action)); setCode(''); missionSocket.disconnect().connect(); }
    catch (e) { setError(e.message === 'Failed to fetch' ? 'Network error. Please retry.' : e.message); }
    finally { setBusy(false); }
  }
  if (data?.unauthorized) return null;
  return <section className="session-controls" aria-label="Collaborative session">
    <h2>Collaborative session</h2>
    <p role="status">{error || (!data ? 'Loading session…' : data.session?.status === 'waiting' ? 'Waiting for a second streamer…' : data.session ? 'Session active' : 'Create a session or join a fellow streamer.')}</p>
    {data && !data.session && <div className="session-actions">
      <button disabled={busy} onClick={() => act('create')}>Create Session</button>
      <form onSubmit={e => { e.preventDefault(); act('join'); }}>
        <label>Invite code <input value={code} maxLength={32} onChange={e => setCode(e.target.value)} autoComplete="off" /></label>
        <button disabled={busy || !code.trim()}>Join Session</button>
      </form>
    </div>}
    {data?.session && <>
      {!busy && data.session.status === 'active' && <PrivateClue key={data.session.id} />}
      {!busy && data.session.status === 'active' && <OverlayLink key={`overlay-${data.session.id}`} />}
      <ul>{data.session.participants.map(p => <li key={p.role}>{p.displayName} · Role {p.role}</li>)}</ul>
      {data.inviteCode && <p className="invite-code"><code>{data.inviteCode}</code> <button onClick={async () => {
        try { await navigator.clipboard.writeText(data.inviteCode); setError('Invite copied.'); }
        catch { setError('Copy unavailable. Select and copy the code above.'); }
      }}>Copy invite</button></p>}
      <button disabled={busy} onClick={() => act('leave')}>Leave Session</button>
    </>}
  </section>;
}
