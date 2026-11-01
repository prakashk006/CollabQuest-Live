import { io } from 'socket.io-client';

export const missionSocket = io('http://localhost:3000', {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
});
