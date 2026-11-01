export function DashboardHeader({ connection }) {
  return (
    <header className="dashboard-header">
      <div className="brand-mark" aria-hidden="true"><span /><span /></div>
      <div className="brand-copy">
        <p className="eyebrow">Community mission control</p>
        <h1>CollabQuest <strong>Live</strong></h1>
      </div>
      <div className={`connection-badge connection-badge--${connection.state}`}
        role="status" aria-live="polite">
        <span className="connection-dot" aria-hidden="true" />
        <span>{connection.state}</span>
      </div>
    </header>
  );
}
