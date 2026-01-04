import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 42069
  },
  preview: {
    port: 4443,
    host: '0.0.0.0',
    allowedHosts: ['evades-pkez.onrender.com']
  }
});
