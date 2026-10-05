import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithAuth } from '../utils/api';
import './AdminPanel.css';

const homepageContentDefaults = {
    eyebrow: 'Official community website',
    hero_badge: 'Public information and online registration',
    about_title: 'About this organisation',
    about_text: 'This website shares official event information, registration details and support contacts for the community.',
    service_title: 'Registration and community services',
    service_text: 'Use this website to review the active event, understand the applicable fees and submit your registration through the official event flow.',
    rules_text: 'Please review the event eligibility, registration instructions and fee details before submitting a form. Information entered during registration should be accurate and complete.',
    refund_policy: 'Registration fees are collected for the selected event service. Refund eligibility, where applicable, is handled according to the event terms shown on this page and the organiser\'s confirmed policy.',
    shipping_policy: 'This is a digital registration service. No physical product is shipped. Any confirmation, receipt or event pass is provided electronically or at the event venue.',
    terms_text: 'By using this website, you agree to provide accurate information, follow the event rules and use the registration service only for its stated community purpose.',
    privacy_text: 'Information submitted through this website is used for event registration, verification, communication and event coordination. It is not sold as a public directory.',
    contact_note: 'For registration help, payment questions or event support, contact the organisation using the details published below.'
};

const parseHomepageContent = (value) => {
    if (!value) return { ...homepageContentDefaults };
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? { ...homepageContentDefaults, ...parsed }
            : { ...homepageContentDefaults };
    } catch (_error) {
        return { ...homepageContentDefaults };
    }
};

const formatDateForInput = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const AdminPanel = ({ token, loggedInUser, isSuperUser = false }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [users, setUsers] = useState([]);
    const [registrationReport, setRegistrationReport] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [events, setEvents] = useState([]);
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [subscriptionPlanFormData, setSubscriptionPlanFormData] = useState({ plan_code: '', plan_name: '', description: '', price: '0', billing_cycle: 'monthly', max_active_events: '', max_candidates: '', is_active: true });
    const [editingSubscriptionPlanId, setEditingSubscriptionPlanId] = useState(null);
    const [clientSubscription, setClientSubscription] = useState(null);
    const [clientSubscriptionFormData, setClientSubscriptionFormData] = useState({ plan_id: '', starts_at: new Date().toISOString().slice(0, 10), ends_at: '', status: 'active', notes: '' });
    const [clientFormOpen, setClientFormOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [volunteers, setVolunteers] = useState([]);
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const [groups, setGroups] = useState([]);
    const [teams, setTeams] = useState([]);
    const [teamAssignments, setTeamAssignments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    // Separated state for forms to prevent data bleed between tabs
    const [adminFormData, setAdminFormData] = useState({});
    const [eventFormData, setEventFormData] = useState({});
    const [homepageFormData, setHomepageFormData] = useState({});
    const [paymentGatewayFormData, setPaymentGatewayFormData] = useState({ provider: 'razorpay', key_id: '', key_secret: '', is_enabled: false });
    const [paymentGateways, setPaymentGateways] = useState([]);
    const [paymentGatewaySecretConfigured, setPaymentGatewaySecretConfigured] = useState(false);
    const [clientDomains, setClientDomains] = useState([]);
    const [newClientDomain, setNewClientDomain] = useState('');
    const [volunteerFormData, setVolunteerFormData] = useState({});
    const [groupFormData, setGroupFormData] = useState({});
    const [teamFormData, setTeamFormData] = useState({});
    const [assignmentFormData, setAssignmentFormData] = useState({});
    const [clientLogoInputKey, setClientLogoInputKey] = useState(0);
    const [volunteerPhotoInputKey, setVolunteerPhotoInputKey] = useState(0);
    const [assignmentSearch, setAssignmentSearch] = useState('');
    const [teamMemberSearch, setTeamMemberSearch] = useState('');
    const [editingAssignmentId, setEditingAssignmentId] = useState(null);
    const [assignmentDraft, setAssignmentDraft] = useState([]);
    const [assignmentDirty, setAssignmentDirty] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [clientOnboardingData, setClientOnboardingData] = useState({});
    const [registrationLink, setRegistrationLink] = useState('');
    const [editingEventId, setEditingEventId] = useState(null);
    const [editingVolunteerId, setEditingVolunteerId] = useState(null);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [editingCandidate, setEditingCandidate] = useState(null);
    const [teamDeleteDialogOpen, setTeamDeleteDialogOpen] = useState(false);
    const [deleteVolunteerDialog, setDeleteVolunteerDialog] = useState(null);
    const [deleteGroupDialog, setDeleteGroupDialog] = useState(null);
    const [sftpFormData, setSftpFormData] = useState({ host: '', port: 22, username: '', auth_method: 'password', remote_path: '/', is_enabled: false, password: '', private_key: '' });
    const [sftpSecretStatus, setSftpSecretStatus] = useState({ password_configured: false, private_key_configured: false });

    useEffect(() => {
        if (!message) return undefined;
        const timeoutId = window.setTimeout(() => setMessage(''), 4500);
        return () => window.clearTimeout(timeoutId);
    }, [message]);

    const API_BASE = 'http://localhost:5000';
    const selectedAdminVolunteer = volunteers.find((volunteer) => String(volunteer.volunteer_id) === String(adminFormData.volunteer_id || ''));
    const assetUrl = (path) => {
        if (!path) return '';
        return /^https?:/i.test(path) ? path : `${API_BASE}${path}`;
    };
    const versionedAssetUrl = (path, version) => {
        const url = assetUrl(path);
        if (!url || !version) return url;
        return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`;
    };
    const eventOrganizerPreview = eventFormData.organizer_photo_preview_url || assetUrl(eventFormData.organizer_photo_existing || '');
    const eventBannerPreview = eventFormData.registration_banner_preview_url || assetUrl(eventFormData.registration_banner_existing || '');
    const volunteerPhotoPreview = volunteerFormData.photo_preview_url || versionedAssetUrl(volunteerFormData.photo_url_existing || '', volunteerFormData.photo_version);
    const filteredVolunteers = volunteers.filter((volunteer) => {
        const searchTerms = volunteerSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (searchTerms.length === 0) return true;
        const searchableText = [volunteer.volunteer_name, volunteer.email, volunteer.whatsapp_number, volunteer.mobile_number, volunteer.mobile]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return searchTerms.every((term) => searchableText.includes(term));
    });
    const selectedAssignmentTeamId = assignmentFormData.team_id || '';
    const selectedAssignmentTeam = teams.find((team) => String(team.team_id) === String(selectedAssignmentTeamId));
    const teamNameChanged = !!selectedAssignmentTeamId && String(assignmentFormData.team_name || '').trim() !== String(selectedAssignmentTeam?.team_name || '').trim();
    const selectedTeamAssignments = teamAssignments.filter((assignment) => String(assignment.team_id) === String(selectedAssignmentTeamId));
    const selectedTeamVolunteerIds = new Set(assignmentDraft.map((assignment) => String(assignment.volunteer_id)));
    const filteredSelectedTeamAssignments = assignmentDraft.filter((assignment) => {
        const search = teamMemberSearch.trim().toLowerCase();
        return !search || [assignment.volunteer_name, assignment.volunteer_id]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search);
    });
    const availableAssignmentVolunteers = volunteers.filter((volunteer) => {
        if (!volunteer.is_active) return false;
        if (selectedTeamVolunteerIds.has(String(volunteer.volunteer_id))) return false;
        const search = assignmentSearch.trim().toLowerCase();
        return !search || [volunteer.volunteer_name, volunteer.email, volunteer.whatsapp_number]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search);
    });
    const adminTabs = ['dashboard', 'users', 'events', 'homepage', 'payment', 'volunteers', 'teams', ...(isSuperUser ? ['clients', 'plans', 'admins', 'sftp'] : []), 'logs'];
    const adminTabLabels = {
        dashboard: 'Dashboard',
        users: 'Candidates',
        events: 'Events',
        homepage: 'Homepage Content',
        payment: 'Payment Gateway',
        volunteers: 'Volunteer Management',
        teams: 'Teams',
        clients: 'Client Onboarding',
        plans: 'Client Plans',
        admins: 'Admins',
        sftp: 'SFTP Settings',
        logs: 'Activity Logs'
    };
    const adminTabDescriptions = {
        dashboard: 'View client-scoped counts and quick actions.',
        users: 'Review, edit, activate and deactivate candidate profiles.',
        events: 'Create, update and manage client events and registration fees.',
        homepage: 'Publish the selected client homepage and registration form settings.',
        payment: 'Configure the selected client payment gateway for paid events.',
        volunteers: 'Add, update, activate and deactivate volunteers.',
        teams: 'Create, rename, assign volunteers and delete teams.',
        clients: 'Create and update client accounts and registration settings.',
        plans: 'Create subscription plans and assign them to client organizations.',
        admins: 'Create and manage administrator access for clients.',
        sftp: 'Configure and test secure file transfer settings.',
        logs: 'Review recent administrative activity for this scope.'
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const fetchUsers = useCallback(async () => {
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/users${suffix}`, { headers });
            const data = await res.json();
            if (data.users) setUsers(data.users);
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchRegistrationReport = async () => {
        if (!selectedClientId) {
            setMessage('Select a client to view its registration and payment report.');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/admin/registration-report?clientId=${selectedClientId}`, { headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load registration report.');
            setRegistrationReport(Array.isArray(data.registrations) ? data.registrations : []);
        } catch (error) {
            setMessage(error.message || 'Unable to load registration report.');
        }
    };

    const fetchAdmins = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setAdmins([]);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/admins${suffix}`, { headers });
            const data = await res.json();
            if (data.admins) setAdmins(data.admins);
        } catch (err) {
            console.error('Error fetching admins:', err);
        }
    }, [token, selectedClientId]);

    const fetchEvents = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setEvents([]);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/events${suffix}`, { headers });
            const data = await res.json();
            if (data.events) setEvents(data.events);
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchPaymentGateway = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setPaymentGateways([]);
            setPaymentGatewayFormData({ provider: 'razorpay', key_id: '', key_secret: '', is_enabled: false });
            setPaymentGatewaySecretConfigured(false);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/payment-gateway${suffix}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unable to load payment gateway settings.');
            const gateways = Array.isArray(data.gateways)
                ? data.gateways
                : (data.config ? [data.config] : []);
            setPaymentGateways(gateways);
            setPaymentGatewayFormData(gateways[0]
                ? { ...gateways[0], key_secret: '' }
                : { provider: 'razorpay', key_id: '', key_secret: '', is_enabled: false });
            setPaymentGatewaySecretConfigured(!!gateways[0]?.secret_configured);
        } catch (err) {
            setMessage(err.message || 'Unable to load payment gateway settings.');
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchClients = useCallback(async () => {
        try {
            const endpoint = isSuperUser ? `${API_BASE}/api/clients` : `${API_BASE}/api/admin/my-clients`;
            const res = await fetch(endpoint, { headers });
            const data = await res.json();
            const result = isSuperUser ? data.data : data.clients;
            if (res.ok) {
                const nextClients = Array.isArray(result) ? result : [];
                setClients(nextClients);
                if (!isSuperUser && nextClients.length > 0) {
                    const selectedClient = nextClients.find((client) => String(client.client_id) === String(loggedInUser?.client_id)) || nextClients[0];
                    setSelectedClientId(String(selectedClient.client_id));
                    setHomepageFormData({
                        public_slug: selectedClient.public_slug || '',
                        homepage_enabled: selectedClient.homepage_enabled !== false,
                        homepage_title: selectedClient.homepage_title || '',
                        homepage_intro: selectedClient.homepage_intro || '',
                        custom_domain: selectedClient.custom_domain || '',
                        homepage_content: parseHomepageContent(selectedClient.homepage_content),
                        registration_form_config: selectedClient.registration_form_config
                            ? JSON.stringify(selectedClient.registration_form_config, null, 2)
                            : ''
                    });
                    setClientDomains(Array.isArray(selectedClient.domains) ? selectedClient.domains : []);
                }
            }
        } catch (err) {
            console.error('Error fetching clients:', err);
        }
    }, [token, isSuperUser, loggedInUser?.client_id]);

    const fetchSubscriptionPlans = useCallback(async () => {
        if (!isSuperUser) return;
        try {
            const response = await fetch(`${API_BASE}/api/subscription-plans`, { headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to load subscription plans.');
            setSubscriptionPlans(Array.isArray(data.plans) ? data.plans : []);
        } catch (error) {
            setMessage(error.message || 'Unable to load subscription plans.');
        }
    }, [token, isSuperUser]);

    const fetchClientSubscription = useCallback(async () => {
        if (!isSuperUser || !selectedClientId) {
            setClientSubscription(null);
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/clients/${selectedClientId}/subscription`, { headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to load client subscription.');
            setClientSubscription(data.current || null);
            const current = data.current || {};
            setClientSubscriptionFormData({
                plan_id: current.plan_id || '',
                starts_at: current.starts_at ? new Date(current.starts_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                ends_at: current.ends_at ? new Date(current.ends_at).toISOString().slice(0, 10) : '',
                status: current.status || 'active',
                notes: current.notes || ''
            });
        } catch (error) {
            setMessage(error.message || 'Unable to load client subscription.');
        }
    }, [token, isSuperUser, selectedClientId]);

    const fetchLogs = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setLogs([]);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/activity-logs${suffix}`, { headers });
            const data = await res.json();
            if (data.logs) setLogs(data.logs);
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchVolunteers = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setVolunteers([]);
            return;
        }
        try {
            const params = new URLSearchParams();
            if (selectedClientId) params.set('clientId', selectedClientId);
            if (isSuperUser && selectedClientId) params.set('includeUnassigned', 'true');
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`${API_BASE}/api/admin/volunteers${suffix}`, { headers });
            const data = await res.json();
            if (data.volunteers) setVolunteers(data.volunteers);
        } catch (err) {
            console.error('Error fetching volunteers:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchGroups = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setGroups([]);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/volunteer-groups${suffix}`, { headers });
            const data = await res.json();
            if (data.groups) setGroups(data.groups);
        } catch (err) {
            console.error('Error fetching volunteer groups:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    const fetchTeams = useCallback(async () => {
        if (isSuperUser && !selectedClientId) {
            setTeams([]);
            setTeamAssignments([]);
            return;
        }
        try {
            const suffix = selectedClientId ? `?clientId=${selectedClientId}` : '';
            const res = await fetch(`${API_BASE}/api/admin/teams${suffix}`, { headers });
            const data = await res.json();
            if (data.teams) setTeams(data.teams);
            if (data.assignments) setTeamAssignments(data.assignments);
        } catch (err) {
            console.error('Error fetching teams:', err);
        }
    }, [token, selectedClientId, isSuperUser]);

    useEffect(() => {
        if (token) {
            fetchUsers();
            fetchAdmins();
            fetchEvents();
            fetchClients();
            fetchPaymentGateway();
            fetchSubscriptionPlans();
            fetchClientSubscription();
            fetchLogs();
            fetchVolunteers();
            fetchGroups();
            fetchTeams();
        }
    }, [token, fetchUsers, fetchAdmins, fetchEvents, fetchClients, fetchPaymentGateway, fetchSubscriptionPlans, fetchClientSubscription, fetchLogs, fetchVolunteers, fetchGroups, fetchTeams]);

    useEffect(() => {
        if (!token || !isSuperUser) return;
        fetch(`${API_BASE}/api/admin/sftp`, { headers })
            .then((response) => response.json())
            .then((data) => {
                if (data.config) {
                    setSftpFormData((current) => ({ ...current, ...data.config, password: '', private_key: '' }));
                    setSftpSecretStatus({ password_configured: !!data.config.password_configured, private_key_configured: !!data.config.private_key_configured });
                }
            })
            .catch(() => setMessage('Unable to load SFTP settings.'));
    }, [token, isSuperUser]);

    const updateSftp = (field, value) => setSftpFormData((current) => ({ ...current, [field]: value }));
    const saveSftp = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/sftp`, { method: 'PUT', headers, body: JSON.stringify(sftpFormData) });
            const data = await response.json();
            setMessage(data.message || data.error || 'SFTP settings saved.');
            if (response.ok) setSftpSecretStatus((current) => ({
                password_configured: current.password_configured || !!sftpFormData.password,
                private_key_configured: current.private_key_configured || !!sftpFormData.private_key
            }));
        } catch (error) { setMessage('Unable to save SFTP settings.'); }
        setLoading(false);
    };
    const testSftp = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/sftp/test`, { method: 'POST', headers, body: JSON.stringify(sftpFormData) });
            const data = await response.json();
            setMessage(data.message || data.error || 'SFTP connection test completed.');
        } catch (error) { setMessage('Unable to test SFTP connection.'); }
        setLoading(false);
    };

    const resetClientOnboarding = () => {
        setClientOnboardingData({});
        setClientFormOpen(false);
        setSelectedClientId('');
        setClientLogoInputKey((key) => key + 1);
    };

    const editClient = async (client) => {
        try {
            const response = await fetchWithAuth(`/api/clients/${client.client_id}`);
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load client details.');

            const committee = result.data.committee || {};
            const volunteerParams = new URLSearchParams({ clientId: String(client.client_id) });
            if (isSuperUser) volunteerParams.set('includeUnassigned', 'true');
            const volunteersResponse = await fetchWithAuth(`/api/admin/volunteers?${volunteerParams.toString()}`);
            const volunteersResult = await volunteersResponse.json();
            const clientVolunteers = volunteersResponse.ok && Array.isArray(volunteersResult.volunteers)
                ? volunteersResult.volunteers
                : volunteers;
            setVolunteers(clientVolunteers);
            const findVolunteerId = (role) => committee[`${role}_volunteer_id`] || clientVolunteers.find((volunteer) =>
                String(volunteer.volunteer_name || '').trim().toLowerCase() === String(committee[`${role}_name`] || '').trim().toLowerCase()
            )?.volunteer_id || '';
            setSelectedClientId(String(client.client_id));
            setClientFormOpen(true);
            setClientLogoInputKey((key) => key + 1);
            setClientOnboardingData({
                ...result.data,
                adhyaksha_volunteer_id: findVolunteerId('adhyaksha'),
                upa_adhyaksha_volunteer_id: findVolunteerId('upa_adhyaksha'),
                khajindar_volunteer_id: findVolunteerId('khajindar'),
                sachiv_volunteer_id: findVolunteerId('sachiv'),
                upasachiv_volunteer_id: findVolunteerId('upasachiv')
            });
            setHomepageFormData({
                public_slug: result.data.public_slug || '',
                homepage_enabled: result.data.homepage_enabled !== false,
                homepage_title: result.data.homepage_title || '',
                homepage_intro: result.data.homepage_intro || '',
                custom_domain: result.data.custom_domain || '',
                homepage_content: parseHomepageContent(result.data.homepage_content),
                registration_form_config: result.data.registration_form_config
                    ? JSON.stringify(result.data.registration_form_config, null, 2)
                    : ''
            });
            setClientDomains(Array.isArray(result.data.domains) ? result.data.domains : []);
        } catch (error) {
            setMessage(error.message || 'Unable to load client details.');
        }
    };

    const updateHomepageContentField = (field, value) => {
        setHomepageFormData((current) => ({
            ...current,
            homepage_content: { ...parseHomepageContent(current.homepage_content), [field]: value }
        }));
    };

    const updatePaymentGateway = (field, value) => setPaymentGatewayFormData((current) => ({ ...current, [field]: value }));
    const startNewPaymentGateway = () => {
        setPaymentGatewayFormData({ provider: 'razorpay', gateway_name: '', key_id: '', key_secret: '', is_enabled: false });
        setPaymentGatewaySecretConfigured(false);
    };
    const editPaymentGateway = (gateway) => {
        setPaymentGatewayFormData({ ...gateway, key_secret: '' });
        setPaymentGatewaySecretConfigured(!!gateway.secret_configured);
    };
    const savePaymentGateway = async () => {
        if (isSuperUser && !selectedClientId) {
            setMessage('Select a client before saving payment gateway settings.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/payment-gateway`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    config_id: paymentGatewayFormData.config_id || undefined,
                    client_id: selectedClientId || undefined,
                    gateway_name: paymentGatewayFormData.gateway_name || '',
                    provider: paymentGatewayFormData.provider || 'razorpay',
                    key_id: paymentGatewayFormData.key_id || '',
                    key_secret: paymentGatewayFormData.key_secret || '',
                    is_enabled: !!paymentGatewayFormData.is_enabled
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to save payment gateway settings.');
            setPaymentGateways(Array.isArray(data.gateways) ? data.gateways : paymentGateways);
            setPaymentGatewayFormData(data.config ? { ...data.config, key_secret: '' } : { provider: 'razorpay', key_id: '', key_secret: '', is_enabled: false });
            setPaymentGatewaySecretConfigured(!!data.config?.secret_configured);
            setMessage(data.message || 'Payment gateway settings saved.');
        } catch (error) {
            setMessage(error.message || 'Unable to save payment gateway settings.');
        }
        setLoading(false);
    };

    const deletePaymentGateway = async (gateway) => {
        if (!gateway?.config_id) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/payment-gateway/${gateway.config_id}`, { method: 'DELETE', headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to delete payment gateway.');
            setPaymentGateways((current) => current.filter((item) => String(item.config_id) !== String(gateway.config_id)));
            startNewPaymentGateway();
            setMessage(data.message || 'Payment gateway deleted.');
        } catch (error) {
            setMessage(error.message || 'Unable to delete payment gateway.');
        }
        setLoading(false);
    };

    const addClientDomain = async () => {
        if (!selectedClientId || !newClientDomain.trim()) {
            setMessage('Enter a domain before adding it.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/client-domains`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ client_id: selectedClientId, hostname: newClientDomain.trim() })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to add client domain.');
            setClientDomains((current) => [...current.filter((domain) => !data.domain?.is_primary || !domain.is_primary), data.domain]);
            setNewClientDomain('');
            setHomepageFormData((current) => ({ ...current, custom_domain: data.domain?.is_primary ? data.domain.hostname : current.custom_domain }));
            setMessage(data.message || 'Client domain added.');
        } catch (error) {
            setMessage(error.message || 'Unable to add client domain.');
        }
        setLoading(false);
    };

    const removeClientDomain = async (domain) => {
        if (!domain?.domain_id) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/client-domains/${domain.domain_id}`, { method: 'DELETE', headers });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to remove client domain.');
            const remaining = clientDomains.filter((item) => String(item.domain_id) !== String(domain.domain_id));
            const nextDomains = domain.is_primary && remaining.length > 0
                ? remaining.map((item, index) => ({ ...item, is_primary: index === 0 ? true : item.is_primary }))
                : remaining;
            setClientDomains(nextDomains);
            if (domain.is_primary) setHomepageFormData((current) => ({ ...current, custom_domain: nextDomains.find((item) => item.is_primary)?.hostname || '' }));
            setMessage(data.message || 'Client domain removed.');
        } catch (error) {
            setMessage(error.message || 'Unable to remove client domain.');
        }
        setLoading(false);
    };

    const saveHomepageContent = async () => {
        if (!selectedClientId) {
            setMessage('Select a client before saving homepage content.');
            return;
        }
        setLoading(true);
        try {
            let registrationFormConfig = homepageFormData.registration_form_config || null;
            if (typeof registrationFormConfig === 'string' && registrationFormConfig.trim()) {
                registrationFormConfig = JSON.parse(registrationFormConfig);
            }
            const response = await fetchWithAuth(`/api/clients/${selectedClientId}/homepage`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    public_slug: homepageFormData.public_slug || null,
                    homepage_enabled: homepageFormData.homepage_enabled !== false,
                    homepage_title: homepageFormData.homepage_title || null,
                    homepage_intro: homepageFormData.homepage_intro || null,
                    homepage_content: homepageFormData.homepage_content || {},
                    registration_form_config: registrationFormConfig,
                    custom_domain: homepageFormData.custom_domain || ''
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Homepage content could not be saved.');
            setMessage('Homepage content saved successfully.');
            fetchClients();
        } catch (error) {
            setMessage(error.message || 'Homepage content could not be saved.');
        }
        setLoading(false);
    };

    const resetSubscriptionPlanForm = () => {
        setSubscriptionPlanFormData({ plan_code: '', plan_name: '', description: '', price: '0', billing_cycle: 'monthly', max_active_events: '', max_candidates: '', is_active: true });
        setEditingSubscriptionPlanId(null);
    };

    const editSubscriptionPlan = (plan) => {
        setEditingSubscriptionPlanId(plan.plan_id);
        setSubscriptionPlanFormData({
            plan_code: plan.plan_code || '',
            plan_name: plan.plan_name || '',
            description: plan.description || '',
            price: String(plan.price ?? 0),
            billing_cycle: plan.billing_cycle || 'monthly',
            max_active_events: plan.max_active_events ?? '',
            max_candidates: plan.max_candidates ?? '',
            is_active: plan.is_active !== false
        });
    };

    const saveSubscriptionPlan = async () => {
        if (!subscriptionPlanFormData.plan_code.trim() || !subscriptionPlanFormData.plan_name.trim()) {
            setMessage('Plan code and plan name are required.');
            return;
        }
        setLoading(true);
        try {
            const endpoint = editingSubscriptionPlanId
                ? `${API_BASE}/api/subscription-plans/${editingSubscriptionPlanId}`
                : `${API_BASE}/api/subscription-plans`;
            const response = await fetch(endpoint, {
                method: editingSubscriptionPlanId ? 'PUT' : 'POST',
                headers,
                body: JSON.stringify({
                    ...subscriptionPlanFormData,
                    price: Number(subscriptionPlanFormData.price || 0),
                    max_active_events: subscriptionPlanFormData.max_active_events || null,
                    max_candidates: subscriptionPlanFormData.max_candidates || null
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to save subscription plan.');
            setMessage(data.message || 'Subscription plan saved successfully.');
            resetSubscriptionPlanForm();
            fetchSubscriptionPlans();
        } catch (error) {
            setMessage(error.message || 'Unable to save subscription plan.');
        }
        setLoading(false);
    };

    const saveClientSubscription = async () => {
        if (!selectedClientId) {
            setMessage('Select a client before assigning a subscription plan.');
            return;
        }
        if (!clientSubscriptionFormData.plan_id) {
            setMessage('Select a subscription plan first.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/clients/${selectedClientId}/subscription`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    ...clientSubscriptionFormData,
                    plan_id: Number(clientSubscriptionFormData.plan_id),
                    ends_at: clientSubscriptionFormData.ends_at || null
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to assign subscription plan.');
            setMessage(data.message || 'Client subscription plan assigned successfully.');
            fetchClientSubscription();
        } catch (error) {
            setMessage(error.message || 'Unable to assign subscription plan.');
        }
        setLoading(false);
    };

    const onboardClient = async () => {
        const requiredFields = ['client_name', 'address', 'phone_number'];
        if (requiredFields.some((field) => !String(clientOnboardingData[field] || '').trim())) {
            setMessage('Complete the client details before saving.');
            return;
        }

        setLoading(true);
        setRegistrationLink('');
        try {
            const isEditingClient = Boolean(clientOnboardingData.client_id);
            const clientResponse = await fetchWithAuth(isEditingClient ? `/api/clients/${clientOnboardingData.client_id}` : '/api/clients', {
                method: isEditingClient ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: clientOnboardingData.client_name,
                    address: clientOnboardingData.address,
                    phone_number: clientOnboardingData.phone_number,
                    contact_email: clientOnboardingData.contact_email || null,
                })
            });
            const clientData = await clientResponse.json();
            if (!clientResponse.ok || !clientData.success) throw new Error(clientData.message || 'Client could not be saved.');
            const clientId = clientOnboardingData.client_id || clientData.client_id;
            if (clientOnboardingData.logo) {
                const logoFormData = new FormData();
                logoFormData.append('logo', clientOnboardingData.logo);
                const logoResponse = await fetchWithAuth(`/api/clients/${clientId}/logo`, { method: 'POST', body: logoFormData });
                const logoData = await logoResponse.json().catch(() => ({}));
                if (!logoResponse.ok) throw new Error(logoData.message || 'Client was saved, but logo upload failed.');
            }
            setSelectedClientId(String(clientId));
            const roleSelections = [
                ['adhyaksha', clientOnboardingData.adhyaksha_volunteer_id],
                ['upa_adhyaksha', clientOnboardingData.upa_adhyaksha_volunteer_id],
                ['khajindar', clientOnboardingData.khajindar_volunteer_id],
                ['sachiv', clientOnboardingData.sachiv_volunteer_id],
                ['upasachiv', clientOnboardingData.upasachiv_volunteer_id]
            ];
            const committeePayload = {};
            roleSelections.forEach(([role, volunteerId]) => {
                const volunteer = volunteers.find((item) => String(item.volunteer_id) === String(volunteerId));
                committeePayload[`${role}_volunteer_id`] = volunteerId || null;
                committeePayload[`${role}_name`] = volunteer?.volunteer_name || null;
                committeePayload[`${role}_phone`] = volunteer?.whatsapp_number || null;
                committeePayload[`${role}_email`] = null;
            });
            const committeeResponse = await fetchWithAuth(`/api/clients/${clientId}/committee`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...committeePayload, admin_id: loggedInUser?.id })
            });
            const committeeData = await committeeResponse.json();
            if (!committeeResponse.ok || !committeeData.success) throw new Error(committeeData.message || 'Client was saved but committee assignments could not be saved.');
            resetClientOnboarding();
            setMessage(isEditingClient ? 'Client details updated successfully.' : 'Client created successfully.');
            fetchClients();
        } catch (err) {
            setMessage(err.message || 'Client onboarding failed.');
        } finally {
            setLoading(false);
        }
    };

    const deactivateUser = async (userId, reason) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/deactivate-user/${userId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            fetchUsers();
        } catch (err) {
            setMessage('Error deactivating user');
        }
        setLoading(false);
    };

    const activateUser = async (userId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/activate-user/${userId}`, {
                method: 'PUT',
                headers
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            fetchUsers();
        } catch (err) {
            setMessage('Error activating user');
        }
        setLoading(false);
    };

    const updateCandidate = async () => {
        if (!editingCandidate) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${editingCandidate.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(editingCandidate)
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setEditingCandidate(null);
                fetchUsers();
            }
        } catch (err) {
            setMessage('Error updating candidate profile');
        }
        setLoading(false);
    };

    const createEvent = async () => {
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('client_id', selectedClientId || '');
            formDataToSend.append('event_name', eventFormData.event_name || '');
            formDataToSend.append('venue', eventFormData.venue || '');
            formDataToSend.append('office_address', eventFormData.office_address || '');
            formDataToSend.append('event_time', eventFormData.event_time || '');
            formDataToSend.append('start_date', eventFormData.start_date || '');
            formDataToSend.append('end_date', eventFormData.end_date || '');
            formDataToSend.append('registration_cutoff_date', eventFormData.registration_cutoff_date || '');
            formDataToSend.append('organizer_name', eventFormData.organizer_name || '');
            formDataToSend.append('organizer_phone', eventFormData.organizer_phone || '');
            formDataToSend.append('organizer_whatsapp', eventFormData.organizer_whatsapp || '');
            formDataToSend.append('razorpay_registration_amount', eventFormData.razorpay_registration_amount ?? '');
            formDataToSend.append('payment_gateway_id', eventFormData.payment_gateway_id || '');
            
            if (eventFormData.organizer_photo) {
                formDataToSend.append('organizer_photo', eventFormData.organizer_photo);
            }
            if (eventFormData.registration_banner) {
                formDataToSend.append('registration_banner', eventFormData.registration_banner);
            }

            const res = await fetch(`${API_BASE}/api/admin/events`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // No Content-Type header for FormData
                body: formDataToSend
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            setEventFormData({});
            fetchEvents();
        } catch (err) {
            setMessage('Error creating event');
        }
        setLoading(false);
    };

    const toSlug = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const toDateSlug = (value) => formatDateForInput(value);
    const getRegistrationLink = (event) => {
        const client = clients.find((item) => String(item.client_id) === String(event.client_id));
        const clientSlug = toSlug(client?.client_name || 'client');
        const eventSlug = toSlug(`${event.event_name}-${toDateSlug(event.start_date)}`);
        return `${window.location.origin}/register/${clientSlug}/${eventSlug}`;
    };

    const copyRegistrationLink = async (event) => {
        try {
            await navigator.clipboard.writeText(getRegistrationLink(event));
            setMessage('Registration link copied.');
        } catch (_) {
            setMessage('Unable to copy the registration link.');
        }
    };

    const updateEvent = async (eventId) => {
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('client_id', selectedClientId || eventFormData.client_id || '');
            formDataToSend.append('event_name', eventFormData.event_name || '');
            formDataToSend.append('venue', eventFormData.venue || '');
            formDataToSend.append('office_address', eventFormData.office_address || '');
            formDataToSend.append('event_time', eventFormData.event_time || '');
            formDataToSend.append('start_date', eventFormData.start_date || '');
            formDataToSend.append('end_date', eventFormData.end_date || '');
            formDataToSend.append('registration_cutoff_date', eventFormData.registration_cutoff_date || '');
            formDataToSend.append('organizer_name', eventFormData.organizer_name || '');
            formDataToSend.append('organizer_phone', eventFormData.organizer_phone || '');
            formDataToSend.append('organizer_whatsapp', eventFormData.organizer_whatsapp || '');
            formDataToSend.append('razorpay_registration_amount', eventFormData.razorpay_registration_amount ?? '');
            formDataToSend.append('payment_gateway_id', eventFormData.payment_gateway_id || '');
            
            if (eventFormData.organizer_photo) {
                formDataToSend.append('organizer_photo', eventFormData.organizer_photo);
            }
            if (eventFormData.registration_banner) {
                formDataToSend.append('registration_banner', eventFormData.registration_banner);
            }

            const res = await fetch(`${API_BASE}/api/admin/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataToSend
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            setEventFormData({});
            setEditingEventId(null);
            fetchEvents();
        } catch (err) {
            setMessage('Error updating event');
        }
        setLoading(false);
    };

    const toggleEventStatus = async (eventId, nextStatus) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/events/${eventId}/status`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ is_active: nextStatus })
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            fetchEvents();
        } catch (err) {
            setMessage('Error updating event status');
        }
        setLoading(false);
    };

    const createAdmin = async () => {
        setLoading(true);
        try {
            const clientId = selectedClientId || adminFormData.client_id || '';
            const res = await fetch(`${API_BASE}/api/admin/create-admin`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    client_id: clientId ? Number(clientId) : null,
                    volunteer_id: adminFormData.volunteer_id ? Number(adminFormData.volunteer_id) : null,
                    name: adminFormData.name || '',
                    email: adminFormData.email,
                    password: adminFormData.password,
                    phone_number: adminFormData.phone_number || '',
                    role_name: adminFormData.role_name || 'admin'
                })
            });
            const data = await res.json();
            if (res.ok && data.admin_id && clientId) {
                const assignmentResponse = await fetchWithAuth(`/api/clients/${clientId}/assign-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        admin_id: data.admin_id,
                        can_view_forms: true,
                        can_generate_links: true,
                        can_view_registrations: true
                    })
                });
                const assignmentData = await assignmentResponse.json();
                if (!assignmentResponse.ok || !assignmentData.success) {
                    throw new Error(assignmentData.message || 'Admin was created but could not be assigned to the client.');
                }
                setMessage('Client admin created and assigned successfully.');
            } else if (!res.ok) {
                setMessage(data.message || data.error);
            } else {
                setMessage('Admin created successfully. The admin can now log in with the configured email and password.');
            }
            setAdminFormData({});
            fetchAdmins();
        } catch (err) {
            setMessage(err.message || 'Error creating admin');
        }
        setLoading(false);
    };

    const createVolunteer = async () => {
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('client_id', selectedClientId);
            formDataToSend.append('volunteer_name', volunteerFormData.volunteer_name || '');
            formDataToSend.append('email', volunteerFormData.email || '');
            formDataToSend.append('address', volunteerFormData.address || '');
            formDataToSend.append('whatsapp_number', volunteerFormData.whatsapp_number || '');
            formDataToSend.append('birthdate', volunteerFormData.birthdate || '');
            formDataToSend.append('main_profession', volunteerFormData.main_profession || '');
            formDataToSend.append('group_id', volunteerFormData.group_id || '');
            if (volunteerFormData.photo) {
                formDataToSend.append('photo', volunteerFormData.photo);
            }
            const res = await fetch(`${API_BASE}/api/admin/volunteers`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataToSend
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            setVolunteerFormData({});
            setVolunteerPhotoInputKey((key) => key + 1);
            fetchVolunteers();
        } catch (err) {
            setMessage('Error creating volunteer');
        }
        setLoading(false);
    };

    const updateVolunteer = async (volunteerId) => {
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('client_id', selectedClientId);
            formDataToSend.append('volunteer_name', volunteerFormData.volunteer_name || '');
            formDataToSend.append('email', volunteerFormData.email || '');
            formDataToSend.append('address', volunteerFormData.address || '');
            formDataToSend.append('whatsapp_number', volunteerFormData.whatsapp_number || '');
            formDataToSend.append('birthdate', volunteerFormData.birthdate || '');
            formDataToSend.append('main_profession', volunteerFormData.main_profession || '');
            formDataToSend.append('group_id', volunteerFormData.group_id || '');
            formDataToSend.append('is_active', volunteerFormData.is_active !== false);
            if (volunteerFormData.photo) {
                formDataToSend.append('photo', volunteerFormData.photo);
            }
            const res = await fetch(`${API_BASE}/api/admin/volunteers/${volunteerId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataToSend
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            setVolunteerFormData({});
            setVolunteerPhotoInputKey((key) => key + 1);
            setEditingVolunteerId(null);
            fetchVolunteers();
        } catch (err) {
            setMessage('Error updating volunteer');
        }
        setLoading(false);
    };

    const deleteVolunteer = async () => {
        if (!deleteVolunteerDialog) return;
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/admin/volunteers/${deleteVolunteerDialog.volunteer_id}`, { method: 'DELETE' });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setDeleteVolunteerDialog(null);
                setVolunteerFormData({});
                setEditingVolunteerId(null);
                fetchVolunteers();
                fetchTeams();
                fetchGroups();
            }
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : 'Error deleting volunteer');
        }
        setLoading(false);
    };

    const saveGroup = async () => {
        setLoading(true);
        try {
            const selectedVolunteer = (field) => volunteers.find((volunteer) =>
                String(volunteer.volunteer_id) === String(groupFormData[field])
            );
            const adhyaksha = selectedVolunteer('adhyaksha_volunteer_id');
            const khajindar = selectedVolunteer('khajindar_volunteer_id');
            const upadhyaksha = selectedVolunteer('upadhyaksha_volunteer_id');
            const sachiv = selectedVolunteer('sachiv_volunteer_id');
            const upasachiv = selectedVolunteer('upasachiv_volunteer_id');
            const targetUrl = editingGroupId
                ? `${API_BASE}/api/admin/volunteer-groups/${editingGroupId}`
                : `${API_BASE}/api/admin/volunteer-groups`;
            const res = await fetchWithAuth(targetUrl.replace(API_BASE, ''), {
                method: editingGroupId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: selectedClientId,
                    group_name: groupFormData.group_name || '',
                    adhyaksha_name: adhyaksha?.volunteer_name || groupFormData.adhyaksha_name || '',
                    khajindar_name: khajindar?.volunteer_name || groupFormData.khajindar_name || '',
                    upadhyaksha_name: upadhyaksha?.volunteer_name || groupFormData.upadhyaksha_name || '',
                    sachiv_name: sachiv?.volunteer_name || groupFormData.sachiv_name || '',
                    upasachiv_name: upasachiv?.volunteer_name || groupFormData.upasachiv_name || '',
                    is_active: groupFormData.is_active !== false
                })
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setGroupFormData({});
                setEditingGroupId(null);
                await fetchGroups();
            }
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : 'Error saving volunteer group');
        }
        setLoading(false);
    };

    const deleteGroup = async () => {
        if (!deleteGroupDialog) return;
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/admin/volunteer-groups/${deleteGroupDialog.group_id}`, { method: 'DELETE' });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setDeleteGroupDialog(null);
                setGroupFormData({});
                setEditingGroupId(null);
                setGroups((currentGroups) => currentGroups.filter((group) => String(group.group_id) !== String(deleteGroupDialog.group_id)));
                await Promise.all([fetchGroups(), fetchVolunteers()]);
            }
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : 'Error deleting volunteer group');
        }
        setLoading(false);
    };

    const createTeam = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/teams`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ client_id: selectedClientId, team_name: teamFormData.team_name || '' })
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            setTeamFormData({});
            fetchTeams();
        } catch (err) {
            setMessage('Error creating team');
        }
        setLoading(false);
    };

    const saveTeamName = async () => {
        if (!editingTeamId || !String(teamFormData.team_name || '').trim()) return;
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/admin/teams/${editingTeamId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: selectedClientId, team_name: String(teamFormData.team_name).trim() })
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setTeamFormData({});
                setEditingTeamId(null);
                fetchTeams();
            }
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : 'Error renaming team');
        }
        setLoading(false);
    };

    const deleteTeam = async () => {
        if (!editingTeamId) return;
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/admin/teams/${editingTeamId}`, { method: 'DELETE' });
            const data = await res.json();
            setMessage(data.message || data.error);
            if (res.ok) {
                setTeamFormData({});
                setEditingTeamId(null);
                setTeamDeleteDialogOpen(false);
                fetchTeams();
            }
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : 'Error deleting team');
        }
        setLoading(false);
    };

    const startTeamEdit = (team) => {
        setEditingTeamId(team.team_id);
        setTeamFormData({ team_name: team.team_name || '' });
    };

    const activeTabTitle = adminTabLabels[activeTab] || 'Dashboard';
    const activeTabDescription = adminTabDescriptions[activeTab] || '';

    const selectAssignmentTeam = (teamId) => {
        const nextAssignments = teamAssignments.filter((assignment) => String(assignment.team_id) === String(teamId));
        const selectedTeam = teams.find((team) => String(team.team_id) === String(teamId));
        setAssignmentFormData({ team_id: teamId, team_name: selectedTeam?.team_name || '', volunteer_id: '', is_team_lead: false, is_team_manager: false });
        setAssignmentDraft(nextAssignments.map((assignment) => ({ ...assignment })));
        setAssignmentDirty(false);
        setEditingAssignmentId(null);
        setTeamMemberSearch('');
    };

    const resetAssignmentSelection = () => {
        if (!selectedAssignmentTeamId) return;
        setAssignmentFormData((current) => ({ ...current, volunteer_id: '' }));
        setAssignmentDraft([]);
        setAssignmentSearch('');
        setTeamMemberSearch('');
        setEditingAssignmentId(null);
        setAssignmentDirty(true);
    };

    const addAssignmentToDraft = (volunteerId) => {
        if (!selectedAssignmentTeamId || selectedTeamVolunteerIds.has(String(volunteerId))) return;
        const volunteer = volunteers.find((item) => String(item.volunteer_id) === String(volunteerId));
        setAssignmentDraft((current) => [...current, {
            team_id: selectedAssignmentTeamId,
            volunteer_id: volunteerId,
            volunteer_name: volunteer?.volunteer_name || '',
            is_team_lead: false,
            is_team_manager: false
        }]);
        setAssignmentDirty(true);
        setAssignmentFormData((current) => ({ ...current, volunteer_id: '' }));
    };

    const removeAssignmentFromDraft = (volunteerId) => {
        setAssignmentDraft((current) => current.filter((assignment) => String(assignment.volunteer_id) !== String(volunteerId)));
        setAssignmentDirty(true);
        setAssignmentFormData((current) => ({ ...current, volunteer_id: '' }));
    };

    const saveTeamAssignments = async () => {
        if (!selectedAssignmentTeamId || (!assignmentDirty && !teamNameChanged)) return;
        setLoading(true);
        try {
            if (teamNameChanged) {
                const teamResponse = await fetchWithAuth(`/api/admin/teams/${selectedAssignmentTeamId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: selectedClientId, team_name: String(assignmentFormData.team_name || '').trim() })
                });
                if (!teamResponse.ok) throw new Error((await teamResponse.json()).error || 'Unable to rename team');
            }
            const draftIds = new Set(assignmentDraft.map((assignment) => String(assignment.volunteer_id)));
            const removedAssignments = selectedTeamAssignments.filter((assignment) => !draftIds.has(String(assignment.volunteer_id)));
            for (const assignment of assignmentDirty ? removedAssignments : []) {
                const response = await fetchWithAuth(`/api/admin/team-assignments/${assignment.assignment_id}?volunteerId=${encodeURIComponent(assignment.volunteer_id)}&teamId=${encodeURIComponent(assignment.team_id)}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json()).error || 'Unable to remove team assignment');
            }
            for (const assignment of assignmentDirty ? assignmentDraft : []) {
                const response = await fetchWithAuth('/api/admin/team-assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: selectedClientId,
                        volunteer_id: Number(assignment.volunteer_id),
                        team_id: Number(selectedAssignmentTeamId),
                        is_team_lead: !!assignment.is_team_lead,
                        is_team_manager: !!assignment.is_team_manager
                    })
                });
                if (!response.ok) throw new Error((await response.json()).error || 'Unable to save team assignment');
            }
            setMessage('Team assignments saved successfully!');
            setAssignmentDirty(false);
            setEditingAssignmentId(null);
            fetchTeams();
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : `Error saving team assignments: ${err.message}`);
        }
        setLoading(false);
    };

    const cancelTeamAssignmentChanges = () => {
        const currentTeam = teams.find((team) => String(team.team_id) === String(selectedAssignmentTeamId));
        setAssignmentFormData((current) => ({ ...current, team_name: currentTeam?.team_name || '' }));
        setAssignmentDraft(selectedTeamAssignments.map((assignment) => ({ ...assignment })));
        setAssignmentDirty(false);
        setTeamMemberSearch('');
    };

    const removeAssignment = async (assignment) => {
        setLoading(true);
        try {
            const assignmentId = assignment.assignment_id || `${assignment.team_id}-${assignment.volunteer_id}`;
            const query = assignment.assignment_id ? '' : `?volunteerId=${encodeURIComponent(assignment.volunteer_id)}&teamId=${encodeURIComponent(assignment.team_id)}`;
            const res = await fetchWithAuth(`/api/admin/team-assignments/${assignmentId}${query}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            setMessage(data.message || data.error || `Unable to remove team assignment (${res.status}).`);
            if (res.ok) fetchTeams();
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : `Error removing team assignment: ${err.message}`);
        }
        setLoading(false);
    };

    const deactivateAdmin = async (adminId) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/deactivate-admin/${adminId}`, {
                method: 'DELETE',
                headers
            });
            const data = await res.json();
            setMessage(data.message || data.error);
            fetchAdmins();
        } catch (err) {
            setMessage('Error deactivating admin');
        }
        setLoading(false);
    };

    const activateAdmin = async (adminId) => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`/api/admin/activate-admin/${adminId}`, { method: 'PUT' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || `Activation failed (${res.status}).`);
            setMessage(data.message || 'Admin activated successfully.');
            if (res.ok) fetchAdmins();
        } catch (err) {
            setMessage(err.message === 'Unauthorized' ? 'Your session has expired. Please log in again.' : `Error activating admin: ${err.message}`);
        }
        setLoading(false);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setAdminFormData({});
        setEventFormData({});
        setHomepageFormData({});
        setVolunteerFormData({});
        setGroupFormData({});
        setTeamFormData({});
        setAssignmentFormData({});
        setAssignmentDraft([]);
        setAssignmentDirty(false);
        setEditingTeamId(null);
        setAssignmentSearch('');
        setTeamMemberSearch('');
        setEditingAssignmentId(null);
        setEditingEventId(null);
        setEditingVolunteerId(null);
        setEditingGroupId(null);
        if (tab !== 'plans') resetSubscriptionPlanForm();
        if (tab !== 'payment') setPaymentGatewayFormData((current) => ({ ...current, key_secret: '' }));
    };

    const editVolunteerGroup = (group) => {
        const findVolunteerId = (name) => {
            const normalizedName = String(name || '').trim().toLowerCase();
            return volunteers.find((volunteer) => String(volunteer.volunteer_name || '').trim().toLowerCase() === normalizedName)?.volunteer_id || '';
        };

        setGroupFormData({
            ...group,
            adhyaksha_volunteer_id: findVolunteerId(group.adhyaksha_name),
            khajindar_volunteer_id: findVolunteerId(group.khajindar_name),
            upadhyaksha_volunteer_id: findVolunteerId(group.upadhyaksha_name),
            sachiv_volunteer_id: findVolunteerId(group.sachiv_name),
            upasachiv_volunteer_id: findVolunteerId(group.upasachiv_name)
        });
        setEditingGroupId(group.group_id);
    };

    const handleClientScopeChange = (clientId) => {
        setSelectedClientId(clientId);
        setClientSubscription(null);
        setClientSubscriptionFormData({ plan_id: '', starts_at: new Date().toISOString().slice(0, 10), ends_at: '', status: 'active', notes: '' });
        setUsers([]);
        setRegistrationReport([]);
        setAdmins([]);
        setEvents([]);
        setVolunteers([]);
        setVolunteerSearch('');
        setGroups([]);
        setTeams([]);
        setTeamAssignments([]);
        setAdminFormData({});
        setEventFormData({});
        setHomepageFormData({});
        setPaymentGatewayFormData({ provider: 'razorpay', key_id: '', key_secret: '', is_enabled: false });
        setPaymentGateways([]);
        setPaymentGatewaySecretConfigured(false);
        setClientDomains([]);
        setNewClientDomain('');
        setVolunteerFormData({});
        setGroupFormData({});
        setTeamFormData({});
        setAssignmentFormData({});
        setAssignmentDraft([]);
        setAssignmentDirty(false);
        setEditingAssignmentId(null);
        setEditingTeamId(null);
        setTeamMemberSearch('');
        setEditingEventId(null);
        setEditingVolunteerId(null);
        setEditingGroupId(null);
        if (clientId) {
            const selectedClient = clients.find((client) => String(client.client_id) === String(clientId));
            if (selectedClient) editClient(selectedClient);
        } else {
            resetClientOnboarding();
        }
    };

    return (
        <div className="admin-panel">
            <aside className="admin-sidebar">
                <nav className="admin-tabs admin-tabs-desktop" aria-label="Admin sections">
                    {adminTabs.map((tab) => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab)}
                        >
                            <span className="tab-dot" aria-hidden="true"></span>
                            {t(`admin.tabs.${tab}`, adminTabLabels[tab])}
                        </button>
                    ))}
                </nav>
                <div className="admin-user-card">
                    <span className="admin-avatar">{(loggedInUser?.name || loggedInUser?.email || 'A').charAt(0).toUpperCase()}</span>
                    <span>
                        <strong>{loggedInUser?.name || 'Admin User'}</strong>
                        <small>{isSuperUser ? 'Super Admin' : 'Admin'}</small>
                    </span>
                </div>
            </aside>

            <main className="admin-main">
                <div className="admin-header">
                    <div>
                        <h1>{activeTab === 'dashboard' ? t('admin.title', 'Operational Overview') : activeTabTitle}</h1>
                        <p>{activeTabDescription}</p>
                    </div>
                    <div className="actions">
                        {isSuperUser && <select value={selectedClientId} onChange={(event) => handleClientScopeChange(event.target.value)} disabled={!clients.length}>
                            <option value="">Select Client Scope</option>
                            {clients.filter((client) => client.is_active).map((client) => (
                                <option key={client.client_id} value={client.client_id}>{client.client_name}</option>
                            ))}
                        </select>}
                        <button className="btn-secondary admin-refresh" onClick={() => { fetchUsers(); fetchVolunteers(); fetchGroups(); fetchTeams(); }} disabled={loading}>Refresh</button>
                    </div>
                </div>

                {message && <div className="admin-message" role="status" aria-live="polite">{message}</div>}

                <div className="admin-tabs admin-tabs-mobile" aria-label="Admin sections">
                    {adminTabs.map((tab) => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab)}
                        >
                            {t(`admin.tabs.${tab}`, adminTabLabels[tab])}
                        </button>
                    ))}
                </div>

                <div className="admin-content">
                {(!isSuperUser || selectedClientId || ['clients', 'plans', 'homepage', 'payment', 'users'].includes(activeTab)) && (
                <>
                {activeTab === 'dashboard' && (
                    <div className="dashboard">
                        <div className="stat-card">
                            <h3>{t('admin.stats.totalUsers', 'Total Candidates')}</h3>
                            <p className="stat-number">{users.length}</p>
                        </div>
                        {isSuperUser && <div className="stat-card">
                            <h3>{t('admin.stats.totalAdmins', 'Admin Accounts')}</h3>
                            <p className="stat-number">{admins.length}</p>
                        </div>}
                        <div className="stat-card">
                            <h3>{t('admin.stats.activeEvents', 'Active Events')}</h3>
                            <p className="stat-number">{events.filter((event) => !!event.is_active).length}</p>
                        </div>
                        <div className="stat-card">
                            <h3>{t('admin.stats.recentLogs', 'System Activity Logs')}</h3>
                            <p className="stat-number">{logs.length}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Total Volunteers</h3>
                            <p className="stat-number">{volunteers.length}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Total Teams</h3>
                            <p className="stat-number">{teams.length}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Assigned Teams</h3>
                            <p className="stat-number">{new Set(teamAssignments.map((assignment) => String(assignment.team_id))).size}</p>
                        </div>

                        <div className="form-section" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                            <h3>Quick Actions</h3>
                            <div className="actions">
                                <button className="btn-primary" onClick={() => handleTabChange('events')} disabled={loading}>Manage Events</button>
                                <button className="btn-primary" onClick={() => handleTabChange('volunteers')} disabled={loading}>Manage Volunteers</button>
                                <button className="btn-primary" onClick={() => handleTabChange('teams')} disabled={loading}>Manage Teams</button>
                                <button className="btn-primary" onClick={() => handleTabChange('users')} disabled={loading}>Manage Candidates</button>
                                {isSuperUser && (
                                    <button className="btn-primary" onClick={() => handleTabChange('admins')} disabled={loading}>Manage Admins</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-section">
                        <div className="actions" style={{ marginBottom: 16 }}>
                            <button type="button" className="btn-primary" onClick={fetchRegistrationReport} disabled={loading || !selectedClientId}>Registration & Payment Report</button>
                        </div>
                        {editingCandidate && (
                            <div className="form-section" style={{ marginBottom: 20 }}>
                                <h3>Edit Candidate Profile</h3>
                                <div className="form-group">
                                    <label>First name<input value={editingCandidate.first_name || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, first_name: e.target.value })} /></label>
                                    <label>Middle name<input value={editingCandidate.middle_name || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, middle_name: e.target.value })} /></label>
                                    <label>Last name<input value={editingCandidate.last_name || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, last_name: e.target.value })} /></label>
                                    <label>Mobile<input value={editingCandidate.mobile_number || editingCandidate.mobile || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, mobile_number: e.target.value })} /></label>
                                    <label>WhatsApp<input value={editingCandidate.whatsapp_number || editingCandidate.whatsapp || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, whatsapp_number: e.target.value })} /></label>
                                    <label>Email<input type="email" value={editingCandidate.email || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, email: e.target.value })} /></label>
                                    <label>Gender<select value={editingCandidate.gender || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, gender: e.target.value })}><option value="">Select</option><option value="Bride">Bride</option><option value="Groom">Groom</option></select></label>
                                    <label>Marriage type<select value={editingCandidate.marriage_type || ''} onChange={(e) => setEditingCandidate({ ...editingCandidate, marriage_type: e.target.value })}><option value="">Select</option><option value="First Marriage">First Marriage</option><option value="Re Marriage">Re Marriage</option></select></label>
                                    <div className="actions"><button type="button" className="btn-primary" onClick={updateCandidate} disabled={loading}>Save Profile</button><button type="button" className="btn-secondary" onClick={() => setEditingCandidate(null)}>Cancel</button></div>
                                </div>
                            </div>
                        )}
                        {registrationReport.length > 0 && (
                            <table className="admin-table" style={{ marginBottom: 24 }}>
                                <thead>
                                    <tr><th>Event</th><th>Candidate</th><th>Mobile</th><th>Registered</th><th>Payment</th><th>Payment Date</th></tr>
                                </thead>
                                <tbody>
                                    {registrationReport.map((registration) => (
                                        <tr key={registration.registration_id}>
                                            <td>{registration.event_name}</td>
                                            <td>{[registration.first_name, registration.middle_name, registration.last_name].filter(Boolean).join(' ')}</td>
                                            <td>{registration.mobile_number || '-'}</td>
                                            <td>{registration.registration_date ? new Date(registration.registration_date).toLocaleDateString() : '-'}</td>
                                            <td>{registration.payment_status || 'Pending'}</td>
                                            <td>{registration.payment_date ? new Date(registration.payment_date).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Email</th>
                                    <th>Name</th>
                                    <th>Mobile</th>
                                    <th>Registered Events</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.email}</td>
                                        <td>{user.first_name} {user.last_name}</td>
                                        <td>{user.mobile}</td>
                                        <td>
                                            {(user.registered_events || []).length > 0
                                                ? user.registered_events.map((event) => (
                                                    <div key={`${user.id}-${event.event_id}`}>
                                                        <strong>{event.event_name}</strong>
                                                        <div>Stage ID: {event.event_registration_code || 'Pending'}</div>
                                                    </div>
                                                ))
                                                : '-'}
                                        </td>
                                        <td className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </td>
                                        <td className="actions">
                                            <button onClick={() => setEditingCandidate({ ...user, mobile_number: user.mobile, whatsapp_number: user.whatsapp })} className="btn-secondary" disabled={loading}>Edit</button>
                                            {user.is_active ? (
                                                <button onClick={() => deactivateUser(user.id, 'Deactivated by admin')} className="btn-deactivate" disabled={loading}>
                                                    Deactivate
                                                </button>
                                            ) : (
                                                <button onClick={() => activateUser(user.id)} className="btn-activate" disabled={loading}>
                                                    Activate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'events' && (
                    <div className="events-section">
                        <div className="form-section">
                            <h3>{editingEventId ? 'Edit Event' : 'Create Event'}</h3>
                            <p className="form-help">Each client can have multiple events. Use the Payment Gateway section only when this event has a registration fee.</p>
                            <div className="form-group event-form-group">
                                <label>Event title <span className="required-mark">*</span><input type="text" placeholder="Example: Matrimonial Introduction Meet 2027" value={eventFormData.event_name || ''} onChange={(e) => setEventFormData({ ...eventFormData, event_name: e.target.value })} /></label>
                                <label>Event venue and full address <span className="required-mark">*</span><input type="text" placeholder="Venue name, street, city and PIN" value={eventFormData.venue || ''} onChange={(e) => setEventFormData({ ...eventFormData, venue: e.target.value })} /></label>
                                <label>Event office address <span className="optional-mark">(optional)</span><input type="text" placeholder="Optional address shown for this event" value={eventFormData.office_address || ''} onChange={(e) => setEventFormData({ ...eventFormData, office_address: e.target.value })} /></label>
                                <label>Event time <span className="optional-mark">(optional)</span><input type="text" placeholder="Example: 9:00 AM to 5:00 PM" value={eventFormData.event_time || ''} onChange={(e) => setEventFormData({ ...eventFormData, event_time: e.target.value })} /></label>
                                
                                <label>Event start date <span className="required-mark">*</span><input type="date" value={eventFormData.start_date || ''} onChange={(e) => setEventFormData({ ...eventFormData, start_date: e.target.value })} /></label>
                                
                                <label>Event end date <span className="required-mark">*</span><input type="date" value={eventFormData.end_date || ''} onChange={(e) => setEventFormData({ ...eventFormData, end_date: e.target.value })} /></label>
                                
                                <label>Registration cutoff date <span className="required-mark">*</span><input type="date" value={eventFormData.registration_cutoff_date || ''} onChange={(e) => setEventFormData({ ...eventFormData, registration_cutoff_date: e.target.value })} /></label>
                                
                                <div className="form-subheading">Organizer and contact details</div>
                                <label>Organizer name<input type="text" placeholder="Person or committee name" value={eventFormData.organizer_name || ''} onChange={(e) => setEventFormData({ ...eventFormData, organizer_name: e.target.value })} /></label>
                                <label>Organizer helpline phone<input type="text" placeholder="Phone shown on the event registration page" value={eventFormData.organizer_phone || ''} onChange={(e) => setEventFormData({ ...eventFormData, organizer_phone: e.target.value })} /></label>
                                <label>Organizer WhatsApp<input type="text" placeholder="WhatsApp number" value={eventFormData.organizer_whatsapp || ''} onChange={(e) => setEventFormData({ ...eventFormData, organizer_whatsapp: e.target.value })} /></label>
                                <label>Registration fee <span className="optional-mark">(enter 0 for free)</span><input type="number" step="0.01" min="0" placeholder="0" value={eventFormData.razorpay_registration_amount ?? ''} onChange={(e) => setEventFormData({ ...eventFormData, razorpay_registration_amount: e.target.value })} /></label>
                                <label>Payment gateway <span className="optional-mark">(required for paid events when multiple gateways exist)</span><select value={eventFormData.payment_gateway_id || ''} onChange={(e) => setEventFormData({ ...eventFormData, payment_gateway_id: e.target.value })}>
                                    <option value="">No gateway (free event)</option>
                                    {paymentGateways.map((gateway) => (
                                        <option key={gateway.config_id} value={gateway.config_id} disabled={!gateway.is_enabled && String(eventFormData.payment_gateway_id) !== String(gateway.config_id)}>{gateway.gateway_name || gateway.key_id || `Gateway ${gateway.config_id}`}{gateway.is_enabled ? '' : ' (disabled)'}</option>
                                    ))}
                                </select></label>
                                
                                <label style={{ width: '100%', fontSize: '0.9em', color: '#666' }}>Organizer Photo:</label>
                                {eventOrganizerPreview && <img src={eventOrganizerPreview} alt="Organizer Preview" style={{ width: '100%', maxWidth: 240, borderRadius: 12, border: '1px solid #e5e7eb' }} />}
                                <label>Choose organizer photo<input type="file" accept="image/*" onChange={(e) => setEventFormData({ ...eventFormData, organizer_photo: e.target.files[0], organizer_photo_preview_url: e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : '', organizer_photo_existing: eventFormData.organizer_photo_existing || '' })} /></label>

                                <label style={{ width: '100%', fontSize: '0.9em', color: '#666' }}>Registration Banner (recommended wide image):</label>
                                {eventBannerPreview && <img src={eventBannerPreview} alt="Registration Banner Preview" style={{ width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid #e5e7eb' }} />}
                                <label>Choose registration banner<input type="file" accept="image/*" onChange={(e) => setEventFormData({ ...eventFormData, registration_banner: e.target.files[0], registration_banner_preview_url: e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : '', registration_banner_existing: eventFormData.registration_banner_existing || '' })} /></label>
                                
                                {editingEventId ? (
                                    <>
                                        <button type="button" onClick={() => updateEvent(editingEventId)} className="btn-primary" disabled={loading}>Save Changes</button>
                                        <button type="button" onClick={() => { setEventFormData({}); setEditingEventId(null); }} className="btn-secondary">Cancel</button>
                                    </>
                                ) : (
                                    <button type="button" onClick={createEvent} className="btn-primary" disabled={loading}>Create Event</button>
                                )}
                            </div>
                        </div>

                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Event Name</th>
                                    <th>Fee</th>
                                    <th>Gateway</th>
                                    <th>Dates</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map(event => (
                                    <tr key={event.event_id}>
                                        <td>{event.event_name}</td>
                                        <td>{Number(event.razorpay_registration_amount) === 0 ? 'Free' : (event.razorpay_registration_amount ? `₹${event.razorpay_registration_amount}` : 'Default')}</td>
                                        <td>{event.payment_gateway_name || (event.payment_gateway_id ? 'Assigned gateway' : 'None')}</td>
                                        <td>{formatDateForInput(event.start_date)} to {formatDateForInput(event.end_date)}</td>
                                        <td className={`status ${event.is_active ? 'active' : 'inactive'}`}>
                                            {event.is_active ? 'Active' : 'Inactive'}
                                        </td>
                                        <td className="actions">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEventFormData({
                                                        client_id: event.client_id || selectedClientId || '',
                                                        event_name: event.event_name,
                                                        venue: event.venue,
                                                        office_address: event.office_address || '',
                                                        event_time: event.event_time || '',
                                                        start_date: formatDateForInput(event.start_date),
                                                        end_date: formatDateForInput(event.end_date),
                                                        registration_cutoff_date: formatDateForInput(event.registration_cutoff_date),
                                                        organizer_name: event.organizer_name,
                                                        organizer_phone: event.organizer_phone,
                                                        organizer_whatsapp: event.organizer_whatsapp,
                                                        organizer_photo_existing: event.organizer_photo || '',
                                                        registration_banner_existing: event.registration_banner_path || '',
                                                        razorpay_registration_amount: event.razorpay_registration_amount ?? '',
                                                        payment_gateway_id: event.payment_gateway_id || ''
                                                    });
                                                    setEditingEventId(event.event_id);
                                                }}
                                                className="btn-primary"
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleEventStatus(event.event_id, !event.is_active)}
                                                className={event.is_active ? 'btn-deactivate' : 'btn-activate'}
                                                disabled={loading}
                                            >
                                                {event.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button type="button" onClick={() => copyRegistrationLink(event)} className="btn-secondary" disabled={!event.client_id}>
                                                Copy Link
                                            </button>
                                            <a className="btn-secondary" href={getRegistrationLink(event)} target="_blank" rel="noreferrer">
                                                Open Link
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'homepage' && (
                    <div className="form-section">
                        {!selectedClientId ? (
                            <p className="form-help">Select a client from the scope menu to create or edit its homepage content.</p>
                        ) : (
                            <>
                                <h3>Homepage Content</h3>
                                <p className="form-help">Client identity, event details, committee members and support teams are pulled from the selected client records. Use the fields below for public-facing website copy and policies.</p>
                                <div className="form-grid">
                                    <label>Public homepage slug <span className="optional-mark">(optional)</span><input type="text" placeholder="community-name" value={homepageFormData.public_slug || ''} onChange={(event) => setHomepageFormData({ ...homepageFormData, public_slug: event.target.value })} /></label>
                                    <label>Custom domain <span className="optional-mark">(optional)</span><input type="text" placeholder="community.example.com" value={homepageFormData.custom_domain || ''} onChange={(event) => setHomepageFormData({ ...homepageFormData, custom_domain: event.target.value })} /></label>
                                    <label>Homepage title <span className="optional-mark">(optional)</span><input type="text" placeholder="Title shown on the community homepage" value={homepageFormData.homepage_title || ''} onChange={(event) => setHomepageFormData({ ...homepageFormData, homepage_title: event.target.value })} /></label>
                                    <label className="form-grid-full">Homepage introduction <span className="optional-mark">(optional)</span><textarea placeholder="Short introduction for this client homepage" value={homepageFormData.homepage_intro || ''} onChange={(event) => setHomepageFormData({ ...homepageFormData, homepage_intro: event.target.value })} /></label>
                                    <label>Header eyebrow <span className="optional-mark">(optional)</span><input type="text" value={homepageFormData.homepage_content?.eyebrow || ''} onChange={(event) => updateHomepageContentField('eyebrow', event.target.value)} /></label>
                                    <label>Hero badge <span className="optional-mark">(optional)</span><input type="text" value={homepageFormData.homepage_content?.hero_badge || ''} onChange={(event) => updateHomepageContentField('hero_badge', event.target.value)} /></label>
                                    <label>About section title <span className="optional-mark">(optional)</span><input type="text" value={homepageFormData.homepage_content?.about_title || ''} onChange={(event) => updateHomepageContentField('about_title', event.target.value)} /></label>
                                    <label>Services section title <span className="optional-mark">(optional)</span><input type="text" value={homepageFormData.homepage_content?.service_title || ''} onChange={(event) => updateHomepageContentField('service_title', event.target.value)} /></label>
                                    <label className="form-grid-full">Invitation letter <span className="optional-mark">(optional)</span><textarea rows="8" placeholder="Invitation text shown on the client homepage" value={homepageFormData.homepage_content?.invitation_text || ''} onChange={(event) => updateHomepageContentField('invitation_text', event.target.value)} /></label>
                                    <label className="form-grid-full">About the organisation <span className="optional-mark">(optional)</span><textarea rows="3" value={homepageFormData.homepage_content?.about_text || ''} onChange={(event) => updateHomepageContentField('about_text', event.target.value)} /></label>
                                    <label className="form-grid-full">Registration and service description <span className="optional-mark">(optional)</span><textarea rows="3" value={homepageFormData.homepage_content?.service_text || ''} onChange={(event) => updateHomepageContentField('service_text', event.target.value)} /></label>
                                    <label className="form-grid-full">Registration rules and fee notes <span className="optional-mark">(optional)</span><textarea rows="3" value={homepageFormData.homepage_content?.rules_text || ''} onChange={(event) => updateHomepageContentField('rules_text', event.target.value)} /></label>
                                    <label>Refund and cancellation policy <span className="optional-mark">(optional)</span><textarea rows="4" value={homepageFormData.homepage_content?.refund_policy || ''} onChange={(event) => updateHomepageContentField('refund_policy', event.target.value)} /></label>
                                    <label>Shipping and delivery policy <span className="optional-mark">(optional)</span><textarea rows="4" value={homepageFormData.homepage_content?.shipping_policy || ''} onChange={(event) => updateHomepageContentField('shipping_policy', event.target.value)} /></label>
                                    <label>Terms and conditions <span className="optional-mark">(optional)</span><textarea rows="4" value={homepageFormData.homepage_content?.terms_text || ''} onChange={(event) => updateHomepageContentField('terms_text', event.target.value)} /></label>
                                    <label>Privacy policy <span className="optional-mark">(optional)</span><textarea rows="4" value={homepageFormData.homepage_content?.privacy_text || ''} onChange={(event) => updateHomepageContentField('privacy_text', event.target.value)} /></label>
                                    <label className="form-grid-full">Contact/help desk note <span className="optional-mark">(optional)</span><textarea rows="3" value={homepageFormData.homepage_content?.contact_note || ''} onChange={(event) => updateHomepageContentField('contact_note', event.target.value)} /></label>
                                    <label className="form-grid-full">Registration form configuration JSON <span className="optional-mark">(optional)</span><textarea rows="7" placeholder='{"hiddenFields":[],"requiredFields":[]}' value={homepageFormData.registration_form_config || ''} onChange={(event) => setHomepageFormData({ ...homepageFormData, registration_form_config: event.target.value })} /></label>
                                </div>
                                <div className="form-section" style={{ marginTop: 18 }}>
                                    <h4>Domain mappings</h4>
                                    <p className="form-help">Point every domain to this server. The primary domain is used for the selected client homepage.</p>
                                    <div className="admin-table-wrap">
                                        <table className="admin-table">
                                            <thead><tr><th>Hostname</th><th>Primary</th><th>Status</th><th>Actions</th></tr></thead>
                                            <tbody>
                                                {clientDomains.map((domain) => (
                                                    <tr key={domain.domain_id}>
                                                        <td>{domain.hostname}</td>
                                                        <td>{domain.is_primary ? 'Yes' : 'No'}</td>
                                                        <td>{domain.is_active ? 'Active' : 'Inactive'}</td>
                                                        <td><button type="button" className="btn-deactivate" onClick={() => removeClientDomain(domain)} disabled={loading}>Remove</button></td>
                                                    </tr>
                                                ))}
                                                {clientDomains.length === 0 && <tr><td colSpan="4">No custom domains configured.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="actions">
                                        <input type="text" value={newClientDomain} onChange={(event) => setNewClientDomain(event.target.value)} placeholder="another.example.com" />
                                        <button type="button" className="btn-secondary" onClick={addClientDomain} disabled={loading}>Add Domain</button>
                                    </div>
                                </div>
                                <label className="checkbox-label"><input type="checkbox" checked={homepageFormData.homepage_enabled !== false} onChange={(event) => setHomepageFormData({ ...homepageFormData, homepage_enabled: event.target.checked })} /> Publish client homepage</label>
                                <div className="actions"><button type="button" className="btn-primary" onClick={saveHomepageContent} disabled={loading}>Save Homepage Content</button></div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'payment' && (
                    <div className="form-section">
                        {isSuperUser && !selectedClientId ? (
                            <p className="form-help">Select a client from the scope menu to configure its payment gateway.</p>
                        ) : (
                            <>
                                <h3>Payment Gateways</h3>
                                <p className="form-help">Gateway settings are client-scoped. Create one record for each Razorpay account and assign one gateway to every paid event.</p>
                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead><tr><th>Name</th><th>Provider</th><th>Key ID</th><th>Status</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {paymentGateways.map((gateway) => (
                                                <tr key={gateway.config_id}>
                                                    <td>{gateway.gateway_name || `Gateway ${gateway.config_id}`}</td>
                                                    <td>{gateway.provider || 'razorpay'}</td>
                                                    <td>{gateway.key_id || '-'}</td>
                                                    <td className={`status ${gateway.is_enabled ? 'active' : 'inactive'}`}>{gateway.is_enabled ? 'Enabled' : 'Disabled'}</td>
                                                    <td className="actions">
                                                        <button type="button" className="btn-secondary" onClick={() => editPaymentGateway(gateway)} disabled={loading}>Edit</button>
                                                        <button type="button" className="btn-deactivate" onClick={() => deletePaymentGateway(gateway)} disabled={loading}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paymentGateways.length === 0 && <tr><td colSpan="5">No payment gateways configured for this client.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="actions"><button type="button" className="btn-secondary" onClick={startNewPaymentGateway} disabled={loading}>New Gateway</button></div>
                                <div className="form-grid">
                                    <label>Gateway name<input type="text" value={paymentGatewayFormData.gateway_name || ''} onChange={(event) => updatePaymentGateway('gateway_name', event.target.value)} placeholder="Example: Pune Razorpay" /></label>
                                    <label>Provider<select value={paymentGatewayFormData.provider || 'razorpay'} onChange={(event) => updatePaymentGateway('provider', event.target.value)}><option value="razorpay">Razorpay</option></select></label>
                                    <label>Razorpay key ID<input type="text" value={paymentGatewayFormData.key_id || ''} onChange={(event) => updatePaymentGateway('key_id', event.target.value)} placeholder="Enter Razorpay key ID" /></label>
                                    <label>Razorpay key secret {paymentGatewaySecretConfigured && <small>(configured, leave blank to keep)</small>}<input type="password" value={paymentGatewayFormData.key_secret || ''} onChange={(event) => updatePaymentGateway('key_secret', event.target.value)} placeholder={paymentGatewaySecretConfigured ? 'Leave blank to keep current' : 'Enter Razorpay key secret'} autoComplete="new-password" /></label>
                                </div>
                                <label className="checkbox-label"><input type="checkbox" checked={!!paymentGatewayFormData.is_enabled} onChange={(event) => updatePaymentGateway('is_enabled', event.target.checked)} /> Enable Razorpay for paid events</label>
                                <div className="actions"><button type="button" className="btn-primary" onClick={savePaymentGateway} disabled={loading}>Save Gateway Settings</button></div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'plans' && isSuperUser && (
                    <div className="events-section">
                        <p style={{ margin: '0 0 18px', color: '#6b4a50' }}>Create reusable client plans here. Candidate event registration fees remain configured separately under Events.</p>
                        <div className="form-section">
                            <h3>{editingSubscriptionPlanId ? 'Edit Client Plan' : 'Create Client Plan'}</h3>
                            <div className="form-grid">
                                <label>Plan code <span className="required-mark">*</span><input type="text" value={subscriptionPlanFormData.plan_code} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, plan_code: event.target.value })} placeholder="Example: community-pro" disabled={!!editingSubscriptionPlanId} /></label>
                                <label>Plan name <span className="required-mark">*</span><input type="text" value={subscriptionPlanFormData.plan_name} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, plan_name: event.target.value })} placeholder="Example: Community Pro" /></label>
                                <label>Price<input type="number" min="0" step="0.01" value={subscriptionPlanFormData.price} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, price: event.target.value })} /></label>
                                <label>Billing cycle<select value={subscriptionPlanFormData.billing_cycle} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select></label>
                                <label>Max active events <span className="optional-mark">(blank = unlimited)</span><input type="number" min="1" step="1" value={subscriptionPlanFormData.max_active_events} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, max_active_events: event.target.value })} /></label>
                                <label>Max candidates <span className="optional-mark">(blank = unlimited)</span><input type="number" min="1" step="1" value={subscriptionPlanFormData.max_candidates} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, max_candidates: event.target.value })} /></label>
                            </div>
                            <label>Description<textarea rows="2" value={subscriptionPlanFormData.description} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, description: event.target.value })} placeholder="What this plan includes" /></label>
                            <label className="checkbox-label"><input type="checkbox" checked={!!subscriptionPlanFormData.is_active} onChange={(event) => setSubscriptionPlanFormData({ ...subscriptionPlanFormData, is_active: event.target.checked })} /> Plan is active</label>
                            <div className="actions"><button type="button" className="btn-primary" onClick={saveSubscriptionPlan} disabled={loading}>Save Plan</button>{editingSubscriptionPlanId && <button type="button" className="btn-secondary" onClick={resetSubscriptionPlanForm}>Cancel</button>}</div>
                        </div>

                        <table className="admin-table">
                            <thead><tr><th>Plan</th><th>Price</th><th>Cycle</th><th>Limits</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {subscriptionPlans.map((plan) => (
                                    <tr key={plan.plan_id}>
                                        <td><strong>{plan.plan_name}</strong><div>{plan.plan_code}</div></td>
                                        <td>₹{Number(plan.price || 0).toFixed(2)}</td>
                                        <td>{plan.billing_cycle}</td>
                                        <td>{plan.max_active_events || '∞'} events / {plan.max_candidates || '∞'} candidates</td>
                                        <td className={`status ${Number(plan.is_active) !== 0 ? 'active' : 'inactive'}`}>{Number(plan.is_active) !== 0 ? 'Active' : 'Inactive'}</td>
                                        <td><button type="button" className="btn-secondary" onClick={() => editSubscriptionPlan(plan)} disabled={loading}>Edit</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="form-section" style={{ marginTop: 20 }}>
                            <h3>Assign Plan To Client</h3>
                            <p className="form-help">Select a client from the header above, then assign its active plan and access dates.</p>
                            {!selectedClientId ? <p className="form-help">No client selected.</p> : (
                                <>
                                    <p><strong>Selected client:</strong> {clients.find((client) => String(client.client_id) === String(selectedClientId))?.client_name || selectedClientId}</p>
                                    {clientSubscription && <p className="form-help">Current plan: <strong>{clientSubscription.plan_name}</strong> ({clientSubscription.status}){clientSubscription.ends_at ? ` until ${new Date(clientSubscription.ends_at).toLocaleDateString()}` : ' with no expiry'}</p>}
                                    <div className="form-grid">
                                        <label>Plan <span className="required-mark">*</span><select value={clientSubscriptionFormData.plan_id} onChange={(event) => setClientSubscriptionFormData({ ...clientSubscriptionFormData, plan_id: event.target.value })}><option value="">Select active plan</option>{subscriptionPlans.filter((plan) => Number(plan.is_active) !== 0 || String(plan.plan_id) === String(clientSubscriptionFormData.plan_id)).map((plan) => <option key={plan.plan_id} value={plan.plan_id}>{plan.plan_name}</option>)}</select></label>
                                        <label>Start date <input type="date" value={clientSubscriptionFormData.starts_at} onChange={(event) => setClientSubscriptionFormData({ ...clientSubscriptionFormData, starts_at: event.target.value })} /></label>
                                        <label>End date <span className="optional-mark">(blank = unlimited)</span><input type="date" value={clientSubscriptionFormData.ends_at} onChange={(event) => setClientSubscriptionFormData({ ...clientSubscriptionFormData, ends_at: event.target.value })} /></label>
                                        <label>Status<select value={clientSubscriptionFormData.status} onChange={(event) => setClientSubscriptionFormData({ ...clientSubscriptionFormData, status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select></label>
                                    </div>
                                    <label>Notes<textarea rows="2" value={clientSubscriptionFormData.notes} onChange={(event) => setClientSubscriptionFormData({ ...clientSubscriptionFormData, notes: event.target.value })} placeholder="Optional assignment note" /></label>
                                    <button type="button" className="btn-primary" onClick={saveClientSubscription} disabled={loading}>Assign Plan</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'clients' && isSuperUser && (
                    <div className="events-section">
                        <p style={{ margin: '0 0 18px', color: '#6b4a50' }}>Create the organization, then select its committee from volunteers. Create and assign a client admin; that admin creates and configures events.</p>
                        {!selectedClientId && !clientFormOpen && !clientOnboardingData.client_id ? (
                            <button type="button" className="btn-primary" onClick={() => setClientFormOpen(true)}>Create New Client</button>
                        ) : (
                        <div className="form-section">
                            <h3>{clientOnboardingData.client_id ? 'Edit Client / Community' : 'Step 1: Onboard Client / Community'}</h3>
                            <p className="form-help">Create the organization first. This name and office contact become the default homepage identity for its events.</p>
                            <div className="form-group">
                                <label>Client / community name <span className="required-mark">*</span><input type="text" placeholder="Example: Akhil Pune Bhavsar Samaj" value={clientOnboardingData.client_name || ''} onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, client_name: e.target.value })} /></label>
                                <label>Client logo <span className="optional-mark">(optional)</span><input key={clientLogoInputKey} type="file" accept="image/png,image/jpeg" onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, logo: e.target.files?.[0] || null })} /></label>
                                <label>Office address <span className="required-mark">*</span><input type="text" placeholder="Address shown when event address is not provided" value={clientOnboardingData.address || ''} onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, address: e.target.value })} /></label>
                                <label>Office / contact phone <span className="required-mark">*</span><input type="tel" placeholder="Primary contact number" value={clientOnboardingData.phone_number || ''} onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, phone_number: e.target.value })} /></label>
                                <label>Organization email <span className="optional-mark">(optional)</span><input type="email" placeholder="Email for organization communication" value={clientOnboardingData.contact_email || ''} onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, contact_email: e.target.value })} /></label>
                                <div className="form-subheading">Core committee (optional)</div>
                                {[['adhyaksha', 'Adhyaksha'], ['upa_adhyaksha', 'Upaadhyaksha'], ['khajindar', 'Khajindar'], ['sachiv', 'Sachiv'], ['upasachiv', 'Upasachiv']].map(([role, label]) => (
                                    <label key={role}>{label}<select value={clientOnboardingData[`${role}_volunteer_id`] || ''} onChange={(e) => setClientOnboardingData({ ...clientOnboardingData, [`${role}_volunteer_id`]: e.target.value })}>
                                        <option value="">Select committee member</option>
                                        {volunteers.filter((volunteer) => volunteer.is_active).map((volunteer) => (
                                            <option key={volunteer.volunteer_id} value={volunteer.volunteer_id}>{volunteer.volunteer_name}</option>
                                        ))}
                                    </select></label>
                                ))}
                                <button type="button" onClick={onboardClient} className="btn-primary" disabled={loading}>{clientOnboardingData.client_id ? 'Save Client Changes' : 'Create Client / Community'}</button>
                                {clientOnboardingData.client_id && <button type="button" onClick={resetClientOnboarding} className="btn-secondary">Cancel</button>}
                            </div>
                        </div>
                        )}

                    </div>
                )}

                {activeTab === 'admins' && (
                    <div className="admins-section">
                        {isSuperUser && (
                            <div className="form-section">
                                <h3>Step 3: Create and Assign Client Admin</h3>
                                <p className="form-help">The assigned admin can manage all events, registrations and homepage content for the selected client only.</p>
                                <div className="form-group">
                                    <label>Volunteer profile <span className="optional-mark">(optional)</span><select value={adminFormData.volunteer_id || ''} onChange={(e) => { const volunteer = volunteers.find((item) => String(item.volunteer_id) === String(e.target.value)); setAdminFormData({ ...adminFormData, volunteer_id: e.target.value, email: volunteer?.email || adminFormData.email || '', phone_number: volunteer?.whatsapp_number || '' }); }}>
                                        <option value="">Select volunteer</option>
                                        {volunteers.filter((item) => !!item.is_active).map((item) => (
                                            <option key={item.volunteer_id} value={item.volunteer_id}>{item.volunteer_name}</option>
                                        ))}
                                    </select></label>
                                    {!adminFormData.volunteer_id && <label>Admin name <span className="required-mark">*</span><input type="text" placeholder="Full name" value={adminFormData.name || ''} onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })} /></label>}
                                    <label>Login email <span className="required-mark">*</span><input type="email" placeholder="admin@example.com" value={adminFormData.email || ''} onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })} /></label>
                                    <label>Temporary password <span className="required-mark">*</span><input type="password" placeholder="Set a temporary password" value={adminFormData.password || ''} onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })} /></label>
                                    <label>Phone <span className="optional-mark">(optional override)</span><input type="text" placeholder="Uses volunteer WhatsApp by default" value={adminFormData.phone_number || ''} onChange={(e) => setAdminFormData({ ...adminFormData, phone_number: e.target.value })} /></label>
                                    <label>Admin role<select
                                        value={adminFormData.role_name || 'admin'}
                                        onChange={(e) => setAdminFormData({ ...adminFormData, role_name: e.target.value })}
                                    >
                                        <option value="admin">Admin</option>
                                    </select></label>
                                    {selectedAdminVolunteer && (
                                        <div style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                                            <strong>{selectedAdminVolunteer.volunteer_name}</strong>
                                            <div>WhatsApp: {selectedAdminVolunteer.whatsapp_number || '-'}</div>
                                            <div>Group: {selectedAdminVolunteer.group_name || '-'}</div>
                                        </div>
                                    )}
                                    <button onClick={createAdmin} className="btn-primary" disabled={loading || (!adminFormData.volunteer_id && !adminFormData.name) || !selectedClientId || !adminFormData.email || !adminFormData.password}>
                                        Create Client Admin
                                    </button>
                                </div>
                            </div>
                        )}

                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Email</th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>WhatsApp</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map(admin => (
                                    <tr key={admin.id}>
                                        <td>{admin.id}</td>
                                        <td>{admin.email}</td>
                                        <td>{admin.first_name} {admin.last_name}</td>
                                        <td>{admin.phone_number || '-'}</td>
                                        <td>{admin.whatsapp_number || '-'}</td>
                                        <td>{admin.role_name}</td>
                                        <td className={`status ${admin.is_active ? 'active' : 'inactive'}`}>
                                            {admin.is_active ? 'Active' : 'Inactive'}
                                        </td>
                                        <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                                        <td className="actions">
                                            {isSuperUser && admin.is_active && String(admin.id) !== String(loggedInUser?.id || loggedInUser?.admin_id) && (
                                                <button onClick={() => deactivateAdmin(admin.id)} className="btn-deactivate" disabled={loading}>
                                                    Deactivate
                                                </button>
                                            )}
                                            {isSuperUser && !admin.is_active && (
                                                <button onClick={() => activateAdmin(admin.id)} className="btn-activate" disabled={loading}>
                                                    Activate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'volunteers' && (
                    <div className="admins-section volunteer-management">
                        <div className="form-section group-master-form">
                            <h3>{editingGroupId ? 'Update Group Master' : 'Create Group Master'}</h3>
                            <div className="form-group group-form-group">
                                <div className="group-form-fields">
                                    <label>Group name <span className="required-mark">*</span><input type="text" placeholder="Enter group name" value={groupFormData.group_name || ''} onChange={(e) => setGroupFormData({ ...groupFormData, group_name: e.target.value })} /></label>
                                    {[['adhyaksha', 'Adhyaksha'], ['khajindar', 'Khajindar'], ['upadhyaksha', 'Upadhyaksha'], ['sachiv', 'Sachiv'], ['upasachiv', 'Upasachiv']].map(([role, label]) => (
                                        <label key={role}>{label}
                                            <select value={groupFormData[`${role}_volunteer_id`] || ''} onChange={(e) => setGroupFormData({ ...groupFormData, [`${role}_volunteer_id`]: e.target.value })}>
                                                <option value="">Select volunteer</option>
                                                {volunteers.filter((volunteer) => volunteer.is_active).map((volunteer) => (
                                                    <option key={volunteer.volunteer_id} value={volunteer.volunteer_id}>{volunteer.volunteer_name}</option>
                                                ))}
                                            </select>
                                        </label>
                                    ))}
                                    {editingGroupId && (
                                        <label className="checkbox-label">
                                            <input type="checkbox" checked={groupFormData.is_active !== false} onChange={(e) => setGroupFormData({ ...groupFormData, is_active: e.target.checked })} />
                                            Active group
                                        </label>
                                    )}
                                </div>
                                <div className="group-form-actions">
                                    <button onClick={saveGroup} className="btn-primary" disabled={loading || !groupFormData.group_name}>Save Group</button>
                                    {editingGroupId && <button onClick={() => { setGroupFormData({}); setEditingGroupId(null); }} className="btn-secondary">Cancel</button>}
                                </div>
                            </div>
                        </div>

                        <table className="admin-table group-list-table">
                            <thead>
                                <tr>
                                    <th>Group</th>
                                    <th>Adhyaksha</th>
                                    <th>Khajindar</th>
                                    <th>Upadhyaksha</th>
                                    <th>Sachiv</th>
                                    <th>Upasachiv</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((group) => (
                                    <tr key={group.group_id}>
                                        <td>{group.group_name}</td>
                                        <td>{group.adhyaksha_name || '-'}</td>
                                        <td>{group.khajindar_name || '-'}</td>
                                        <td>{group.upadhyaksha_name || '-'}</td>
                                        <td>{group.sachiv_name || '-'}</td>
                                        <td>{group.upasachiv_name || '-'}</td>
                                        <td className={`status ${group.is_active ? 'active' : 'inactive'}`}>{group.is_active ? 'Active' : 'Inactive'}</td>
                                        <td className="actions">
                                            <button onClick={() => editVolunteerGroup(group)} className="btn-primary" disabled={loading}>Edit</button>
                                            <button onClick={() => setDeleteGroupDialog(group)} className="btn-deactivate" disabled={loading}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="form-section volunteer-create-form">
                            <h3>{editingVolunteerId ? 'Update Volunteer' : 'Create Volunteer'}</h3>
                            <div className="volunteer-form-layout">
                                <div className="volunteer-photo-panel">
                                    <div className="volunteer-photo-frame">
                                        {volunteerPhotoPreview ? (
                                            <img src={volunteerPhotoPreview} alt="Volunteer preview" />
                                        ) : (
                                            <span>No photo selected</span>
                                        )}
                                    </div>
                                    <label>Volunteer photo<input key={volunteerPhotoInputKey} type="file" accept="image/*" onChange={(e) => setVolunteerFormData({ ...volunteerFormData, photo: e.target.files?.[0] || null, photo_preview_url: e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : '', photo_url_existing: volunteerFormData.photo_url_existing || '' })} /></label>
                                </div>
                                <div className="volunteer-form-fields">
                                    <label>Volunteer name <span className="required-mark">*</span><input type="text" placeholder="Enter volunteer name" value={volunteerFormData.volunteer_name || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, volunteer_name: e.target.value })} /></label>
                                    <label>Main profession<input type="text" placeholder="Enter main profession" value={volunteerFormData.main_profession || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, main_profession: e.target.value })} /></label>
                                    <label>Email<input type="email" placeholder="Enter email address" value={volunteerFormData.email || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, email: e.target.value })} /></label>
                                    <label>Address<input type="text" placeholder="Enter address" value={volunteerFormData.address || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, address: e.target.value })} /></label>
                                    <label>WhatsApp number<input type="text" placeholder="Enter WhatsApp number" value={volunteerFormData.whatsapp_number || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, whatsapp_number: e.target.value })} /></label>
                                    <label>Birth date<input type="date" value={volunteerFormData.birthdate || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, birthdate: e.target.value })} /></label>
                                    <label>Volunteer group<select value={volunteerFormData.group_id || ''} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, group_id: e.target.value })}>
                                        <option value="">Select group</option>
                                        {groups.filter((group) => !!group.is_active).map((group) => (
                                            <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
                                        ))}
                                    </select></label>
                                    {editingVolunteerId && (
                                        <label className="checkbox-label">
                                            <input type="checkbox" checked={volunteerFormData.is_active !== false} onChange={(e) => setVolunteerFormData({ ...volunteerFormData, is_active: e.target.checked })} />
                                            Active volunteer
                                        </label>
                                    )}
                                </div>
                                <div className="volunteer-form-actions">
                                    {editingVolunteerId ? (
                                        <>
                                            <button onClick={() => updateVolunteer(editingVolunteerId)} className="btn-primary" disabled={loading}>Save Volunteer</button>
                                            <button onClick={() => { setVolunteerFormData({}); setEditingVolunteerId(null); }} className="btn-secondary">Cancel</button>
                                            <button onClick={() => setDeleteVolunteerDialog(volunteers.find((volunteer) => String(volunteer.volunteer_id) === String(editingVolunteerId)))} className="btn-deactivate" disabled={loading}>Delete Volunteer</button>
                                        </>
                                    ) : (
                                        <button onClick={createVolunteer} className="btn-primary" disabled={loading || !volunteerFormData.volunteer_name}>Create Volunteer</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="volunteer-search-bar">
                            <label htmlFor="volunteer-search">Search volunteers</label>
                            <input
                                id="volunteer-search"
                                type="search"
                                value={volunteerSearch}
                                onChange={(event) => setVolunteerSearch(event.target.value)}
                                placeholder="Type name, email or phone number..."
                            />
                            <span>{filteredVolunteers.length} of {volunteers.length} volunteers</span>
                        </div>

                        <table className="admin-table volunteer-list-table">
                            <thead>
                                <tr>
                                    <th>Photo</th>
                                    <th>Name</th>
                                    <th>Profession</th>
                                    <th>Group</th>
                                    <th>WhatsApp</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVolunteers.map((v) => (
                                    <tr key={v.volunteer_id}>
                                        <td>
                                            {v.photo_url ? (
                                                <img
                                                    src={versionedAssetUrl(v.photo_url, v.update_date)}
                                                    alt={`${v.volunteer_name || 'Volunteer'} photo`}
                                                    className="volunteer-table-photo"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <span className="volunteer-table-avatar">
                                                    {(v.volunteer_name || 'V').trim().charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </td>
                                        <td>{v.volunteer_name}</td>
                                        <td>{v.main_profession || '-'}</td>
                                        <td>{v.group_name || '-'}</td>
                                        <td>{v.whatsapp_number}</td>
                                        <td className={`status ${v.is_active ? 'active' : 'inactive'}`}>{v.is_active ? 'Active' : 'Inactive'}</td>
                                        <td className="actions">
                                            <button
                                                onClick={() => {
                                                    setVolunteerFormData({
                                                        volunteer_name: v.volunteer_name,
                                                        main_profession: v.main_profession || '',
                                                        email: v.email || '',
                                                        address: v.address || '',
                                                        whatsapp_number: v.whatsapp_number || '',
                                                        birthdate: v.birthdate ? new Date(v.birthdate).toISOString().split('T')[0] : '',
                                                        group_id: v.group_id || '',
                                                        photo_url_existing: v.photo_url || '',
                                                        photo_version: v.update_date || '',
                                                        is_active: !!v.is_active
                                                    });
                                                    setEditingVolunteerId(v.volunteer_id);
                                                }}
                                                className="btn-primary"
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredVolunteers.length === 0 && (
                                    <tr><td colSpan="6" className="volunteer-search-empty">No volunteers match this search.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'teams' && (
                    <div className="admins-section">
                        <div className="team-management-layout">
                        <div className="form-section team-create-section">
                            <h3>{editingTeamId ? 'Edit Team' : 'Create Team'}</h3>
                            <div className="form-group team-create-form">
                                <label>Team name <span className="required-mark">*</span><input type="text" placeholder="Enter team name" value={teamFormData.team_name || ''} onChange={(e) => setTeamFormData({ ...teamFormData, team_name: e.target.value })} /></label>
                                <div className="team-create-actions">
                                    <button onClick={editingTeamId ? saveTeamName : createTeam} className="btn-primary" disabled={loading || !teamFormData.team_name}>{editingTeamId ? 'Save Team' : 'Create Team'}</button>
                                    {editingTeamId && <>
                                        <button type="button" className="btn-secondary" onClick={() => { setEditingTeamId(null); setTeamFormData({}); }}>Cancel</button>
                                        <button type="button" className="btn-deactivate" onClick={() => setTeamDeleteDialogOpen(true)} disabled={loading}>Delete Team</button>
                                    </>}
                                </div>
                                {teamDeleteDialogOpen && (
                                    <div className="admin-dialog-backdrop" role="presentation" onClick={() => setTeamDeleteDialogOpen(false)}>
                                        <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-team-dialog-title" onClick={(event) => event.stopPropagation()}>
                                            <h3 id="delete-team-dialog-title">Delete team?</h3>
                                            <p>This will remove <strong>{teamFormData.team_name}</strong> and its volunteer assignments.</p>
                                            <div className="admin-dialog-actions">
                                                <button type="button" className="btn-secondary" onClick={() => setTeamDeleteDialogOpen(false)} disabled={loading}>Cancel</button>
                                                <button type="button" className="btn-deactivate" onClick={deleteTeam} disabled={loading}>Delete Team</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!editingTeamId && <div className="team-name-list">
                                {teams.filter((team) => !!team.is_active).map((team) => (
                                    <div className="team-name-row" key={team.team_id}>
                                        <span>{team.team_name}</span>
                                        <button type="button" className="btn-secondary" onClick={() => startTeamEdit(team)} disabled={loading}>Edit</button>
                                    </div>
                                ))}
                            </div>}
                        </div>

                        <div className="form-section team-assignment-section">
                            <h3 className="team-assignment-title">Assign Volunteer To Team</h3>
                            <div className="team-assignment-toolbar">
                                <label>Select team<select value={selectedAssignmentTeamId} onChange={(e) => selectAssignmentTeam(e.target.value)}>
                                    <option value="">Choose a team</option>
                                    {teams.filter((tm) => !!tm.is_active).map((tm) => (
                                        <option key={tm.team_id} value={tm.team_id}>{tm.team_name}</option>
                                    ))}
                                </select></label>
                                <button type="button" className="btn-secondary team-reset-button" onClick={resetAssignmentSelection} disabled={loading}>Reset</button>
                            </div>
                            <div className="team-assignment-board">
                                <div className="team-member-panel">
                                    <div className="team-member-panel-header">
                                        <h4>Available volunteers</h4>
                                        <span>{availableAssignmentVolunteers.length}</span>
                                    </div>
                                    <input
                                        type="search"
                                        aria-label="Search available volunteers"
                                        placeholder="Search volunteers..."
                                        value={assignmentSearch}
                                        onChange={(e) => setAssignmentSearch(e.target.value)}
                                    />
                                    <div className="team-member-list">
                                        {availableAssignmentVolunteers.map((volunteer) => (
                                            <button
                                                type="button"
                                                key={volunteer.volunteer_id}
                                                className={`team-member-option ${String(assignmentFormData.volunteer_id) === String(volunteer.volunteer_id) ? 'selected' : ''}`}
                                                onClick={() => setAssignmentFormData({ ...assignmentFormData, volunteer_id: volunteer.volunteer_id })}
                                                onDoubleClick={() => addAssignmentToDraft(volunteer.volunteer_id)}
                                                disabled={!selectedAssignmentTeamId || loading}
                                            >
                                                <span>{volunteer.volunteer_name}</span>
                                                <small>{volunteer.whatsapp_number || volunteer.email || 'Volunteer'}</small>
                                            </button>
                                        ))}
                                        {availableAssignmentVolunteers.length === 0 && <p className="team-member-empty">No available volunteers.</p>}
                                    </div>
                                </div>
                                <div className="team-assignment-controls">
                                    <button type="button" className="team-assign-button" onClick={() => addAssignmentToDraft(assignmentFormData.volunteer_id)} disabled={loading || !selectedAssignmentTeamId || !assignmentFormData.volunteer_id} aria-label="Add volunteer to team" title="Add volunteer to team">&gt;</button>
                                    <button type="button" className="team-assign-button reverse" onClick={() => {
                                        if (assignmentFormData.volunteer_id) removeAssignmentFromDraft(assignmentFormData.volunteer_id);
                                    }} disabled={loading || !assignmentFormData.volunteer_id} aria-label="Remove volunteer from team" title="Remove volunteer from team">&lt;</button>
                                </div>
                                <div className="team-member-panel assigned">
                                    <div className="team-member-panel-header">
                                        <h4>{teams.find((team) => String(team.team_id) === String(selectedAssignmentTeamId))?.team_name || 'Selected team'} members</h4>
                                        <span>{assignmentDraft.length}</span>
                                    </div>
                                    <input
                                        type="search"
                                        aria-label="Search selected team members"
                                        placeholder="Search team members..."
                                        value={teamMemberSearch}
                                        onChange={(e) => setTeamMemberSearch(e.target.value)}
                                    />
                                    <div className="team-member-list">
                                        {!selectedAssignmentTeamId && <p className="team-member-empty">Choose a team to view its members.</p>}
                                        {filteredSelectedTeamAssignments.map((assignment) => (
                                            <div className="team-member-assigned" key={assignment.assignment_id || `${assignment.team_id}-${assignment.volunteer_id}`}>
                                                <button type="button" className="team-member-assigned-select" onDoubleClick={() => removeAssignmentFromDraft(assignment.volunteer_id)} onClick={() => setAssignmentFormData((current) => ({ ...current, volunteer_id: assignment.volunteer_id, is_team_lead: !!assignment.is_team_lead, is_team_manager: !!assignment.is_team_manager }))} title="Double-click to remove from team">
                                                    <span>{assignment.volunteer_name || assignment.volunteer_id}</span>
                                                </button>
                                                <small>{assignment.is_team_lead ? 'Team Lead' : assignment.is_team_manager ? 'Team Manager' : 'Member'}</small>
                                            </div>
                                        ))}
                                        {selectedAssignmentTeamId && assignmentDraft.length === 0 && <p className="team-member-empty">No volunteers assigned yet.</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="team-save-actions">
                                <button type="button" className="btn-primary team-save-button" onClick={saveTeamAssignments} disabled={loading || !selectedAssignmentTeamId || !assignmentDirty}>Save Team</button>
                                <button type="button" className="btn-secondary" onClick={cancelTeamAssignmentChanges} disabled={loading || !selectedAssignmentTeamId || !assignmentDirty}>Cancel</button>
                            </div>
                        </div>
                        </div>

                    </div>
                )}

                {deleteGroupDialog && (
                    <div className="admin-dialog-backdrop" role="presentation" onClick={() => setDeleteGroupDialog(null)}>
                        <div className="admin-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                            <h3>Delete group?</h3>
                            <p>This will delete <strong>{deleteGroupDialog.group_name}</strong>.</p>
                            <div className="admin-dialog-actions">
                                <button type="button" className="btn-secondary" onClick={() => setDeleteGroupDialog(null)} disabled={loading}>Cancel</button>
                                <button type="button" className="btn-deactivate" onClick={deleteGroup} disabled={loading}>Delete Group</button>
                            </div>
                        </div>
                    </div>
                )}
                {deleteVolunteerDialog && (
                    <div className="admin-dialog-backdrop" role="presentation" onClick={() => setDeleteVolunteerDialog(null)}>
                        <div className="admin-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                            <h3>Delete volunteer?</h3>
                            <p>This will delete <strong>{deleteVolunteerDialog.volunteer_name}</strong> and remove team assignments.</p>
                            <div className="admin-dialog-actions">
                                <button type="button" className="btn-secondary" onClick={() => setDeleteVolunteerDialog(null)} disabled={loading}>Cancel</button>
                                <button type="button" className="btn-deactivate" onClick={deleteVolunteer} disabled={loading}>Delete Volunteer</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="logs-section">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Table</th>
                                    <th>Record ID</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.slice(0, 50).map(log => (
                                    <tr key={log.id}>
                                        <td>{log.first_name} {log.last_name}</td>
                                        <td>{log.action}</td>
                                        <td>{log.table_name}</td>
                                        <td>{log.record_id}</td>
                                        <td>{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'sftp' && isSuperUser && (
                    <div className="form-section">
                        <p>Configure the server used for secure file transfers. Credentials are encrypted before storage.</p>
                        <div className="form-grid">
                            <label>Host<input value={sftpFormData.host} onChange={(event) => updateSftp('host', event.target.value)} placeholder="sftp.example.com" /></label>
                            <label>Port<input type="number" min="1" max="65535" value={sftpFormData.port} onChange={(event) => updateSftp('port', event.target.value)} /></label>
                            <label>Username<input value={sftpFormData.username} onChange={(event) => updateSftp('username', event.target.value)} /></label>
                            <label>Authentication<select value={sftpFormData.auth_method} onChange={(event) => updateSftp('auth_method', event.target.value)}><option value="password">Password</option><option value="private_key">Private key</option></select></label>
                            <label>Remote path<input value={sftpFormData.remote_path} onChange={(event) => updateSftp('remote_path', event.target.value)} /></label>
                            {sftpFormData.auth_method === 'password' ? (
                                <label>Password {sftpSecretStatus.password_configured && <small>(configured, leave blank to keep)</small>}<input type="password" value={sftpFormData.password} onChange={(event) => updateSftp('password', event.target.value)} autoComplete="new-password" /></label>
                            ) : (
                                <label>Private key {sftpSecretStatus.private_key_configured && <small>(configured, leave blank to keep)</small>}<textarea value={sftpFormData.private_key} onChange={(event) => updateSftp('private_key', event.target.value)} rows="6" /></label>
                            )}
                        </div>
                        <label className="checkbox-label"><input type="checkbox" checked={!!sftpFormData.is_enabled} onChange={(event) => updateSftp('is_enabled', event.target.checked)} /> Enable SFTP</label>
                        <div className="actions"><button className="btn-secondary" onClick={testSftp} disabled={loading}>Test Connection</button><button className="btn-primary" onClick={saveSftp} disabled={loading}>Save Settings</button></div>
                    </div>
                )}
                </>
                )}
                </div>
            </main>
        </div>
    );
};

export default AdminPanel;
