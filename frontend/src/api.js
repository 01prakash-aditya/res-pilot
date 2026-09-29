/**
 * Centralised Axios instance — eliminates all hardcoded localhost URLs.
 * Every component imports from here instead of calling axios directly.
 */
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const api = axios.create({
  baseURL: API_URL,
  timeout: 600_000, // 10 minutes for large model processing
  headers: {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  },
});

/** Helper: build a URL for SSE EventSource (query-param auth for browser compat) */
export const sseUrl = (path) => {
  const url = `${API_URL}${path}`;
  return API_KEY ? `${url}?api_key=${API_KEY}` : url;
};

export default api;
