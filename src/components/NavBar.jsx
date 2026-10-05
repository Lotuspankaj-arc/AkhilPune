import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ChevronDown, LogOut, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../utils/api';
import { apiUrl } from '../config';

const toAssetUrl = (assetPath) => {
    if (!assetPath) return '';
    const normalizedPath = String(assetPath).trim();
    if (/^(?:data:|blob:)/i.test(normalizedPath)) return normalizedPath;
    if (/^https?:\/\//i.test(normalizedPath)) {
        try {
            const parsedPath = new URL(normalizedPath);
            if (parsedPath.pathname.startsWith('/api/')) return `${parsedPath.pathname}${parsedPath.search}`;
        } catch (_) {
            return normalizedPath;
        }
        return normalizedPath;
    }
    const path = `/${normalizedPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    return path.startsWith('/api/') ? path : apiUrl(path);
};

// Global, persistent top navigation bar shown on every route.
const NavBar = ({ loggedInUser, setLoggedInUser }) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const { clearToken: authClearToken } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showLikesDropdown, setShowLikesDropdown] = useState(false);
    const [showMsgsDropdown, setShowMsgsDropdown] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [clientName, setClientName] = useState(loggedInUser?.client_name || '');
    const roleName = String(loggedInUser?.roleName || '').toLowerCase();
    const isSuperUser = roleName === 'super_user' || !!loggedInUser?.isSuperUser;
    const isClientAdmin = roleName === 'admin' && !loggedInUser?.isSuperUser;
    const isAdminUser = roleName === 'admin' || roleName === 'super_user' || !!loggedInUser?.isAdmin || !!loggedInUser?.isSuperUser;
    const profilePhoto = toAssetUrl(loggedInUser?.photo || loggedInUser?.photo_path || loggedInUser?.photo_url);
    const isAdminPanel = location.pathname === '/admin';
    const currentPageTitle = {
        '/': t('home.nav.home', 'Home'),
        '/online-suchi': t('home.nav.search', 'Search Online-Suchi'),
        '/admin-profile': t('home.nav.editProfile', 'Edit Profile'),
        '/organizer': t('home.nav.organizer', 'Organizer'),
        '/about': t('home.nav.aboutUs', 'About Us'),
        '/contact': t('home.nav.contact', 'Contact')
    }[location.pathname];
    const brandName = isAdminPanel ? 'Admin Panel' : (isAdminUser ? (currentPageTitle || 'Online Suchi') : (clientName || t('home.brand', 'अखिल पुणे भावसार समाज')));
    const brandShortName = isAdminPanel ? 'Admin Panel' : (isAdminUser ? (currentPageTitle || 'Online Suchi') : (clientName || t('home.brandShort', 'भावसार')));

    useEffect(() => {
        if (!isClientAdmin) {
            setClientName('');
            return undefined;
        }

        setClientName(loggedInUser?.client_name || '');
        return undefined;
    }, [isClientAdmin, loggedInUser?.client_name]);

    useEffect(() => {
        if (!loggedInUser || loggedInUser.isAdmin) {
            setNotifications([]);
            return undefined;
        }

        const loadNotifications = async () => {
            try {
                const response = await fetchWithAuth('/api/candidate/notifications');
                const data = await response.json().catch(() => ({}));
                if (response.ok) setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
            } catch (_) {
                setNotifications([]);
            }
        };

        loadNotifications();
        const intervalId = window.setInterval(loadNotifications, 30000);
        return () => window.clearInterval(intervalId);
    }, [loggedInUser]);

    const handleLogout = () => {
        const returnPath = loggedInUser?.publicHomePath || '/';
        fetch('/auth/logout', { method: 'POST', credentials: 'include' }).finally(() => {
            authClearToken();
            localStorage.removeItem('appSession');
            setLoggedInUser(null);
            setIsMenuOpen(false);
            window.location.replace(returnPath);
        });
    };

    const navLinks = [
        { name: t('home.nav.home', 'Home'), path: '/' },
        { name: t('home.nav.search', 'Search Online-Suchi'), path: '/online-suchi' },
        ...(!isSuperUser ? [
            { name: t('home.nav.editProfile', 'Edit Profile'), path: loggedInUser?.isAdmin ? '/admin-profile' : '/profile' },
            { name: t('home.nav.organizer', 'Organizer'), path: '/organizer' },
        ] : []),
        { name: t('home.nav.aboutUs', 'About Us'), path: '/about' },
        { name: t('home.nav.contact', 'Contact'), path: '/contact' },
    ];
    if (loggedInUser?.isAdmin) {
        navLinks.push({ name: t('home.nav.adminPanel', 'Admin Panel'), path: '/admin' });
    }

    return (
        <>
            {!loggedInUser && <div className="fixed left-0 top-0 z-50 flex h-8 w-full items-center justify-center bg-[#4a0a13] px-4 text-center text-[11px] font-semibold text-amber-100">॥ श्री हिंगुलांबिका देवी प्रसन्न ॥ &nbsp; | &nbsp; अखिल पुणे भावसार समाज</div>}
            <nav className={`fixed left-0 z-40 w-full border-b shadow-[0_10px_30px_-15px_rgba(0,0,0,0.35)] ${loggedInUser ? 'top-0 border-amber-500/10 bg-[#4a0a13]/90 backdrop-blur-xl' : 'top-8 border-red-950/10 bg-white'}`}>
            <div className="flex h-16 w-full items-center justify-between px-4 lg:px-8">

                {/* LOGO */}
                <Link to="/" className={`flex items-center gap-2 text-xl font-extrabold tracking-tight ${loggedInUser ? 'text-white' : 'text-[#4a0a13]'}`}>
                    {!loggedInUser ? <img src="/icon-192.png?v=2" className="h-11 w-11 object-contain" alt="भावसार समाज लोगो" /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg shadow-amber-900/40"><Heart className="text-red-950" fill="currentColor" size={18} /></span>}
                    <span className={`hidden sm:block ${loggedInUser ? 'text-gradient-gold' : 'text-[#4a0a13]'}`}>{brandName}</span>
                    <span className={`sm:hidden ${loggedInUser ? 'text-gradient-gold' : 'text-[#4a0a13]'}`}>{brandShortName}</span>
                    {loggedInUser && (
                        <span className="ml-2 hidden md:inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 border border-amber-500/40">
                            {loggedInUser.name} ({String(loggedInUser.roleName || 'candidate').replace('_', ' ')})
                        </span>
                    )}
                </Link>

                {/* RIGHT SIDE (Profile Dropdown ONLY - No Hamburger) */}
                <div className="flex items-center gap-3 sm:gap-4">
                    {/* language selector */}
                    {!loggedInUser && <Link to="/register" className="hidden items-center gap-2 rounded-lg bg-[#4a0a13] px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-[#671122] sm:inline-flex">नोंदणी करा</Link>}
                    <div className="hidden sm:block">
                        <select
                            value={i18n.language}
                            onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLang', e.target.value); }}
                            className={`${loggedInUser ? 'bg-[#4a0a13] text-amber-200 border-amber-500/25' : 'bg-white text-[#4a0a13] border-red-950/15'} rounded-lg border px-3 py-2 mr-2 cursor-pointer transition hover:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/40`}
                        >
                            <option value="en">English</option>
                            <option value="mr">मराठी</option>
                            <option value="hi">हिन्दी</option>
                        </select>
                    </div>
                    {/* Notification icons */}
                    {loggedInUser && !loggedInUser.isAdmin && (
                        <div className="flex items-center gap-1 sm:gap-2 relative">
                            <div className="relative">
                                <button onClick={() => { setShowLikesDropdown(!showLikesDropdown); setShowMsgsDropdown(false); }} className="relative p-2 rounded-full hover:bg-[#69111c] hover:scale-110 active:scale-95 transition-all duration-200">
                                    <Heart className="text-amber-400" size={18} />
                                    <span className="absolute -top-1 -right-1 bg-amber-400 text-red-950 text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md">{notifications.filter((notification) => notification.type === 'mutual_match').length}</span>
                                </button>
                                {showLikesDropdown && (
                                    <div className="notification-dropdown absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border border-amber-500/30 z-50 p-3 animate-pop-in origin-top-right">
                                        <p className="text-xs text-rose-200/70 mb-2 font-bold uppercase tracking-wide">Mutual Matches</p>
                                        <div className="space-y-2">
                                            {notifications.filter((notification) => notification.type === 'mutual_match').slice(0, 5).map((notification) => (
                                                <div key={notification.id} className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/5">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-300"><Heart size={15} fill="currentColor" /></span>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{notification.name}</p>
                                                        <p className="text-xs text-emerald-200/80">You both shortlisted each other.</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {notifications.filter((notification) => notification.type === 'mutual_match').length === 0 && <p className="text-sm text-rose-200/70">No mutual matches yet.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button onClick={() => { setShowMsgsDropdown(!showMsgsDropdown); setShowLikesDropdown(false); }} className="relative p-2 rounded-full hover:bg-[#69111c] hover:scale-110 active:scale-95 transition-all duration-200">
                                    <MessageCircle className="text-amber-400" size={18} />
                                    <span className="absolute -top-1 -right-1 bg-amber-400 text-red-950 text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md">{notifications.length}</span>
                                </button>
                                {showMsgsDropdown && (
                                    <div className="notification-dropdown absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border border-amber-500/30 z-50 p-3 animate-pop-in origin-top-right">
                                        <p className="text-xs text-rose-200/70 mb-2 font-bold uppercase tracking-wide">Notifications</p>
                                        <div className="space-y-2">
                                            {notifications.map((notification) => (
                                                <div key={notification.id} className="bg-[#69111c] p-2 rounded-md transition hover:bg-[#7a1320]">
                                                    <p className="text-xs font-bold text-amber-400">{notification.type === 'mutual_match' ? 'Mutual Match' : 'New Shortlist'}</p>
                                                    <p className="text-sm text-rose-200">{notification.type === 'mutual_match' ? `${notification.name} shortlisted you too. You are a mutual match.` : `${notification.name} shortlisted your profile.`}</p>
                                                </div>
                                            ))}
                                            {notifications.length === 0 && <p className="text-sm text-rose-200/70">No new shortlist notifications.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {loggedInUser ? (
                        <div className="relative">
                            {/* Profile Button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-2 bg-[#69111c] pl-1.5 pr-3 py-1 rounded-full border border-amber-500/40 hover:bg-[#7a1320] transition shadow-inner focus:outline-none"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center font-bold text-red-950 text-sm border-[1.5px] border-amber-300 shadow-sm overflow-hidden">
                                    {profilePhoto ? <img src={profilePhoto} className="w-full h-full object-cover" alt="User" /> : loggedInUser.initials}
                                </div>
                                <ChevronDown size={16} className={`text-amber-400 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu (Instagram/Facebook Style) */}
                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                                    <div className="glass-card profile-dropdown absolute top-12 right-0 w-64 rounded-2xl shadow-2xl border border-amber-500/30 z-50 overflow-hidden animate-pop-in origin-top-right">

                                        <div className="p-4 border-b border-red-900/50 bg-gradient-to-r from-[#4a0a13] to-[#5c0a18]">
                                            <p className="text-xs text-rose-200/80 uppercase font-semibold tracking-wide">{t('home.profile.signedInAs', 'Signed in as')}</p>
                                            <p className="text-base font-bold text-white truncate">{loggedInUser.name}</p>
                                        </div>

                                        <div className="p-2 flex flex-col">
                                            {navLinks.map((link) => (
                                                <Link key={link.name} to={link.path} onClick={() => setIsMenuOpen(false)} className="px-4 py-2.5 text-amber-50 hover:bg-[#69111c] hover:translate-x-1 rounded-xl font-medium transition-all duration-200 flex items-center gap-2">
                                                    {link.name}
                                                </Link>
                                            ))}
                                        </div>

                                        <div className="p-2 border-t border-red-900/50 bg-[#4a0a13]">
                                            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl font-bold transition">
                                                <LogOut size={18} /> {t('home.profile.logout', 'Logout')}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div></div>
                        // Registration is now client-specific via shared URLs only
                        // General public registration removed
                    )}
                </div>
            </div>
            </nav>
        </>
    );
};

export default NavBar;
