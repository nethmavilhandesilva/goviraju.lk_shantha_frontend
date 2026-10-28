// Sub-folder the app is served from ('' locally, '/shantha_frontend' in production).
// Set by `base` in vite.config.js.
export const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Laravel backend (API + uploaded files)
// `npm run dev` (local) -> local `php artisan serve`; `npm run build` (hosted) -> goviraju.lk.
// VITE_BACKEND_URL in a .env.local file overrides either one.
const LOCAL_BACKEND_URL = 'http://127.0.0.1:8000';
const HOSTED_BACKEND_URL = 'https://goviraju.lk/shantha_backend/public';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
    || (import.meta.env.DEV ? LOCAL_BACKEND_URL : HOSTED_BACKEND_URL);
export const API_BASE_URL = `${BACKEND_URL}/api`;
export const STORAGE_URL = `${BACKEND_URL}/storage`;
