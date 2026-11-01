import { useEffect, useState } from 'react';
import { missionSocket } from './socket';

function isPublicMission(value) {
  return value && typeof value.id === 'string' && typeof value.title === 'string'
    && ['active', 'completed'].includes(value.status);
}

export function useMissionSocket() {
  const [mission, setMission] = useState(null);
  const [connection, setConnection] = useState({
    state: 'connecting', detail: 'Connecting to the mission server…',
  });
  const [lastEvent, setLastEvent] = useState('Waiting for mission state');

  useEffect(() => {
    const receiveMission = eventName => payload => {
      if (!isPublicMission(payload)) {
        setConnection({ state: 'error', detail: 'The server sent an invalid mission update.' });
        setLastEvent('invalid payload');
        return;
      }
      setMission({ id: payload.id, title: payload.title, status: payload.status });
      setLastEvent(eventName);
    };
    const onState = receiveMission('mission:state');
    const onCompleted = receiveMission('mission:completed');
    const onConnect = () => setConnection({
      state: 'connected', detail: 'Live mission updates are online.',
    });
    const onDisconnect = reason => {
      if (reason === 'io server disconnect') missionSocket.connect();
      setConnection({
      state: 'disconnected', detail: 'Connection lost. Waiting to reconnect…',
      });
    };
    const onConnectError = () => setConnection({
      state: 'error', detail: 'Cannot reach the mission server at localhost:3000.',
    });
    const onReconnectAttempt = () => setConnection({
      state: 'reconnecting', detail: 'Reconnecting to the mission server…',
    });

    missionSocket.on('connect', onConnect);
    missionSocket.on('disconnect', onDisconnect);
    missionSocket.on('connect_error', onConnectError);
    missionSocket.on('mission:state', onState);
    missionSocket.on('mission:completed', onCompleted);
    missionSocket.io.on('reconnect_attempt', onReconnectAttempt);
    missionSocket.connect();

    return () => {
      missionSocket.off('connect', onConnect);
      missionSocket.off('disconnect', onDisconnect);
      missionSocket.off('connect_error', onConnectError);
      missionSocket.off('mission:state', onState);
      missionSocket.off('mission:completed', onCompleted);
      missionSocket.io.off('reconnect_attempt', onReconnectAttempt);
      missionSocket.disconnect();
    };
  }, []);

  return { mission, connection, lastEvent };
}
