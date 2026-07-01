/**
 * Returns backend API URL.
 * Example:
 * VITE_API_BASE_URL=https://promptarena-backend-7lmh.onrender.com
 *
 * apiPath("/auth/login")
 * =>
 * https://promptarena-backend-7lmh.onrender.com/api/auth/login
 */
export function apiPath(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");

  const p = path.startsWith("/") ? path : `/${path}`;

  if (base) {
    return `${base}/api${p}`;
  }

  return `/api${p}`;
}