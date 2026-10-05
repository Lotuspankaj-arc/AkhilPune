export const API_BASE = import.meta.env.VITE_API_BASE || '';
const configuredPlatformHostnames = String(import.meta.env.VITE_PLATFORM_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
const defaultPlatformHostnames = ['localhost', '127.0.0.1', '::1'];

export function isPlatformHostname(hostname = window.location.hostname) {
    const normalizedHostname = String(hostname || '').trim().toLowerCase();
    return [...defaultPlatformHostnames, ...configuredPlatformHostnames].includes(normalizedHostname);
}

export function apiUrl(path) {
    if (!path) return API_BASE || '';
    if (!path.startsWith('/')) path = '/' + path;
    return API_BASE ? `${API_BASE}${path}` : path;
}

export default { API_BASE, apiUrl, isPlatformHostname };
