import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Overlay from './Overlay';
import StreamerOverlay from './StreamerOverlay';
import './style.css';

const isOverlay = window.location.pathname === '/overlay'
  || window.location.pathname.startsWith('/overlay/');
const isStreamerOverlay = window.location.pathname === '/streamer-overlay';
document.documentElement.classList.toggle('overlay-mode', isOverlay || isStreamerOverlay);

createRoot(document.getElementById('root')).render(
  <StrictMode>{isStreamerOverlay ? <StreamerOverlay /> : isOverlay ? <Overlay /> : <App />}</StrictMode>,
);
