import { DashboardHeader } from './components/DashboardHeader';
import { MissionCard } from './components/MissionCard';
import { StatusCards } from './components/StatusCards';
import { useMissionSocket } from './useMissionSocket';
import { AccountStatus } from './components/AccountStatus';
import { SessionControls } from './components/SessionControls';

export default function App() {
  const { mission, connection, lastEvent } = useMissionSocket();
  return (
    <div className="app-shell">
      <DashboardHeader connection={connection} />
      <AccountStatus />
      <main className="dashboard" aria-label="Mission dashboard">
        <section className="hero-copy">
          <p className="eyebrow">Live cooperative challenge</p>
          <h2>Two communities. One shared mission.</h2>
          <p>Mission status updates instantly as Twitch chat works together.</p>
        </section>
        <MissionCard mission={mission} />
        <SessionControls />
        <StatusCards connection={connection} lastEvent={lastEvent} />
      </main>
      <footer><span className="footer-pulse" aria-hidden="true" />Live mission telemetry</footer>
    </div>
  );
}
