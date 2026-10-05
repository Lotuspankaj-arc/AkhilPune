import { apiUrl } from '../config';
import { getToken, setToken, clearToken } from '../auth';

export async function fetchWithAuth(url, options = {}) {
    const finalUrl = apiUrl(url);
    const makeRequest = async (token) => {
        const headers = options.headers ? { ...options.headers } : {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(finalUrl, { ...options, headers, credentials: 'include' });
        return res;
    };

    let token = getToken();
    let res = await makeRequest(token);

    if (res.status === 401) {
        // try refresh using cookie
        const r = await fetch(apiUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
        if (!r.ok) {
            clearToken();
            throw new Error('Unauthorized');
        }
        const data = await r.json();
        if (data.accessToken) setToken(data.accessToken);
        token = getToken();
        res = await makeRequest(token);
    }

    return res;
}

export async function fetchJsonWithAuth(url, options = {}) {
    const res = await fetchWithAuth(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
}
