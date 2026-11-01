import { useEffect, useState } from 'react';
import { missionSocket } from '../socket';

export function PrivateClue() {
  const [clue, setClue] = useState(null), [status, setStatus] = useState('Loading your clue…');
  useEffect(() => {
    let live = true, timer;
    const controller = new AbortController();
    const clear = () => { if (live) { setClue(null); setStatus('Rechecking private access…'); } };
    async function refresh() {
      clear();
      try {
        const response = await fetch('http://localhost:3000/api/sessions/clue', {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const value = await response.json();
        if (!['A', 'B'].includes(value.role) || typeof value.clue !== 'string' || typeof value.title !== 'string') throw new Error();
        if (live) setClue({ role: value.role, clue: value.clue, title: value.title });
      } catch { if (live) setStatus('Clue unavailable. Checking access again shortly.'); }
      if (live) timer = setTimeout(refresh, 5000);
    }
    missionSocket.on('disconnect', clear);
    refresh();
    return () => { live = false; controller.abort(); clearTimeout(timer); missionSocket.off('disconnect', clear); };
  }, []);
  return <section className="private-clue" aria-label="Your private mission clue">
    <h3>Your clue {clue && `· Role ${clue.role}`}</h3>
    {clue ? <><p>{clue.title}</p><p className="private-clue-text">{clue.clue}</p></> : <p role="status">{status}</p>}
    <small>This card is visible to anyone watching a screen share of this dashboard.</small>
  </section>;
}
