import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testRegistrationFlow() {
  console.log('🎯 Testing Full Registration Flow\n');

  try {
    // Step 1: Create an event
    console.log('📝 Step 1: Create Event for Client 1');
    const eventResponse = await fetch(`${BASE_URL}/api/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 1,
        event_name: 'Pune Matrimony Meet 2024',
        event_date_from: '2024-12-15',
        event_date_to: '2024-12-17',
        venue: 'The Orchid Hotel, Pune',
        banner_url: 'https://example.com/banner.jpg',
        is_active: true,
        admin_id: 1
      })
    });
    const eventData = await eventResponse.json();
    console.log(`   Status: ${eventResponse.status}`);
    console.log('   Response:', JSON.stringify(eventData, null, 2));
    const eventId = eventData.data?.event_id || 1;
    console.log('');

    // Step 2: Register a new candidate
    console.log('📝 Step 2: Register New Candidate');
    const candidateForm = new FormData();
    candidateForm.append('mobile_number', '9876543210');
    candidateForm.append('first_name', 'Aarav');
    candidateForm.append('middle_name', 'Kumar');
    candidateForm.append('last_name', 'Sharma');
    candidateForm.append('email', 'aarav@example.com');
    candidateForm.append('gender', 'Male');
    candidateForm.append('marriage_type', 'Hindu');
    candidateForm.append('birth_date', '1995-05-15');
    candidateForm.append('birth_place', 'Delhi');
    candidateForm.append('height', '5.10');
    candidateForm.append('education_qualification', 'Bachelor of Technology');
    candidateForm.append('education_details', 'IIT Delhi');
    candidateForm.append('job_business_title', 'Software Engineer');
    candidateForm.append('annual_income', '1500000');
    candidateForm.append('job_business_location', 'Bangalore');
    candidateForm.append('complexion', 'Fair');
    candidateForm.append('blood_group', 'O+');
    candidateForm.append('gotra', 'Bharadwaj');
    candidateForm.append('candidate_profile', 'Seeking a life partner');
    candidateForm.append('address', '123 MG Road, Bangalore');
    candidateForm.append('city', 'Bangalore');
    candidateForm.append('state', 'Karnataka');
    candidateForm.append('country', 'India');
    candidateForm.append('postal_code', '560001');
    candidateForm.append('event_id', eventId);
    candidateForm.append('client_id', 1);

    const registerResponse = await fetch(`${BASE_URL}/api/candidates/register`, {
      method: 'POST',
      body: candidateForm
    });
    const registerData = await registerResponse.json();
    console.log(`   Status: ${registerResponse.status}`);
    console.log('   Response:', JSON.stringify(registerData, null, 2));
    console.log('');

    // Step 3: Lookup the candidate
    console.log('📝 Step 3: Lookup Registered Candidate');
    const lookupResponse = await fetch(`${BASE_URL}/api/candidates/lookup?mobile=9876543210`);
    const lookupData = await lookupResponse.json();
    console.log(`   Status: ${lookupResponse.status}`);
    console.log('   Response:', JSON.stringify(lookupData, null, 2));
    console.log('');

    console.log('✅ Registration Flow Tests Complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRegistrationFlow();
