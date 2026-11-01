export function StatusCards({ connection, lastEvent }) {
  return (
    <section className="status-cards" aria-label="Live system status">
      <article className="status-card">
        <div className="status-card__icon" aria-hidden="true">⌁</div>
        <div>
          <p className="section-label">Connection</p>
          <h2>{connection.state}</h2>
          <p>{connection.detail}</p>
        </div>
      </article>
      <article className="status-card">
        <div className="status-card__icon" aria-hidden="true">↯</div>
        <div>
          <p className="section-label">Latest event</p>
          <h2>{lastEvent}</h2>
          <p>Most recent update received from Socket.IO.</p>
        </div>
      </article>
    </section>
  );
}
