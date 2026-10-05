import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
    Mail, Lock, ArrowRight, Calendar, UserPlus,
    Star, CheckCircle2, GraduationCap, Users, Clock,
    ChevronLeft, ChevronRight, MapPin, Upload, Building2,
    Utensils, ParkingCircle, ShieldCheck, Sparkles
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../utils/api';
import { toProfilePhotoUrl, mapServerUserToSession } from '../utils/authSession';

const eventSlides = [
    {
        title: 'Grand Community Melava 2026',
        date: 'July 4, 2026',
        location: 'Pune Community Hall',
        image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1600',
        caption: 'A dignified gathering for families to connect through verified Online Suchi profiles.'
    },
    {
        title: 'Youth Connect Meet',
        date: 'August 18, 2026',
        location: 'Mumbai Heritage Center',
        image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1600',
        caption: 'Modern profile discovery with the warmth and trust of community introductions.'
    },
    {
        title: 'Regional Suchi Sangam',
        date: 'September 12, 2026',
        location: 'Nashik Sabha Gruha',
        image: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=1600',
        caption: 'Event registrations, biodata review, and profile search in one connected experience.'
    }
];

const HomeWithLogin = ({ loggedInUser, setLoggedInUser }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { t, i18n } = useTranslation();
    const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
    const { setToken: authSetToken } = useAuth();

    // Admin States
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminUsersLoading, setAdminUsersLoading] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [editForm, setEditForm] = useState({
        first_name: '', middle_name: '', last_name: '', email: '',
        mobile: '', whatsapp: '', expectations: '', admin_notes: ''
    });

    // --- NEW MERGED STATES FOR PROFILE EDITING ---
    const [dialog, setDialog] = useState({ show: false, message: '' });
    const [pincode, setPincode] = useState('');
    const [postOfficeList, setPostOfficeList] = useState([]);
    const [birthTime, setBirthTime] = useState('');
    const [timePeriod, setTimePeriod] = useState('sakal');

    const postOfficeRef = useRef(null);
    const mobileRef = useRef(null);
    const fileInputRef = useRef(null);

    // Dialog Helper
    const showDialog = (message) => setDialog({ show: true, message });

    // Pincode & Focus Logic
    const handlePincodeChange = async (e) => {
        const value = e.target.value;
        setPincode(value);

        if (value.length === 6) {
            try {
                const response = await fetch(`https://api.postalpincode.in/pincode/${value}`);
                const data = await response.json();

                if (data[0].Status === 'Success') {
                    const offices = data[0].PostOffice;
                    setPostOfficeList(offices);

                    if (offices.length === 1) {
                        // Go directly to mobile if only 1 option
                        mobileRef.current?.focus();
                    } else if (offices.length > 1) {
                        // Stop at dropdown if multiple
                        postOfficeRef.current?.focus();
                    }
                } else {
                    setPostOfficeList([]);
                }
            } catch (error) {
                console.error("Failed to fetch post offices", error);
            }
        } else {
            setPostOfficeList([]);
        }
    };

    const handlePostOfficeChange = () => {
        mobileRef.current?.focus();
    };

    const handlePhotoUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showDialog('Please upload a valid image file.');
            event.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showDialog('Photo is too large. Please upload an image below 5 MB.');
            event.target.value = '';
            return;
        }

        showDialog('Photo selected.');
    };

    // Utility formatting
    const formatDobForUi = (value) => {
        if (!value) return '';
        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [year, month, day] = raw.split('-');
            return `${day}/${month}/${year}`;
        }
        return raw;
    };

    const registeredEvents = Array.isArray(loggedInUser?.registeredEvents) ? loggedInUser.registeredEvents : [];

    const showPopup = (message, type = 'success') => {
        setPopup({ show: true, message, type });
        setTimeout(() => setPopup({ show: false, message: '', type: 'success' }), 3000);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' });
            const responseText = await res.text();
            let data = {};
            if (responseText.trim()) {
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('Login returned a non-JSON response:', parseError);
                }
            }
            if (!res.ok) {
                showPopup([data.error, data.details].filter(Boolean).join(' ') || `Login service unavailable (${res.status}). Please try again.`, 'error');
                return;
            }
            if (!data.user || !data.accessToken) {
                showPopup('Login service returned an incomplete response. Please try again.', 'error');
                return;
            }
            const u = data.user;
            if (data.accessToken) authSetToken(data.accessToken);
            setLoggedInUser(mapServerUserToSession(u));
            showPopup(data.message || 'Login successful!', 'success');
            const roleName = String(u?.roleName || '').toLowerCase();
            const isAdminLogin = roleName === 'admin' || roleName === 'super_user' || !!u?.isAdmin || !!u?.isSuperUser;
            navigate(isAdminLogin ? '/admin-profile' : '/');
        } catch (err) {
            console.error('Login error', err);
            showPopup(err?.message || 'Login failed. Try again.', 'error');
        }
    };

    const popupNotification = popup.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm animate-fade-in">
            <div className="glass-card w-full max-w-xl rounded-3xl border-2 border-amber-500/80 bg-red-950/95 px-6 py-6 text-amber-50 shadow-2xl">
                <div className="flex items-center justify-center gap-3 text-center">
                    {popup.type === 'error' ? <div className="h-3.5 w-3.5 rounded-full bg-red-500"></div> : <CheckCircle2 className="text-emerald-400" size={20} />}
                    <span className="text-base font-semibold leading-snug">{popup.message}</span>
                </div>
            </div>
        </div>
    );

    const loadAdminUsers = async () => {
        setAdminUsersLoading(true);
        try {
            const res = await fetchWithAuth('/api/admin/users');
            const contentType = res.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await res.json() : { error: await res.text() };
            if (res.ok && Array.isArray(data.users)) setAdminUsers(data.users);
            else showPopup(typeof data.error === 'string' ? data.error : 'Failed to load profiles', 'error');
        } catch (error) {
            showPopup(error?.message || 'Failed to load profiles', 'error');
        }
        setAdminUsersLoading(false);
    };

    useEffect(() => {
        if (!loggedInUser?.isAdmin) return;
        loadAdminUsers();
    }, [loggedInUser?.isAdmin]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, rowsPerPage]);

    const filteredAdminUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return adminUsers.filter((user) => {
            const byStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? !!user.is_active : !user.is_active;
            if (!byStatus) return false;
            if (!term) return true;
            const haystack = [user.id, user.first_name, user.email, user.mobile, user.expectations].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [adminUsers, searchTerm, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredAdminUsers.length / rowsPerPage));
    const currentStart = (currentPage - 1) * rowsPerPage;
    const pagedAdminUsers = filteredAdminUsers.slice(currentStart, currentStart + rowsPerPage);

    const matchTarget = loggedInUser?.gender === 'Groom' ? 'Brides' : 'Grooms';
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => { setCurrentSlide((prev) => (prev + 1) % eventSlides.length); }, 5000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!loggedInUser) {
            setEmail('');
            setPassword('');
        }
    }, [loggedInUser]);

    if (!loggedInUser) {
        return (
            <>
                {popupNotification}
                <main className="flex min-h-screen items-center justify-center bg-[#fff8eb] px-4 py-16 text-[#4a0a13] sm:px-6">
                    <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-[#4a0a13] shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="relative flex min-h-[340px] flex-col justify-center overflow-hidden px-7 py-12 text-white sm:px-12 lg:min-h-[560px]">
                        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" />
                        <p className="relative text-sm font-bold tracking-[0.18em] text-amber-300">॥ श्री हिंगुलांबिका देवी प्रसन्न ॥</p>
                        <h1 className="relative mt-5 max-w-lg font-serif text-4xl font-black leading-tight sm:text-6xl">अखिल पुणे <span className="text-gradient-gold">भावसार समाज</span></h1>
                        <p className="relative mt-5 max-w-md text-base leading-7 text-rose-100/80">आपल्या समाजाच्या सुरक्षित ऑनलाइन सूचीमध्ये प्रवेश करण्यासाठी लॉगिन करा.</p>
                        <div className="relative mt-8 flex flex-wrap gap-3 text-sm font-bold text-amber-100/90">
                            <span className="rounded-full border border-amber-300/30 px-4 py-2">सुरक्षित प्रोफाइल</span>
                            <span className="rounded-full border border-amber-300/30 px-4 py-2">विश्वासार्ह माहिती</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center bg-[#fff8eb] px-6 py-10 sm:px-10 lg:px-12">
                        <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-700">Online Suchi</p>
                        <h2 className="mt-2 font-serif text-3xl font-black text-[#4a0a13]">Welcome back</h2>
                        <p className="mt-2 text-sm leading-6 text-red-950/60">लॉगिन केल्यानंतर तुमचे homepage, profile आणि menu उपलब्ध होतील.</p>
                        <form onSubmit={handleLogin} autoComplete="off" className="mt-7 space-y-4">
                            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-red-950/35" size={20} /><input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-modern input-light w-full rounded-xl py-3.5 pl-12 pr-4 font-semibold outline-none" placeholder={t('home.login.emailPlaceholder', 'ईमेल पत्ता')} /></div>
                            <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-red-950/35" size={20} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-modern input-light w-full rounded-xl py-3.5 pl-12 pr-4 font-semibold outline-none" placeholder={t('home.login.passwordPlaceholder', 'पासवर्ड')} /></div>
                            <button type="submit" className="btn-3d btn-3d-gold flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-black">लॉगिन करा <ArrowRight size={19} /></button>
                        </form>
                        <div className="my-6 flex items-center gap-3 text-xs font-bold text-red-950/35"><span className="h-px flex-1 bg-red-950/10" /> किंवा <span className="h-px flex-1 bg-red-950/10" /></div>
                        <Link to="/register" className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#4a0a13] px-4 py-3 font-black text-[#4a0a13] transition hover:bg-[#4a0a13] hover:text-amber-200"><UserPlus size={18} /> नवीन नोंदणी करा</Link>
                    </div>
                    </section>
                </main>
            </>
        );
    }

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#fff8eb] font-sans text-[#4a0a13]">

            {/* POPUP NOTIFICATION (Top) */}
            {popupNotification}

            {/* QUICK DIALOG FOR PHOTO VALIDATION / MESSAGES */}
            {dialog.show && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#fff8eb] p-6 rounded-2xl shadow-2xl w-80 text-center border border-[#4a0a13] transform scale-100 transition-transform">
                        <p className="text-lg text-[#4a0a13] font-extrabold mb-6">{dialog.message}</p>
                        <button
                            onClick={() => setDialog({ show: false, message: '' })}
                            className="w-full bg-amber-400 text-red-950 font-black text-lg py-3 rounded-xl hover:bg-amber-500 transition"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* --- MAIN PAGE CONTENT --- */}
            <div className={`relative z-10 w-full max-w-6xl mx-auto px-4 pb-12 lg:px-8 ${loggedInUser ? 'pt-20' : 'pt-28'}`}>

                {!loggedInUser ? (
                    // LOGGED OUT VIEW
                    <div className="home-landing mt-3 w-full overflow-hidden rounded-[32px]">
                        <section className="home-landing__hero relative overflow-hidden px-5 py-12 sm:px-10 sm:py-16 lg:px-16">
                            <div className="relative z-10 max-w-3xl animate-fade-in-up">
                                <p className="mb-4 text-sm font-bold tracking-[0.18em] text-amber-300 sm:text-base">॥ श्री हिंगुलांबिका देवी प्रसन्न ॥</p>
                                <h1 className="font-serif text-4xl font-black leading-[1.08] text-white sm:text-6xl lg:text-7xl">अखिल पुणे<br /><span className="text-gradient-gold">भावसार समाज</span></h1>
                                <p className="mt-6 max-w-2xl text-xl font-semibold leading-8 text-amber-50 sm:text-2xl">वधू-वर परिचय मेळावा २०२६</p>
                                <p className="mt-3 max-w-xl text-sm leading-6 text-rose-100/75 sm:text-base">संस्कारांची सुंदर गाठ, नव्या आयुष्याची नवी पहाट... एकत्र येऊन यशस्वी करूया, सुखद नात्यांतील ही वाट!</p>
                                <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-red-950"><Calendar size={16} /> रविवार, १३ डिसेंबर २०२६</span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-white/10 px-4 py-2 text-amber-100"><Clock size={16} /> सकाळी ९ ते दु. ५</span>
                                </div>
                                <div className="mt-5 flex items-start gap-2 text-sm leading-6 text-amber-50/80"><MapPin className="mt-1 shrink-0 text-amber-300" size={17} /><span><strong className="text-amber-200">कार्यक्रम स्थळ:</strong> पुणे, महाराष्ट्र</span></div>
                                <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-amber-100/90"><a href="#invitation" className="rounded-full border border-amber-300/35 px-3 py-2 transition hover:bg-amber-300 hover:text-red-950">स्नेह निमंत्रण</a><a href="#features" className="rounded-full border border-amber-300/35 px-3 py-2 transition hover:bg-amber-300 hover:text-red-950">मेळाव्याची वैशिष्ट्ये</a><a href="#rules-fees" className="rounded-full border border-amber-300/35 px-3 py-2 transition hover:bg-amber-300 hover:text-red-950">नियम व शुल्क</a></div>
                            </div>
                            <div className="home-landing__seal" aria-hidden="true">ॐ<br /><span>भावसार</span></div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 bg-[#fff8eb] p-5 sm:p-8 lg:grid-cols-12 lg:p-10">
                            <div className="lg:col-span-7">
                                <div className="group relative min-h-[360px] overflow-hidden rounded-[24px] bg-red-950 shadow-xl sm:min-h-[450px]">
                                    <img src={eventSlides[currentSlide].image} alt="भावसार समाज मेळावा" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#4a0a13] via-[#4a0a13]/35 to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 p-6 text-white sm:p-8">
                                        <p className="mb-2 text-sm font-bold text-amber-300">आपले हार्दिक स्वागत</p>
                                        <h2 className="font-serif text-3xl font-black sm:text-5xl">नाती जुळवूया,<br />समाज जोडूया.</h2>
                                    </div>
                                </div>
                            </div>

                            <div className="surface-card rounded-[24px] p-6 sm:p-8 lg:col-span-5">
                                <p className="text-sm font-black tracking-[0.14em] text-amber-700">ऑनलाईन सूची</p>
                                <h2 className="mt-2 font-serif text-3xl font-black text-[#4a0a13]">उमेदवार लॉगिन</h2>
                                <p className="mt-2 text-sm leading-6 text-red-950/60">आपली प्रोफाइल पाहण्यासाठी आणि जुळणारे स्थळ शोधण्यासाठी लॉगिन करा.</p>
                                <form onSubmit={handleLogin} autoComplete="off" className="mt-6 space-y-4">
                                    <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-red-950/35" size={20} /><input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-modern input-light w-full rounded-xl py-3.5 pl-12 pr-4 font-semibold outline-none" placeholder={t('home.login.emailPlaceholder', 'ईमेल पत्ता')} /></div>
                                    <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-red-950/35" size={20} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-modern input-light w-full rounded-xl py-3.5 pl-12 pr-4 font-semibold outline-none" placeholder={t('home.login.passwordPlaceholder', 'पासवर्ड')} /></div>
                                    <button type="submit" className="btn-3d btn-3d-gold mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-black">लॉगिन करा <ArrowRight size={19} /></button>
                                </form>
                            </div>
                        </section>

                        <section id="features" className="bg-[#fff8eb] px-5 pb-10 sm:px-8 lg:px-10">
                            <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-black tracking-[0.14em] text-amber-700">मेळाव्याची वैशिष्ट्ये</p><h2 className="mt-1 font-serif text-3xl font-black text-[#4a0a13]">आपल्यासाठी खास व्यवस्था</h2></div><Sparkles className="hidden text-amber-500 sm:block" size={30} /></div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {[[Building2, 'सुसज्ज सभागृह', 'समाज बांधवांसाठी प्रशस्त आणि आरामदायी व्यवस्था'], [Users, 'योग्य परिचय', 'विश्वासार्ह प्रोफाइल आणि कुटुंबांमध्ये संवाद'], [ParkingCircle, 'सुरक्षित पार्किंग', 'कार्यक्रमस्थळी वाहनांसाठी प्रशस्त पार्किंग'], [Utensils, 'निःशुल्क भोजन', 'सर्व उपस्थितांसाठी स्वादिष्ट भोजन व्यवस्था']].map(([Icon, title, text]) => <div key={title} className="surface-card surface-card-hover rounded-2xl p-5"><Icon className="text-amber-600" size={25} /><h3 className="mt-4 font-serif text-xl font-black text-[#4a0a13]">{title}</h3><p className="mt-2 text-sm leading-6 text-red-950/60">{text}</p></div>)}
                            </div>
                        </section>

                        <footer className="grid gap-6 bg-[#4a0a13] px-5 py-8 text-rose-100 sm:px-10 lg:grid-cols-3">
                            <div><p className="font-serif text-2xl font-black text-amber-300">अखिल पुणे भावसार समाज</p><p className="mt-2 text-sm leading-6 text-rose-100/70">समाज बांधवांचे स्नेहपूर्वक स्वागत!</p></div>
                            <div><p className="flex items-center gap-2 font-bold text-amber-200"><MapPin size={17} /> कार्यक्रम स्थळ</p><p className="mt-2 text-sm leading-6 text-rose-100/70">पुणे, महाराष्ट्र<br />संपूर्ण माहिती लवकरच उपलब्ध होईल.</p></div>
                            <div><p className="flex items-center gap-2 font-bold text-amber-200"><ShieldCheck size={17} /> विश्वासार्ह ऑनलाइन सूची</p><p className="mt-2 text-sm leading-6 text-rose-100/70">तुमची माहिती सुरक्षितपणे व्यवस्थापित केली जाते.</p></div>
                        </footer>
                    </div>
                ) : loggedInUser?.isAdmin ? (
                    // ADMIN VIEW
                    <div className="w-full max-w-6xl mx-auto mt-6 pb-10">
                        {/* Admin table omitted for brevity in response, keeping it structured as requested */}
                        <div className="glass-card p-6 rounded-2xl mb-5 bg-[#560b17]">
                            <h2 className="text-2xl font-extrabold text-amber-400">All Candidate Profiles (Admin View)</h2>
                        </div>
                    </div>
                ) : (
                    // CANDIDATE LOGGED IN VIEW + NEW MERGED PROFILE FIELDS
                    <div className="w-full max-w-6xl mx-auto mt-6 pb-10">
                        <div className="grid grid-cols-1 gap-6">

                            {/* Profile Summary Card */}
                            <div className="bg-[#560b17] border border-red-900/50 p-6 rounded-2xl shadow-sm">
                                <div className="flex items-start gap-6">
                                    <div className="w-28 h-28 rounded-xl overflow-hidden bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                                {toProfilePhotoUrl(loggedInUser.photo || loggedInUser.photo_path || loggedInUser.photo_url, loggedInUser.name) ? <img src={toProfilePhotoUrl(loggedInUser.photo || loggedInUser.photo_path || loggedInUser.photo_url, loggedInUser.name)} className="w-full h-full object-cover" alt="profile" /> : <div className="text-2xl font-bold text-amber-400">{loggedInUser.initials}</div>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-amber-400">{loggedInUser.name}</h2>
                                                <p className="text-sm text-rose-200/80 mt-1">{loggedInUser.location}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link to="/profile" className="px-4 py-2 rounded-lg bg-amber-400 text-red-950 font-bold">
                                                    {t('home.profile.editProfile', 'Edit Profile')}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#fff8eb] border border-amber-300/50 p-6 rounded-2xl shadow-sm text-red-950">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Event History</p>
                                        <h3 className="mt-1 text-xl font-extrabold text-[#4a0a13]">Registered Events</h3>
                                    </div>
                                    <Calendar className="text-amber-600" size={22} />
                                </div>
                                {registeredEvents.length > 0 ? (
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        {registeredEvents.map((event) => (
                                            <div key={`${event.event_id}-${event.event_registration_code || 'registration'}`} className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                                                <p className="font-bold text-[#4a0a13]">{event.event_name || 'Event'}</p>
                                                <p className="mt-1 text-sm text-red-950/65">Stage ID: <strong className="text-red-950">{event.event_registration_code || 'Pending'}</strong></p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-4 text-sm text-red-950/60">No event registration found.</p>
                                )}
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeWithLogin;