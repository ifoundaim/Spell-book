const LOCAL_API = 'http://localhost:5174';
const PROD_API = 'https://spell-book-api-chag.onrender.com';

const DEFAULT_API_BASE_URL = import.meta.env.PROD ? PROD_API : LOCAL_API;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  .replace(/\/$/, '');
