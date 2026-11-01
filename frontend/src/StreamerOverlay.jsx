import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function StreamerOverlay() {
  const [clue, setClue] = useState(null), [mission, setMission] = useState(null);
  const [status, setStatus] = useState('Connecting…');
  useEffect(() => {
    const credential = window.location.hash.slice(1);
    if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) {
      setStatus('Overlay unavailable. A valid overlay link is required.'); return;
    }
    // Auth travels in Socket.IO's CONNECT packet, never in the request URL.
    const socket = io('http://localhost:3000', { autoConnect: false,
      withCredentials: false, auth: { overlayCredential: credential } });
    const clear = message => { setClue(null); setMission(null); setStatus(message); };
    socket.on('overlay:clue', value => setClue({ title: value.title, role: value.role, clue: value.clue }));
    const state = value => setMission({ id: value.id, title: value.title, status: value.status });
    socket.on('mission:state', state);
    socket.on('mission:completed', state);
    socket.on('connect', () => setStatus('Connected'));
    socket.on('disconnect', reason => clear(reason === 'io server disconnect'
      ? 'Overlay unavailable: link expired, revoked, or session inactive.' : 'Disconnected. Reconnecting…'));
    socket.on('connect_error', error => clear(error.message === 'overlay_unavailable'
      ? 'Overlay unavailable: link expired, revoked, or session inactive.' : 'Connection unavailable. Retrying…'));
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, []);
  const completed = mission?.status === 'completed', progress = completed ? 100 : 0;
  return <main className={`overlay-shell${completed ? ' overlay-shell--completed' : ''}`}>
    {clue && mission ? <section className="overlay-card streamer-overlay" aria-label="Streamer mission overlay">
      <div className="overlay-heading">
        <div className="overlay-title-block"><p>CollabQuest Live · Role {clue.role}</p><h1>{mission.title}</h1></div>
        <div className={`overlay-status overlay-status--${completed ? 'unlocked' : 'active'}`}>
          {completed ? 'UNLOCKED' : 'ACTIVE'}
        </div>
      </div>
      <p className="streamer-overlay-clue">{clue.clue}</p>
      <div className="overlay-progress-row">
        <div className="overlay-progress" role="progressbar" aria-label="Mission completion"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        <strong>{progress}%</strong>
      </div>
    </section> : <div className="overlay-sync" role="status">{status}</div>}
  </main>;
}
