export function MissionCard({ mission }) {
  const completed = mission?.status === 'completed';
  const progress = completed ? 100 : 0;

  return (
    <section className={`mission-card${completed ? ' mission-card--completed' : ''}`}
      aria-labelledby="mission-title">
      <div className="mission-card__glow" aria-hidden="true" />
      <div className="mission-card__topline">
        <span className="section-label">Current mission</span>
        <span className={`mission-state mission-state--${completed ? 'completed' : 'active'}`}>
          {completed ? 'Unlocked' : 'Active'}
        </span>
      </div>
      <div className="mission-card__content">
        <div className="vault-icon" aria-hidden="true">
          <span className="vault-icon__ring" /><span className="vault-icon__core" />
        </div>
        <div>
          <p className="mission-id">{mission?.id || 'Awaiting mission data'}</p>
          <h2 id="mission-title">{mission?.title || 'Connecting to mission control…'}</h2>
          <p className="mission-description">
            {completed
              ? 'Mission complete. The vault has been unlocked by the community.'
              : 'Communities are collaborating live through Twitch chat.'}
          </p>
        </div>
      </div>
      <div className="progress-block">
        <div className="progress-meta"><span>Mission completion</span><strong>{progress}%</strong></div>
        <div className="progress-track" role="progressbar" aria-label="Mission completion"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
          <span className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
