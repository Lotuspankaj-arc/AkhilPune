import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    BookOpen, Building2, CalendarDays, Car, CheckCircle2, CircleHelp,
    Clock3, FileText, HeartHandshake, ArrowRight, Lock, LogIn, Mail, MapPin, Menu, Phone, ScrollText,
    ShieldCheck, Users, Utensils, WalletCards, X
} from 'lucide-react';
import { apiUrl } from '../config';
import { useAuth } from '../context/AuthContext';
import { mapServerUserToSession } from '../utils/authSession';
import './ClientPublicHome.css';

const defaultHomepageContent = {
    eyebrow: 'अधिकृत समाज संकेतस्थळ',
    hero_badge: 'समाज माहिती, कार्यक्रम व ऑनलाईन नोंदणी',
    notice_text: '',
    registration_note: 'अधिकृत सार्वजनिक माहिती व नोंदणी पोर्टल',
    hero_heading: 'समाज बांधवांसाठी अधिकृत कार्यक्रम माहिती',
    hero_quote: 'संस्कारांची सुंदर गाठ, नव्या आयुष्याची नवी पहाट... एकत्र येऊन सुखद नात्यांची ही वाट यशस्वी करूया.',
    invitation_title: 'स्नेह निमंत्रण',
    invitation_salutation: 'श्री / श्रीमती,',
    invitation_quote: 'समाज बांधवांच्या सहकार्याने प्रत्येक उपक्रम अधिक सुंदर आणि अर्थपूर्ण होतो.',
    invitation_text: 'आपणास निमंत्रित करताना आनंद होत आहे. कार्यक्रमाची अधिकृत माहिती, नोंदणी प्रक्रिया आणि आवश्यक मार्गदर्शन या संकेतस्थळावर उपलब्ध आहे.',
    invitation_welcome: 'सर्व समाज बांधवांचे स्नेहपूर्वक स्वागत!',
    about_title: 'समाजाविषयी',
    about_text: 'हे संकेतस्थळ समाजाच्या अधिकृत कार्यक्रमांची माहिती, नोंदणी तपशील, पेमेंट मार्गदर्शन आणि सहाय्यक संपर्क एकाच ठिकाणी उपलब्ध करून देते.',
    service_title: 'नोंदणी व समाज सेवा',
    service_text: 'सक्रिय कार्यक्रमाची माहिती व शुल्क तपासून अधिकृत नोंदणी फॉर्म भरा. पेमेंट निवडलेल्या कार्यक्रमाच्या नोंदणी प्रक्रियेशी जोडलेले आहे.',
    feature_title: 'कार्यक्रमाची वैशिष्ट्ये',
    feature_heading: 'समाज बांधवांच्या सोयीसाठी नियोजनबद्ध व्यवस्था',
    feature_items: [
        { title: 'अधिकृत कार्यक्रम माहिती', text: 'दिनांक, स्थळ, शुल्क आणि नोंदणीची अद्ययावत माहिती एका ठिकाणी.' },
        { title: 'सोपे ऑनलाईन नोंदणी', text: 'नोंदणी फॉर्म आणि पेमेंट प्रक्रियेसाठी स्पष्ट मार्गदर्शन.' },
        { title: 'सहाय्यक संपर्क व्यवस्था', text: 'तांत्रिक किंवा नोंदणीसंबंधी प्रश्नांसाठी समिती सदस्यांशी संपर्क.' },
        { title: 'समाज संवाद', text: 'समाज बांधव, पालक आणि आयोजक यांच्यातील संवादासाठी माहिती कक्ष.' },
        { title: 'पेमेंट पारदर्शकता', text: 'निवडलेल्या कार्यक्रमाचे शुल्क आणि पेमेंट स्थिती स्पष्टपणे दर्शविली जाते.' },
        { title: 'आयोजन समन्वय', text: 'कार्यक्रमाच्या विविध समित्या आणि सहाय्यक गटांचे नियोजन.' }
    ],
    rules_title: 'नियमावली व अटी',
    rules_heading: 'नोंदणी नियमावली व शुल्क तपशील',
    rules_text: 'कृपया कार्यक्रमाची पात्रता, नोंदणी सूचना आणि शुल्क तपशील काळजीपूर्वक वाचून फॉर्म भरावा. नोंदणीमध्ये दिलेली माहिती अचूक असावी.',
    payment_note: 'पेमेंट पूर्ण झाल्यावरच नोंदणी ग्राह्य धरली जाईल.',
    refund_policy: 'परतावा किंवा रद्दीकरणाची पात्रता संबंधित कार्यक्रमाच्या अटींनुसार हाताळली जाईल. लागू अटी नोंदणीपूर्वी तपासाव्यात.',
    shipping_policy: 'ही डिजिटल नोंदणी सेवा आहे. कोणतेही भौतिक उत्पादन पाठविले जात नाही. पावती किंवा प्रवेश माहिती इलेक्ट्रॉनिक पद्धतीने अथवा कार्यक्रमस्थळी दिली जाऊ शकते.',
    terms_text: 'हे संकेतस्थळ वापरताना अचूक माहिती देणे, कार्यक्रमाचे नियम पाळणे आणि सेवा केवळ समाजाच्या अधिकृत उद्देशासाठी वापरणे मान्य केले जाते.',
    privacy_text: 'या संकेतस्थळावर सादर केलेली माहिती नोंदणी, पडताळणी, संपर्क आणि कार्यक्रम समन्वयासाठी वापरली जाते. ती सार्वजनिक निर्देशिका म्हणून विकली जात नाही.',
    rates_title: 'स्मरणिका जाहिरात दर पत्रक',
    rates_heading: 'कार्यक्रम यशस्वी करण्यासाठी आपल्या सहकार्याची आवश्यकता आहे.',
    rates_text: 'स्मरणिका जाहिरात दर आणि उपलब्ध जागांची माहिती आयोजकांकडून लवकरच प्रसिद्ध केली जाईल.',
    contact_title: 'आयोजकांशी संपर्क साधा',
    contact_note: 'नोंदणी, पेमेंट किंवा कार्यक्रमासंबंधी मदतीसाठी खालील अधिकृत संपर्क तपशील वापरा.',
    helpline_title: 'नोंदणी सहाय्यता हेल्पलाईन',
    support_title: 'तांत्रिक सहाय्यता',
    support_text: 'फॉर्म भरणे, पेमेंट किंवा संकेतस्थळ वापरण्यासंबंधी अडचणींसाठी तांत्रिक सहाय्यता समितीशी संपर्क साधा.'
};

const committeeRoles = [
    ['adhyaksha_name', 'adhyaksha_phone', 'adhyaksha_photo_url', 'अध्यक्ष'],
    ['upa_adhyaksha_name', 'upa_adhyaksha_phone', 'upa_adhyaksha_photo_url', 'उपाध्यक्ष'],
    ['khajindar_name', 'khajindar_phone', 'khajindar_photo_url', 'कोषाध्यक्ष'],
    ['sachiv_name', 'sachiv_phone', 'sachiv_photo_url', 'सचिव'],
    ['upasachiv_name', 'upasachiv_phone', 'upasachiv_photo_url', 'उपसचिव']
];

const teamIcon = (teamName) => {
    if (teamName.includes('महिला')) return HeartHandshake;
    if (teamName.includes('युवा')) return Users;
    if (teamName.includes('तांत्रिक')) return CircleHelp;
    if (teamName.includes('नोंदणी')) return FileText;
    if (teamName.includes('स्मरणिका')) return BookOpen;
    return Users;
};

const formatDate = (value) => {
    if (!value) return 'दिनांक जाहीर करण्यात येईल';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
    : new Intl.DateTimeFormat('mr-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
};

const formatAmount = (value) => {
    if (value === null || value === undefined || value === '') return 'शुल्क जाहीर करण्यात येईल';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const assetUrl = (value) => {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : apiUrl(value);
};

const readHomepageContent = (value) => {
    if (!value) return defaultHomepageContent;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? { ...defaultHomepageContent, ...parsed }
            : defaultHomepageContent;
    } catch (_error) {
        return defaultHomepageContent;
    }
};

const paragraphLines = (value) => String(value || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const listValue = (value, fallback = []) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return fallback;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (_error) {
        return fallback;
    }
};

const ContactLink = ({ phone, children }) => phone
    ? <a className="public-client-home__contact-link" href={`tel:${String(phone).replace(/[^\d+]/g, '')}`}><Phone size={15} /> {children || phone}</a>
    : null;

const CommitteeAvatar = ({ name, photoUrl, title }) => {
    const [imageFailed, setImageFailed] = useState(false);
    const initial = String(name || 'स').trim().charAt(0) || 'स';

    return (
        <div className="public-client-home__committee-avatar">
            {photoUrl && !imageFailed
                ? <img src={assetUrl(photoUrl)} alt={`${title} ${name}`} onError={() => setImageFailed(true)} />
                : <span aria-hidden="true">{initial}</span>}
        </div>
    );
};

const PublicLoginPopover = ({ returnPath, setLoggedInUser, onClose }) => {
    const navigate = useNavigate();
    const { setToken: authSetToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const response = await fetch(apiUrl('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error([data.error, data.details].filter(Boolean).join(' ') || 'लॉगिन अयशस्वी झाले.');
            if (!data.user || !data.accessToken) throw new Error('लॉगिन सेवेकडून अपूर्ण प्रतिसाद मिळाला.');

            const sessionUser = {
                ...mapServerUserToSession(data.user),
                publicHomePath: returnPath || '/'
            };
            authSetToken(data.accessToken);
            setLoggedInUser(sessionUser);
            onClose();
            const roleName = String(data.user.roleName || '').toLowerCase();
            const isAdminLogin = roleName === 'admin' || roleName === 'super_user' || !!data.user.isAdmin || !!data.user.isSuperUser;
            navigate(isAdminLogin ? '/admin-profile' : (returnPath || '/'));
        } catch (loginError) {
            setError(loginError.message || 'लॉगिन अयशस्वी झाले.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="public-client-home__login-popover" role="dialog" aria-label="लॉगिन विंडो">
            <div className="public-client-home__login-heading">
                <div><span>सदस्य लॉगिन</span><strong>आपल्या खात्यात प्रवेश करा</strong></div>
                <button type="button" className="public-client-home__login-close" aria-label="लॉगिन विंडो बंद करा" onClick={onClose}><X size={17} /></button>
            </div>
            <form onSubmit={handleSubmit} className="public-client-home__login-form" autoComplete="on">
                <label><Mail size={15} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ईमेल पत्ता" autoComplete="email" required /></label>
                <label><Lock size={15} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="पासवर्ड" autoComplete="current-password" required /></label>
                {error && <p className="public-client-home__login-error" role="alert">{error}</p>}
                <button type="submit" className="public-client-home__login-submit" disabled={isSubmitting}><span>{isSubmitting ? 'तपासणी सुरू आहे...' : 'लॉगिन करा'}</span><ArrowRight size={16} /></button>
            </form>
        </div>
    );
};

const ClientPublicHome = ({ domainMode = false, setLoggedInUser }) => {
    const { clientSlug } = useParams();
    const location = useLocation();
    const [page, setPage] = useState(null);
    const [error, setError] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const endpoint = domainMode
            ? '/api/public/current-client'
            : `/api/public/clients/${encodeURIComponent(clientSlug)}`;
        fetch(apiUrl(endpoint))
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Client homepage not found.');
                return data;
            })
            .then((data) => { if (!cancelled) setPage(data); })
            .catch((requestError) => { if (!cancelled) setError(requestError.message); });
        return () => { cancelled = true; };
    }, [clientSlug, domainMode]);

    useEffect(() => {
        if (page?.client?.client_name) document.title = page.client.client_name;
    }, [page?.client?.client_name]);

    if (error) return <main className="reference-page client-home--status"><h1>{error}</h1><Link to="/">मुख्य संकेतस्थळावर जा</Link></main>;
    if (!page) return <main className="reference-page client-home--status"><p>समाजाचे संकेतस्थळ लोड होत आहे...</p></main>;

    const { client, events = [], committee, teams = [] } = page;
    const content = readHomepageContent(client.homepage_content);
    const activeEvent = events[0];
    const committeeMembers = committee
        ? committeeRoles.map(([nameKey, phoneKey, photoKey, title]) => ({ name: committee[nameKey], phone: committee[phoneKey], photoUrl: committee[photoKey], title })).filter((member) => member.name)
        : [];
    const featureItems = listValue(content.feature_items, defaultHomepageContent.feature_items)
        .filter((item) => item && (item.title || item.name));
    const souvenirRates = listValue(content.souvenir_rates)
        .filter((item) => item && (item.title || item.name || item.label));
    const orderedTeams = [...teams].sort((first, second) => Number(first.team_id) - Number(second.team_id));
    const helpdeskTeams = orderedTeams.filter((team) => team.team_name.includes('तांत्रिक') || team.team_name.includes('नोंदणी'));
    const bannerUrl = assetUrl(activeEvent?.registration_banner_path || activeEvent?.banner_url);
    const dateText = formatDate(activeEvent?.start_date);
    const eventTime = activeEvent?.event_time || content.event_time || 'सकाळी ९:०० ते दु. ५:०० पर्यंत';
    const eventPhone = activeEvent?.organizer_phone || client.phone_number;
    const registrationPath = activeEvent?.registration_path || '/register';
    const phoneHref = eventPhone ? `tel:${String(eventPhone).replace(/[^\d+]/g, '')}` : null;

    return (
        <main className="reference-page public-client-home">
            <div className="reference-page__notice">
                {content.notice_text && <>{content.notice_text} <span>|</span> </>}{content.registration_note}
            </div>

            <header className="reference-page__header">
                <a href="#home" className="reference-page__brand" onClick={() => setMenuOpen(false)}>
                    {client.logo_url
                        ? <img src={assetUrl(client.logo_url)} alt={`${client.client_name} लोगो`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                        : <span className="public-client-home__brand-fallback">{String(client.client_name || 'स').charAt(0)}</span>}
                    <span>{client.client_name}<small>{content.eyebrow}</small></span>
                </a>
                <nav className={`reference-page__nav public-client-home__nav ${menuOpen ? 'public-client-home__nav--open' : ''}`} aria-label="सार्वजनिक संकेतस्थळ">
                    <a href="#home" onClick={() => setMenuOpen(false)}>मुखपृष्ठ</a>
                    <a href="#invitation" onClick={() => setMenuOpen(false)}>निमंत्रण</a>
                    <a href="#features" onClick={() => setMenuOpen(false)}>वैशिष्ट्ये</a>
                    <a href="#rules-fees" onClick={() => setMenuOpen(false)}>नियम व शुल्क</a>
                    <a href="#committee" onClick={() => setMenuOpen(false)}>समिती</a>
                    <a href="#contact" onClick={() => setMenuOpen(false)}>संपर्क</a>
                </nav>
                <div className="reference-page__actions">
                    <button type="button" className="public-client-home__login" aria-expanded={loginOpen} onClick={() => { setLoginOpen((open) => !open); setMenuOpen(false); }}><LogIn size={14} /> लॉगिन</button>
                    {activeEvent && <Link to={registrationPath} className="reference-page__register" onClick={() => setMenuOpen(false)}><LogIn size={15} /> नोंदणी</Link>}
                    <button type="button" className="public-client-home__menu-button" aria-label="नेव्हिगेशन मेन्यू" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
                {loginOpen && <PublicLoginPopover returnPath={`${location.pathname}${location.search}${location.hash}`} setLoggedInUser={setLoggedInUser} onClose={() => setLoginOpen(false)} />}
            </header>

            <section id="home" className={`reference-hero public-client-home__hero ${bannerUrl ? 'public-client-home__hero--with-image' : ''}`}>
                {bannerUrl && <div className="public-client-home__hero-image" style={{ backgroundImage: `url("${bannerUrl}")` }} aria-hidden="true" />}
                {bannerUrl && <div className="public-client-home__hero-overlay" aria-hidden="true" />}
                <div className="public-client-home__hero-content">
                    {client.logo_url && <img className="reference-hero__logo" src={assetUrl(client.logo_url)} alt={`${client.client_name} लोगो`} />}
                    <p className="reference-hero__location"><MapPin size={16} /> {client.address || 'महाराष्ट्र'}</p>
                    <p className="reference-hero__registration">{content.registration_note}</p>
                    <p className="reference-hero__consent">{content.hero_badge}</p>
                    <h1>{client.homepage_title || client.client_name}</h1>
                    <p className="reference-hero__office"><MapPin size={15} /><strong> कार्यालयाचा पत्ता:</strong> {client.address || 'पत्ता लवकरच प्रसिद्ध केला जाईल.'}</p>
                    <h2>{activeEvent?.event_name || content.hero_heading}</h2>
                    <p className="reference-hero__quote">{content.hero_quote || client.homepage_intro}</p>
                    {activeEvent ? (
                        <div className="reference-hero__details">
                            <div><CalendarDays size={25} /><span>वार व दिनांक<strong>{dateText}</strong><small><Clock3 size={14} /> {eventTime}</small></span></div>
                            <div><MapPin size={25} /><span>कार्यक्रम स्थळ<strong>{activeEvent.venue || client.address || 'स्थळ लवकरच प्रसिद्ध केले जाईल.'}</strong><small>{eventPhone || 'संपर्क तपशील लवकरच प्रसिद्ध केला जाईल.'}</small></span></div>
                        </div>
                    ) : (
                        <div className="public-client-home__event-empty"><CalendarDays size={22} /> सध्या कोणताही सक्रिय कार्यक्रम नोंदणीसाठी उपलब्ध नाही.</div>
                    )}
                    <div className="reference-hero__links">
                        {activeEvent && <Link to={registrationPath}><LogIn size={16} /> ऑनलाईन नोंदणी फॉर्म भरा</Link>}
                        <a href="#invitation">स्नेह निमंत्रण</a>
                        <a href="#rules-fees">नियम व शुल्क</a>
                        <a href="#committee">समिती व सहाय्यता</a>
                    </div>
                    {activeEvent?.registration_cutoff_date && <div className="reference-hero__deadline"><CalendarDays size={16} /> अर्ज करण्याची अंतिम तारीख: {formatDate(activeEvent.registration_cutoff_date)}</div>}
                </div>
            </section>

            <div className="reference-quicklinks">
                {activeEvent && <Link to={registrationPath}>नोंदणी करा</Link>}
                <a href="#invitation">स्नेह निमंत्रण</a>
                <a href="#features">वैशिष्ट्ये</a>
                <a href="#rules-fees">नियमावली व शुल्क</a>
                <a href="#rates">स्मरणिका दर</a>
                <a href="#committee">समिती</a>
                <a href="#contact">हेल्पलाईन</a>
            </div>

            <section id="invitation" className="reference-section reference-invitation">
                <p className="reference-kicker">॥ {content.invitation_title} ॥</p>
                <h2>{client.client_name}</h2>
                <h3>{activeEvent?.event_name || content.hero_heading}</h3>
                <div className="reference-section__body">
                    <h4>{content.invitation_salutation}</h4>
                    <p><strong>{content.invitation_quote}</strong></p>
                    {paragraphLines(content.invitation_text).map((line) => <p key={line}>{line}{activeEvent ? ` ${dateText} रोजी होणाऱ्या कार्यक्रमासाठी आपणास सादर निमंत्रण.` : ''}</p>)}
                </div>
                {committeeMembers.length > 0 && <div className="reference-signatures">
                    {committeeMembers.slice(0, 3).map((member) => <div key={member.title}><span>{member.title}</span><strong>{member.name}</strong></div>)}
                </div>}
                <p className="reference-welcome">{content.invitation_welcome}</p>
            </section>

            <section id="features" className="reference-section">
                <p className="reference-kicker">{content.feature_title}</p>
                <h2>{content.feature_heading}</h2>
                <div className="reference-features">
                    {featureItems.map((item, index) => {
                        const Icon = [Building2, Car, MapPin, Users, BookOpen, Utensils][index % 6];
                        return <article key={`${item.title || item.name}-${index}`}><Icon size={27} /><h3>{item.title || item.name}</h3><p>{item.text || item.description}</p></article>;
                    })}
                </div>
            </section>

            <section id="about" className="reference-section reference-section--tint public-client-home__about">
                <div className="public-client-home__about-grid">
                    <div><p className="reference-kicker">{content.eyebrow}</p><h2>{content.about_title}</h2></div>
                    <div>{paragraphLines(content.about_text).map((line) => <p key={line}>{line}</p>)}</div>
                </div>
            </section>

            <section id="rules-fees" className="reference-section reference-section--tint">
                <p className="reference-kicker">॥ {content.rules_title} ॥</p>
                <h2>{content.rules_heading}</h2>
                <div className="reference-rules">
                    <div><ScrollText size={28} /><h3>{content.service_title}</h3><strong className="public-client-home__fee">{formatAmount(activeEvent?.razorpay_registration_amount)}</strong><p>{activeEvent?.event_name || 'सक्रिय कार्यक्रम जाहीर झाल्यावर शुल्क येथे दिसेल.'}</p>{paragraphLines(content.service_text).map((line) => <p key={line}>{line}</p>)}</div>
                    <ol>
                        {paragraphLines(content.rules_text).map((line) => <li key={line}>{line}</li>)}
                        <li>{content.payment_note}</li>
                        {activeEvent?.registration_cutoff_date && <li>अर्ज करण्याची अंतिम तारीख: {formatDate(activeEvent.registration_cutoff_date)}.</li>}
                    </ol>
                </div>
                {activeEvent && <Link to={registrationPath} className="reference-primary-cta"><LogIn size={17} /> येथून ऑनलाईन नोंदणी करा</Link>}
            </section>

            <section id="rates" className="reference-section">
                <p className="reference-kicker">{content.rates_title}</p>
                <h2>{content.rates_heading}</h2>
                {souvenirRates.length > 0
                    ? <div className="reference-rate-table">{souvenirRates.map((rate, index) => <div key={`${rate.title || rate.name || rate.label}-${index}`}><span>{rate.title || rate.name || rate.label}</span><strong>{rate.amount || rate.price}</strong></div>)}</div>
                    : <p className="public-client-home__section-note">{content.rates_text}</p>}
            </section>

            <section id="committee" className="reference-section reference-section--tint">
                <p className="reference-kicker">कार्यकारिणी समिती व सहाय्यक गट</p>
                <h2>विनीत / स्वागतोत्सुक व कार्यकारिणी समिती सदस्य</h2>
                {committeeMembers.length > 0
                    ? <div className="reference-committee public-client-home__committee">{committeeMembers.map((member) => <div className="public-client-home__committee-card" key={member.title}><CommitteeAvatar name={member.name} photoUrl={member.photoUrl} title={member.title} /><div className="public-client-home__committee-info"><strong>{member.title}</strong><span className="public-client-home__committee-name">{member.name}</span><ContactLink phone={member.phone} /></div></div>)}</div>
                    : <p className="public-client-home__section-note">कार्यकारिणी समितीची माहिती आयोजकांकडून लवकरच प्रसिद्ध केली जाईल.</p>}
                <div id="teams" className="public-client-home__teams-heading"><p className="reference-kicker">समाजाचे गट व समित्या</p><h3>कार्यक्रमासाठी सहाय्यक टीम</h3></div>
                <div className="public-client-home__team-grid">
                    {orderedTeams.map((team) => {
                        const Icon = teamIcon(team.team_name);
                        return <article className="public-client-home__team-card" key={team.team_id}>
                            <div className="public-client-home__team-title"><Icon size={23} /><h3>{team.team_name}</h3></div>
                            <p className="public-client-home__team-description">{team.description || team.team_description || 'या समितीची अधिकृत माहिती आणि संपर्क येथे प्रकाशित केला जाईल.'}</p>
                            {team.members?.length ? <div className="public-client-home__team-members">{team.members.map((member) => <div className="public-client-home__team-member" key={`${team.team_id}-${member.volunteer_id}`}><div><strong>{member.volunteer_name}</strong><span>{member.role_name || (member.is_team_lead ? 'टीम प्रमुख' : member.is_team_manager ? 'टीम व्यवस्थापक' : 'सहाय्यक सदस्य')}</span>{member.main_profession ? <small>{member.main_profession}</small> : null}</div><ContactLink phone={member.whatsapp_number} /></div>)}</div> : <p className="public-client-home__team-empty">सभासदांची माहिती आयोजकांकडून लवकरच प्रसिद्ध केली जाईल.</p>}
                        </article>;
                    })}
                </div>
            </section>

            <section id="helpdesk" className="reference-section public-client-home__helpdesk">
                <p className="reference-kicker">सहाय्यता कक्ष</p>
                <h2>तांत्रिक व नोंदणी मार्गदर्शन</h2>
                <div className="public-client-home__helpdesk-grid">
                    {(helpdeskTeams.length ? helpdeskTeams : [
                        { team_id: 'technical-fallback', team_name: content.support_title, members: [] },
                        { team_id: 'registration-fallback', team_name: content.helpline_title, members: [] }
                    ]).map((team) => <article key={team.team_id}><CircleHelp size={27} /><h3>{team.team_name}</h3><p>{team.team_name.includes('नोंदणी') ? 'फॉर्म भरणे, आवश्यक कागदपत्रे आणि नोंदणी प्रक्रियेसाठी मदत.' : content.support_text}</p>{team.members?.length ? team.members.map((member) => <ContactLink key={`${team.team_id}-${member.volunteer_id}`} phone={member.whatsapp_number}>{member.volunteer_name}</ContactLink>) : <p className="public-client-home__team-empty">संपर्क तपशील लवकरच प्रसिद्ध केला जाईल.</p>}</article>)}
                </div>
            </section>

            <section id="policies" className="reference-section reference-section--tint public-client-home__policies">
                <p className="reference-kicker">महत्त्वाची माहिती</p>
                <h2>नियम, शुल्क व धोरणे</h2>
                <div className="public-client-home__policy-grid">
                    <article><WalletCards size={21} /><h3>नोंदणी नियम</h3>{paragraphLines(content.rules_text).map((line) => <p key={line}>{line}</p>)}</article>
                    <article><CheckCircle2 size={21} /><h3>परतावा व रद्दीकरण</h3>{paragraphLines(content.refund_policy).map((line) => <p key={line}>{line}</p>)}</article>
                    <article><FileText size={21} /><h3>डिलिव्हरी</h3>{paragraphLines(content.shipping_policy).map((line) => <p key={line}>{line}</p>)}</article>
                    <article><FileText size={21} /><h3>अटी व शर्ती</h3>{paragraphLines(content.terms_text).map((line) => <p key={line}>{line}</p>)}</article>
                    <article><ShieldCheck size={21} /><h3>गोपनीयता धोरण</h3>{paragraphLines(content.privacy_text).map((line) => <p key={line}>{line}</p>)}</article>
                </div>
            </section>

            <section id="contact" className="reference-section public-client-home__contact-section">
                <div className="public-client-home__contact-grid">
                    <div><p className="reference-kicker">सहाय्य हवी आहे?</p><h2>{content.contact_title}</h2>{paragraphLines(content.contact_note).map((line) => <p key={line}>{line}</p>)}</div>
                    <div className="public-client-home__contact-details">
                        <div><MapPin size={19} /><span>{client.address || 'पत्ता लवकरच प्रसिद्ध केला जाईल.'}</span></div>
                        {client.phone_number && <div><Phone size={19} /><a href={`tel:${String(client.phone_number).replace(/[^\d+]/g, '')}`}>{client.phone_number}</a></div>}
                        {client.contact_email && <div><Mail size={19} /><a href={`mailto:${client.contact_email}`}>{client.contact_email}</a></div>}
                        {eventPhone && <div><CircleHelp size={19} /><span>कार्यक्रम सहाय्य: <a href={phoneHref}>{eventPhone}</a></span></div>}
                    </div>
                </div>
            </section>

            <footer className="reference-footer">
                <div><h2>{client.client_name}</h2><p>{content.invitation_welcome}</p><p>{client.address}</p></div>
                <div><h3><Phone size={17} /> {content.helpline_title}</h3><p>{eventPhone || 'संपर्क तपशील लवकरच प्रसिद्ध केला जाईल.'}</p><p>{content.contact_note}</p></div>
                <div><h3><HeartHandshake size={17} /> {content.support_title}</h3><p>{content.support_text}</p><a href="#helpdesk">सहाय्यता कक्ष पहा</a></div>
                <div className="reference-footer__bottom"><span>© {new Date().getFullYear()} {client.client_name}</span><span>अधिकृत कार्यक्रम व नोंदणी माहिती</span></div>
            </footer>

            <div className="reference-mobile-cta">
                {eventPhone ? <a href={phoneHref}><Phone size={16} /> हेल्पलाईन</a> : <a href="#contact"><CircleHelp size={16} /> संपर्क</a>}
                {activeEvent && <Link to={registrationPath}><LogIn size={16} /> नोंदणी करा</Link>}
            </div>
        </main>
    );
};

export default ClientPublicHome;