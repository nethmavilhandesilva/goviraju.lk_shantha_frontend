// Sub-folder the app is served from ('' locally, '/shantha_frontend' in production).
// Set by `base` in vite.config.js.
export const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Laravel backend (API + uploaded files)
export const BACKEND_URL = 'https://goviraju.lk/shantha_backend/public';
export const API_BASE_URL = `${BACKEND_URL}/api`;
export const STORAGE_URL = `${BACKEND_URL}/storage`;
