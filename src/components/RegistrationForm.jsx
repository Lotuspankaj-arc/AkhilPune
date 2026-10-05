import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, AlertCircle, AlertTriangle, XCircle, Eye, EyeOff, Mars, Venus, Clock3, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as faceapi from 'face-api.js';
import { fetchWithAuth } from '../utils/api';
import { apiUrl } from '../config';
import { useAuth } from '../context/AuthContext';
import enData from '../assets/en.json';
import mrData from '../assets/mr.json';
import educationMasterData from '../assets/educationMaster.json';
import marathiDictionary from '../assets/marathiDictionary.json';
import QRCode from 'qrcode';

const createEntryQrDataUrl = ({ batchId, userId, eventName, paymentId, paymentDate }) => QRCode.toDataURL(JSON.stringify({
    batchId,
    userId,
    eventName,
    paymentId,
    paymentDate
}), { width: 240, margin: 1, errorCorrectionLevel: 'M' });

const EDUCATION_CATEGORY_OPTIONS = [
    'All Masters Degrees',
    'All Batchelor Degrees',
    'PHD',
    'CA,CS,ICWA',
    'Doctors or Medical Field',
    'Engineers/Architect(ANY)',
    'Graduates(BCOM,BA,BSC,BBA,BCS,ANY)',
    'Law Field(ANY)',
    '10th,12th Under Graduates(ANY),ITI,Diploma(ANY)'
];

const heightOptions = [
    '4ft', '4ft.1in', '4ft.2in', '4ft.3in', '4ft.4in', '4ft.5in', '4ft.6in', '4ft.7in', '4ft.8in', '4ft.9in', '4ft.10in', '4ft.11in',
    '5ft', '5ft.1in', '5ft.2in', '5ft.3in', '5ft.4in', '5ft.5in', '5ft.6in', '5ft.7in', '5ft.8in', '5ft.9in', '5ft.10in', '5ft.11in',
    '6ft', '6ft.1in', '6ft.2in', '6ft.3in', '6ft.4in', '6ft.5in', '6ft.6in', '6ft.7in', '6ft.8in', '6ft.9in', '6ft.10in', '6ft.11in',
    '7ft', '7ft.1in', '7ft.2in', '7ft.3in', '7ft.4in', '7ft.5in', '7ft.6in', '7ft.7in', '7ft.8in', '7ft.9in', '7ft.10in', '7ft.11in', '8ft'
];

const isValidIndianMobile = (value) => /^[6-9][0-9]{9}$/.test(value);
const isValidPincode = (value) => /^[0-9]{6}$/.test(value);
const isValidDate = (value) => /^([0-2][0-9]|3[0-1])[-\/](0[1-9]|1[0-2])[-\/][0-9]{4}$/.test(value);
const isValidTime = (value) => /^(0?[1-9]|1[0-2]):[0-5][0-9](:[0-5][0-9])?(\s+.+)?$/i.test(value);

const defaultTimePhases = {
    morning: 'Sakal',
    afternoon: 'Dupar',
    evening: 'Sandhyakal',
    night: 'Ratra',
    legend: 'Sakal / Dupar / Sandhyakal / Ratra',
    hint: 'Just type the birth time, the phase is detected automatically'
};

const timePhaseOptions = [
    { value: 'morning', label: 'Sakal' },
    { value: 'afternoon', label: 'Dupar' },
    { value: 'evening', label: 'Sandhyakal' },
    { value: 'night', label: 'Ratra' }
];

const formatDateForDisplay = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(raw)) {
        return raw.replace(/\//g, '-');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-');
        return `${day}-${month}-${year}`;
    }
    return raw;
};

const formatDateForInput = (value) => {
    const displayValue = formatDateForDisplay(value);
    if (!displayValue || !/^\d{2}-\d{2}-\d{4}$/.test(displayValue)) return '';
    const [day, month, year] = displayValue.split('-');
    return `${year}-${month}-${day}`;
};

const formatDateForStorage = (value) => {
    if (!value) return '';
    if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(value)) return value.replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${day}-${month}-${year}`;
    }
    return value;
};

const normalizeNameCase = (value) => {
    const compactValue = String(value || '').replace(/\s+/g, ' ').trim();
    if (!compactValue) return '';
    return compactValue
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const normalizeEducationMaster = (items = []) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
        value: String(item?.value || item?.label || '').trim(),
        label: String(item?.label || item?.value || '').trim(),
        details: Array.isArray(item?.details)
            ? item.details.map((detail) => ({
                value: String(detail?.value || detail?.label || '').trim(),
                label: String(detail?.label || detail?.value || '').trim()
            })).filter((detail) => detail.value)
            : []
    })).filter((item) => item.value);
};

const toOptionRows = (items = []) => items.map((item, index) => ({
    id: item.id || `${item.value || item.label || index}`,
    name: item.label || item.name || item.value || '',
    value: item.value || item.name || item.label || ''
}));

const fallbackExpectationOptions = [
    { id: 'exp_1', name: 'Good family background', value: 'Good family background' },
    { id: 'exp_2', name: 'Well educated', value: 'Well educated' },
    { id: 'exp_3', name: 'Respectful nature', value: 'Respectful nature' },
    { id: 'exp_4', name: 'Simple living', value: 'Simple living' },
    { id: 'exp_5', name: 'Vegetarian', value: 'Vegetarian' },
    { id: 'exp_6', name: 'Non-smoker', value: 'Non-smoker' },
    { id: 'exp_7', name: 'Non-drinker', value: 'Non-drinker' },
    { id: 'exp_8', name: 'Working professional', value: 'Working professional' },
    { id: 'exp_9', name: 'Own house', value: 'Own house' },
    { id: 'exp_10', name: 'Well mannered', value: 'Well mannered' },
    { id: 'exp_11', name: 'Family oriented', value: 'Family oriented' },
    { id: 'exp_12', name: 'Financially stable', value: 'Financially stable' }
];

const parseCsvValues = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const toCsvValue = (values = []) => values.filter(Boolean).join(', ');

const RegistrationForm = ({ loggedInUser, setLoggedInUser }) => {
    const navigate = useNavigate();
    const { clientSlug, eventSlug } = useParams();
    const { t, i18n } = useTranslation();
    const { setToken: authSetToken } = useAuth();

    const [eventDetails, setEventDetails] = useState(null);
    const [clientDetails, setClientDetails] = useState(null);
    const [loadingEventData, setLoadingEventData] = useState(true);
    const [existingProfile, setExistingProfile] = useState(null);
    const [checkedIdentityKey, setCheckedIdentityKey] = useState('');
    const eventBannerUrl = eventDetails?.registration_banner_path || eventDetails?.banner_url || '';
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

    const languageData = enData;
    const formText = languageData.form || {};
    const marriageText = formText.marriageOptions || {};
    const genderText = formText.genderOption || {};
    const complexionText = (formText.options && formText.options.complexion) || {};
    const sectionText = formText.section || {};
    const placeholderText = formText.placeholder || {};
    const timePhaseText = { ...defaultTimePhases, ...(formText.timePhases || {}) };

    const [view, setView] = useState(loggedInUser ? 'edit' : 'register');
    const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });

    const [dynamicExpectations, setDynamicExpectations] = useState([]);
    const [dynamicKulList, setDynamicKulList] = useState([]);
    const [dynamicZodiacList, setDynamicZodiacList] = useState([]);
    const [dynamicNakshatraList, setDynamicNakshatraList] = useState([]);
    const [dynamicBloodGroups, setDynamicBloodGroups] = useState([]);
    const [dynamicGanList, setDynamicGanList] = useState([]);
    const [dynamicNadiList, setDynamicNadiList] = useState([]);
    const [educationMaster, setEducationMaster] = useState([]);
    const [locationMatches, setLocationMatches] = useState([]);
    const [educationDraft, setEducationDraft] = useState('');
    const [educationDetailDraft, setEducationDetailDraft] = useState('');
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [passwordSyncError, setPasswordSyncError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const fieldRefs = useRef({});
    const popupTimerRef = useRef(null);
    const [showBiodataPreview, setShowBiodataPreview] = useState(false);
    const [isSubmittingAfterReview, setIsSubmittingAfterReview] = useState(false);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
    const [registrationIntentId, setRegistrationIntentId] = useState(null);
    const [completionModal, setCompletionModal] = useState({ show: false, name: '', userId: '', password: '', batchId: '', orderId: '', paymentId: '', paymentDate: '', qrCodeDataUrl: '', sessionUser: null });
    const [activeRegistrationEvent, setActiveRegistrationEvent] = useState(null);

    const [marathiTranslations, setMarathiTranslations] = useState({
        firstName: '', middleName: '', lastName: '', addressFlat: '', addressStreet: '', addressColony: '', addressLandmark: '', job: ''
    });

    const [isFaceModelLoaded, setIsFaceModelLoaded] = useState(false);
    const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
    const [photoValidationStatus, setPhotoValidationStatus] = useState(loggedInUser?.photo ? 'valid' : 'idle');

    useEffect(() => {
        const loadModels = async () => {
            try {
                await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                setIsFaceModelLoaded(true);
            } catch (err) {
                console.error("Error loading face-api models:", err);
            }
        };
        loadModels();
    }, []);

    // Load event and client details for multi-tenant registration
    useEffect(() => {
        if (!clientSlug || !eventSlug) {
            return;
        }

        const fetchEventAndClientData = async () => {
            try {
                setLoadingEventData(true);
                const isLegacyNumericLink = /^\d+$/.test(clientSlug) && /^\d+$/.test(eventSlug);
                const eventRes = await fetch(
                    isLegacyNumericLink
                        ? apiUrl(`/api/events/${eventSlug}?clientId=${clientSlug}`)
                        : apiUrl(`/api/events/registration/${encodeURIComponent(clientSlug)}/${encodeURIComponent(eventSlug)}`),
                    { credentials: 'include' }
                );
                if (eventRes.ok) {
                    const eventData = await eventRes.json();
                    setEventDetails(eventData.data);
                    if (isLegacyNumericLink) {
                        const clientRes = await fetch(apiUrl(`/api/clients/${clientSlug}`), { credentials: 'include' });
                        const clientData = clientRes.ok ? await clientRes.json() : null;
                        setClientDetails(clientData?.data || null);
                    } else {
                        setClientDetails(eventData.client || null);
                    }
                } else {
                    setEventDetails(null);
                    setClientDetails(null);
                }
            } catch (error) {
                console.error('Error loading event/client data:', error);
            } finally {
                setLoadingEventData(false);
            }
        };

        fetchEventAndClientData();
    }, [clientSlug, eventSlug]);

    useEffect(() => {
        const metadata = languageData.metadata || {};
        setDynamicKulList(toOptionRows(metadata.kul));
        setDynamicZodiacList(toOptionRows(metadata.zodiac));
        setDynamicNakshatraList(toOptionRows(metadata.nakshatra));
        setDynamicBloodGroups(toOptionRows(metadata.bloodGroups));
        setDynamicGanList(toOptionRows(metadata.gan));
        setDynamicNadiList(toOptionRows(metadata.nadi));
    }, [i18n.language]);

    useEffect(() => {
        let cancelled = false;

        const loadExpectations = async () => {
            try {
                const res = await fetch(apiUrl('/api/master/expectations'), { credentials: 'include' });
                if (!res.ok) throw new Error('Expectation master not available');
                const data = await res.json();
                if (!cancelled && Array.isArray(data.expectations) && data.expectations.length > 0) {
                    setDynamicExpectations(toOptionRows(data.expectations));
                    return;
                }
            } catch (error) {
                console.warn('Expectation master lookup failed, falling back to static metadata', error);
            }

            const metadata = languageData.metadata || {};
            if (!cancelled) {
                const metadataExpectations = toOptionRows(metadata.expectations || []);
                setDynamicExpectations(metadataExpectations.length > 0 ? metadataExpectations : fallbackExpectationOptions);
            }
        };

        loadExpectations();
        return () => { cancelled = true; };
    }, [i18n.language]);

    useEffect(() => {
        setEducationMaster(normalizeEducationMaster(educationMasterData));
    }, []);

    useEffect(() => {
        if (clientSlug && eventSlug) return undefined;

        let cancelled = false;
        const loadActiveEventBanner = async () => {
            setLoadingEventData(true);
            try {
                const response = await fetch(apiUrl('/api/events/active-banner'), { credentials: 'include' });
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) {
                    setActiveRegistrationEvent(data?.event || null);
                }
            } catch (error) {
                if (!cancelled) {
                    setActiveRegistrationEvent(null);
                }
            } finally {
                if (!cancelled) setLoadingEventData(false);
            }
        };
        loadActiveEventBanner();
        return () => { cancelled = true; };
    }, [clientSlug, eventSlug]);

    const initialFormState = {
        email: loggedInUser?.email || '', password: '', confirmPassword: '',
        marriageCategory: 'First Marriage', gender: loggedInUser?.gender || '', firstName: loggedInUser?.name || '', middleName: '', lastName: '',
        addressFlat: '', addressStreet: '', addressColony: '', addressLandmark: '',
        pincode: '', postOffice: '', city: '', tehsil: '', district: '', state: '', stateId: '', districtId: '', subdistrictId: '', locationId: '', mobile: '', whatsapp: '',
        height: '', complexion: '', education: '', educationDetails: '', educationCategory: '', job: '', income: '', jobLocation: '',
        mamekul: '', dob: '', birthTime: '', birthPlace: '', bloodGroup: '', gotra: '', zodiac: '', gan: '', nadi: '', charan: '', nakshatra: '',
        attendedActiveEvent: '', willAttendEvent: '', attendeeCount: '',
        expectations: [], customExpectation: '', agreement: false, photo: null
    };

    const [formData, setFormData] = useState(initialFormState);
    const [photoPreview, setPhotoPreview] = useState(loggedInUser?.photo || null);
    const isCandidateEditView = view === 'edit';

    const fetchMarathiTransliteration = async (text, fieldName) => {
        if (!text.trim()) {
            setMarathiTranslations(prev => ({ ...prev, [fieldName]: '' }));
            return;
        }

        const lowerText = text.trim().toLowerCase();

        // Dictionary Intercept Check for Surnames loaded from JSON
        if (marathiDictionary[lowerText]) {
            setMarathiTranslations(prev => ({ ...prev, [fieldName]: marathiDictionary[lowerText] }));
            return;
        }

        setMarathiTranslations(prev => ({ ...prev, [fieldName]: '' }));
    };

    useEffect(() => {
        if (loggedInUser) {
            setFormData(prev => ({
                ...prev,
                email: loggedInUser.email || prev.email,
                marriageCategory: loggedInUser.marriageCategory || loggedInUser.marriageType || loggedInUser.marriage_type || prev.marriageCategory,
                gender: loggedInUser.gender || prev.gender,
                firstName: loggedInUser.firstName || loggedInUser.name || prev.firstName,
                middleName: loggedInUser.middleName || prev.middleName,
                lastName: loggedInUser.lastName || prev.lastName,
                mobile: loggedInUser.phone || prev.mobile,
                whatsapp: loggedInUser.whatsapp || prev.whatsapp,
                addressFlat: loggedInUser.addressFlat || loggedInUser.address_flat || loggedInUser.address || prev.addressFlat,
                addressStreet: loggedInUser.addressStreet || loggedInUser.address_street || prev.addressStreet,
                addressColony: loggedInUser.addressColony || loggedInUser.address_colony || prev.addressColony,
                addressLandmark: loggedInUser.addressLandmark || loggedInUser.address_landmark || prev.addressLandmark,
                pincode: loggedInUser.pincode || prev.pincode,
                postOffice: loggedInUser.postOffice || prev.postOffice,
                city: loggedInUser.city || prev.city,
                tehsil: loggedInUser.tehsil || prev.tehsil,
                district: loggedInUser.district || prev.district,
                state: loggedInUser.state || prev.state,
                stateId: loggedInUser.stateId || prev.stateId,
                districtId: loggedInUser.districtId || prev.districtId,
                subdistrictId: loggedInUser.subdistrictId || prev.subdistrictId,
                locationId: loggedInUser.locationId || prev.locationId,
                height: loggedInUser.height || prev.height,
                complexion: loggedInUser.complexion || prev.complexion,
                education: loggedInUser.education || prev.education,
                educationDetails: loggedInUser.educationDetails || prev.educationDetails,
                educationCategory: loggedInUser.educationCategory || prev.educationCategory,
                job: loggedInUser.profession || loggedInUser.job || prev.job,
                income: loggedInUser.income || prev.income,
                jobLocation: loggedInUser.jobLocation || prev.jobLocation,
                mamekul: loggedInUser.mamekul || prev.mamekul,
                dob: formatDateForDisplay(loggedInUser.dob || loggedInUser.birth_date || prev.dob),
                birthTime: loggedInUser.birthTime || prev.birthTime,
                birthPlace: loggedInUser.birthPlace || prev.birthPlace,
                bloodGroup: loggedInUser.bloodGroup || prev.bloodGroup,
                gotra: loggedInUser.gotra || prev.gotra,
                zodiac: loggedInUser.zodiac || prev.zodiac,
                gan: loggedInUser.gan || prev.gan,
                nadi: loggedInUser.nadi || prev.nadi,
                charan: loggedInUser.charan || prev.charan,
                nakshatra: loggedInUser.nakshatra || prev.nakshatra,
                attendedActiveEvent: loggedInUser.attendedActiveEvent || loggedInUser.attended_active_event || prev.attendedActiveEvent,
                willAttendEvent: loggedInUser.willAttendEvent || loggedInUser.will_attend_event || prev.willAttendEvent,
                attendeeCount: loggedInUser.attendeeCount || loggedInUser.attendee_count || prev.attendeeCount,
                expectations: Array.isArray(loggedInUser.expectations) ? loggedInUser.expectations : prev.expectations,
                customExpectation: loggedInUser.customExpectation || prev.customExpectation,
            }));
            const profilePhoto = toAssetUrl(loggedInUser.photo || loggedInUser.photo_path || loggedInUser.photo_url);
            setPhotoPreview(profilePhoto || null);
            setPhotoValidationStatus(profilePhoto ? 'valid' : 'idle');
            setShowBiodataPreview(false);
            if (loggedInUser.pincode) {
                loadLocationOptionsForEdit(loggedInUser.pincode);
            }
        } else {
            setFormData(initialFormState);
            setPhotoPreview(null);
            setPhotoValidationStatus('idle');
            setShowBiodataPreview(false);
        }
    }, [loggedInUser]);

    useEffect(() => {
        if (view !== 'register') {
            setPasswordTouched(false);
            setPasswordSyncError('');
        }
    }, [view]);

    useEffect(() => {
        loadRazorpayScript();
    }, []);

    const dismissPopup = () => {
        if (popupTimerRef.current) {
            clearTimeout(popupTimerRef.current);
            popupTimerRef.current = null;
        }
        setPopup({ show: false, message: '', type: 'success' });
    };

    const showPopup = (message, type = 'success', persistent = false) => {
        if (popupTimerRef.current) {
            clearTimeout(popupTimerRef.current);
            popupTimerRef.current = null;
        }
        setPopup({ show: true, message, type });
        if (!persistent) {
            popupTimerRef.current = setTimeout(dismissPopup, 5000);
        }
    };

    const loadRazorpayScript = () => new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

    const mapServerUserToSession = (u) => ({
        id: u.id || u.batch_id,
        name: [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || u.name || formData.firstName,
        initials: ((u.first_name || formData.firstName || 'U')[0] || 'U').toUpperCase(),
        firstName: u.first_name || formData.firstName || '',
        middleName: u.middle_name || formData.middleName || '',
        lastName: u.last_name || formData.lastName || '',
        gender: u.gender || formData.gender || '',
        photo: toAssetUrl(u.photo_path) || photoPreview || null,
        email: u.email || formData.email || '',
        marriageCategory: u.marriageCategory || u.marriage_type || formData.marriageCategory || '',
        phone: u.mobile || u.mobile_number || formData.mobile || '',
        whatsapp: u.whatsapp || u.whatsapp_number || formData.whatsapp || '',
        addressFlat: u.addressFlat || u.address_flat || formData.addressFlat || '',
        addressStreet: u.addressStreet || u.address_street || formData.addressStreet || '',
        addressColony: u.addressColony || u.address_colony || formData.addressColony || '',
        addressLandmark: u.addressLandmark || u.address_landmark || formData.addressLandmark || '',
        address: u.address || u.address_line || [formData.addressFlat, formData.addressStreet, formData.addressColony, formData.addressLandmark].filter(Boolean).join(', ') || '',
        pincode: u.pincode || formData.pincode || '',
        postOffice: u.post_office || formData.postOffice || '',
        city: u.city || u.city_village || formData.city || '',
        tehsil: u.tehsil || formData.tehsil || '',
        district: u.district || formData.district || '',
        state: u.state || formData.state || '',
        stateId: u.location_state_id || formData.stateId || '',
        districtId: u.location_district_id || formData.districtId || '',
        subdistrictId: u.location_subdistrict_id || formData.subdistrictId || '',
        locationId: u.location_master_id || formData.locationId || '',
        education: u.education || u.education_qualification || formData.education || '',
        educationDetails: u.education_details || formData.educationDetails || '',
        educationCategory: u.education_category || u.educationCategory || formData.educationCategory || '',
        profession: u.job || u.job_business_title || formData.job || '',
        job: u.job || u.job_business_title || formData.job || '',
        income: u.income || u.annual_income || formData.income || '',
        jobLocation: u.job_location || u.job_business_location || formData.jobLocation || '',
        mamekul: u.mamekul || formData.mamekul || '',
        dob: formatDateForDisplay(u.dob || u.birth_date || formData.dob || ''),
        birthTime: u.birth_time || formData.birthTime || '',
        birthPlace: u.birth_place || formData.birthPlace || '',
        bloodGroup: u.blood_group || formData.bloodGroup || '',
        gotra: u.gotra || formData.gotra || '',
        zodiac: u.zodiac || formData.zodiac || '',
        gan: u.gan || formData.gan || '',
        nadi: u.nadi || formData.nadi || '',
        charan: u.charan || formData.charan || '',
        nakshatra: u.nakshatra || formData.nakshatra || '',
        attendedActiveEvent: u.attended_active_event || formData.attendedActiveEvent || '',
        willAttendEvent: u.will_attend_event || formData.willAttendEvent || '',
        attendeeCount: u.attendee_count || formData.attendeeCount || '',
        expectations: Array.isArray(u.selected_expectations)
            ? u.selected_expectations
            : (Array.isArray(u.expectations) ? u.expectations : []),
        customExpectation: u.other_expectations || u.customExpectation || formData.customExpectation || '',
        likesCount: 0,
        isAdmin: !!u.isAdmin,
        isSuperUser: !!u.isSuperUser,
        roleName: u.roleName || (u.isSuperUser ? 'super_user' : (u.isAdmin ? 'admin' : 'candidate')),
        adminRole: u.adminRole || null
    });

    const handleInputChange = (e) => {
        let { name, value, type, files, checked } = e.target;

        if (view === 'register' && ['email', 'firstName', 'middleName', 'lastName', 'mobile', 'dob'].includes(name)) {
            setExistingProfile(null);
            setCheckedIdentityKey('');
            setRegistrationIntentId(null);
        }

        if (type === 'text' || type === 'textarea') {
            value = value.replace(/[^a-zA-Z0-9\s.,@_'-]/g, '');
        }

        if (['firstName', 'middleName', 'lastName', 'job', 'addressFlat', 'addressStreet', 'addressColony', 'addressLandmark'].includes(name)) {
            fetchMarathiTransliteration(value, name);
        }

        if (type === 'file') {
            if (files && files.length > 0) {
                const file = files[0];

                if (name === 'photo') {
                    if (!isFaceModelLoaded) {
                        showPopup('Photo scanner is still loading. Please try again in a few seconds.', 'warning');
                        e.target.value = '';
                        return;
                    }
                    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                    if (!validTypes.includes(file.type)) {
                        showPopup('Invalid format. Please upload a JPG, PNG, or WebP photo.', 'error');
                        e.target.value = '';
                        return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                        showPopup('Photo is too large. Please upload an image below 5 MB.', 'error');
                        e.target.value = '';
                        return;
                    }

                    setIsAnalyzingPhoto(true);
                    const imgUrl = URL.createObjectURL(file);
                    const img = new Image();
                    img.onload = async () => {
                        if (img.width < 300 || img.height < 300) {
                            setIsAnalyzingPhoto(false);
                            showPopup('Photo resolution is too low. Please upload a clearer solo photo (minimum 300x300 pixels).', 'error');
                            e.target.value = '';
                            URL.revokeObjectURL(img.src);
                            return;
                        }
                        const ratio = img.height / img.width;
                        if (ratio < 0.8 || ratio > 1.5) {
                            setIsAnalyzingPhoto(false);
                            showPopup('Please upload a standard portrait or square photo.', 'error');
                            e.target.value = '';
                            URL.revokeObjectURL(img.src);
                            return;
                        }
                        try {
                            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());
                            if (detections.length === 0) {
                                setIsAnalyzingPhoto(false);
                                showPopup('No face detected. Please ensure your face is clearly visible.', 'error');
                                e.target.value = '';
                                URL.revokeObjectURL(img.src);
                                return;
                            }
                            if (detections.length > 1) {
                                setIsAnalyzingPhoto(false);
                                showPopup(`Detected ${detections.length} faces. Please upload a solo photo.`, 'error');
                                e.target.value = '';
                                URL.revokeObjectURL(img.src);
                                return;
                            }

                            setIsAnalyzingPhoto(false);
                            setRegistrationIntentId(null);
                            setPhotoValidationStatus('ready');
                            setFormData(prev => ({ ...prev, [name]: file }));
                            setPhotoPreview(imgUrl);
                            showPopup('Valid solo photo selected successfully.', 'success');
                        } catch (err) {
                            console.error("Face detection failed:", err);
                            setIsAnalyzingPhoto(false);
                            showPopup('Failed to analyze the photo. Please try a different one.', 'error');
                            e.target.value = '';
                            URL.revokeObjectURL(img.src);
                        }
                    };
                    img.onerror = () => {
                        setIsAnalyzingPhoto(false);
                        showPopup('Error reading image file. Please try a different photo.', 'error');
                        e.target.value = '';
                        URL.revokeObjectURL(img.src);
                    };
                    img.src = imgUrl;
                    return;
                }

                setFormData(prev => ({ ...prev, [name]: file }));
                setPhotoPreview(URL.createObjectURL(file));
            }
        } else if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            if (name === 'pincode') {
                const nextPincode = value.replace(/\D/g, '').slice(0, 6);
                setLocationMatches([]);
                setFormData(prev => ({
                    ...prev,
                    pincode: nextPincode,
                    postOffice: '',
                    city: '',
                    tehsil: '',
                    district: '',
                    state: '',
                    stateId: '',
                    districtId: '',
                    subdistrictId: '',
                    locationId: ''
                }));
                if (isValidPincode(nextPincode)) {
                    lookupPincode(nextPincode);
                }
                return;
            }

            if (name === 'dob') {
                setFormData(prev => ({ ...prev, dob: formatDateForStorage(value) }));
                return;
            }

            if (name === 'mobile' || name === 'whatsapp') {
                setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 10) }));
                return;
            }

            if (name === 'password' || name === 'confirmPassword') {
                const nextPassword = name === 'password' ? value : formData.password;
                const nextConfirmPassword = name === 'confirmPassword' ? value : formData.confirmPassword;

                setFormData(prev => ({ ...prev, [name]: value }));

                if (passwordTouched) {
                    validatePasswordSync(nextPassword, nextConfirmPassword, true);
                }
                return;
            }

            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const validatePasswordSync = (passwordValue, confirmPasswordValue, force = false) => {
        if (view !== 'register') {
            setPasswordSyncError('');
            return true;
        }
        const password = String(passwordValue || '');
        const confirmPassword = String(confirmPasswordValue || '');
        if (!password && !confirmPassword) {
            setPasswordSyncError('');
            return true;
        }
        if (!force && (!password || !confirmPassword)) {
            setPasswordSyncError('');
            return true;
        }
        if (password !== confirmPassword) {
            setPasswordSyncError('Password and Confirm Password must match.');
            return false;
        }
        setPasswordSyncError('');
        return true;
    };

    const setFieldRef = (name, node) => {
        if (node) fieldRefs.current[name] = node;
    };

    const focusField = (name) => {
        const node = fieldRefs.current[name];
        if (node && typeof node.focus === 'function') {
            node.focus();
        }
    };

    const getFieldError = (fieldName) => {
        const mandatoryPostOffice = locationMatches.length > 1;

        switch (fieldName) {
            case 'email':
                return formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? '' : 'Please enter a valid email address.';
            case 'password':
                return view === 'register' && !formData.password ? 'Password is required.' : '';
            case 'confirmPassword':
                if (view !== 'register') return '';
                if (!formData.confirmPassword) return 'Confirm Password is required.';
                return validatePasswordSync(formData.password, formData.confirmPassword, true) ? '' : 'Password and Confirm Password must match.';
            case 'firstName':
                return formData.firstName.trim() ? '' : 'First Name is required.';
            case 'middleName':
                return formData.middleName.trim() ? '' : 'Middle Name is required.';
            case 'lastName':
                return formData.lastName.trim() ? '' : 'Last Name is required.';
            case 'marriageCategory':
                return formData.marriageCategory ? '' : 'Please select marriage status.';
            case 'gender':
                return formData.gender ? '' : 'Please select Bride / Groom.';
            case 'addressFlat':
                return formData.addressFlat.trim() ? '' : 'Flat / House No is required.';
            case 'addressStreet':
                return formData.addressStreet.trim() ? '' : 'Street Name is required.';
            case 'addressColony':
                return formData.addressColony.trim() ? '' : 'Colony / Area is required.';
            case 'addressLandmark':
                return formData.addressLandmark.trim() ? '' : 'Landmark is required.';
            case 'pincode':
                return isValidPincode(formData.pincode) ? '' : 'Please enter a valid 6-digit pincode.';
            case 'postOffice':
                if (!mandatoryPostOffice) return '';
                return formData.locationId ? '' : 'Please select Post Office from dropdown.';
            case 'mobile':
                return isValidIndianMobile(formData.mobile) ? '' : 'Please enter a valid mobile number.';
            case 'whatsapp':
                return isValidIndianMobile(formData.whatsapp) ? '' : 'Please enter a valid WhatsApp number.';
            case 'height':
                return formData.height ? '' : 'Please select height.';
            case 'complexion':
                return formData.complexion ? '' : 'Please select complexion.';
            case 'educationCategory':
                return view !== 'register' || formData.educationCategory ? '' : 'Please select education category.';
            case 'education':
                return selectedEducationList.length > 0 ? '' : 'Please add at least one education qualification.';
            case 'educationDetails':
                return selectedEducationDetailsList.length > 0 ? '' : 'Please add at least one specialization / stream.';
            case 'dob':
                return formData.dob && isValidDate(formData.dob) ? '' : 'Please enter Date of Birth in DD-MM-YYYY format.';
            case 'birthTime':
                return formData.birthTime && isValidTime(formData.birthTime) ? '' : 'Please enter a valid birth time.';
            case 'birthPlace':
                return formData.birthPlace.trim() ? '' : 'Please enter place of birth.';
            default:
                return '';
        }
    };

    const enforceMandatoryField = (fieldName, options = {}) => {
        const { refocus = true, popupType = 'error' } = options;
        const error = getFieldError(fieldName);
        if (error) {
            showPopup(error, popupType);
            if (refocus) {
                focusField(fieldName);
            }
            return false;
        }
        return true;
    };

    const tabValidationSkipFields = new Set(['password', 'confirmPassword', 'birthTime']);
    const groupedMandatoryFields = new Set(['marriageCategory', 'gender', 'complexion']);

    const handleMandatoryFieldBlur = (fieldName, event) => {
        if (groupedMandatoryFields.has(fieldName)) {
            if (event?.relatedTarget?.name === fieldName) {
                return;
            }
            enforceMandatoryField(fieldName, { refocus: true, popupType: 'warning' });
            return;
        }
        if (tabValidationSkipFields.has(fieldName)) return;
        enforceMandatoryField(fieldName, { refocus: false, popupType: 'warning' });
    };

    const checkExistingProfile = async () => {
        if (view !== 'register') return;
        const mobile = formData.mobile.trim();
        const email = formData.email.trim();
        const names = [formData.firstName, formData.middleName, formData.lastName].map((name) => name.trim());
        const hasNameAndBirthDetails = names.every(Boolean) && formData.dob && formData.birthTime;
        if (!email && !isValidIndianMobile(mobile) && !hasNameAndBirthDetails) return;

        const identityKey = `${mobile}|${email.toLowerCase()}|${names.join(' ').toLowerCase()}|${formData.dob}|${formData.birthTime}`;
        if (identityKey === checkedIdentityKey) return;
        setCheckedIdentityKey(identityKey);

        try {
            const response = await fetch(apiUrl('/api/registration-profile-check'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    mobile,
                    email,
                    firstName: names[0],
                    middleName: names[1],
                    lastName: names[2],
                    dob: formData.dob,
                    birthTime: formData.birthTime,
                    eventId: eventDetails?.event_id || null
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.exists) return;

            const candidate = data.candidate || {};
            setFormData(prev => ({
                ...prev,
                email: candidate.email || prev.email,
                firstName: candidate.first_name || prev.firstName,
                middleName: candidate.middle_name || prev.middleName,
                lastName: candidate.last_name || prev.lastName,
                mobile: candidate.mobile_number || prev.mobile,
                whatsapp: candidate.whatsapp_number || prev.whatsapp,
                gender: candidate.gender || prev.gender,
                marriageCategory: candidate.marriage_type || prev.marriageCategory,
                addressFlat: candidate.address_line || prev.addressFlat,
                pincode: candidate.pincode || prev.pincode,
                city: candidate.city_village || prev.city,
                tehsil: candidate.tehsil || prev.tehsil,
                district: candidate.district || prev.district,
                state: candidate.state || prev.state,
                dob: formatDateForDisplay(candidate.birth_date) || prev.dob,
                birthTime: candidate.birth_time || prev.birthTime,
                birthPlace: candidate.birth_place || prev.birthPlace,
                height: candidate.height || prev.height,
                complexion: candidate.complexion || prev.complexion,
                education: candidate.education_qualification || prev.education,
                educationDetails: candidate.education_details || prev.educationDetails,
                educationCategory: candidate.education_category || prev.educationCategory,
                job: candidate.job_business_title || prev.job,
                income: candidate.annual_income || prev.income,
                jobLocation: candidate.job_business_location || prev.jobLocation,
                mamekul: candidate.mamekul || prev.mamekul,
                bloodGroup: candidate.blood_group || prev.bloodGroup,
                gotra: candidate.gotra || prev.gotra,
                zodiac: candidate.zodiac || prev.zodiac,
                gan: candidate.gan || prev.gan,
                nadi: candidate.nadi || prev.nadi,
                charan: candidate.charan || prev.charan,
                nakshatra: candidate.nakshatra || prev.nakshatra,
                customExpectation: candidate.other_expectations || prev.customExpectation,
                expectations: Array.isArray(candidate.selected_expectations) ? candidate.selected_expectations : prev.expectations
            }));
            const alreadyRegisteredForEvent = Boolean(data.alreadyRegisteredForEvent);
            setExistingProfile({ alreadyRegisteredForEvent, matchType: data.matchType });
            showPopup(
                alreadyRegisteredForEvent
                    ? 'This profile is already registered for this event.'
                    : 'Matching profile found. Review your details, then proceed to payment for this event.',
                'warning',
                true
            );
        } catch (_) {
            // Final duplicate validation still runs on the server before payment.
        }
    };

    const handleMandatoryFieldTab = (fieldName, event) => {
        if (event.key !== 'Tab') return;
        if (groupedMandatoryFields.has(fieldName)) {
            if (!enforceMandatoryField(fieldName, { popupType: 'warning' })) {
                event.preventDefault();
            }
            return;
        }

        if (event.shiftKey) return;
        if (tabValidationSkipFields.has(fieldName)) return;
        if (!enforceMandatoryField(fieldName, { popupType: 'warning' })) {
            event.preventDefault();
        }
    };

    const handlePasswordGroupTab = (fieldName, event) => {
        if (event.key !== 'Tab') return;
        if (event.shiftKey) return;
        if (fieldName !== 'confirmPassword') return;

        const hasPassword = String(formData.password || '').trim().length > 0;
        const hasConfirm = String(formData.confirmPassword || '').trim().length > 0;
        const isMatch = validatePasswordSync(formData.password, formData.confirmPassword, true);

        if (!hasPassword) {
            event.preventDefault();
            showPopup('Password is required.', 'warning');
            focusField('password');
            return;
        }

        if (!hasConfirm || !isMatch) {
            event.preventDefault();
            showPopup('Password and Confirm Password must match.', 'warning');
            focusField('confirmPassword');
        }
    };

    const handlePasswordBlur = (fieldName) => {
        setPasswordTouched(true);
        validatePasswordSync(formData.password, formData.confirmPassword, true);
        if (fieldName === 'confirmPassword' && formData.password && formData.confirmPassword) {
            enforceMandatoryField('confirmPassword', { refocus: false, popupType: 'warning' });
        }
    };

    const handleNameBlur = (fieldName) => {
        const normalizedValue = normalizeNameCase(formData[fieldName]);
        if (normalizedValue !== formData[fieldName]) {
            setFormData(prev => ({ ...prev, [fieldName]: normalizedValue }));
        }
        enforceMandatoryField(fieldName);
    };

    const handleCheckboxArrayChange = (_name, itemValue) => {
        setFormData(prev => {
            const current = [...prev.expectations];
            if (current.includes(itemValue)) {
                return { ...prev, expectations: current.filter(i => i !== itemValue) };
            }
            if (current.length >= 5) {
                showPopup(t('form.validation.expectationsLimit'), 'error');
                return prev;
            }
            return { ...prev, expectations: [...current, itemValue] };
        });
    };

    const removePhoto = () => {
        setFormData(prev => ({ ...prev, photo: null }));
        setPhotoPreview(null);
        setPhotoValidationStatus('idle');
        setRegistrationIntentId(null);
    };

    const selectedEducationList = parseCsvValues(formData.education);
    const selectedEducationDetailsList = parseCsvValues(formData.educationDetails);
    const selectedDraftDegree = educationMaster.find((item) => item.value === educationDraft);
    const educationDetailOptions = (selectedDraftDegree?.details || [])
        .filter((item, index, list) => list.findIndex((entry) => entry.value === item.value) === index);
    const missingEducationDetailDegrees = selectedEducationList.filter((degree) => {
        const degreeMaster = educationMaster.find((item) => item.value === degree);
        const allowedDetails = (degreeMaster?.details || []).map((item) => item.value);
        if (allowedDetails.length === 0) return false;
        return !selectedEducationDetailsList.some((detail) => allowedDetails.includes(detail));
    });
    const selectedEducationComboList = selectedEducationList.map((degree) => {
        const allowedDetails = (educationMaster.find((item) => item.value === degree)?.details || []).map((item) => item.value);
        const selectedDetail = selectedEducationDetailsList.find((detail) => allowedDetails.includes(detail));

        return {
            degree,
            detail: selectedDetail || '',
            label: selectedDetail ? `${degree} - ${selectedDetail}` : degree
        };
    });

    const isRegistrationClosed = view === 'register' && !!activeRegistrationEvent && activeRegistrationEvent.registrationOpen === false;
    const registrationCutoffDisplay = activeRegistrationEvent?.cutoffDate
        ? new Date(activeRegistrationEvent.cutoffDate).toLocaleDateString('en-GB')
        : '';

    const applySelectedLocation = (location) => {
        if (!location) return;

        setFormData(prev => ({
            ...prev,
            postOffice: location.postOffice || '',
            city: location.displayCity || location.city || '',
            tehsil: location.tehsil || '',
            district: location.district || '',
            state: location.state || '',
            stateId: location.stateId || '',
            districtId: location.districtId || '',
            subdistrictId: location.subdistrictId || '',
            locationId: location.locationId || ''
        }));
    };

    const lookupPincode = async (pincode) => {
        if (!isValidPincode(pincode)) {
            setLocationMatches([]);
            return;
        }
        try {
            const res = await fetch(apiUrl(`/api/pincode/${pincode}`), { credentials: 'include' });
            if (!res.ok) {
                setLocationMatches([]);
                return;
            }
            const data = await res.json();
            const locations = Array.isArray(data.locations) ? data.locations : [];
            setLocationMatches(locations);
            if (locations.length === 1) {
                applySelectedLocation(locations[0]);
                setTimeout(() => focusField('mobile'), 0);
            } else if (locations.length > 1) {
                setFormData(prev => ({
                    ...prev,
                    postOffice: '', city: '', tehsil: '', district: '', state: '',
                    stateId: '', districtId: '', subdistrictId: '', locationId: ''
                }));
                setTimeout(() => focusField('postOffice'), 0);
            } else {
                setFormData(prev => ({
                    ...prev,
                    postOffice: '', city: '', tehsil: '', district: '', state: '',
                    stateId: '', districtId: '', subdistrictId: '', locationId: ''
                }));
            }
        } catch (err) {
            console.warn('Pincode lookup failed', err);
            setLocationMatches([]);
        }
    };

    const loadLocationOptionsForEdit = async (pincode) => {
        if (!isValidPincode(pincode)) return;
        try {
            const res = await fetch(apiUrl(`/api/pincode/${pincode}`), { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            const locations = Array.isArray(data.locations) ? data.locations : [];
            if (locations.length > 0) {
                setLocationMatches(locations);
            }
        } catch (err) {
            console.warn('Pincode lookup for profile edit failed', err);
        }
    };

    const handlePostOfficeChange = (e) => {
        const selectedLocationId = e.target.value;
        const location = locationMatches.find((item) => String(item.locationId) === selectedLocationId);
        setFormData(prev => ({
            ...prev,
            locationId: selectedLocationId,
            postOffice: location?.postOffice || ''
        }));
        applySelectedLocation(location);
        if (location) {
            setTimeout(() => focusField('mobile'), 0);
        }
    };

    const addEducationEntry = ({ silent = false, returnFocus = true } = {}) => {
        if (!educationDraft) {
            if (!silent) showPopup('Please select a degree first.', 'error');
            return;
        }
        if (educationDetailOptions.length > 0 && !educationDetailDraft) {
            if (!silent) showPopup('Please select the specialization / subject / stream.', 'error');
            return;
        }
        const nextEducationValues = selectedEducationList.includes(educationDraft)
            ? selectedEducationList
            : [...selectedEducationList, educationDraft];

        const nextDetailValues = educationDetailDraft && !selectedEducationDetailsList.includes(educationDetailDraft)
            ? [...selectedEducationDetailsList, educationDetailDraft]
            : selectedEducationDetailsList;

        setFormData(prev => ({
            ...prev,
            education: toCsvValue(nextEducationValues),
            educationDetails: toCsvValue(nextDetailValues)
        }));
        setEducationDraft('');
        setEducationDetailDraft('');
        if (returnFocus) {
            setTimeout(() => focusField('educationDraft'), 0);
        }
    };

    const autoAddEducationEntry = () => {
        if (!educationDraft || !educationDetailDraft) return;
        addEducationEntry({ silent: true, returnFocus: false });
    };

    const removeEducationQualification = (value) => {
        const nextValues = selectedEducationList.filter((item) => item !== value);
        const allowedDetails = educationMaster
            .filter((item) => nextValues.includes(item.value))
            .flatMap((item) => item.details || [])
            .map((item) => item.value);

        setFormData(prev => ({
            ...prev,
            education: toCsvValue(nextValues),
            educationDetails: toCsvValue(selectedEducationDetailsList.filter((item) => allowedDetails.includes(item)))
        }));
    };

    const requireField = (condition, message) => {
        if (!condition) {
            showPopup(message, 'error');
            return false;
        }
        return true;
    };

    const validateForm = () => {
        if (view === 'register' && !requireField(formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email), 'Please enter a valid email address.')) return false;
        if (view === 'register' && !validatePasswordSync(formData.password, formData.confirmPassword, true)) {
            showPopup('Passwords do not match!', 'error');
            return false;
        }
        if (!requireField(formData.marriageCategory, 'Please select marriage status.')) return false;
        if (!requireField(formData.gender, 'Please select Bride / Groom.')) return false;
        if (!requireField(formData.firstName && formData.middleName && formData.lastName, 'Please complete all name fields.')) return false;
        if (!requireField(formData.addressFlat.trim(), 'Please enter Flat / House No.')) return false;
        if (!requireField(formData.addressStreet.trim(), 'Please enter Street Name.')) return false;
        if (!requireField(formData.addressColony.trim(), 'Please enter Colony / Area.')) return false;
        if (!requireField(formData.addressLandmark.trim(), 'Please enter Landmark.')) return false;
        if (!isValidPincode(formData.pincode)) {
            showPopup(t('form.labels.pincode'), 'error');
            return false;
        }
        if (locationMatches.length > 1 && !requireField(formData.locationId, 'Please select the correct post office for this pincode.')) return false;
        if (!requireField(formData.city && formData.district && formData.state, 'Please choose the location details for this pincode.')) return false;
        if (!isValidIndianMobile(formData.mobile)) {
            showPopup(t('form.labels.mobile'), 'error');
            return false;
        }
        if (!isValidIndianMobile(formData.whatsapp)) {
            showPopup(t('form.labels.whatsapp'), 'error');
            return false;
        }
        if (!requireField(formData.height, 'Please select height.')) return false;
        if (!requireField(formData.complexion, 'Please select complexion.')) return false;
        if (view === 'register' && !requireField(formData.educationCategory, 'Please select education category.')) return false;
        if (!requireField(selectedEducationList.length > 0, 'Please add at least one education qualification.')) return false;
        if (!requireField(selectedEducationDetailsList.length > 0, 'Please add at least one education detail.')) return false;
        if (!requireField(missingEducationDetailDegrees.length === 0, `Please add at least one detail for: ${missingEducationDetailDegrees.join(', ')}`)) return false;
        if (!requireField(formData.dob && isValidDate(formData.dob), 'Please enter Date of Birth in DD-MM-YYYY format.')) return false;
        if (!requireField(formData.birthTime && isValidTime(formData.birthTime), 'Please enter a valid birth time.')) return false;
        if (!requireField(formData.birthPlace.trim(), 'Please enter place of birth.')) return false;
        if (view === 'register' && !existingProfile && !formData.photo) {
            showPopup('Please upload a passport size photo.', 'error');
            return false;
        }
        if (formData.expectations.length > 5) {
            showPopup(t('form.validation.expectationsLimit'), 'error');
            return false;
        }
        if (activeRegistrationEvent && formData.willAttendEvent === 'yes' && !requireField(String(formData.attendeeCount || '').trim() && Number(formData.attendeeCount) > 0, 'Please enter how many people will attend.')) return false;
        return true;
    };

    const postOfficeOptions = locationMatches.map((item) => {
        const villageOrCity = item.villageNameLocal || item.displayCity || item.city;
        const labelParts = [item.postOffice, villageOrCity, item.tehsil].filter(Boolean);
        return {
            value: String(item.locationId),
            label: labelParts.length > 0 ? labelParts.join(' - ') : item.displayLabel || item.postOffice
        };
    });
    const cityOptions = [...new Set(locationMatches.map((item) => item.displayCity).filter(Boolean))];
    const tehsilOptions = [...new Set(locationMatches.map((item) => item.tehsil).filter(Boolean))];
    const districtOptions = [...new Set(locationMatches.map((item) => item.district).filter(Boolean))];
    const stateOptions = [...new Set(locationMatches.map((item) => item.state).filter(Boolean))];

    const performSubmit = async () => {
        if (isSubmittingAfterReview) return;
        setIsSubmittingAfterReview(true);

        try {
            const fd = new FormData();
            const protectedEditFields = new Set(view === 'edit' ? ['firstName', 'middleName', 'lastName', 'email', 'dob'] : []);

            const excludeFromLoop = ['confirmPassword', 'agreement', 'expectations', 'customExpectation', 'addressFlat', 'addressStreet', 'addressColony', 'addressLandmark', 'firstName', 'middleName', 'lastName', 'mobile', 'whatsapp', 'email', 'photo'];

            Object.entries(formData).forEach(([key, value]) => {
                if (excludeFromLoop.includes(key)) return;
                if (protectedEditFields.has(key)) return;
                if (value !== undefined && value !== null) fd.append(key, value);
            });

            // Enforce explicit trims on fields vital for Duplication logic + backend constraints
            if (!protectedEditFields.has('firstName')) fd.append('firstName', formData.firstName.trim());
            if (!protectedEditFields.has('middleName')) fd.append('middleName', formData.middleName.trim());
            if (!protectedEditFields.has('lastName')) fd.append('lastName', formData.lastName.trim());
            if (!protectedEditFields.has('email')) fd.append('email', formData.email.trim());
            fd.append('mobile', formData.mobile.trim());
            fd.append('whatsapp', formData.whatsapp.trim());

            const concatenatedAddress = [formData.addressFlat, formData.addressStreet, formData.addressColony, formData.addressLandmark, formData.city, formData.tehsil, formData.district, formData.state].filter(Boolean).join(', ');
            if (concatenatedAddress) fd.append('address', concatenatedAddress);
            fd.append('address_flat', formData.addressFlat);
            fd.append('address_street', formData.addressStreet);
            fd.append('address_colony', formData.addressColony);
            fd.append('address_landmark', formData.addressLandmark);
            fd.append('marriage_type', formData.marriageCategory);
            fd.append('post_office', formData.postOffice);

            formData.expectations.forEach(item => fd.append('expectations', item));
            if (formData.customExpectation) fd.append('customExpectation', formData.customExpectation);
            if (formData.photo) fd.append('photo', formData.photo);

            let res;
            if (view === 'register') {
                res = await fetch(apiUrl('/api/register'), { method: 'POST', body: fd, credentials: 'include' });
            } else {
                res = await fetchWithAuth(`/api/update/${loggedInUser.id}`, { method: 'PUT', body: fd });
            }

            if (!res.ok) {
                const errData = await res.json();
                if (res.status === 403 && errData.error && errData.error.includes('closed')) {
                    showPopup('कुठलाही मेळावा चालू नाही, कृपया नंतर प्रयत्न करा', 'error');
                    return;
                }
                showPopup([errData.error, errData.details].filter(Boolean).join(' ') || errData.message || 'Operation failed', 'error');
                return;
            }

            const data = await res.json();

            if (view === 'edit' && data.user) {
                setLoggedInUser(mapServerUserToSession({
                    ...data.user,
                    email: data.user.email || loggedInUser?.email || formData.email
                }));
            }

            if (view === 'register' && data.user) {
                const u = data.user;
                try { authSetToken(data.accessToken); } catch (e) { }
                setLoggedInUser(mapServerUserToSession(u));
                setShowBiodataPreview(false);
                const batchId = String(data.registrationCode || data.batchId || '');
                const userId = (u.email || formData.email || '').trim();
                const qrCodeDataUrl = await createEntryQrDataUrl({
                    batchId,
                    userId,
                    eventName: activeRegistrationEvent?.eventName || 'Online Suchi',
                    paymentId: '',
                    paymentDate: ''
                });
                setCompletionModal({
                    show: true,
                    name: [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || [formData.firstName.trim(), formData.middleName.trim(), formData.lastName.trim()].filter(Boolean).join(' '),
                    userId,
                    password: formData.password,
                    batchId,
                    orderId: '',
                    paymentId: '',
                    paymentDate: '',
                    qrCodeDataUrl
                });
                return;
            }

            showPopup(data.message || 'Successful!', 'success');
            if (view === 'edit') return;

            setShowBiodataPreview(false);
            navigate('/');
        } catch (err) {
            console.error('Submission error', err);
            showPopup(err?.message || 'Server communication failure.', 'error');
        } finally {
            setIsSubmittingAfterReview(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isRegistrationClosed) {
            showPopup(`Registration cutoff date has passed${registrationCutoffDisplay ? ` (${registrationCutoffDisplay})` : ''}.`, 'warning');
            return;
        }
        if (!formData.agreement) {
            showPopup('Please accept the agreement to proceed.', 'error');
            return;
        }
        if (!validateForm()) return;
        if (view === 'edit') {
            await performSubmit();
            return;
        }
        if (!showBiodataPreview) {
            setShowBiodataPreview(true);
            return;
        }
    };

    const createRegistrationIntentFormData = () => {
        const fd = new FormData();
        const excludeFromLoop = ['confirmPassword', 'agreement', 'expectations', 'customExpectation', 'addressFlat', 'addressStreet', 'addressColony', 'addressLandmark', 'firstName', 'middleName', 'lastName', 'mobile', 'whatsapp', 'email', 'photo'];
        const selectedEventId = eventDetails?.event_id || activeRegistrationEvent?.eventId || null;

        if (selectedEventId) fd.append('event_id', String(selectedEventId));

        Object.entries(formData).forEach(([key, value]) => {
            if (excludeFromLoop.includes(key)) return;
            if (value !== undefined && value !== null) fd.append(key, value);
        });

        // Enforce explicit trims on identical check fields
        fd.append('firstName', formData.firstName.trim());
        fd.append('middleName', formData.middleName.trim());
        fd.append('lastName', formData.lastName.trim());
        fd.append('email', formData.email.trim());
        fd.append('mobile', formData.mobile.trim());
        fd.append('whatsapp', formData.whatsapp.trim());

        const concatenatedAddress = [formData.addressFlat, formData.addressStreet, formData.addressColony, formData.addressLandmark, formData.city, formData.tehsil, formData.district, formData.state].filter(Boolean).join(', ');
        if (concatenatedAddress) fd.append('address', concatenatedAddress);
        fd.append('address_flat', formData.addressFlat);
        fd.append('address_street', formData.addressStreet);
        fd.append('address_colony', formData.addressColony);
        fd.append('address_landmark', formData.addressLandmark);
        fd.append('marriage_type', formData.marriageCategory);
        fd.append('post_office', formData.postOffice);

        formData.expectations.forEach((item) => fd.append('expectations', item));
        if (formData.customExpectation) fd.append('customExpectation', formData.customExpectation);
        if (formData.photo) fd.append('photo', formData.photo);
        return fd;
    };

    const startPaymentFlow = async () => {
        if (isRegistrationClosed) {
            showPopup(`Registration cutoff date has passed${registrationCutoffDisplay ? ` (${registrationCutoffDisplay})` : ''}.`, 'warning');
            return;
        }
        if (!validateForm()) return;
        setIsPaymentProcessing(true);
        let paymentCompleted = false;

        try {
            let intentId = registrationIntentId;
            if (!intentId) {
                const intentRes = await fetch(apiUrl('/api/registration-intents'), {
                    method: 'POST',
                    body: createRegistrationIntentFormData(),
                    credentials: 'include'
                });

                const intentData = await intentRes.json().catch(() => ({}));
                if (!intentRes.ok || !intentData?.intentId) {
                    const serverMessage = [intentData.error, intentData.details]
                        .filter(Boolean)
                        .join(' ')
                        .trim();
                    const message = /record already exists/i.test(serverMessage)
                        ? serverMessage
                        : (/under confirmation/i.test(serverMessage)
                            ? 'Registration confirmation is pending. Please contact customer care.'
                            : (serverMessage || 'Registration is not confirmed. Please try again before payment.'));
                    showPopup(message, 'error', true);
                    return;
                }
                intentId = intentData.intentId;
                setRegistrationIntentId(intentId);
            }

            const orderRes = await fetch(apiUrl('/api/payment/order'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    intentId,
                    purpose: `Registration payment for ${[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ')}`
                })
            });

            const orderData = await orderRes.json().catch(() => ({}));
            if (!orderRes.ok) {
                showPopup(orderData?.error || 'Payment could not start. Registration is not confirmed. Please try again.', 'error', true);
                return;
            }

            if (orderData?.free) {
                paymentCompleted = true;
                await performSubmitWithPayment(null, '', orderData.intentId || intentId);
                return;
            }

            if (!orderData?.keyId || !orderData?.orderId) {
                showPopup('Payment could not start. Registration is not confirmed. Please try again later.', 'error', true);
                return;
            }

            const scriptReady = await loadRazorpayScript();
            if (!scriptReady || !window.Razorpay) {
                showPopup('Payment window could not open. Registration is not confirmed. Please try again.', 'error', true);
                return;
            }

            const razorpayOptions = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'PCMC Registration',
                description: 'Registration fee',
                order_id: orderData.orderId,
                prefill: {
                    name: [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' '),
                    email: formData.email.trim(),
                    contact: formData.mobile
                },
                theme: { color: '#7f1d1d' },
                handler: async (response) => {
                    paymentCompleted = true;
                    await performSubmitWithPayment(response, orderData.orderId, orderData.intentId || intentId);
                },
                modal: {
                    ondismiss: () => {
                        if (!paymentCompleted) {
                            showPopup('Payment was not completed. Registration is not confirmed.', 'error', true);
                        }
                    }
                }
            };

            const razorpayInstance = new window.Razorpay(razorpayOptions);
            razorpayInstance.on('payment.failed', (response) => {
                paymentCompleted = true;
                showPopup('Payment failed. Registration is not confirmed. Please try again.', 'error', true);
            });
            razorpayInstance.open();
        } catch (err) {
            console.error('Payment start failed:', err);
            showPopup('Payment could not start. Registration is not confirmed. Please try again.', 'error', true);
        } finally {
            setIsPaymentProcessing(false);
        }
    };

    const performSubmitWithPayment = async (paymentResponse, orderId, intentId) => {
        setIsSubmittingAfterReview(true);
        try {
            const fd = new FormData();
            fd.append('registration_intent_id', String(intentId || ''));
            fd.append('password', formData.password);
            if (paymentResponse) {
                fd.append('razorpay_order_id', orderId);
                fd.append('razorpay_payment_id', paymentResponse.razorpay_payment_id);
                fd.append('razorpay_signature', paymentResponse.razorpay_signature);
            }

            const res = await fetch(apiUrl('/api/register'), { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setShowBiodataPreview(false);
                setRegistrationIntentId(null);
                showPopup(paymentResponse
                    ? `Payment was received, but registration confirmation is pending. Do not pay again. Please contact customer care with Payment ID: ${paymentResponse.razorpay_payment_id}.`
                    : (data?.error || 'Free registration could not be completed. Please try again.'), 'warning', true);
                return;
            }

            if (res.status === 202 || data.status === 'recovery_pending') {
                setShowBiodataPreview(false);
                setRegistrationIntentId(null);
                showPopup(paymentResponse
                    ? `Payment was received, but registration confirmation is pending. Do not pay again. Please contact customer care with Payment ID: ${paymentResponse.razorpay_payment_id}.`
                    : 'Registration confirmation is pending. Please contact customer care.', 'warning', true);
                return;
            }

            if (data.accessToken) {
                try { authSetToken(data.accessToken); } catch (e) { }
            }
            const sessionUser = data.user || {
                first_name: formData.firstName, middle_name: formData.middleName, last_name: formData.lastName,
                gender: formData.gender, email: formData.email, marriageCategory: formData.marriageCategory,
                mobile: formData.mobile, whatsapp: formData.whatsapp, address: [formData.addressFlat, formData.addressStreet, formData.addressColony, formData.addressLandmark, formData.city, formData.tehsil, formData.district, formData.state].filter(Boolean).join(', '),
                pincode: formData.pincode, city: formData.city, tehsil: formData.tehsil, district: formData.district,
                state: formData.state, locationId: formData.locationId, education: formData.education,
                educationDetails: formData.educationDetails, job: formData.job, income: formData.income,
                jobLocation: formData.jobLocation, mamekul: formData.mamekul, dob: formData.dob,
                birthTime: formData.birthTime, birthPlace: formData.birthPlace, bloodGroup: formData.bloodGroup,
                gotra: formData.gotra, zodiac: formData.zodiac, gan: formData.gan, nadi: formData.nadi,
                charan: formData.charan, nakshatra: formData.nakshatra, attended_active_event: formData.attendedActiveEvent, photo_path: null
            };
            const completedSessionUser = mapServerUserToSession(sessionUser);
            const batchId = String(data.registrationCode || data.batchId || 'PENDING');
            const paymentDate = data.user?.payment_date
                ? new Date(data.user.payment_date).toLocaleString('en-GB')
                : new Date().toLocaleString('en-GB');
            const qrCodeDataUrl = await createEntryQrDataUrl({
                batchId, userId: formData.email.trim(), eventName: activeRegistrationEvent?.eventName || 'Online Suchi',
                paymentId: String(paymentResponse?.razorpay_payment_id || ''), paymentDate
            });

            setShowBiodataPreview(false);
            setRegistrationIntentId(null);
            setCompletionModal({
                show: true, name: [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' '),
                userId: formData.email.trim(), password: formData.password, batchId,
                orderId: String(orderId || ''), paymentId: String(paymentResponse?.razorpay_payment_id || ''),
                paymentDate, qrCodeDataUrl, sessionUser: completedSessionUser
            });
        } catch (err) {
            console.error('Final registration save failed:', err);
            setShowBiodataPreview(false);
            setRegistrationIntentId(null);
            showPopup(paymentResponse
                ? `Payment was received, but registration confirmation is pending. Do not pay again. Please contact customer care with Payment ID: ${paymentResponse?.razorpay_payment_id || 'N/A'}.`
                : 'Free registration could not be completed. Please try again.', 'warning', true);
        } finally {
            setIsSubmittingAfterReview(false);
        }
    };

    const inputClasses = "input-modern input-light w-full p-4 rounded-xl outline-none transition-all text-base placeholder:text-red-950/35 text-black";
    const getFilledInputClasses = (value) => {
        const hasValue = String(value ?? '').trim().length > 0;
        return hasValue ? `${inputClasses} !bg-white !text-black !border-amber-300` : `${inputClasses} bg-black/5`;
    };
    const selectClasses = `${inputClasses} pr-10 cursor-pointer text-black`;
    const postOfficeSelectClasses = `${selectClasses} border-amber-500/70 !bg-white font-semibold !text-black`;
    const labelClasses = "block text-sm font-extrabold text-black mb-1.5 ml-1";
    const radioGroupClasses = "flex flex-wrap gap-3 rounded-xl border border-red-950/10 bg-[#fffaf0] p-3";
    const getRadioOptionClasses = (isSelected) => `flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all text-black ${isSelected
        ? 'border-amber-400 bg-amber-100 font-bold shadow-sm'
        : 'border-red-950/10 bg-white hover:border-amber-400/70 hover:bg-amber-50'
        }`;
    const selectControlStyle = { backgroundColor: 'rgba(0,0,0,0.05)', color: 'black', colorScheme: 'light' };
    const selectOptionStyle = { backgroundColor: '#ffffff', color: 'black' };
    const getSelectControlStyle = (value) => (String(value || '').trim()
        ? { backgroundColor: '#ffffff', color: 'black', colorScheme: 'light', borderColor: '#fcd34d' }
        : selectControlStyle);
    const toYesNoLabel = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'yes') return t('form.labels.yes', 'Yes');
        if (normalized === 'no') return t('form.labels.no', 'No');
        return 'N/A';
    };

    const fullAddressEng = [formData.addressFlat, formData.addressStreet, formData.addressColony, formData.addressLandmark, formData.city, formData.tehsil, formData.district, formData.state].filter(Boolean).join(', ');
    const fullAddressMar = [marathiTranslations.addressFlat, marathiTranslations.addressStreet, marathiTranslations.addressColony, marathiTranslations.addressLandmark].filter(Boolean).join(', ');

    const previewSections = [
        {
            title: 'Personal & Birth Details',
            items: [
                ['Complexion', formData.complexion], ['Height', formData.height],
                ['DOB', formData.dob], ['Birth Time', formData.birthTime], ['Birth Place', formData.birthPlace],
            ]
        },
        {
            title: 'Education & Work',
            items: [
                ['Education Category', formData.educationCategory],
                ['Education Qualification', parseCsvValues(formData.education).join(', ')],
                ['Education Details', parseCsvValues(formData.educationDetails).join(', ')],
                ['Job / Business', `${formData.job} ${marathiTranslations.job ? `(${marathiTranslations.job})` : ''}`], ['Annual Income', formData.income],
                ['Location of Job / Business', formData.jobLocation],
                ['Expectations', formData.expectations.join(', ')], ['Additional Expectation', formData.customExpectation]
            ]
        },
        {
            title: 'Astro & Family Details',
            items: [
                ['Blood Group', formData.bloodGroup], ['Gotra', formData.gotra], ['Zodiac', formData.zodiac],
                ['Gan', formData.gan], ['Nadi', formData.nadi], ['Charan', formData.charan],
                ['Nakshatra', formData.nakshatra], ['Mamekul', formData.mamekul]
            ]
        }
    ];
    const renderPreviewFieldRow = (label, value) => (
        <div key={label} className="grid grid-cols-[minmax(130px,1fr)_2fr] gap-2 border-b border-amber-200 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">{label}</span>
            <span className="text-sm font-semibold text-slate-800 break-words">{value || 'N/A'}</span>
        </div>
    );

    const registrationEvent = clientSlug && eventSlug ? eventDetails : activeRegistrationEvent;
    if (!isCandidateEditView && loadingEventData) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#fff8eb] px-4 pt-20 text-center text-red-950">
                <p className="rounded-2xl border border-amber-200 bg-white px-6 py-5 font-semibold shadow-sm">Checking registration availability...</p>
            </div>
        );
    }
    if (!isCandidateEditView && !registrationEvent) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#fff8eb] px-4 pt-20 text-center text-red-950">
                <div className="max-w-lg rounded-3xl border border-amber-200 bg-white px-6 py-8 shadow-sm">
                    <h1 className="font-serif text-2xl font-black">Registration is currently closed</h1>
                    <p className="mt-3 text-sm font-semibold text-red-950/65">There is no active event available for registration right now. Please check back when the next event is announced.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fff8eb] bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')] font-sans pb-12 relative pt-20 overflow-x-hidden text-black">
            <div className="bg-blob -top-20 -left-20 h-72 w-72 bg-amber-500/20 animate-float-slow"></div>
            <div className="bg-blob top-1/2 -right-24 h-80 w-80 bg-red-900/10 animate-float-slower"></div>
            {popup.show && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg rounded-3xl border-2 border-amber-400/70 bg-[#fff8ef] px-6 py-6 text-slate-900 shadow-2xl animate-pop-in">
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5">
                                {popup.type === 'error' && <XCircle className="text-red-600" size={24} />}
                                {popup.type === 'warning' && <AlertTriangle className="text-amber-600" size={24} />}
                                {popup.type === 'success' && <CheckCircle2 className="text-emerald-600" size={24} />}
                                {popup.type !== 'error' && popup.type !== 'warning' && popup.type !== 'success' && <AlertCircle className="text-sky-600" size={24} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                                    {popup.type === 'error' ? 'Alert' : popup.type === 'warning' ? 'Warning' : popup.type === 'success' ? 'Success' : 'Message'}
                                </p>
                                <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{popup.message}</p>
                            </div>
                            <button type="button" onClick={dismissPopup} className="shrink-0 text-slate-500 hover:text-slate-900" aria-label="Close message" title="Close message">
                                <XCircle size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completionModal.show && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-[30px] border border-amber-500/50 bg-[#fff8ef] p-8 text-center shadow-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Registration Completed</p>
                        <h3 className="mt-3 text-3xl font-extrabold text-red-950">Jay Hinglaj {completionModal.name || ''}</h3>
                        <p className="mt-4 text-lg font-semibold text-slate-700">
                            {completionModal.name || 'Candidate'}, your registration has been completed successfully.
                        </p>
                        <div className="mt-4 space-y-1 rounded-2xl border border-amber-200 bg-white p-4 text-left text-sm text-slate-700">
                            <p><strong>User ID:</strong> {completionModal.userId || 'N/A'}</p>
                            <p><strong>Password:</strong> {completionModal.password || 'N/A'}</p>
                            <p><strong>Stage ID:</strong> {completionModal.batchId || 'N/A'}</p>
                            <p><strong>Order ID:</strong> {completionModal.orderId || 'N/A'}</p>
                            <p><strong>Payment ID:</strong> {completionModal.paymentId || 'N/A'}</p>
                            <p><strong>Payment Date:</strong> {completionModal.paymentDate || 'N/A'}</p>
                        </div>
                        {completionModal.qrCodeDataUrl && (
                            <div className="mx-auto mt-5 w-fit rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
                                <img src={completionModal.qrCodeDataUrl} alt="Event entry QR code" className="h-56 w-56" />
                                <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-700">Entry Pass QR</p>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                const completedSessionUser = completionModal.sessionUser;
                                setCompletionModal({ show: false, name: '', userId: '', password: '', batchId: '', orderId: '', paymentId: '', paymentDate: '', qrCodeDataUrl: '', sessionUser: null });
                                if (completedSessionUser) {
                                    setLoggedInUser(completedSessionUser);
                                }
                                navigate('/');
                            }}
                            className="btn-3d btn-3d-maroon mt-6 rounded-2xl px-6 py-3 font-extrabold"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {isSubmittingAfterReview && (
                <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl border border-amber-400/60 bg-[#fff8ef] p-7 text-center text-slate-900 shadow-2xl">
                        <LoaderCircle className="mx-auto animate-spin text-amber-600" size={42} />
                        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
                            {view === 'edit' ? 'Saving Changes' : 'Finalizing Registration'}
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-700">
                            {view === 'edit' ? 'Please wait while your profile is updated.' : 'Payment received. Please wait while the confirmation popup is prepared.'}
                        </p>
                    </div>
                </div>
            )}

            {showBiodataPreview && (
                <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-amber-500/50 bg-[#fff8ef] text-slate-900 shadow-2xl sm:max-h-[calc(100vh-3rem)]">
                        <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-gradient-to-r from-[#fff6e8] to-[#fff1dc] px-6 py-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Biodata Preview</p>
                                <h3 className="font-serif text-2xl font-extrabold text-red-950">Please verify the details before payment</h3>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4 grid gap-3">
                            <div className="grid gap-4 rounded-3xl border border-amber-200 bg-white p-4 shadow-sm md:grid-cols-[160px_1fr]">
                                <div className="flex items-center justify-center">
                                    <div className="h-40 w-32 overflow-hidden rounded-2xl border-4 border-amber-100 bg-amber-50 shadow-inner">
                                        {photoPreview ? <img src={photoPreview} alt="Biodata preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-center text-sm font-bold text-amber-700">Photo</div>}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h4 className="font-serif text-2xl font-extrabold text-red-950 mb-1">
                                        {[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') || 'Applicant Name'}
                                        {marathiTranslations.firstName && (
                                            <span className="text-lg text-amber-700 ml-2">
                                                ({[marathiTranslations.firstName, marathiTranslations.middleName, marathiTranslations.lastName].filter(Boolean).join(' ')})
                                            </span>
                                        )}
                                    </h4>
                                    <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full w-fit mb-2">
                                        {formData.gender || 'Bride'} • {formData.marriageCategory || 'First Marriage'}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
                                        <p><strong>Email (User ID):</strong> {formData.email}</p>
                                        <p><strong>Mobile:</strong> {formData.mobile} | <strong>WA:</strong> {formData.whatsapp}</p>
                                        <p className="col-span-1 md:col-span-2">
                                            <strong>Address:</strong> {fullAddressEng}
                                            {fullAddressMar && <><br /><span className="text-blue-700">मराठी: {fullAddressMar} {locationMatches.find((item) => String(item.locationId) === String(formData.locationId))?.villageNameLocal || ''}</span></>}
                                        </p>
                                        <p><strong>Pincode:</strong> {formData.pincode}</p>
                                        <p><strong>Post Office:</strong> {locationMatches.find((item) => String(item.locationId) === String(formData.locationId))?.postOffice || formData.postOffice}</p>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">Will Attend: {toYesNoLabel(formData.willAttendEvent)}</span>
                                        {formData.willAttendEvent === 'yes' && <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">Attendees: {formData.attendeeCount}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-3">
                                {previewSections.map((section) => (
                                    <div key={section.title} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                                        <h4 className="mb-2 font-serif text-lg font-extrabold text-red-950">{section.title}</h4>
                                        <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-1">
                                            {section.items.map(([label, value]) => renderPreviewFieldRow(label, value))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-3 border-t border-amber-200 bg-amber-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-slate-700">
                                {view === 'edit'
                                    ? 'After confirmation, your profile changes will be saved.'
                                    : 'User should understand after a payment his profile will be submitted.'}
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button type="button" onClick={() => setShowBiodataPreview(false)} className="rounded-2xl border border-red-200 bg-white px-5 py-3 font-bold text-red-800 hover:bg-red-50">
                                    Edit Details
                                </button>
                                <button type="button" onClick={() => {
                                    setPhotoValidationStatus('valid');
                                    startPaymentFlow();
                                }} disabled={isPaymentProcessing || isSubmittingAfterReview || isRegistrationClosed} className="btn-3d btn-3d-maroon flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-extrabold disabled:cursor-not-allowed disabled:opacity-60">
                                    {isRegistrationClosed
                                        ? `Registration Closed${registrationCutoffDisplay ? ` (${registrationCutoffDisplay})` : ''}`
                                        : (isPaymentProcessing
                                            ? <><LoaderCircle className="animate-spin" size={20} /> Starting Payment...</>
                                            : (view === 'edit' ? 'Confirm Changes & Proceed to Payment' : 'Confirm & Proceed to Payment'))}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 pt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {activeRegistrationEvent && (activeRegistrationEvent.registrationBannerPath || activeRegistrationEvent.organizerPhoto) && (
                        <div className="overflow-hidden rounded-3xl border border-amber-500/40 bg-black/20">
                            <div className="h-44 w-full sm:h-52 md:h-60 lg:h-64">
                                <img
                                    src={activeRegistrationEvent.registrationBannerPath || activeRegistrationEvent.organizerPhoto || ''}
                                    alt={activeRegistrationEvent.eventName || 'Event Banner'}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="border-t border-red-900/50 bg-[#5c0a18]/90 px-5 py-4">
                                <p className="text-sm font-bold text-amber-200">{activeRegistrationEvent.eventName || 'Online Suchi'}</p>
                                <p className="text-xs text-rose-100/90">{activeRegistrationEvent.startDate ? new Date(activeRegistrationEvent.startDate).toLocaleDateString('en-GB') : ''}</p>
                                {activeRegistrationEvent.cutoffDate && (
                                    <p className={`mt-1 text-xs font-semibold ${activeRegistrationEvent.registrationOpen === false ? 'text-amber-300' : 'text-emerald-300'}`}>
                                        Registration cutoff: {new Date(activeRegistrationEvent.cutoffDate).toLocaleDateString('en-GB')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="surface-card flex items-center gap-3 p-5 rounded-2xl mb-6">
                        <AlertCircle className="text-amber-600" size={28} />
                        <div>
                            <h2 className="font-serif text-xl font-black text-red-950">
                                {view === 'edit' ? t('form.headings.editProfile') : t('form.headings.createProfile')}
                            </h2>
                            <p className="text-sm font-semibold text-red-950/55">
                                {view === 'edit' ? t('form.headings.editProfileSubtitle') : t('form.headings.createProfileSubtitle')}
                            </p>
                        </div>
                    </div>

                    {existingProfile && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400 bg-amber-50 p-4 text-amber-950">
                            <p className="text-sm font-bold">
                                {existingProfile.alreadyRegisteredForEvent
                                    ? 'This profile is already registered for this event.'
                                    : 'Matching profile found. You can edit details or proceed to payment.'}
                            </p>
                            {!existingProfile.alreadyRegisteredForEvent && (
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowBiodataPreview(false)} className="rounded-xl border border-amber-700 bg-white px-4 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100">
                                        Edit Details
                                    </button>
                                    <button type="button" onClick={() => setShowBiodataPreview(true)} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">
                                        Proceed to Payment
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Event Details Banner for Multi-Tenant Registration */}
                    {(eventDetails || clientDetails) && (
                        <div className="surface-card p-6 rounded-3xl mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
                            {eventBannerUrl && (
                                <img 
                                    src={toAssetUrl(eventBannerUrl)} 
                                    alt="Event Banner" 
                                    className="w-full h-32 object-cover rounded-2xl mb-4"
                                />
                            )}
                            {!eventBannerUrl && eventDetails && (
                                <div className="mb-4 flex h-32 flex-col justify-end rounded-2xl bg-[#5c0a18] p-5 text-amber-100 shadow-inner">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Event Registration</p>
                                    <p className="mt-1 font-serif text-2xl font-black">{eventDetails.event_name}</p>
                                    <p className="mt-1 text-sm font-semibold text-amber-100/80">{eventDetails.start_date ? new Date(eventDetails.start_date).toLocaleDateString('en-GB') : 'Date to be announced'}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {eventDetails && (
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">Event Details</p>
                                        <h3 className="font-serif text-2xl font-black text-red-950 mt-1">
                                            {eventDetails.event_name}
                                        </h3>
                                        <p className="text-sm text-red-950/70 mt-2">
                                            <strong>📍 Venue:</strong> {eventDetails.venue}
                                        </p>
                                        <p className="text-sm text-red-950/70 mt-1">
                                            <strong>📅 Dates:</strong> {eventDetails.start_date ? new Date(eventDetails.start_date).toLocaleDateString('en-GB') : 'TBA'} - {eventDetails.end_date ? new Date(eventDetails.end_date).toLocaleDateString('en-GB') : 'TBA'}
                                        </p>
                                    </div>
                                )}
                                {clientDetails && (
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">Organized By</p>
                                        <h3 className="font-serif text-2xl font-black text-red-950 mt-1">
                                            {typeof clientDetails === 'object' && clientDetails['0'] 
                                                ? clientDetails['0'].client_name 
                                                : clientDetails?.client_name || 'Event Organizer'}
                                        </h3>
                                        <p className="text-sm text-red-950/70 mt-2">
                                            <strong>📞 Contact:</strong> {typeof clientDetails === 'object' && clientDetails['0'] 
                                                ? clientDetails['0'].phone_number 
                                                : clientDetails?.phone_number || 'N/A'}
                                        </p>
                                        <p className="text-sm text-red-950/70 mt-1">
                                            <strong>📧 Email:</strong> {typeof clientDetails === 'object' && clientDetails['0'] 
                                                ? clientDetails['0'].contact_email 
                                                : clientDetails?.contact_email || 'N/A'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="surface-card p-5 rounded-3xl mb-6">
                        <h3 className="font-serif text-lg font-black text-red-950">{t('form.instructions.title')}</h3>
                        <ul className="mt-4 space-y-2 text-sm font-semibold text-red-950/65 list-disc list-inside">
                            <li>{t('form.instructions.englishOnly', 'Please type in English only. Runtime Marathi translation is provided below some fields.')}</li>
                            <li>{t('form.instructions.spellingOfName')}</li>
                            <li>{t('form.instructions.addressPrecautions')}</li>
                            <li>{t('form.instructions.accuracy')}</li>
                            <li>{t('form.instructions.mobileNumber')}</li>
                            <li>{t('form.instructions.photo')}</li>
                            <li>{t('form.instructions.addressNote')}</li>
                        </ul>
                    </div>

                    <div className="surface-card p-6 sm:p-8 rounded-3xl relative">
                        <div className="flex flex-col-reverse md:flex-row gap-8 border-b border-red-950/10 pb-10">
                            <div className="flex-1 space-y-5">
                                <h3 className="font-serif text-xl font-black text-red-950 mb-2">{sectionText.accountDetails || t('form.section.accountDetails', 'Account Details')}</h3>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.email')} (User ID) *</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} onBlur={() => { handleMandatoryFieldBlur('email'); checkExistingProfile(); }} onKeyDown={(e) => handleMandatoryFieldTab('email', e)} ref={(node) => setFieldRef('email', node)} className={`${getFilledInputClasses(formData.email)} ${isCandidateEditView ? 'opacity-60 cursor-not-allowed' : ''}`} required={view === 'register'} readOnly={isCandidateEditView} />
                                </div>
                                {view === 'register' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className={labelClasses}>{t('form.labels.password')} *</label>
                                            <div className="relative">
                                                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} onBlur={() => handlePasswordBlur('password')} onKeyDown={(e) => { handleMandatoryFieldTab('password', e); handlePasswordGroupTab('password', e); }} ref={(node) => setFieldRef('password', node)} required={!existingProfile} className={`${getFilledInputClasses(formData.password)} pr-14`} />
                                                <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClasses}>{t('form.labels.confirmPassword')} *</label>
                                            <div className="relative">
                                                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} onBlur={() => handlePasswordBlur('confirmPassword')} onKeyDown={(e) => { handleMandatoryFieldTab('confirmPassword', e); handlePasswordGroupTab('confirmPassword', e); }} ref={(node) => setFieldRef('confirmPassword', node)} required={!existingProfile} className={`${getFilledInputClasses(formData.confirmPassword)} pr-14`} />
                                                <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                                                    {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                                                </button>
                                            </div>
                                            {passwordSyncError && <p className="mt-1 text-xs font-semibold text-amber-600">{passwordSyncError}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="w-full md:w-1/3 flex flex-col items-center justify-start border-l border-red-950/10 pl-0 md:pl-8">
                                <label className="text-base font-black text-red-950 mb-3">{t('form.labels.photo')} *</label>
                                <div className={`relative w-40 h-52 border-2 border-dashed border-amber-400/70 rounded-2xl overflow-hidden bg-amber-50 flex items-center justify-center group shadow-inner transition-all duration-300 ${isAnalyzingPhoto ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-500 hover:shadow-[0_0_0_4px_rgba(251,191,36,0.15)]'}`}>
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-4 text-red-950/45">
                                            {isAnalyzingPhoto ? <LoaderCircle className="mx-auto mb-2 text-amber-600 animate-spin" size={40} /> : <Camera className="mx-auto mb-2 text-amber-600" size={40} />}
                                            <span className="text-sm font-medium">{isAnalyzingPhoto ? 'Analyzing...' : 'Upload'}</span>
                                        </div>
                                    )}
                                    <input type="file" name="photo" accept="image/*" onChange={handleInputChange} disabled={isAnalyzingPhoto} className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" />
                                </div>
                                {photoValidationStatus === 'valid' && photoPreview && (
                                    <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-emerald-700">Photo verified</p>
                                )}
                                {photoValidationStatus === 'ready' && photoPreview && (
                                    <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-amber-700">Photo selected</p>
                                )}
                                {photoValidationStatus === 'invalid' && photoPreview && (
                                    <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-red-700">Upload another photo</p>
                                )}
                                {photoPreview && (
                                    <button type="button" onClick={removePhoto} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-red-400 hover:text-red-600 bg-red-100 px-4 py-2 rounded-xl border border-red-200 transition">
                                        <XCircle size={16} /> Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="border-b border-red-900/50 py-10 space-y-5">
                            <h3 className="text-xl font-bold text-amber-600">Profile Specifications</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.marriageCategory')} *</label>
                                    <div className={radioGroupClasses}>
                                        <label className={getRadioOptionClasses(formData.marriageCategory === 'First Marriage')}>
                                            <input
                                                type="radio"
                                                name="marriageCategory"
                                                value="First Marriage"
                                                checked={formData.marriageCategory === 'First Marriage'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('marriageCategory', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('marriageCategory', e)}
                                                ref={(node) => setFieldRef('marriageCategory', node)}
                                                required
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>{marriageText.first || t('form.marriageOptions.first', 'First Marriage')}</span>
                                        </label>
                                        <label className={getRadioOptionClasses(formData.marriageCategory === 'Re Marriage')}>
                                            <input
                                                type="radio"
                                                name="marriageCategory"
                                                value="Re Marriage"
                                                checked={formData.marriageCategory === 'Re Marriage'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('marriageCategory', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('marriageCategory', e)}
                                                ref={(node) => setFieldRef('marriageCategory', node)}
                                                required
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>{marriageText.remarriage || t('form.marriageOptions.remarriage', 'Re-Marriage')}</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClasses}>
                                        <span className="flex items-center gap-2">
                                            {t('form.labels.gender')} *
                                            {formData.gender === 'Bride' && <Venus className="text-pink-600" size={16} />}
                                            {formData.gender === 'Groom' && <Mars className="text-sky-600" size={16} />}
                                        </span>
                                    </label>
                                    <div className={radioGroupClasses}>
                                        <label className={getRadioOptionClasses(formData.gender === 'Bride')}>
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="Bride"
                                                checked={formData.gender === 'Bride'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('gender', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('gender', e)}
                                                ref={(node) => setFieldRef('gender', node)}
                                                required
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>🚺 {genderText.bride || t('form.genderOption.bride', 'Bride')}</span>
                                        </label>
                                        <label className={getRadioOptionClasses(formData.gender === 'Groom')}>
                                            <input
                                                type="radio"
                                                name="gender"
                                                value="Groom"
                                                checked={formData.gender === 'Groom'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('gender', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('gender', e)}
                                                ref={(node) => setFieldRef('gender', node)}
                                                required
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>🚹 {genderText.groom || t('form.genderOption.groom', 'Groom')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.firstName')} *</label>
                                    <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} onBlur={() => handleNameBlur('firstName')} onKeyDown={(e) => handleMandatoryFieldTab('firstName', e)} ref={(node) => setFieldRef('firstName', node)} readOnly={isCandidateEditView} required className={`${getFilledInputClasses(formData.firstName)} ${isCandidateEditView ? 'opacity-60 cursor-not-allowed' : ''}`} />
                                    {marathiTranslations.firstName && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.firstName}</span>}
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.middleName')} *</label>
                                    <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} onBlur={() => handleNameBlur('middleName')} onKeyDown={(e) => handleMandatoryFieldTab('middleName', e)} ref={(node) => setFieldRef('middleName', node)} readOnly={isCandidateEditView} required className={`${getFilledInputClasses(formData.middleName)} ${isCandidateEditView ? 'opacity-60 cursor-not-allowed' : ''}`} />
                                    {marathiTranslations.middleName && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.middleName}</span>}
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.lastName')} *</label>
                                    <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} onBlur={() => { handleNameBlur('lastName'); checkExistingProfile(); }} onKeyDown={(e) => handleMandatoryFieldTab('lastName', e)} ref={(node) => setFieldRef('lastName', node)} readOnly={isCandidateEditView} required className={`${getFilledInputClasses(formData.lastName)} ${isCandidateEditView ? 'opacity-60 cursor-not-allowed' : ''}`} />
                                    {marathiTranslations.lastName && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.lastName}</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.pincode')} *</label>
                                    <input type="text" name="pincode" value={formData.pincode} onChange={handleInputChange} onBlur={() => { lookupPincode(formData.pincode); handleMandatoryFieldBlur('pincode'); }} onKeyDown={(e) => handleMandatoryFieldTab('pincode', e)} ref={(node) => setFieldRef('pincode', node)} className={getFilledInputClasses(formData.pincode)} maxLength={6} required />
                                </div>
                                <div>
                                    <label className={labelClasses}>Post Office {locationMatches.length > 1 ? '*' : ''}</label>
                                    <select name="postOffice" value={formData.locationId} onChange={handlePostOfficeChange} onBlur={() => handleMandatoryFieldBlur('postOffice')} onKeyDown={(e) => handleMandatoryFieldTab('postOffice', e)} ref={(node) => setFieldRef('postOffice', node)} className={postOfficeSelectClasses} style={getSelectControlStyle(formData.locationId)} disabled={locationMatches.length === 0} required={locationMatches.length > 1}>
                                        <option value="" style={selectOptionStyle}>Select Post Office</option>
                                        {postOfficeOptions.map((item) => <option key={item.value} value={item.value} style={selectOptionStyle}>{item.label}</option>)}
                                    </select>
                                    {locationMatches.length > 1 && !formData.locationId && (
                                        <p className="mt-1 text-xs font-semibold text-amber-600">Please select a Post Office from the dropdown before continuing.</p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.city')} *</label>
                                    <select name="city" value={formData.city} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.city)} disabled>
                                        <option value="" style={selectOptionStyle}>Select City / Village</option>
                                        {cityOptions.map((item) => <option key={item} value={item} style={selectOptionStyle}>{item}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.tehsil')}</label>
                                    <select name="tehsil" value={formData.tehsil} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.tehsil)} disabled>
                                        <option value="" style={selectOptionStyle}>Select Tehsil if available</option>
                                        {tehsilOptions.map((item) => <option key={item} value={item} style={selectOptionStyle}>{item}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.district')} *</label>
                                    <select name="district" value={formData.district} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.district)} disabled>
                                        <option value="" style={selectOptionStyle}>Select District</option>
                                        {districtOptions.map((item) => <option key={item} value={item} style={selectOptionStyle}>{item}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.state')} *</label>
                                    <select name="state" value={formData.state} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.state)} disabled>
                                        <option value="" style={selectOptionStyle}>Select State</option>
                                        {stateOptions.map((item) => <option key={item} value={item} style={selectOptionStyle}>{item}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                <div>
                                    <label className={labelClasses}>फ्लॅट / घर क्रमांक * (Flat / House No)</label>
                                    <input type="text" name="addressFlat" value={formData.addressFlat} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('addressFlat')} onKeyDown={(e) => handleMandatoryFieldTab('addressFlat', e)} ref={(node) => setFieldRef('addressFlat', node)} className={getFilledInputClasses(formData.addressFlat)} required />
                                    {marathiTranslations.addressFlat && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.addressFlat}</span>}
                                </div>
                                <div>
                                    <label className={labelClasses}>रस्ता नाव * (Street Name)</label>
                                    <input type="text" name="addressStreet" value={formData.addressStreet} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('addressStreet')} onKeyDown={(e) => handleMandatoryFieldTab('addressStreet', e)} ref={(node) => setFieldRef('addressStreet', node)} className={getFilledInputClasses(formData.addressStreet)} required />
                                    {marathiTranslations.addressStreet && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.addressStreet}</span>}
                                </div>
                                <div>
                                    <label className={labelClasses}>कॉलनी / पेठ / ठिकाण * (Colony / Area)</label>
                                    <input type="text" name="addressColony" value={formData.addressColony} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('addressColony')} onKeyDown={(e) => handleMandatoryFieldTab('addressColony', e)} ref={(node) => setFieldRef('addressColony', node)} className={getFilledInputClasses(formData.addressColony)} required />
                                    {marathiTranslations.addressColony && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.addressColony}</span>}
                                </div>
                                <div>
                                    <label className={labelClasses}>लँडमार्क इ. * (Landmark)</label>
                                    <input type="text" name="addressLandmark" value={formData.addressLandmark} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('addressLandmark')} onKeyDown={(e) => handleMandatoryFieldTab('addressLandmark', e)} ref={(node) => setFieldRef('addressLandmark', node)} className={getFilledInputClasses(formData.addressLandmark)} required />
                                    {marathiTranslations.addressLandmark && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.addressLandmark}</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.mobile')} *</label>
                                    <input type="tel" name="mobile" value={formData.mobile} onChange={handleInputChange} onBlur={() => { handleMandatoryFieldBlur('mobile'); checkExistingProfile(); }} onKeyDown={(e) => handleMandatoryFieldTab('mobile', e)} ref={(node) => setFieldRef('mobile', node)} required className={getFilledInputClasses(formData.mobile)} />
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.whatsapp')} *</label>
                                    <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('whatsapp')} onKeyDown={(e) => handleMandatoryFieldTab('whatsapp', e)} ref={(node) => setFieldRef('whatsapp', node)} required className={getFilledInputClasses(formData.whatsapp)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className={labelClasses}>{t('form.labels.height')} *</label>
                                    <select name="height" value={formData.height} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('height')} onKeyDown={(e) => handleMandatoryFieldTab('height', e)} ref={(node) => setFieldRef('height', node)} className={selectClasses} style={getSelectControlStyle(formData.height)} required>
                                        <option value="" style={selectOptionStyle}>Select Height</option>
                                        {heightOptions.map(h => <option key={h} value={h} style={selectOptionStyle}>{h}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClasses}>{t('form.labels.complexion')} *</label>
                                    <div className={radioGroupClasses}>
                                        <label className={getRadioOptionClasses(formData.complexion === 'Fair')}>
                                            <input
                                                type="radio"
                                                name="complexion"
                                                value="Fair"
                                                checked={formData.complexion === 'Fair'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('complexion', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('complexion', e)}
                                                ref={(node) => setFieldRef('complexion', node)}
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>{complexionText.fair || t('form.options.complexion.fair', 'Fair')}</span>
                                        </label>
                                        <label className={getRadioOptionClasses(formData.complexion === 'Wheatish')}>
                                            <input
                                                type="radio"
                                                name="complexion"
                                                value="Wheatish"
                                                checked={formData.complexion === 'Wheatish'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('complexion', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('complexion', e)}
                                                ref={(node) => setFieldRef('complexion', node)}
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>{complexionText.wheatish || t('form.options.complexion.wheatish', 'Wheatish')}</span>
                                        </label>
                                        <label className={getRadioOptionClasses(formData.complexion === 'Dark')}>
                                            <input
                                                type="radio"
                                                name="complexion"
                                                value="Dark"
                                                checked={formData.complexion === 'Dark'}
                                                onChange={handleInputChange}
                                                onBlur={(e) => handleMandatoryFieldBlur('complexion', e)}
                                                onKeyDown={(e) => handleMandatoryFieldTab('complexion', e)}
                                                ref={(node) => setFieldRef('complexion', node)}
                                                className="h-4 w-4 accent-amber-500"
                                            />
                                            <span>{complexionText.dark || t('form.options.complexion.dark', 'Dark')}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center">
                                <h3 className="text-2xl font-extrabold text-amber-600">EDUCATIONAL QUALIFICATION - Bride/Groom</h3>
                                <p className="mt-1 text-lg font-extrabold text-amber-700">(शिक्षण - वधू / वर)</p>
                            </div>

                            <div className="rounded-3xl border border-red-900/50 bg-black/5 p-5">
                                <label className={labelClasses}>Education Category *</label>
                                <select
                                    name="educationCategory"
                                    value={formData.educationCategory}
                                    onChange={handleInputChange}
                                    onBlur={() => handleMandatoryFieldBlur('educationCategory')}
                                    onKeyDown={(e) => handleMandatoryFieldTab('educationCategory', e)}
                                    ref={(node) => setFieldRef('educationCategory', node)}
                                    className={selectClasses}
                                    style={getSelectControlStyle(formData.educationCategory)}
                                    required={view === 'register'}
                                >
                                    <option value="">Select Category</option>
                                    {EDUCATION_CATEGORY_OPTIONS.map((option) => (
                                        <option key={option} value={option} style={selectOptionStyle}>{option}</option>
                                    ))}
                                </select>
                                <p className="mt-2 text-xs text-rose-800/70">This decides your registration stage code and cannot be changed after registration.</p>
                            </div>

                            <div className="rounded-3xl border border-red-900/50 bg-black/5 p-5 space-y-5">
                                <div>
                                    <h3 className="text-xl font-bold text-amber-600 mb-2">Education Details</h3>
                                    <p className="text-sm text-rose-800/80">Choose a degree first, then choose the specialization, subject, or stream for that degree.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.education')} *</label>
                                        <select
                                            value={educationDraft}
                                            onChange={(e) => {
                                                setEducationDraft(e.target.value);
                                                setEducationDetailDraft('');
                                                if (e.target.value) {
                                                    setTimeout(() => focusField('educationDetailDraft'), 0);
                                                }
                                            }}
                                            ref={(node) => setFieldRef('educationDraft', node)}
                                            className={selectClasses}
                                            style={getSelectControlStyle(educationDraft)}
                                        >
                                            <option value="" style={selectOptionStyle}>Select Degree</option>
                                            {educationMaster.map((item) => <option key={item.value} value={item.value} style={selectOptionStyle}>{item.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.educationDetails')} *</label>
                                        <select
                                            value={educationDetailDraft}
                                            onChange={(e) => {
                                                setEducationDetailDraft(e.target.value);
                                            }}
                                            onBlur={() => {
                                                autoAddEducationEntry();
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Tab') return;
                                                if (educationDraft && !educationDetailDraft) {
                                                    e.preventDefault();
                                                    showPopup('Please select the specialization / subject / stream.', 'warning');
                                                    focusField('educationDetailDraft');
                                                    return;
                                                }
                                                if (educationDraft && educationDetailDraft) {
                                                    autoAddEducationEntry();
                                                }
                                            }}
                                            ref={(node) => setFieldRef('educationDetailDraft', node)}
                                            className={selectClasses}
                                            style={getSelectControlStyle(educationDetailDraft)}
                                            disabled={!educationDraft || educationDetailOptions.length === 0}
                                        >
                                            <option value="" style={selectOptionStyle}>
                                                {educationDraft ? 'Select Specialization / Stream' : 'Select degree first'}
                                            </option>
                                            {educationDetailOptions.map((item) => <option key={item.value} value={item.value} style={selectOptionStyle}>{item.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedEducationComboList.length === 0 && <span className="text-sm text-rose-800/70">No education selected yet.</span>}
                                    {selectedEducationComboList.map((item) => (
                                        <button key={item.degree} type="button" onClick={() => removeEducationQualification(item.degree)} className="rounded-full border border-amber-600/40 bg-red-100 px-3 py-1 text-sm text-red-900">
                                            {item.label} x
                                        </button>
                                    ))}
                                </div>
                                {selectedEducationList.length > 0 && missingEducationDetailDegrees.length > 0 && (
                                    <p className="text-xs font-semibold text-amber-700">Add specialization / stream for: {missingEducationDetailDegrees.join(', ')}</p>
                                )}
                            </div>

                            <div className="rounded-3xl border border-red-900/50 bg-black/5 p-5 space-y-5">
                                <div>
                                    <h3 className="text-xl font-bold text-amber-600 mb-2">Work / Business Details</h3>
                                    <p className="text-sm text-rose-800/80">Use one section for your job title, annual income, and workplace or business location.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.job')}</label>
                                        <input type="text" name="job" value={formData.job} onChange={handleInputChange} placeholder={placeholderText.job || t('form.placeholder.job', 'Job Title, Designation, Company Name or Nature of Business')} className={getFilledInputClasses(formData.job)} />
                                        {marathiTranslations.job && <span className="text-xs text-blue-700 font-semibold block mt-1">मराठी: {marathiTranslations.job}</span>}
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.income')}</label>
                                        <input type="number" name="income" value={formData.income} onChange={handleInputChange} min="100000" className={getFilledInputClasses(formData.income)} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.jobLocation')}</label>
                                        <input type="text" name="jobLocation" value={formData.jobLocation} onChange={handleInputChange} className={getFilledInputClasses(formData.jobLocation)} />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-red-900/50 bg-black/5 p-5 space-y-5">
                                <div>
                                    <h3 className="text-xl font-bold text-amber-600 mb-2">Birth Details</h3>
                                    <p className="text-sm text-rose-800/80">Birth details from date of birth to nakshatra are kept together for easier review.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.dob')} *</label>
                                        <input type="date" name="dob" value={formatDateForInput(formData.dob)} onChange={handleInputChange} onBlur={() => { handleMandatoryFieldBlur('dob'); checkExistingProfile(); }} onKeyDown={(e) => handleMandatoryFieldTab('dob', e)} ref={(node) => setFieldRef('dob', node)} disabled={isCandidateEditView} required className={`${getFilledInputClasses(formatDateForInput(formData.dob))} ${isCandidateEditView ? 'opacity-60 cursor-not-allowed' : ''}`} />
                                    </div>

                                    <div className="lg:col-span-2">
                                        <label className={labelClasses}>{t('form.labels.birthTime')} *</label>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                                            {(() => {
                                                const timeParts = (formData.birthTime || '').split(' ');
                                                const hm = (timeParts[0] || '').split(':');
                                                const currentHour12 = hm[0] || '';
                                                const currentMinute = hm[1] || '';
                                                const currentPhase = timeParts[1] || '';

                                                const updateClock = (newH12, newM, newPhase) => {
                                                    const hStr = newH12 || currentHour12 || '12';
                                                    const mStrVal = newM || currentMinute || '00';
                                                    const phaseStr = newPhase || currentPhase || 'morning';
                                                    setFormData(prev => ({ ...prev, birthTime: `${hStr.padStart(2, '0')}:${mStrVal.padStart(2, '0')} ${phaseStr}` }));
                                                };

                                                return (
                                                    <div className="flex gap-2 items-center w-full">
                                                        <select
                                                            className={`${getFilledInputClasses(currentHour12)} p-2.5 text-center px-1 flex-1`}
                                                            value={currentHour12}
                                                            onChange={(e) => updateClock(e.target.value, currentMinute, currentPhase)}
                                                            onBlur={() => { handleMandatoryFieldBlur('birthTime'); checkExistingProfile(); }}
                                                        >
                                                            <option value="">HH</option>
                                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                                <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
                                                            ))}
                                                        </select>
                                                        <span className="font-bold text-xl text-amber-600">:</span>
                                                        <select
                                                            className={`${getFilledInputClasses(currentMinute)} p-2.5 text-center px-1 flex-1`}
                                                            value={currentMinute}
                                                            onChange={(e) => updateClock(currentHour12, e.target.value, currentPhase)}
                                                            onBlur={() => { handleMandatoryFieldBlur('birthTime'); checkExistingProfile(); }}
                                                        >
                                                            <option value="">MM</option>
                                                            {Array.from({ length: 60 }, (_, i) => i).map(m => (
                                                                <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            className={`${getFilledInputClasses(currentPhase)} p-2.5 px-2 flex-[1.5]`}
                                                            value={currentPhase}
                                                            onChange={(e) => updateClock(currentHour12, currentMinute, e.target.value)}
                                                            onBlur={() => handleMandatoryFieldBlur('birthTime')}
                                                        >
                                                            <option value="">Phase</option>
                                                            {timePhaseOptions.map((item) => (
                                                                <option key={item.value} value={item.value} style={selectOptionStyle}>{timePhaseText[item.value] || item.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>{t('form.labels.birthPlace')} *</label>
                                        <input type="text" name="birthPlace" value={formData.birthPlace} onChange={handleInputChange} onBlur={() => handleMandatoryFieldBlur('birthPlace')} onKeyDown={(e) => handleMandatoryFieldTab('birthPlace', e)} ref={(node) => setFieldRef('birthPlace', node)} required className={getFilledInputClasses(formData.birthPlace)} />
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.bloodGroup')}</label>
                                        <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.bloodGroup)}>
                                            <option value="" style={selectOptionStyle}>Select Blood Group</option>
                                            {dynamicBloodGroups.map(bg => <option key={bg.id} value={bg.value} style={selectOptionStyle}>{bg.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.gotra')}</label>
                                        <select name="gotra" value={formData.gotra} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.gotra)}>
                                            <option value="" style={selectOptionStyle}>Select Kul</option>
                                            {dynamicKulList.map(k => <option key={k.id} value={k.name} style={selectOptionStyle}>{k.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.zodiac')}</label>
                                        <select name="zodiac" value={formData.zodiac} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.zodiac)}>
                                            <option value="" style={selectOptionStyle}>Select Rashi</option>
                                            {dynamicZodiacList.map(z => <option key={z.id} value={z.name} style={selectOptionStyle}>{z.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.gan')}</label>
                                        <select name="gan" value={formData.gan} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.gan)}>
                                            <option value="" style={selectOptionStyle}>Select Gan</option>
                                            {dynamicGanList.map(g => <option key={g.id} value={g.name} style={selectOptionStyle}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.nadi')}</label>
                                        <select name="nadi" value={formData.nadi} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.nadi)}>
                                            <option value="" style={selectOptionStyle}>Select Nadi</option>
                                            {dynamicNadiList.map(n => <option key={n.id} value={n.name} style={selectOptionStyle}>{n.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.charan')}</label>
                                        <select name="charan" value={formData.charan} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.charan)}>
                                            <option value="" style={selectOptionStyle}>Select Charan</option>
                                            <option value="First" style={selectOptionStyle}>First</option>
                                            <option value="Second" style={selectOptionStyle}>Second</option>
                                            <option value="Third" style={selectOptionStyle}>Third</option>
                                            <option value="Fourth" style={selectOptionStyle}>Fourth</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.nakshatra')}</label>
                                        <select name="nakshatra" value={formData.nakshatra} onChange={handleInputChange} className={selectClasses} style={getSelectControlStyle(formData.nakshatra)}>
                                            <option value="" style={selectOptionStyle}>Select Nakshatra</option>
                                            {dynamicNakshatraList.map(n => <option key={n.id} value={n.name} style={selectOptionStyle}>{n.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClasses}>{t('form.labels.mamekul')}</label>
                                        <input type="text" name="mamekul" value={formData.mamekul} onChange={handleInputChange} className={getFilledInputClasses(formData.mamekul)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-b border-red-900/50 py-10 space-y-4">
                            <h3 className="text-xl font-bold text-amber-600">{t('form.labels.expectations')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 bg-black/5 rounded-xl">
                                {dynamicExpectations.map((item) => (
                                    <label key={item.id} className="flex items-center gap-3 text-sm text-black cursor-pointer hover:bg-black/5 p-1 rounded">
                                        <input type="checkbox" checked={formData.expectations.includes(item.name)} onChange={() => handleCheckboxArrayChange('expectations', item.name)} className="w-4 h-4 accent-amber-500" />
                                        {item.name}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4">
                                <label className={labelClasses}>{t('form.labels.customExpectation')}</label>
                                <textarea name="customExpectation" value={formData.customExpectation} onChange={handleInputChange} className={getFilledInputClasses(formData.customExpectation)} rows={2}></textarea>
                            </div>
                        </div>

                        {activeRegistrationEvent && (
                            <div className="border-b border-red-900/50 py-8 space-y-5">
                                <div className="rounded-2xl border border-red-800/50 bg-black/5 p-4">
                                    <label className={labelClasses}>{t('form.labels.willAttendEvent', 'Will You Attend This Event?')}</label>
                                    <p className="mb-3 text-xs text-rose-800/80">
                                        Will you attend the event "{activeRegistrationEvent.eventName}" on "{activeRegistrationEvent.startDate ? new Date(activeRegistrationEvent.startDate).toLocaleDateString('en-GB') : '-'}"?
                                    </p>
                                    <div className="flex flex-wrap gap-6">
                                        <label className="flex items-center gap-2 text-black">
                                            <input type="radio" name="willAttendEvent" value="yes" checked={formData.willAttendEvent === 'yes'} onChange={handleInputChange} className="h-4 w-4 accent-amber-500" />
                                            <span>{t('form.labels.yes', 'Yes')}</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-black">
                                            <input type="radio" name="willAttendEvent" value="no" checked={formData.willAttendEvent === 'no'} onChange={handleInputChange} className="h-4 w-4 accent-amber-500" />
                                            <span>{t('form.labels.no', 'No')}</span>
                                        </label>
                                    </div>
                                    {formData.willAttendEvent === 'yes' && (
                                        <div className="mt-4 max-w-xs">
                                            <label className={labelClasses}>{t('form.labels.attendeeCount', 'How Many People Will Attend?')} *</label>
                                            <input
                                                type="number"
                                                name="attendeeCount"
                                                min="1"
                                                value={formData.attendeeCount}
                                                onChange={handleInputChange}
                                                required
                                                className={getFilledInputClasses(formData.attendeeCount)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3 pt-8 pb-4">
                            <input type="checkbox" name="agreement" checked={formData.agreement} onChange={handleInputChange} required className="mt-1 w-6 h-6 accent-amber-500 cursor-pointer" />
                            <label className="text-sm text-slate-800 leading-relaxed cursor-pointer" onClick={() => setFormData({ ...formData, agreement: !formData.agreement })}>
                                <strong className="text-amber-600 block mb-1">{t('form.labels.agreement')}:</strong>
                                {t('form.labels.agreementText')}
                            </label>
                        </div>

                        <button type="submit" disabled={isRegistrationClosed} className="btn-3d btn-3d-gold w-full flex justify-center items-center gap-2 py-4 rounded-2xl font-extrabold text-lg mt-4 disabled:cursor-not-allowed disabled:opacity-60 bg-amber-500 text-white">
                            <CheckCircle2 size={26} /> {isRegistrationClosed
                                ? `Registration cutoff date passed${registrationCutoffDisplay ? ` (${registrationCutoffDisplay})` : ''}`
                                : (view === 'edit' ? t('form.labels.saveChanges') : t('form.labels.submit'))}
                        </button>
                        {isRegistrationClosed && (
                            <p className="mt-2 text-center text-sm font-semibold text-amber-600">
                                Registration is closed for current event{registrationCutoffDisplay ? ` after ${registrationCutoffDisplay}` : ''}.
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegistrationForm;