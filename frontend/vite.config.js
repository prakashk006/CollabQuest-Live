import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const headers = { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
export default defineConfig({ plugins: [react()], server: { headers }, preview: { headers } });
