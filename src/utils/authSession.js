import { apiUrl } from '../config';

export const toProfilePhotoUrl = (photoPath, fallbackName) => {
    if (photoPath) {
        const rawPath = String(photoPath).trim();
        if (/^https?:\/\//i.test(rawPath)) {
            try {
                const parsedPath = new URL(rawPath);
                if (parsedPath.pathname.startsWith('/api/')) return `${parsedPath.pathname}${parsedPath.search}`;
            } catch (_) {
                return rawPath;
            }
            return rawPath;
        }
        const normalizedPath = `/${rawPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
        return normalizedPath.startsWith('/api/') ? normalizedPath : apiUrl(normalizedPath);
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=f59e0b&color=fff`;
};

export const mapServerUserToSession = (user = {}) => ({
    ...user,
    id: user.id || user.batch_id,
    name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.name || 'User',
    initials: ((user.first_name || user.name || 'U')[0] || 'U').toUpperCase(),
    firstName: user.first_name || '',
    middleName: user.middle_name || '',
    lastName: user.last_name || '',
    gender: user.gender || '',
    email: user.email || '',
    phone: user.mobile || user.mobile_number || user.phone || '',
    whatsapp: user.whatsapp || user.whatsapp_number || '',
    photo: toProfilePhotoUrl(user.photo || user.photo_path || user.photo_url, user.first_name || user.name || 'User'),
    location: user.city || user.city_village || user.location || '',
    address: user.address || user.address_line || '',
    addressFlat: user.addressFlat || user.address_flat || '',
    addressStreet: user.addressStreet || user.address_street || '',
    addressColony: user.addressColony || user.address_colony || '',
    addressLandmark: user.addressLandmark || user.address_landmark || '',
    pincode: user.pincode || '',
    postOffice: user.post_office || '',
    city: user.city || user.city_village || '',
    tehsil: user.tehsil || '',
    district: user.district || '',
    state: user.state || '',
    stateId: user.location_state_id || '',
    districtId: user.location_district_id || '',
    subdistrictId: user.location_subdistrict_id || '',
    locationId: user.location_master_id || '',
    marriageCategory: user.marriageCategory || user.marriage_type || '',
    education: user.education || user.education_qualification || '',
    educationDetails: user.education_details || '',
    educationCategory: user.education_category || '',
    height: user.height || '',
    profession: user.job || user.job_business_title || '',
    job: user.job || user.job_business_title || '',
    income: user.income || user.annual_income || '',
    jobLocation: user.jobLocation || user.job_business_location || '',
    mamekul: user.mamekul || '',
    dob: user.dob || user.birth_date || '',
    birthTime: user.birth_time || '',
    birthPlace: user.birth_place || '',
    complexion: user.complexion || '',
    bloodGroup: user.blood_group || '',
    gotra: user.gotra || '',
    zodiac: user.zodiac || '',
    gan: user.gan || '',
    nadi: user.nadi || '',
    charan: user.charan || '',
    nakshatra: user.nakshatra || '',
    expectations: Array.isArray(user.selected_expectations) ? user.selected_expectations : [],
    customExpectation: user.other_expectations || '',
    attendedActiveEvent: user.attended_active_event || '',
    willAttendEvent: user.will_attend_event || '',
    attendeeCount: user.attendee_count || '',
    registeredEvents: Array.isArray(user.registered_events) ? user.registered_events : [],
    isAdmin: !!user.isAdmin,
    isSuperUser: !!user.isSuperUser,
    roleName: user.roleName || (user.isSuperUser ? 'super_user' : (user.isAdmin ? 'admin' : 'candidate')),
});