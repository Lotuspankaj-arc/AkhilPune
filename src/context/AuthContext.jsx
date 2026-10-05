import React, { createContext, useContext, useState, useEffect } from 'react';
import { setToken as setInMemoryToken, clearToken as clearInMemoryToken } from '../auth';
import { apiUrl } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setTokenState] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    useEffect(() => {
        // keep in-memory token synced
        if (token) setInMemoryToken(token); else clearInMemoryToken();
    }, [token]);

    const setToken = (t) => {
        setTokenState(t);
    };

    const clearToken = () => {
        setTokenState(null);
    };

    // perform a silent refresh on mount to obtain access token if refresh cookie exists
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(apiUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && data.accessToken) setTokenState(data.accessToken);
            } catch (e) {
                // ignore
            } finally {
                if (!cancelled) setAuthReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const value = { token, setToken, clearToken, authReady };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
