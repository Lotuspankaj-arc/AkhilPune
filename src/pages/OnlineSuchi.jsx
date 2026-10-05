import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Phone, MessageCircle, Heart, X, RotateCcw, GraduationCap, Briefcase, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth } from '../utils/api';
import { apiUrl } from '../config';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 12;
const AGE_MIN_LIMIT = 18;
const AGE_MAX_LIMIT = 70;
const INCOME_MIN_LIMIT = 0;
const INCOME_MAX_LIMIT = 10000000;

const toIndianPhoneNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
};

const formatProfileValue = (value) => {
    if (value === null || value === undefined) return '';
    let normalized = value;
    if (typeof value === 'string') {
        try {
            normalized = JSON.parse(value);
        } catch (_) {
            normalized = value;
        }
    }
    if (Array.isArray(normalized)) {
        return normalized.map((item) => (item && typeof item === 'object' ? item.name || item.label || '' : String(item))).filter(Boolean).join(', ');
    }
    if (normalized && typeof normalized === 'object') {
        return Object.values(normalized).filter(Boolean).join(', ');
    }
    return String(normalized).trim();
};

const formatProfileDate = (value) => {
    if (!value) return '';
    const dateValue = String(value).slice(0, 10);
    const date = new Date(`${dateValue}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN');
};

const OnlineSuchi = ({ initialInteraction = 'all' }) => {
    const { t, i18n } = useTranslation();
    const { token, authReady } = useAuth();
    const [query, setQuery] = useState('');
    const [gender, setGender] = useState('all');
    const [marriageType, setMarriageType] = useState('all');
    const [district, setDistrict] = useState('');
    const [incomeMax, setIncomeMax] = useState(INCOME_MAX_LIMIT);
    const [ageMin, setAgeMin] = useState(AGE_MIN_LIMIT);
    const [ageMax, setAgeMax] = useState(AGE_MAX_LIMIT);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [interactionView, setInteractionView] = useState(initialInteraction);

    const text = (en, mr, hi) => {
        if (i18n.language === 'mr') return mr;
        if (i18n.language === 'hi') return hi;
        return en;
    };

    const marriageOptions = useMemo(() => ([
        { value: 'all', label: t('onlineSuchi.all', text('All', 'सर्व', 'सभी')) },
        { value: 'First Marriage', label: t('onlineSuchi.firstMarriage', text('First Marriage', 'प्रथम विवाह', 'प्रथम विवाह')) },
        { value: 'Re Marriage', label: t('onlineSuchi.remarriage', text('Re Marriage', 'पुनः विवाह', 'पुनर्विवाह')) }
    ]), [i18n.language]);

    const genderOptions = useMemo(() => ([
        { value: 'all', label: t('onlineSuchi.all', text('All', 'सर्व', 'सभी')) },
        { value: 'Bride', label: t('onlineSuchi.bride', text('Bride', 'वधू', 'वधू')) },
        { value: 'Groom', label: t('onlineSuchi.groom', text('Groom', 'वर', 'वर')) }
    ]), [i18n.language]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const ageTrackStart = ((ageMin - AGE_MIN_LIMIT) / (AGE_MAX_LIMIT - AGE_MIN_LIMIT)) * 100;
    const ageTrackEnd = ((ageMax - AGE_MIN_LIMIT) / (AGE_MAX_LIMIT - AGE_MIN_LIMIT)) * 100;

    const loadProfiles = async (nextPage = page) => {
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            if (query.trim()) params.set('q', query.trim());
            if (gender !== 'all') params.set('gender', gender);
            if (marriageType !== 'all') params.set('marriageType', marriageType);
            if (district.trim()) params.set('district', district.trim());
            if (incomeMax < INCOME_MAX_LIMIT) params.set('incomeMax', String(incomeMax));
            if (ageMin > AGE_MIN_LIMIT) params.set('ageMin', String(ageMin));
            if (ageMax < AGE_MAX_LIMIT) params.set('ageMax', String(ageMax));
            if (interactionView !== 'all') params.set('interaction', interactionView);
            params.set('page', String(nextPage));
            params.set('limit', String(PAGE_SIZE));

            const res = await fetchWithAuth(`/api/online-suchi/search?${params.toString()}`);
            const contentType = res.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await res.json() : await res.text();

            if (typeof data === 'string') {
                setError(t('onlineSuchi.loadError', text('Unable to load profiles right now. Please try again later.', 'सध्या प्रोफाइल लोड करता येत नाहीत. कृपया नंतर पुन्हा प्रयत्न करा.', 'अभी प्रोफाइल लोड नहीं हो सकीं। कृपया बाद में पुनः प्रयास करें।')));
                setProfiles([]);
                setTotal(0);
                return;
            }

            if (!res.ok) {
                setError(data.error || 'Failed to load profiles.');
                setProfiles([]);
                setTotal(0);
                return;
            }

            setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
            setTotal(Number(data.total || 0));
            setPage(Number(data.page || nextPage));
        } catch (err) {
            setError(err?.message || 'Failed to load profiles.');
            setProfiles([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authReady) return;
        if (!token) {
            setLoading(false);
            setError(text('Your session has expired. Please log in again.', 'तुमचे सत्र संपले आहे. कृपया पुन्हा लॉग इन करा.', 'आपका सत्र समाप्त हो गया है। कृपया फिर से लॉग इन करें।'));
            setProfiles([]);
            setTotal(0);
            return;
        }
        loadProfiles(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, token, gender, marriageType, interactionView]);

    useEffect(() => {
        if (!authReady || !token || page === 1) return;
        loadProfiles(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, token, page]);

    const profilePhotoUrl = (profile) => {
        if (profile.photo_path) {
            const normalized = `/${String(profile.photo_path).replace(/\\/g, '/').replace(/^\/+/, '')}`;
            // Keep protected media same-origin so Vite and the production server can proxy it consistently.
            return normalized.startsWith('/api/') ? normalized : apiUrl(normalized);
        }

        const name = profile.can_view_sensitive || profile.is_mutual
            ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || 'User'
            : 'Profile';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f59e0b&color=fff`;
    };

    const filterSummary = (() => {
        const parts = [];
        if (gender !== 'all') parts.push(gender);
        if (marriageType !== 'all') parts.push(marriageType);
        if (district.trim()) parts.push(`${text('District', 'जिल्हा', 'जिला')}: ${district.trim()}`);
        if (ageMin > AGE_MIN_LIMIT || ageMax < AGE_MAX_LIMIT) parts.push(`${text('Age', 'वय', 'आयु')}: ${ageMin}-${ageMax}`);
        if (incomeMax < INCOME_MAX_LIMIT) parts.push(`${text('Max Income', 'कमाल उत्पन्न', 'अधिकतम आय')}: ${Number(incomeMax).toLocaleString('en-IN')}`);
        return parts.length > 0 ? parts.join(' | ') : text('All Profiles', 'सर्व प्रोफाइल', 'सभी प्रोफाइल');
    })();

    const updateInteraction = async (profile, field, value) => {
        try {
            const res = await fetchWithAuth(`/api/candidate/interactions/${profile.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Interaction could not be saved.');
            setProfiles((current) => current.map((item) => item.id === profile.id
                ? {
                    ...item,
                    [`is_${field}`]: value,
                    is_mutual: data.isMutual ?? data.mutual ?? item.is_mutual,
                    is_shortlisted: field === 'shortlisted' ? value : data.isShortlisted ?? item.is_shortlisted,
                    has_shortlisted_you: data.hasShortlistedYou ?? item.has_shortlisted_you,
                    is_liked: field === 'liked' ? value : data.isLiked ?? item.is_liked,
                    has_liked_you: data.hasLikedYou ?? item.has_liked_you
                }
                : item));
            if (field === 'shortlisted') await loadProfiles(page);
        } catch (err) {
            setError(err.message);
        }
    };

    const resetFilters = () => {
        setQuery('');
        setGender('all');
        setMarriageType('all');
        setDistrict('');
        setIncomeMax(INCOME_MAX_LIMIT);
        setAgeMin(AGE_MIN_LIMIT);
        setAgeMax(AGE_MAX_LIMIT);
        setPage(1);
    };

    const hasActiveFilters = query.trim() || gender !== 'all' || marriageType !== 'all' || district.trim() || incomeMax < INCOME_MAX_LIMIT || ageMin > AGE_MIN_LIMIT || ageMax < AGE_MAX_LIMIT;

    const applyAndCloseFilters = () => {
        loadProfiles(1);
        setFilterOpen(false);
    };

    const selectedProfileCanViewSensitive = !!(selectedProfile?.can_view_sensitive || selectedProfile?.is_mutual);
    const selectedProfileDisplayName = selectedProfileCanViewSensitive
        ? [selectedProfile?.first_name, selectedProfile?.middle_name, selectedProfile?.last_name].filter(Boolean).join(' ') || text('Matched Profile', 'जुळलेली प्रोफाइल', 'मिलान प्रोफाइल')
        : text('Private Profile', 'खासगी प्रोफाइल', 'निजी प्रोफाइल');
    const selectedProfilePhone = selectedProfileCanViewSensitive
        ? toIndianPhoneNumber(selectedProfile.mobile_number || selectedProfile.whatsapp_number)
        : '';
    const selectedProfileLocation = selectedProfile
        ? (selectedProfile.location || [selectedProfile.city_village, selectedProfile.district, selectedProfile.state].filter(Boolean).join(', '))
        : '';

    return (
        <div className="min-h-screen bg-[#fff8eb] bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')] px-4 py-20 text-red-950">
            <div className="mx-auto max-w-7xl">
            <div className="surface-card sticky top-16 z-30 mb-6 rounded-3xl p-4 backdrop-blur">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#881337]">{text('Active Filters', 'सक्रिय फिल्टर', 'सक्रिय फ़िल्टर')}</p>
                            <p className="mt-1 break-words text-sm font-semibold text-amber-900">{filterSummary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFilterOpen(true)}
                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${filterOpen || hasActiveFilters ? 'border-[#881337] bg-[#881337] text-amber-50' : 'border-amber-300 bg-white text-[#881337]'}`}
                            >
                                <Filter size={16} />
                                {text('Filters', 'फिल्टर', 'फ़िल्टर')}
                            </button>
                            <div className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">{t('onlineSuchi.totalProfiles', text('Total profiles', 'एकूण प्रोफाइल', 'कुल प्रोफाइल'))}: {total}</div>
                        </div>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
                    <h1 className="font-serif text-3xl font-black text-[#4a0a13] sm:text-4xl">
                        {t('home.nav.search', 'Search Online-Suchi')}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                        {[['all', 'All Profiles'], ['shortlisted', 'Shortlisted'], ['mutual', 'Mutual Matches']].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => { setPage(1); setInteractionView(value); }}
                                className={`rounded-full border px-3 py-2 text-xs font-black ${interactionView === value ? 'border-[#881337] bg-[#881337] text-amber-50' : 'border-amber-300 bg-white text-[#881337]'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`fixed inset-0 z-[95] bg-black/45 backdrop-blur-sm transition-opacity ${filterOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setFilterOpen(false)}></div>
                <aside className={`fixed right-0 top-0 z-[100] h-screen w-full max-w-[340px] overflow-y-auto border-l border-amber-300/30 bg-[rgba(253,251,247,0.97)] bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')] p-6 text-amber-950 shadow-2xl transition-transform duration-300 ${filterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="mb-6 flex items-center justify-between border-b-2 border-amber-100 pb-4">
                        <div className="text-lg font-extrabold uppercase tracking-[0.08em] text-[#881337]">{text('Profile Filters', 'प्रोफाईल फिल्टर', 'प्रोफाइल फ़िल्टर')}</div>
                        <button type="button" onClick={() => setFilterOpen(false)} className="rounded-full p-2 text-[#881337] hover:bg-amber-100"><X size={20} /></button>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{t('onlineSuchi.search', text('Search', 'शोध', 'खोज'))}</label>
                            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('onlineSuchi.searchPlaceholder', text('Name, phone, location...', 'नाव, फोन, पत्ता...', 'नाम, फोन, पता...'))} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-amber-950 outline-none focus:border-[#881337]" />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{t('onlineSuchi.gender', text('Bride / Groom', 'वधू / वर', 'वधू / वर'))}</label>
                            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-amber-950 outline-none focus:border-[#881337]">
                                {genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{t('onlineSuchi.marriageStatus', text('Marriage Status', 'वैवाहिक स्थिती', 'वैवाहिक स्थिति'))}</label>
                            <select value={marriageType} onChange={(e) => setMarriageType(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-amber-950 outline-none focus:border-[#881337]">
                                {marriageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{t('onlineSuchi.district', text('District', 'जिल्हा', 'जिला'))}</label>
                            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t('onlineSuchi.district', text('District', 'जिल्हा', 'जिला'))} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-amber-950 outline-none focus:border-[#881337]" />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{t('onlineSuchi.incomeMax', text('Max Income', 'कमाल उत्पन्न', 'अधिकतम आय'))}: {Number(incomeMax).toLocaleString('en-IN')}</label>
                            <input type="range" min={INCOME_MIN_LIMIT} max={INCOME_MAX_LIMIT} step={50000} value={incomeMax} onChange={(e) => setIncomeMax(Number(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-amber-200/60" />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-bold text-amber-950">{text('Age Range', 'वय श्रेणी', 'आयु सीमा')}: {ageMin} - {ageMax}</label>
                            <div className="rounded-xl border border-amber-100 bg-white px-3 py-3">
                                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-amber-900">
                                    <span>{ageMin}</span>
                                    <span>{ageMax}</span>
                                </div>
                                <div className="relative h-7">
                                    <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-amber-200"></div>
                                    <div className="absolute top-3 h-1 rounded-full bg-[#881337]" style={{ left: `${ageTrackStart}%`, width: `${Math.max(0, ageTrackEnd - ageTrackStart)}%` }}></div>
                                    <input type="range" min={AGE_MIN_LIMIT} max={AGE_MAX_LIMIT} step={1} value={ageMin} onChange={(e) => { const value = Number(e.target.value); setAgeMin(Math.min(value, ageMax)); }} className="absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent" />
                                    <input type="range" min={AGE_MIN_LIMIT} max={AGE_MAX_LIMIT} step={1} value={ageMax} onChange={(e) => { const value = Number(e.target.value); setAgeMax(Math.max(value, ageMin)); }} className="absolute inset-0 h-7 w-full cursor-pointer appearance-none bg-transparent" />
                                </div>
                            </div>
                        </div>

                        <button type="button" onClick={applyAndCloseFilters} className="w-full rounded-xl bg-gradient-to-br from-[#881337] to-[#4c0519] px-4 py-3 text-sm font-extrabold text-amber-50 shadow-lg">{t('onlineSuchi.applyFilters', text('Apply Filters', 'फिल्टर लागू करा', 'फ़िल्टर लागू करें'))}</button>
                        <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-[#881337] disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={16} />{text('Reset Filters', 'फिल्टर रीसेट करा', 'फ़िल्टर रीसेट करें')}</button>
                    </div>
                </aside>

                {error && (
                    <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/40 px-4 py-3 text-sm text-red-100">
                        {error}
                    </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {loading ? (
                        <div className="surface-card col-span-full rounded-2xl p-6 text-center font-bold text-red-950/60">
                            {t('onlineSuchi.loading', text('Loading profiles...', 'प्रोफाइल लोड होत आहेत...', 'प्रोफाइल लोड हो रहे हैं...'))}
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="surface-card col-span-full rounded-2xl p-6 text-center font-bold text-red-950/60">
                            {t('onlineSuchi.noResults', text('No profiles matched your filters.', 'योग्य प्रोफाइल सापडले नाहीत.', 'कोई प्रोफाइल नहीं मिला।'))}
                        </div>
                    ) : (
                        profiles.map((profile) => {
                            const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');
                            const isMutual = !!profile.is_mutual;
                            const canViewSensitive = !!(profile.can_view_sensitive || isMutual);
                            const displayName = canViewSensitive
                                ? (fullName || text('Matched Profile', 'जुळलेली प्रोफाइल', 'मिलान प्रोफाइल'))
                                : text('Private Profile', 'खासगी प्रोफाइल', 'निजी प्रोफाइल');
                            const isFavorite = !!profile.is_liked;
                            const isShortlisted = !!profile.is_shortlisted;
                            const primaryPhone = canViewSensitive ? (profile.mobile_number || profile.whatsapp_number) : '';
                            const phoneNumber = toIndianPhoneNumber(primaryPhone);
                            const profileLocation = profile.location || [profile.city_village, profile.district, profile.state].filter(Boolean).join(', ');
                            return (
                                <div key={profile.id} className="surface-card surface-card-hover overflow-hidden rounded-[28px] text-red-950">
                                    <div className="flex h-full flex-col sm:flex-row">
                                        <div className="relative h-72 overflow-hidden sm:h-auto sm:w-52 lg:w-60">
                                            <img src={profilePhotoUrl(profile)} alt={canViewSensitive ? (fullName || 'Matched profile') : 'Profile photo'} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                                            <button
                                                type="button"
                                                onClick={() => updateInteraction(profile, 'liked', !isFavorite)}
                                                className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition ${isFavorite ? 'bg-rose-100 text-rose-800' : 'bg-white/25 text-white hover:bg-amber-400 hover:text-red-950'}`}
                                                title={text('Favorite', 'फेव्हरेट', 'फ़ेवरिट')}
                                            >
                                                <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
                                            <div className="min-w-0">
                                                <p className="truncate font-serif text-2xl font-black text-[#4a0a13]">{displayName}</p>
                                                <p className="mt-1 text-sm font-extrabold text-red-950/55">
                                                    {profile.age ? `${profile.age} ${text('yrs', 'वर्षे', 'वर्ष')}` : text('Age unavailable', 'वय उपलब्ध नाही', 'आयु उपलब्ध नहीं')}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {profile.is_mutual && <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Mutual Match</span>}
                                                    {!profile.is_mutual && profile.has_shortlisted_you && <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">Shortlisted You</span>}
                                                    {!profile.is_mutual && profile.is_shortlisted && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-extrabold text-[#7f1d1d]">You Shortlisted</span>}
                                                </div>
                                            </div>

                                            <div className="mt-5 space-y-3 text-sm font-bold text-red-950/70">
                                                <p className="flex items-start gap-2"><GraduationCap className="mt-0.5 shrink-0 text-amber-600" size={17} /> <span>{formatProfileValue(profile.education_qualification) || '-'}</span></p>
                                                <p className="flex items-start gap-2"><Briefcase className="mt-0.5 shrink-0 text-amber-600" size={17} /> <span>{formatProfileValue(profile.job_business_title) || '-'}</span></p>
                                                <p className="flex items-start gap-2"><span className="mt-0.5 w-[17px] shrink-0 text-center font-black text-amber-600">₹</span> <span>{formatProfileValue(profile.annual_income) || '-'}</span></p>
                                                <p className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-amber-600" size={17} /> <span>{formatProfileValue(profileLocation) || '-'}</span></p>
                                                <p><span className="font-black text-[#7f1d1d]">{t('onlineSuchi.expectationsLabel', text('Expectations', 'अपेक्षा', 'अपेक्षाएँ'))}:</span> {formatProfileValue(profile.selected_expectations) || formatProfileValue(profile.other_expectations) || '-'}</p>
                                                <p><span className="font-black text-[#7f1d1d]">{text('Mamekul', 'मामेकुळ', 'मामेकुळ')}:</span> {formatProfileValue(profile.mamekul) || '-'}</p>
                                            </div>

                                            <div className="mt-auto pt-5">
                                                <div className={`grid gap-2 ${canViewSensitive ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                                                    {canViewSensitive && (
                                                        <>
                                                            <a
                                                                href={phoneNumber ? `tel:+${phoneNumber}` : '#'}
                                                                onClick={(e) => { if (!phoneNumber) e.preventDefault(); }}
                                                                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${phoneNumber ? 'bg-[#4a0a13] text-white hover:bg-[#68121e]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                                title={text('Call', 'कॉल', 'कॉल')}
                                                            >
                                                                <Phone size={16} /> <span className="hidden sm:inline">{text('Call', 'कॉल', 'कॉल')}</span>
                                                            </a>
                                                            <a
                                                                href={phoneNumber ? `https://wa.me/${phoneNumber}` : '#'}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={(e) => { if (!phoneNumber) e.preventDefault(); }}
                                                                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${phoneNumber ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                                title={text('WhatsApp', 'व्हॉट्सअॅप', 'व्हाट्सऐप')}
                                                            >
                                                                <MessageCircle size={16} /> <span className="hidden sm:inline">WhatsApp</span>
                                                            </a>
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => updateInteraction(profile, 'shortlisted', !isShortlisted)}
                                                        className={`flex items-center justify-center rounded-xl px-3 py-2 text-sm font-black ${isShortlisted ? 'bg-amber-300 text-red-950' : 'border border-amber-300 bg-amber-50 text-red-950 hover:bg-amber-100'}`}
                                                        title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                                                    >
                                                        <span className="hidden sm:inline">{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
                                                        <span className="sm:hidden">{isShortlisted ? 'Saved' : 'Save'}</span>
                                                    </button>
                                                    <button type="button" onClick={() => setSelectedProfile(profile)} className="flex items-center justify-center rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-red-950 hover:bg-amber-300">
                                                        {text('More Details', 'अधिक तपशील', 'अधिक विवरण')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {!loading && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg bg-[#5c0a18] px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span className="text-sm text-amber-200">{page} / {totalPages}</span>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            className="rounded-lg bg-[#5c0a18] px-3 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}

                {selectedProfile && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
                        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-500/50 bg-[#fff8ef] p-6 text-slate-900 shadow-2xl">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-2xl font-extrabold text-red-950">{text('More Details', 'अधिक तपशील', 'अधिक विवरण')}</h3>
                                    <p className="mt-1 text-sm font-bold text-red-950/60">{selectedProfileDisplayName}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedProfile(null)} className="rounded-xl bg-red-950 px-3 py-2 text-sm font-bold text-amber-100">{t('onlineSuchi.close', text('Close', 'बंद', 'बंद करें'))}</button>
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
                                <div>
                                    <img src={profilePhotoUrl(selectedProfile)} alt={selectedProfileCanViewSensitive ? (selectedProfileDisplayName || 'Matched profile') : 'Profile photo'} className="h-56 w-full rounded-2xl object-cover shadow-sm" />
                                    <p className="mt-3 text-sm font-bold text-red-950/70"><strong>{text('Age', 'वय', 'आयु')}:</strong> {selectedProfile.age || '-'}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm text-red-950/80 sm:grid-cols-2">
                                    <p><strong>{text('Education Category', 'शिक्षण श्रेणी', 'शिक्षा श्रेणी')}:</strong> {formatProfileValue(selectedProfile.education_category) || '-'}</p>
                                    <p><strong>{t('onlineSuchi.educationLabel', text('Education', 'शिक्षण', 'शिक्षा'))}:</strong> {formatProfileValue(selectedProfile.education_qualification) || '-'}</p>
                                    <p><strong>{text('Education Details', 'शिक्षण तपशील', 'शिक्षा विवरण')}:</strong> {formatProfileValue(selectedProfile.education_details) || '-'}</p>
                                    <p><strong>{t('onlineSuchi.jobLabel', text('Job', 'नोकरी', 'नौकरी'))}:</strong> {formatProfileValue(selectedProfile.job_business_title) || '-'}</p>
                                    <p><strong>{t('onlineSuchi.income', text('Annual Income', 'वार्षिक उत्पन्न', 'वार्षिक आय'))}:</strong> {formatProfileValue(selectedProfile.annual_income) || '-'}</p>
                                    <p><strong>{t('onlineSuchi.jobLocationLabel', text('Job Location', 'नोकरीचे ठिकाण', 'नौकरी का स्थान'))}:</strong> {formatProfileValue(selectedProfile.job_business_location) || '-'}</p>
                                    <p><strong>{text('Location', 'ठिकाण', 'स्थान')}:</strong> {formatProfileValue(selectedProfileLocation) || '-'}</p>
                                    <p><strong>{text('Mamekul', 'मामेकुळ', 'मामेकुळ')}:</strong> {formatProfileValue(selectedProfile.mamekul) || '-'}</p>
                                    <p className="sm:col-span-2"><strong>{t('onlineSuchi.expectationsLabel', text('Expectations', 'अपेक्षा', 'अपेक्षाएँ'))}:</strong> {formatProfileValue(selectedProfile.selected_expectations) || formatProfileValue(selectedProfile.other_expectations) || '-'}</p>
                                    {Array.isArray(selectedProfile.registered_events) && selectedProfile.registered_events.length > 0 && (
                                        <div className="sm:col-span-2 border-t border-red-950/15 pt-3">
                                            <p className="text-xs font-black uppercase tracking-[0.14em] text-red-950/60">{text('Registered Events', 'नोंदणीकृत मेळावे', 'पंजीकृत कार्यक्रम')}</p>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                {selectedProfile.registered_events.map((event) => (
                                                    <div key={`${event.event_id}-${event.event_registration_code || 'registration'}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                        <p className="font-bold text-red-950">{event.event_name || 'Event'}</p>
                                                        <p className="text-xs text-red-950/65">Stage ID: <strong>{event.event_registration_code || 'Pending'}</strong></p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedProfileCanViewSensitive && (
                                        <>
                                            <p className="sm:col-span-2 border-t border-red-950/15 pt-3 text-xs font-black uppercase tracking-[0.14em] text-red-950/60">{text('Personal and Astro Details', 'वैयक्तिक आणि ज्योतिष तपशील', 'व्यक्तिगत और ज्योतिष विवरण')}</p>
                                            <p><strong>{text('Gender', 'लिंग', 'लिंग')}:</strong> {formatProfileValue(selectedProfile.gender) || '-'}</p>
                                            <p><strong>{text('Marriage Status', 'वैवाहिक स्थिती', 'वैवाहिक स्थिति')}:</strong> {formatProfileValue(selectedProfile.marriage_type) || '-'}</p>
                                            <p><strong>{text('Height', 'उंची', 'कद')}:</strong> {formatProfileValue(selectedProfile.height) || '-'}</p>
                                            <p><strong>{text('Complexion', 'वर्ण', 'रंग')}:</strong> {formatProfileValue(selectedProfile.complexion) || '-'}</p>
                                            <p><strong>{text('Birth Date', 'जन्मतारीख', 'जन्म तिथि')}:</strong> {formatProfileDate(selectedProfile.birth_date) || '-'}</p>
                                            <p><strong>{text('Birth Time', 'जन्मवेळ', 'जन्म समय')}:</strong> {formatProfileValue(selectedProfile.birth_time) || '-'}</p>
                                            <p><strong>{text('Birth Place', 'जन्मस्थळ', 'जन्म स्थान')}:</strong> {formatProfileValue(selectedProfile.birth_place) || '-'}</p>
                                            <p><strong>{text('Blood Group', 'रक्तगट', 'रक्त समूह')}:</strong> {formatProfileValue(selectedProfile.blood_group) || '-'}</p>
                                            <p><strong>{text('Gotra', 'गोत्र', 'गोत्र')}:</strong> {formatProfileValue(selectedProfile.gotra) || '-'}</p>
                                            <p><strong>{text('Rashi / Zodiac', 'राशी', 'राशि')}:</strong> {formatProfileValue(selectedProfile.zodiac) || '-'}</p>
                                            <p><strong>{text('Gan', 'गण', 'गण')}:</strong> {formatProfileValue(selectedProfile.gan) || '-'}</p>
                                            <p><strong>{text('Nadi', 'नाडी', 'नाड़ी')}:</strong> {formatProfileValue(selectedProfile.nadi) || '-'}</p>
                                            <p><strong>{text('Charan', 'चरण', 'चरण')}:</strong> {formatProfileValue(selectedProfile.charan) || '-'}</p>
                                            <p><strong>{text('Nakshatra', 'नक्षत्र', 'नक्षत्र')}:</strong> {formatProfileValue(selectedProfile.nakshatra) || '-'}</p>
                                            <p><strong>{text('Phone', 'फोन', 'फोन')}:</strong> {selectedProfilePhone ? <a href={`tel:+${selectedProfilePhone}`} className="font-bold text-[#881337] underline">{selectedProfilePhone}</a> : '-'}</p>
                                            <p><strong>{text('WhatsApp', 'व्हॉट्सअॅप', 'व्हाट्सऐप')}:</strong> {selectedProfilePhone ? <a href={`https://wa.me/${selectedProfilePhone}`} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline">{selectedProfilePhone}</a> : '-'}</p>
                                            <p className="sm:col-span-2"><strong>{t('onlineSuchi.address', text('Address', 'पत्ता', 'पता'))}:</strong> {[selectedProfile.address_line, selectedProfile.city_village, selectedProfile.tehsil, selectedProfile.district, selectedProfile.state, selectedProfile.pincode].filter(Boolean).join(', ') || '-'}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnlineSuchi;
