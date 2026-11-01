import { useEffect, useRef, useState } from 'react';

export function OverlayLink() {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [link, setLink] = useState(null), [manual, setManual] = useState(false);
  const pending = useRef(false), field = useRef(null), controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(() => {
      setLink(null); setManual(false); setNotice('Link expired. Copy a new overlay link.');
    }, Math.max(0, link.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [link]);
  useEffect(() => {
    if (manual) { field.current?.focus(); field.current?.select(); }
  }, [manual]);
  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url);
      setManual(false); setNotice('Overlay link copied');
    } catch {
      setManual(true); setNotice('Select and copy this link');
      field.current?.focus(); field.current?.select();
    }
  }
  async function act(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setNotice(action === 'link' ? 'Copying overlay link…' : 'Revoking overlay link…');
    try {
      if (action === 'link' && link?.expiresAt > Date.now()) {
        await copy(link.url); return;
      }
      setLink(null); setManual(false);
      controller.current = new AbortController();
      const response = await fetch(`http://localhost:3000/api/sessions/overlay-${action}`, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(10000)]),
        headers: { 'Content-Type': 'application/json', 'X-CollabQuest-CSRF': '1' }, body: '{}',
      });
      if (!response.ok) {
        setNotice(response.status === 401 ? 'Please connect Twitch again.'
          : response.status === 429 ? 'Too many attempts. Wait a minute and retry.'
          : 'Overlay unavailable. Check that your session is active and retry.');
        return;
      }
      if (action === 'link') {
        const value = await response.json();
        setLink({ url: value.url, expiresAt: value.expiresAt });
        await copy(value.url);
      } else setNotice('Your overlay link is revoked.');
    } catch { setNotice('Cannot reach the overlay service. Check your connection and retry.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="overlay-link-actions">
    <button type="button" disabled={busy} onClick={() => act('link')}>Copy OBS Overlay Link</button>{' '}
    <button type="button" disabled={busy} onClick={() => act('revoke')}>Revoke OBS Link</button>
    <p>Anyone with this link can view your stream-visible clue until expiry or revocation. A newly generated link replaces your previous link; copying again here reuses it.</p>
    <p className="overlay-copy-notice" role="status" aria-live="polite">{notice}</p>
    {manual && link && <div className="overlay-copy-fallback">
      <label>Private OBS overlay URL
        <input ref={field} type="text" readOnly value={link.url} autoComplete="off" spellCheck={false}
          onFocus={event => event.target.select()} />
      </label>
      <button type="button" disabled={busy} onClick={() => act('link')}>Copy link</button>{' '}
      <button type="button" onClick={() => { field.current?.focus(); field.current?.select(); }}>Select link</button>
      <p>Press Ctrl+C to copy the selected link, then paste it into OBS. Keep this URL private.</p>
    </div>}
  </div>;
}
