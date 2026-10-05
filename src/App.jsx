import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';

import HomeWithLogin from './pages/HomeWithLogin';
import OnlineSuchi from './pages/OnlineSuchi';
import RegistrationForm from './components/RegistrationForm';
import ClientPublicHome from './components/ClientPublicHome';
import AdminPanel from './components/AdminPanel';
import AdminProfile from './components/AdminProfile';
import NavBar from './components/NavBar';
import { isPlatformHostname } from './config';
import { HeartHandshake, ListFilter, UserRound } from 'lucide-react';

function PaymentPage() {
    const location = useLocation();
    return (
        <div className="relative min-h-screen bg-gradient-to-b from-[#3a0810] via-[#4a0a13] to-[#5c0a18] px-4 py-20 text-white overflow-hidden">
            <div className="bg-blob -top-20 -left-20 h-72 w-72 bg-amber-500/25 animate-float-slow"></div>
            <div className="bg-blob bottom-0 -right-20 h-72 w-72 bg-rose-500/20 animate-float-slower"></div>
            <div className="glass-card animate-fade-in-up relative z-10 mx-auto max-w-3xl rounded-[28px] p-8">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Payment Stage</p>
                <h1 className="mt-2 text-3xl font-extrabold text-gradient-gold">Biodata verified. Proceed to payment.</h1>
                <p className="mt-4 text-base leading-7 text-rose-100/90">
                    Your profile has been reviewed. This screen is the handoff point for payment integration and can receive the registration state from the biodata preview step.
                </p>
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-black/20 p-5 text-sm text-amber-100">
                    {location.state?.candidateId ? (
                        <div>
                            <div className="font-bold">Candidate ID: {location.state.candidateId}</div>
                            <div className="mt-1 opacity-80">Continue from here to attach your payment gateway.</div>
                        </div>
                    ) : (
                        <div>No candidate data was passed to the payment step.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CandidateProfileWorkspace({ loggedInUser, setLoggedInUser }) {
    const { token } = useAuth();
    const [tab, setTab] = useState('profile');
    const [statusSaving, setStatusSaving] = useState(false);
    const tabs = [
        ['profile', 'My Profile', UserRound],
        ['shortlisted', 'Shortlisted', ListFilter],
        ['mutual', 'Mutual Likes', HeartHandshake]
    ];

    const toggleOwnProfile = async () => {
        setStatusSaving(true);
        try {
            const response = await fetch(`/api/update/${loggedInUser.id}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: loggedInUser.is_active === false })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to update profile visibility.');
            setLoggedInUser({ ...loggedInUser, is_active: data.user?.is_active ?? loggedInUser.is_active === false });
        } catch (error) {
            window.alert(error.message);
        } finally {
            setStatusSaving(false);
        }
    };

    return (
        <main className="profile-workspace min-h-screen px-4 pb-16 pt-24 text-red-950 sm:px-6">
            <div className="mx-auto max-w-7xl">
                <header className="profile-workspace__hero mb-6 overflow-hidden rounded-[28px] p-6 sm:p-8">
                    <div className="relative z-10 max-w-2xl">
                        <p className="profile-workspace__eyebrow">Candidate workspace</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Your profile, your shortlist.</h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-amber-100/75 sm:text-base">Keep your biodata current, discover compatible profiles, and follow the connections that matter.</p>
                    </div>
                    <div className="profile-workspace__identity">
                        <span className="profile-workspace__status" />
                        <span>{loggedInUser?.name || 'Candidate'}</span>
                        <button type="button" onClick={toggleOwnProfile} disabled={statusSaving} className="ml-3 rounded-lg border border-amber-200/40 px-3 py-1 text-xs font-bold text-amber-100">
                            {loggedInUser?.is_active === false ? 'Enable profile' : 'Disable profile'}
                        </button>
                    </div>
                </header>

                <nav className="profile-tabs mb-7" aria-label="Candidate workspace">
                    {tabs.map(([value, label, Icon]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTab(value)}
                            className={`profile-tab ${tab === value ? 'profile-tab--active' : ''}`}
                        >
                            <Icon size={18} strokeWidth={2.2} />
                            {label}
                        </button>
                    ))}
                </nav>
                {tab === 'profile' ? (
                    <RegistrationForm loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />
                ) : (
                    <OnlineSuchi initialInteraction={tab} />
                )}
            </div>
        </main>
    );
}

function PublicRoot({ loggedInUser, setLoggedInUser }) {
    return isPlatformHostname()
        ? <HomeWithLogin loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />
        : <ClientPublicHome domainMode setLoggedInUser={setLoggedInUser} />;
}

function App() {
    const { token, authReady } = useAuth();
    // GLOBAL AUTH STATE: Initializes from localStorage so session survives refreshes and back buttons
    const [loggedInUser, setLoggedInUser] = useState(() => {
        const savedSession = localStorage.getItem('appSession');
        return savedSession ? JSON.parse(savedSession) : null;
    });

    // Auto-sync localStorage when user logs in or out
    useEffect(() => {
        if (loggedInUser) {
            localStorage.setItem('appSession', JSON.stringify(loggedInUser));
        } else {
            localStorage.removeItem('appSession');
        }
    }, [loggedInUser]);

    useEffect(() => {
        if (authReady && loggedInUser && !token) setLoggedInUser(null);
    }, [authReady, loggedInUser, token]);

    const { t } = useTranslation();
    const roleName = (loggedInUser?.roleName || '').toLowerCase();
    const isSuperUser = roleName === 'super_user' || !!loggedInUser?.isSuperUser;
    const isAdmin = roleName === 'admin' || isSuperUser || !!loggedInUser?.isAdmin;

    return (
        <Router>
            <div className="min-h-screen bg-[#4a0a13] font-sans selection:bg-amber-300 selection:text-red-950">
                {authReady && loggedInUser && <NavBar loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />}
                <Routes>
                    <Route
                        path="/"
                        element={<PublicRoot loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />}
                    />
                    <Route path="/login" element={<HomeWithLogin loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />} />
                    <Route path="/register" element={isAdmin ? <Navigate to="/admin-profile" replace /> : (loggedInUser ? <Navigate to="/" replace /> : <RegistrationForm loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />)} />
                    <Route path="/register/:clientSlug/:eventSlug" element={isAdmin ? <Navigate to="/admin-profile" replace /> : (loggedInUser ? <Navigate to="/" replace /> : <RegistrationForm loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} />)} />
                    <Route path="/community/:clientSlug" element={<ClientPublicHome setLoggedInUser={setLoggedInUser} />} />
                    <Route path="/profile" element={loggedInUser && !isAdmin ? <CandidateProfileWorkspace loggedInUser={loggedInUser} setLoggedInUser={setLoggedInUser} /> : <Navigate to="/" replace />} />
                    <Route path="/payment" element={loggedInUser ? <PaymentPage /> : <Navigate to="/" replace />} />
                    <Route path="/admin-profile" element={isAdmin ? <AdminProfile loggedInUser={loggedInUser} /> : <Navigate to="/" replace />} />

                    {/* Protected Route Example */}
                    <Route path="/online-suchi" element={loggedInUser ? <OnlineSuchi /> : <Navigate to="/" replace />} />
                    <Route path="/organizer" element={<div className="p-20 text-center text-2xl text-amber-400">{t('app.pages.organizerComing', 'Organizer Page (Coming Soon)')}</div>} />
                    <Route path="/about" element={<div className="p-20 text-center text-2xl text-amber-400">{t('app.pages.aboutComing', 'About Us (Coming Soon)')}</div>} />
                    <Route path="/contact" element={<div className="p-20 text-center text-2xl text-amber-400">{t('app.pages.contactComing', 'Contact (Coming Soon)')}</div>} />
                    <Route path="/admin" element={isAdmin ? <AdminPanel token={token} loggedInUser={loggedInUser} isSuperUser={isSuperUser} /> : <Navigate to="/" replace />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;