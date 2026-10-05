import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock3, MapPin, Phone, ScrollText, Users, Utensils, Building2, Car, HeartHandshake, BookOpen, Menu, LogIn } from 'lucide-react';

const defaultEvent = {
    communityName: 'अखिल पुणे भावसार समाज', eventName: 'उपवर - वधू, पालक परिचय मेळावा २०२७',
    startDate: '2027-01-16', cutoffDate: '2026-12-25', venue: 'Swargate, Keshav Rao Road, NH60, Beside Nehru Stadium, Shukrawar Peth, Pune, Maharashtra 411002',
    officeAddress: '107/6, Changdev Thorat Path, Ekbote Colony, Ghorpade Peth, Swargate, Pune, Maharashtra 411042', officePhone: '020 2444 7712'
};
const quote = '‘ संस्कारांची सुंदर गाठ, नव्या आयुष्याची नवी पहाट... एकत्र येऊन यशस्वी करूया, सुखद नात्यांतील ही वाट ! ’';

const pageContent = {
    mr: {
        featureTitle: 'मेळाव्याची वैशिष्ट्ये', featureHeading: 'सर्व समाज बांधवांच्या सोयीसाठी परिपूर्ण व नियोजनबद्ध व्यवस्था',
        features: [['१००० बांधव बसू शकेल असा सुसज्ज हॉल', 'भव्य आणि प्रशस्त सभागृह, सर्व आधुनिक सुविधांसह सुसज्ज.'], ['भव्य अशी पार्किंगची व्यवस्था', 'कार्यक्रमास येणाऱ्या सर्व समाज बांधवांच्या वाहनांसाठी सुरक्षित पार्किंग.'], ['शहराच्या मध्यभागी सोयीस्कर स्थळ', 'सर्व बाजूंनी आणि वाहतुकीच्या साधनांनी सहज जोडलेले मध्यवर्ती ठिकाण.'], ['पालक समुपदेशनाची स्वतंत्र व्यवस्था', 'उपवर-वधू व पालकांसाठी योग्य मार्गदर्शन आणि संवाद कक्ष.'], ['एल.ई.डी. डिस्प्लेची व्यवस्था', 'सभागृहातील सर्व उपस्थितांना उमेदवारांचा परिचय स्पष्ट दिसेल.'], ['निशुल्क भोजन व्यवस्था', 'सर्व भावसार बंधू आणि भगिनींसाठी स्वादिष्ट भोजन व्यवस्था.']],
        invitation: 'स्नेह निमंत्रण', salutation: 'श्री / श्रीमती,', invitationText: 'आपणास निमंत्रित करतांना आनंद होतो की, पुणे येथे', invitationEnd: 'रोजी आयोजन करण्यात येत आहे. तरी सर्व भावसार समाज बंधू आणि भगिनींनी उपस्थित राहून कार्यक्रम यशस्वी करावा, ही नम्र विनंती.', welcome: 'सर्व भावसार समाज बांधवांचे स्नेहपूर्वक स्वागत!',
        rulesKicker: 'नियमावली व अटी', rulesHeading: 'मेळावा नोंदणी नियमावली व शुल्क तपशील', fees: 'नोंदणी शुल्क तपशील', feeText: <>फॉर्म नोंदणी शुल्क: <strong>₹ २००/-</strong><br />स्मरणिका नोंदणी शुल्क: <strong>₹ ३५०/-</strong><br />एकूण शुल्क: <strong>₹ ५५०/-</strong></>, paymentDone: 'पेमेंट पूर्ण झाल्यावरच नोंदणी ग्राह्य धरली जाईल.', rulesText: 'कृपया सर्व नियम काळजीपूर्वक वाचून ऑनलाईन फॉर्म भरावा.', registerCta: 'येथे ऑनलाईन नोंदणी करा',
        ratesTitle: 'स्मरणिका जाहिरात दर पत्रक', ratesHeading: 'यशस्वी करण्यासाठी आपल्या सहकार्याची आवश्यकता आहे.', committeeKicker: 'कार्यकारिणी समिती', committeeHeading: 'विनीत / स्वागतोत्सुक व कार्यकारिणी समिती सदस्य', loginKicker: 'ऑनलाईन सूची', loginHeading: 'उमेदवार लॉगिन', loginText: 'आपली प्रोफाइल पाहण्यासाठी आणि जुळणारे स्थळ शोधण्यासाठी लॉगिन करा.', email: 'ईमेल पत्ता', password: 'पासवर्ड', login: 'लॉगिन करा', helpline: 'नोंदणी सहाय्यता हेल्पलाईन', food: 'अन्नदान', foodText: 'अन्नदानाकरिता देणगी स्वेच्छेनुसार स्वीकारण्यात येईल.', mobileHelp: 'हेल्पलाईन',
        altLogo: 'भावसार समाज लोगो', menu: 'नेव्हिगेशन मेन्यू', dateTime: 'वार व दिनांक', heroRegister: 'ऑनलाईन नोंदणी फॉर्म भरा', heroInvite: 'स्नेह निमंत्रण', heroRules: 'नियम व शुल्क', heroRates: 'स्मरणिका दर', venue: 'कार्यक्रम स्थळ', office: 'कार्यालयाचा पत्ता', location: 'पुणे (महाराष्ट्र)', registration: '(र. नं. महाराष्ट्र २३६, एफ ३५४ क्र. ४७/२)', president: 'अध्यक्ष', secretary: 'सचिव', treasurer: 'कोषाध्यक्ष', footerWelcome: 'समाज बांधवांचे स्नेहपूर्वक स्वागत!'
    },
    en: {
        featureTitle: 'Meet Features', featureHeading: 'A complete and well-planned arrangement for all community members',
        features: [['A well-equipped hall for 1,000 guests', 'A spacious hall with all modern facilities.'], ['Ample parking facility', 'Safe parking for vehicles of all community members.'], ['Convenient central location', 'A centrally located venue connected by all major routes.'], ['Dedicated parent counselling facility', 'Guidance and interaction space for candidates and parents.'], ['LED display facility', 'Candidate introductions will be clearly visible to everyone.'], ['Complimentary meal arrangement', 'A delicious meal arrangement for all community members.']],
        invitation: 'Invitation', salutation: 'Dear Sir / Madam,', invitationText: 'We are pleased to invite all community members to', invitationEnd: 'on the date below. We request everyone to attend and make the event successful.', welcome: 'A warm welcome to all community members!',
        rulesKicker: 'Rules and Conditions', rulesHeading: 'Registration Rules and Fee Details', fees: 'Registration Fee Details', feeText: <>Form registration fee: <strong>₹ 200/-</strong><br />Souvenir registration fee: <strong>₹ 350/-</strong><br />Total fee: <strong>₹ 550/-</strong></>, paymentDone: 'Registration is valid only after payment is completed.', rulesText: 'Please read all rules carefully before submitting the online form.', registerCta: 'Register Online',
        ratesTitle: 'Souvenir Advertisement Rates', ratesHeading: 'Your support is needed to make the event successful.', committeeKicker: 'Executive Committee', committeeHeading: 'Welcome and Executive Committee Members', loginKicker: 'Online Directory', loginHeading: 'Candidate Login', loginText: 'Login to view your profile and discover compatible matches.', email: 'Email address', password: 'Password', login: 'Sign in', helpline: 'Registration Help Helpline', food: 'Food Donation', foodText: 'Donations for food service are accepted voluntarily.', mobileHelp: 'Helpline',
        altLogo: 'Bhavsar Samaj logo', menu: 'Navigation menu', dateTime: 'Date and time', heroRegister: 'Fill online registration form', heroInvite: 'Invitation', heroRules: 'Rules and fees', heroRates: 'Souvenir rates', venue: 'Event venue', office: 'Office address', location: 'Pune (Maharashtra)', registration: '(Reg. No. Maharashtra 236, F 354 No. 47/2)', president: 'President', secretary: 'Secretary', treasurer: 'Treasurer', footerWelcome: 'A warm welcome to all community members!'
    },
    hi: {
        featureTitle: 'मेळावा विशेषताएं', featureHeading: 'सभी समाज बंधुओं के लिए पूर्ण और सुव्यवस्थित व्यवस्था',
        features: [['1000 लोगों के लिए सुसज्जित हॉल', 'सभी आधुनिक सुविधाओं से सुसज्जित विशाल सभागार।'], ['भव्य पार्किंग व्यवस्था', 'सभी समाज बंधुओं के वाहनों के लिए सुरक्षित पार्किंग।'], ['शहर के मध्य में सुविधाजनक स्थान', 'सभी मार्गों और परिवहन साधनों से आसानी से जुड़ा स्थान।'], ['अभिभावक परामर्श की स्वतंत्र व्यवस्था', 'उम्मीदवारों और अभिभावकों के लिए मार्गदर्शन कक्ष।'], ['एलईडी डिस्प्ले की व्यवस्था', 'सभी उपस्थित लोगों को उम्मीदवारों का परिचय स्पष्ट दिखाई देगा।'], ['निःशुल्क भोजन व्यवस्था', 'सभी समाज बंधुओं के लिए स्वादिष्ट भोजन व्यवस्था।']],
        invitation: 'स्नेह निमंत्रण', salutation: 'श्री / श्रीमती,', invitationText: 'आपको सादर आमंत्रित किया जाता है', invitationEnd: 'को सफल बनाने के लिए सभी समाज बंधुओं से उपस्थित रहने का अनुरोध है।', welcome: 'सभी समाज बंधुओं का स्नेहपूर्वक स्वागत!',
        rulesKicker: 'नियम और शर्तें', rulesHeading: 'मेळावा पंजीकरण नियम और शुल्क विवरण', fees: 'पंजीकरण शुल्क विवरण', feeText: <>फॉर्म पंजीकरण शुल्क: <strong>₹ २००/-</strong><br />स्मरणिका पंजीकरण शुल्क: <strong>₹ ३५०/-</strong><br />कुल शुल्क: <strong>₹ ५५०/-</strong></>, paymentDone: 'भुगतान पूरा होने के बाद ही पंजीकरण मान्य होगा।', rulesText: 'ऑनलाइन फॉर्म भरने से पहले सभी नियम ध्यान से पढ़ें।', registerCta: 'ऑनलाइन पंजीकरण करें',
        ratesTitle: 'स्मरणिका विज्ञापन दर पत्रक', ratesHeading: 'कार्यक्रम को सफल बनाने के लिए आपके सहयोग की आवश्यकता है।', committeeKicker: 'कार्यकारिणी समिति', committeeHeading: 'स्वागत और कार्यकारिणी समिति सदस्य', loginKicker: 'ऑनलाइन सूची', loginHeading: 'उम्मीदवार लॉगिन', loginText: 'अपनी प्रोफाइल देखने और उपयुक्त रिश्ते खोजने के लिए लॉगिन करें।', email: 'ईमेल पता', password: 'पासवर्ड', login: 'लॉगिन करें', helpline: 'पंजीकरण सहायता हेल्पलाइन', food: 'अन्नदान', foodText: 'अन्नदान के लिए दान स्वेच्छा से स्वीकार किया जाएगा।', mobileHelp: 'हेल्पलाइन',
        altLogo: 'भावसार समाज लोगो', menu: 'नेविगेशन मेन्यू', dateTime: 'दिनांक और समय', heroRegister: 'ऑनलाइन पंजीकरण फॉर्म भरें', heroInvite: 'स्नेह निमंत्रण', heroRules: 'नियम और शुल्क', heroRates: 'स्मरणिका दर', venue: 'कार्यक्रम स्थल', office: 'कार्यालय का पता', location: 'पुणे (महाराष्ट्र)', registration: '(पंजीकरण संख्या महाराष्ट्र 236, एफ 354 क्र. 47/2)', president: 'अध्यक्ष', secretary: 'सचिव', treasurer: 'कोषाध्यक्ष', footerWelcome: 'सभी समाज बंधुओं का स्नेहपूर्वक स्वागत!'
    }
};

const committee = [
    'प्रा. श्री. यशवंत वसंतराव आंबेकर', 'डॉ. सौ. स्वाती विपिन टोंगळे', 'श्री. धिरज कमलाकरराव पोहणेकर',
    'सौ. जया गिरीशराव मानमोडे', 'श्री. महेश गुणवंतराव जोगी', 'श्री. नंदकिशोर तुकारामपंत पेठकर',
    'सौ. अपर्णा राजू मुकवाने', 'श्री. विजय नारायणराव अंबारे', 'श्री. उत्तमराव पुंडलिकरराव बनसोड',
];

const PublicLanding = ({ email, setEmail, password, setPassword, handleLogin }) => {
    const { i18n } = useTranslation();
    const [event, setEvent] = useState(defaultEvent);
    useEffect(() => {
        fetch('/api/events/active-banner').then((response) => response.ok ? response.json() : null).then((data) => {
            if (!data?.event) return;
            setEvent((current) => data.event.eventName === 'AkhilPune'
                ? { ...defaultEvent, ...current, ...data.event }
                : { ...current, ...data.event });
        }).catch(() => {});
    }, []);
    const isEnglish = i18n.language === 'en';
    const isHindi = i18n.language === 'hi';
    const labels = isEnglish ? { home: 'Home', invitation: 'Invitation', features: 'Features', rules: 'Rules & Fees', rates: 'Souvenir Rates', committee: 'Committee', help: 'Helpline', register: 'Registration', event: 'Matrimonial Introduction Meet 2027', office: 'Office Address', venue: 'Event Venue', deadline: 'Application deadline', payment: 'Payment is completed securely through the online payment gateway.' } : isHindi ? { home: 'मुखपृष्ठ', invitation: 'स्नेह निमंत्रण', features: 'विशेषताएं', rules: 'नियम और शुल्क', rates: 'स्मरणिका दर', committee: 'समिति', help: 'हेल्पलाइन', register: 'पंजीकरण', event: 'उपवर-वधू परिचय मेळावा २०२७', office: 'कार्यालय का पता', venue: 'कार्यक्रम स्थल', deadline: 'आवेदन की अंतिम तारीख', payment: 'भुगतान ऑनलाइन पेमेंट गेटवे के माध्यम से सुरक्षित रूप से किया जाएगा।' } : { home: 'मुखपृष्ठ', invitation: 'स्नेह निमंत्रण', features: 'वैशिष्ट्ये', rules: 'नियमावली व शुल्क', rates: 'स्मरणिका दर', committee: 'समिती', help: 'हेल्पलाईन', register: 'नोंदणी', event: 'उपवर - वधू, पालक परिचय मेळावा २०२७', office: 'कार्यालयाचा पत्ता', venue: 'कार्यक्रम स्थळ', deadline: 'अर्ज करण्याची अंतिम तारीख', payment: 'पेमेंट ऑनलाइन पेमेंट गेटवेद्वारे सुरक्षितपणे केले जाईल.' };
    const dateText = new Intl.DateTimeFormat(isEnglish ? 'en-IN' : 'mr-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(event.startDate));
    const cutoffText = new Intl.DateTimeFormat(isEnglish ? 'en-IN' : 'mr-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(event.cutoffDate));
    const communityName = event.communityName || defaultEvent.communityName;
    const eventTitle = event.eventName === 'AkhilPune' ? labels.event : (event.eventName || labels.event);
    const eventTime = event.eventTime || (isEnglish ? '9:00 AM to 5:00 PM' : isHindi ? 'सुबह ९:०० से शाम ५:०० तक' : 'सकाळी ९:०० ते दु. ५:०० पर्यंत');
    const languageName = i18n.language === 'en' ? 'English' : i18n.language === 'hi' ? 'हिन्दी' : 'मराठी';
    const content = pageContent[i18n.language] || pageContent.mr;
    return (
    <div className="reference-page min-h-screen bg-[#fffaf4] text-[#4a0a13]">
        <div className="reference-page__notice">{isEnglish ? '॥ Shri Hingulambika Devi Blessings ॥' : isHindi ? '॥ श्री हिंगुलांबिका देवी प्रसन्न ॥' : '॥ श्री हिंगुलांबिका देवी प्रसन्न ॥'} <span>|</span> {content.registration}</div>
        <header className="reference-page__header">
            <Link to="/" className="reference-page__brand">
                <img src="/icon-192.png?v=2" alt={content.altLogo} />
                <span>{communityName}<small>पुणे</small></span>
            </Link>
            <nav className="reference-page__nav" aria-label={content.menu}>
                <a href="#home">{labels.home}</a><a href="#invitation">{labels.invitation}</a><a href="#features">{labels.features}</a><a href="#rules-fees">{labels.rules}</a><a href="#souvenir-rates">{labels.rates}</a><a href="#committee">{labels.committee}</a><a href="#helpline">{labels.help}</a>
            </nav>
            <div className="reference-page__actions"><Link to="/register" className="reference-page__register"><LogIn size={15} /> {labels.register}</Link><select className="reference-page__language" value={i18n.language} onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('appLang', e.target.value); }} aria-label="Language"><option value="mr">मराठी</option><option value="en">English</option><option value="hi">हिन्दी</option></select><span className="sr-only">{languageName}</span><button type="button" aria-label={content.menu}><Menu size={22} /></button></div>
        </header>

        <main id="home">
            <section className="reference-hero">
                <img className="reference-hero__logo" src="/icon-192.png?v=2" alt={content.altLogo} />
                <p className="reference-hero__location"><MapPin size={16} /> {content.location}</p>
                <p className="reference-hero__registration">{content.registration}</p>
                <h1>{communityName}</h1>
                <p className="reference-hero__office"><MapPin size={15} /><strong> {content.office}:</strong> {event.officeAddress}</p>
                <h2>{eventTitle}</h2>
                <p className="reference-hero__quote">{isEnglish ? 'A beautiful bond of values, a new dawn for a new life. Let us come together and make this journey of happy relationships successful!' : isHindi ? 'संस्कारों का सुंदर बंधन, नए जीवन की नई सुबह। आइए मिलकर सुखद रिश्तों की इस यात्रा को सफल बनाएं!' : quote}</p>
                <div className="reference-hero__details">
                    <div><CalendarDays size={25} /><span>{content.dateTime}<strong>{dateText}</strong><small><Clock3 size={14} /> {eventTime}</small></span></div>
                    <div><MapPin size={25} /><span>{content.venue}<strong>{event.venue}</strong><small>{event.officePhone}</small></span></div>
                </div>
                <div className="reference-hero__links"><Link to="/register"><LogIn size={16} /> {content.heroRegister}</Link><a href="#invitation">{content.heroInvite}</a><a href="#rules-fees">{content.heroRules}</a><a href="#souvenir-rates">{content.heroRates}</a></div>
                <div className="reference-hero__deadline"><CalendarDays size={16} /> {labels.deadline}: {cutoffText}</div>
            </section>

            <div className="reference-quicklinks"><Link to="/register">{labels.register}</Link><a href="#invitation">{labels.invitation}</a><a href="#features">{labels.features}</a><a href="#rules-fees">{labels.rules}</a><a href="#souvenir-rates">{labels.rates}</a><a href="#committee">{labels.committee}</a></div>

            <section id="invitation" className="reference-section reference-invitation"><p className="reference-kicker">॥ {content.invitation} ॥</p><h2>{communityName}</h2><h3>{eventTitle}</h3><div className="reference-section__body"><h4>{content.salutation}</h4><p><strong>{isEnglish ? 'A beautiful bond of values, a new dawn for a new life.' : isHindi ? 'संस्कारों का सुंदर बंधन, नए जीवन की नई सुबह।' : quote}</strong></p><p>{content.invitationText} <strong>{eventTitle}</strong> <strong>{dateText}</strong> {content.invitationEnd}</p></div><div className="reference-signatures"><div><span>{content.president}</span><strong>श्री. पंकज राजेंद्र भावसार</strong></div><div><span>{content.secretary}</span><strong>{communityName}</strong></div><div><span>{content.treasurer}</span><strong>समाज कार्यकारिणी समिती</strong></div></div><p className="reference-welcome">{content.welcome}</p></section>

            <section id="features" className="reference-section"><p className="reference-kicker">{content.featureTitle}</p><h2>{content.featureHeading}</h2><div className="reference-features">{content.features.map(([title, text], index) => { const Icon = [Building2, Car, MapPin, Users, BookOpen, Utensils][index]; return <article key={title}><Icon size={27} /><h3>{title}</h3><p>{text}</p></article>; })}</div></section>

            <section id="rules-fees" className="reference-section reference-section--tint"><p className="reference-kicker">॥ {content.rulesKicker} ॥</p><h2>{content.rulesHeading}</h2><div className="reference-rules"><div><ScrollText size={28} /><h3>{content.fees}</h3><p>{content.feeText}</p></div><ol><li>{labels.payment}</li><li>{content.paymentDone}</li><li>{labels.deadline}: {cutoffText}.</li><li>{content.rulesText}</li></ol></div><Link to="/register" className="reference-primary-cta"><LogIn size={17} /> {content.registerCta}</Link></section>

            <section id="souvenir-rates" className="reference-section"><p className="reference-kicker">{content.ratesTitle}</p><h2>{eventTitle} {content.ratesHeading}</h2><div className="reference-rate-table"><div><span>{isEnglish ? 'Colour multicolour cover' : isHindi ? 'रंगीन मल्टीकलर कवर' : 'रंगीत मल्टीकलर मलपृष्ठ'}</span><strong>₹ ५०,०००/-</strong></div><div><span>{isEnglish ? 'Inside cover page' : isHindi ? 'मुखपृष्ठ का अंदरूनी पृष्ठ' : 'मुखपृष्ठाचे आतील पान'}</span><strong>₹ ५०,०००/-</strong></div><div><span>{isEnglish ? 'Colour inside page' : isHindi ? 'रंगीन अंदरूनी पृष्ठ' : 'रंगीत आतील पान'}</span><strong>₹ ४०,०००/-</strong></div><div><span>{isEnglish ? 'Standard inside page' : isHindi ? 'साधारण अंदरूनी पृष्ठ' : 'साधे आतील पान'}</span><strong>₹ १०,०००/-</strong></div></div></section>

            <section id="committee" className="reference-section reference-section--tint"><p className="reference-kicker">{content.committeeKicker}</p><h2>{content.committeeHeading}</h2><div className="reference-committee">{committee.map((name) => <span key={name}>◆ {name}</span>)}</div></section>

            <section className="reference-login"><div><p className="reference-kicker">{content.loginKicker}</p><h2>{content.loginHeading}</h2><p>{content.loginText}</p></div><form onSubmit={handleLogin}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={content.email} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder={content.password} /><button type="submit">{content.login} <LogIn size={16} /></button></form></section>
        </main>

        <footer id="helpline" className="reference-footer"><div><h2>{communityName}</h2><p>{content.footerWelcome}</p></div><div><h3><Phone size={17} /> {content.helpline}</h3><p>{event.officePhone}</p><p>{event.officeAddress}</p></div><div><h3><HeartHandshake size={17} /> {content.food}</h3><p>{content.foodText}</p></div><div className="reference-footer__bottom">© २०२७ {communityName}. {isEnglish ? 'All rights reserved.' : isHindi ? 'सर्वाधिकार सुरक्षित।' : 'सर्व हक्क सुरक्षित.'}</div></footer>
        <div className="reference-mobile-cta"><a href={`tel:${event.officePhone.replace(/\D/g, '')}`}><Phone size={16} /> {content.mobileHelp}</a><Link to="/register"><LogIn size={16} /> {content.registerCta}</Link></div>
    </div>
    );
};

export default PublicLanding;
