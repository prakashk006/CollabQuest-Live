import { useMissionSocket } from './useMissionSocket';

export default function Overlay() {
  const { mission, connection } = useMissionSocket();

  if (!mission) {
    return (
      <main className="overlay-shell">
        <div className="overlay-sync" role="status">
          <span aria-hidden="true" /> Syncing mission status…
        </div>
      </main>
    );
  }

  const completed = mission.status === 'completed';
  const progress = completed ? 100 : 0;

  return (
    <main className={`overlay-shell${completed ? ' overlay-shell--completed' : ''}`}>
      <section className="overlay-card" aria-labelledby="overlay-mission-title">
        <div className="overlay-accent" aria-hidden="true" />
        <div className="overlay-heading">
          <div className="overlay-brand" aria-label="CollabQuest Live">CQ</div>
          <div className="overlay-title-block">
            <p>Current mission</p>
            <h1 id="overlay-mission-title">{mission.title}</h1>
          </div>
          <div className={`overlay-status overlay-status--${completed ? 'unlocked' : 'active'}`}>
            <span aria-hidden="true" />
            {completed ? 'UNLOCKED' : 'ACTIVE'}
          </div>
        </div>
        <div className="overlay-progress-row">
          <div className="overlay-progress" role="progressbar" aria-label="Mission completion"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>
        <div className={`overlay-connection overlay-connection--${connection.state}`} role="status">
          <span aria-hidden="true" /> {connection.state}
        </div>
      </section>
    </main>
  );
}
