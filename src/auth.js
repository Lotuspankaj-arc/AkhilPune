// Simple in-memory auth token holder for non-React modules
let accessToken = null;

export function setToken(token) {
    accessToken = token;
}

export function getToken() {
    return accessToken;
}

export function clearToken() {
    accessToken = null;
}

export default { setToken, getToken, clearToken };
