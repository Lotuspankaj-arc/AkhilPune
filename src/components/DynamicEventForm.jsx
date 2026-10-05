import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DynamicEventForm.css';

/**
 * DynamicEventForm Component
 * 
 * Purpose: Multi-tenant event registration form accessible via /register/:clientId/:eventId
 * 
 * Features:
 * - Dynamically fetch and display event details and client branding
 * - Display client banner and event information
 * - Smart auto-fill: If candidate's mobile number exists, fetch their profile
 * - Link existing candidates to new events (prevent duplicates)
 * - Support for both new registrations and profile updates
 * 
 * Architecture:
 * - Fetches event & client data to build dynamic UI
 * - Cross-event candidate linking via phone number lookup
 * - Proper subscription tracking for 6-month access window
 */

const DynamicEventForm = () => {
  const { clientId, eventId } = useParams();
  const navigate = useNavigate();

  // State for event and client data
  const [eventData, setEventData] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for form fields
  const [formData, setFormData] = useState({
    mobile_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    gender: '',
    marriage_type: '',
    birth_date: '',
    birth_place: '',
    height: '',
    education_qualification: '',
    education_details: '',
    job_business_title: '',
    annual_income: '',
    job_business_location: '',
    complexion: '',
    blood_group: '',
    gotra: '',
    kul: '',
    zodiac: '',
    gan: '',
    nadi: '',
    nakshatra: '',
    charan: '',
    address_line: '',
    pincode: '',
    city_village: '',
    tehsil: '',
    district: '',
    state: '',
    whatsapp_number: '',
    selected_expectations: [],
    other_expectations: '',
    photo: null,
    consent_agreed: false,
  });

  // State for auto-fill and duplicate detection
  const [existingCandidate, setExistingCandidate] = useState(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch event and client data on component mount
  useEffect(() => {
    const fetchEventAndClientData = async () => {
      try {
        setLoading(true);

        // Fetch event details
        const eventRes = await axios.get(
          `/api/events/${eventId}?clientId=${clientId}`
        );
        setEventData(eventRes.data);

        // Fetch client details
        const clientRes = await axios.get(
          `/api/clients/${clientId}`
        );
        setClientData(clientRes.data);

        setError(null);
      } catch (err) {
        console.error('Error fetching event/client data:', err);
        setError(
          err.response?.data?.message || 
          'Failed to load event details. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (clientId && eventId) {
      fetchEventAndClientData();
    }
  }, [clientId, eventId]);

  /**
   * Handle mobile number change and auto-fill if candidate exists
   * This prevents duplicate registrations and links existing profiles to new events
   */
  const handleMobileNumberChange = async (e) => {
    const mobileNumber = e.target.value;
    setFormData((prev) => ({
      ...prev,
      mobile_number: mobileNumber,
    }));

    // If mobile number has 10 digits, search for existing candidate
    if (mobileNumber.length === 10) {
      try {
        setIsAutoFilling(true);
        const res = await axios.get(
          `/api/candidates/lookup?mobile=${mobileNumber}`
        );

        if (res.data && res.data.batch_id) {
          // Found existing candidate - pre-populate form
          setExistingCandidate(res.data);
          setFormData((prev) => ({
            ...prev,
            first_name: res.data.first_name || '',
            middle_name: res.data.middle_name || '',
            last_name: res.data.last_name || '',
            email: res.data.email || '',
            gender: res.data.gender || '',
            birth_date: res.data.birth_date || '',
            birth_place: res.data.birth_place || '',
            height: res.data.height || '',
            education_qualification: res.data.education_qualification || '',
            education_details: res.data.education_details || '',
            job_business_title: res.data.job_business_title || '',
            annual_income: res.data.annual_income || '',
            job_business_location: res.data.job_business_location || '',
            complexion: res.data.complexion || '',
            blood_group: res.data.blood_group || '',
            gotra: res.data.gotra || '',
            kul: res.data.kul || '',
            zodiac: res.data.zodiac || '',
            gan: res.data.gan || '',
            nadi: res.data.nadi || '',
            nakshatra: res.data.nakshatra || '',
            charan: res.data.charan || '',
            address_line: res.data.address_line || '',
            pincode: res.data.pincode || '',
            city_village: res.data.city_village || '',
            tehsil: res.data.tehsil || '',
            district: res.data.district || '',
            state: res.data.state || '',
            whatsapp_number: res.data.whatsapp_number || '',
            selected_expectations: res.data.selected_expectations || [],
          }));
        } else {
          setExistingCandidate(null);
        }
      } catch (err) {
        console.error('Error looking up candidate:', err);
        setExistingCandidate(null);
      } finally {
        setIsAutoFilling(false);
      }
    } else {
      setExistingCandidate(null);
    }
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  /**
   * Handle photo upload
   */
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        photo: file,
      }));
    }
  };

  /**
   * Handle expectations (multi-select)
   */
  const handleExpectationsChange = (e) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const expectations = prev.selected_expectations || [];
      if (checked) {
        return {
          ...prev,
          selected_expectations: [...expectations, value],
        };
      } else {
        return {
          ...prev,
          selected_expectations: expectations.filter((exp) => exp !== value),
        };
      }
    });
  };

  /**
   * Handle form submission
   * - New candidate: Create registration and subscription
   * - Existing candidate: Link to event via candidate_event_registrations
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.consent_agreed) {
      alert('Please agree to the terms and conditions');
      return;
    }

    try {
      setFormSubmitting(true);

      const formDataPayload = new FormData();
      
      // Add all form fields
      Object.keys(formData).forEach((key) => {
        if (key === 'photo' && formData.photo) {
          formDataPayload.append('photo', formData.photo);
        } else if (key === 'selected_expectations') {
          formDataPayload.append(key, JSON.stringify(formData.selected_expectations));
        } else if (key !== 'photo') {
          formDataPayload.append(key, formData[key]);
        }
      });

      formDataPayload.append('event_id', eventId);
      formDataPayload.append('client_id', clientId);
      formDataPayload.append('batch_id', existingCandidate?.batch_id || '');

      const endpoint = existingCandidate
        ? `/api/candidates/${existingCandidate.batch_id}/link-event`
        : '/api/candidates/register';

      const res = await axios.post(endpoint, formDataPayload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.status === 201 || res.status === 200) {
        alert(
          existingCandidate
            ? 'Successfully linked to event! Your profile is now visible in this event.'
            : 'Registration successful! You can now browse profiles.'
        );
        
        // Redirect to candidate browsing feed
        navigate(`/browse/${clientId}/${eventId}`);
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      alert(
        err.response?.data?.message || 
        'Error submitting form. Please try again.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="form-container loading">
        <div className="spinner">Loading event details...</div>
      </div>
    );
  }

  // Error state
  if (error || !eventData) {
    return (
      <div className="form-container error">
        <div className="error-message">
          <h2>Error Loading Event</h2>
          <p>{error || 'Event not found'}</p>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      {/* Client Header Section */}
      <div className="form-header">
        {eventData.banner_url && (
          <div className="banner-section">
            <img 
              src={eventData.banner_url} 
              alt="Event Banner" 
              className="event-banner"
            />
          </div>
        )}
        
        <div className="client-info">
          <h1>{clientData?.client_name}</h1>
          <div className="event-details">
            <h2>{eventData.event_name}</h2>
            <p>
              <strong>Venue:</strong> {eventData.venue}
            </p>
            <p>
              <strong>Event Date:</strong> {new Date(eventData.start_date).toLocaleDateString()} - {new Date(eventData.end_date).toLocaleDateString()}
            </p>
            {eventData.organizer_name && (
              <p>
                <strong>Organizer:</strong> {eventData.organizer_name} ({eventData.organizer_phone})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Section */}
      <form onSubmit={handleSubmit} className="dynamic-form">
        <div className="form-section">
          <h3>Personal Information</h3>

          {/* Existing Candidate Alert */}
          {existingCandidate && (
            <div className="alert alert-info">
              <strong>Welcome back!</strong> We found your profile. 
              Your information has been pre-filled. You're now registering for{' '}
              <strong>{eventData.event_name}</strong>.
            </div>
          )}

          {/* Mobile Number - Key field for auto-fill */}
          <div className="form-group">
            <label htmlFor="mobile_number">
              Mobile Number <span className="required">*</span>
            </label>
            <input
              type="tel"
              id="mobile_number"
              name="mobile_number"
              value={formData.mobile_number}
              onChange={handleMobileNumberChange}
              placeholder="10-digit mobile number"
              maxLength="10"
              pattern="[0-9]{10}"
              required
              disabled={isAutoFilling}
            />
            {isAutoFilling && <span className="loading-text">Checking...</span>}
          </div>

          {/* Name Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name <span className="required">*</span></label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="middle_name">Middle Name</label>
              <input
                type="text"
                id="middle_name"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last Name</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Gender and Marriage Type */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gender">Gender <span className="required">*</span></label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="Bride">Bride</option>
                <option value="Groom">Groom</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="marriage_type">Marriage Type <span className="required">*</span></label>
              <select
                id="marriage_type"
                name="marriage_type"
                value={formData.marriage_type}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Marriage Type</option>
                <option value="First">First Marriage</option>
                <option value="Remarriage">Remarriage</option>
                <option value="Divorcee">Divorcee</option>
              </select>
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>

          {/* Contact Numbers */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="whatsapp_number">WhatsApp Number</label>
              <input
                type="tel"
                id="whatsapp_number"
                name="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={handleInputChange}
                maxLength="10"
                pattern="[0-9]{10}"
              />
            </div>
          </div>
        </div>

        {/* Personal Details Section */}
        <div className="form-section">
          <h3>Personal Details</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="birth_date">Birth Date</label>
              <input
                type="date"
                id="birth_date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="birth_place">Birth Place</label>
              <input
                type="text"
                id="birth_place"
                name="birth_place"
                value={formData.birth_place}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="height">Height</label>
              <input
                type="text"
                id="height"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                placeholder={'e.g., 5\'6"'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="complexion">Complexion</label>
              <select
                id="complexion"
                name="complexion"
                value={formData.complexion}
                onChange={handleInputChange}
              >
                <option value="">Select Complexion</option>
                <option value="Fair">Fair</option>
                <option value="Wheatish">Wheatish</option>
                <option value="Dusky">Dusky</option>
                <option value="Dark">Dark</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="blood_group">Blood Group</label>
              <select
                id="blood_group"
                name="blood_group"
                value={formData.blood_group}
                onChange={handleInputChange}
              >
                <option value="">Select Blood Group</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="form-group">
            <label htmlFor="photo">Upload Photo</label>
            <input
              type="file"
              id="photo"
              name="photo"
              onChange={handlePhotoUpload}
              accept="image/*"
            />
          </div>
        </div>

        {/* Education & Career Section */}
        <div className="form-section">
          <h3>Education & Career</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="education_qualification">Qualification</label>
              <input
                type="text"
                id="education_qualification"
                name="education_qualification"
                value={formData.education_qualification}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="education_details">Education Details</label>
              <input
                type="text"
                id="education_details"
                name="education_details"
                value={formData.education_details}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="job_business_title">Job/Business Title</label>
              <input
                type="text"
                id="job_business_title"
                name="job_business_title"
                value={formData.job_business_title}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="job_business_location">Job/Business Location</label>
              <input
                type="text"
                id="job_business_location"
                name="job_business_location"
                value={formData.job_business_location}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="annual_income">Annual Income</label>
              <input
                type="text"
                id="annual_income"
                name="annual_income"
                value={formData.annual_income}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Astrological Information Section */}
        <div className="form-section">
          <h3>Astrological Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gotra">Gotra</label>
              <input
                type="text"
                id="gotra"
                name="gotra"
                value={formData.gotra}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="kul">Kul</label>
              <input
                type="text"
                id="kul"
                name="kul"
                value={formData.kul}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="zodiac">Zodiac</label>
              <input
                type="text"
                id="zodiac"
                name="zodiac"
                value={formData.zodiac}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gan">Gan</label>
              <input
                type="text"
                id="gan"
                name="gan"
                value={formData.gan}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="nadi">Nadi</label>
              <input
                type="text"
                id="nadi"
                name="nadi"
                value={formData.nadi}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="nakshatra">Nakshatra</label>
              <input
                type="text"
                id="nakshatra"
                name="nakshatra"
                value={formData.nakshatra}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="charan">Charan</label>
            <input
              type="text"
              id="charan"
              name="charan"
              value={formData.charan}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="form-section">
          <h3>Address Information</h3>

          <div className="form-group">
            <label htmlFor="address_line">Address Line <span className="required">*</span></label>
            <textarea
              id="address_line"
              name="address_line"
              value={formData.address_line}
              onChange={handleInputChange}
              rows="3"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="pincode">Pincode <span className="required">*</span></label>
              <input
                type="text"
                id="pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleInputChange}
                maxLength="6"
                pattern="[0-9]{6}"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="city_village">City/Village</label>
              <input
                type="text"
                id="city_village"
                name="city_village"
                value={formData.city_village}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="tehsil">Tehsil</label>
              <input
                type="text"
                id="tehsil"
                name="tehsil"
                value={formData.tehsil}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="district">District</label>
              <input
                type="text"
                id="district"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="state">State</label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Expectations Section */}
        <div className="form-section">
          <h3>Expectations</h3>

          <div className="expectations-grid">
            {['Educated', 'Employed', 'Settled Abroad', 'Good Height', 'Fair Complexion', 'Similar Culture'].map(
              (exp) => (
                <div key={exp} className="form-group checkbox">
                  <input
                    type="checkbox"
                    id={`exp_${exp}`}
                    value={exp}
                    checked={formData.selected_expectations.includes(exp)}
                    onChange={handleExpectationsChange}
                  />
                  <label htmlFor={`exp_${exp}`}>{exp}</label>
                </div>
              )
            )}
          </div>

          <div className="form-group">
            <label htmlFor="other_expectations">Other Expectations</label>
            <textarea
              id="other_expectations"
              name="other_expectations"
              value={formData.other_expectations}
              onChange={handleInputChange}
              rows="3"
            />
          </div>
        </div>

        {/* Consent Section */}
        <div className="form-section">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="consent_agreed"
              name="consent_agreed"
              checked={formData.consent_agreed}
              onChange={handleInputChange}
              required
            />
            <label htmlFor="consent_agreed">
              I agree to the terms and conditions and privacy policy <span className="required">*</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={formSubmitting}
          >
            {formSubmitting
              ? 'Submitting...'
              : existingCandidate
              ? 'Link to Event'
              : 'Register Now'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default DynamicEventForm;
