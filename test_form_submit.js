/**
 * Automated form fill and submission test
 * Tests the multi-tenant registration flow
 */
async function testFormSubmission() {
  console.log('🎯 Testing Form Submission\n');

  // Test data
  const testData = {
    mobile_number: '9876543210',
    first_name: 'Aarav',
    middle_name: 'Kumar',
    last_name: 'Sharma',
    gender: 'Groom',
    marriage_type: 'First Marriage',
    email: 'aarav@example.com',
    whatsapp: '9876543210',
    birth_date: '1995-05-15',
    birth_place: 'Delhi',
    height: '5\'10"',
    complexion: 'Fair',
    blood_group: 'O+',
    qualification: 'Bachelor of Technology',
    education_details: 'IIT Delhi',
    job_title: 'Software Engineer',
    job_location: 'Bangalore',
    annual_income: '1500000',
    gotra: 'Bharadwaj',
    address: '123 MG Road, Bangalore',
    pincode: '560001',
    city: 'Bangalore',
    district: 'Bengaluru Urban',
    state: 'Karnataka'
  };

  // Fill form fields by injecting data into the page
  await new Promise(resolve => {
    const script = document.createElement('script');
    script.textContent = `
      // Get all input fields
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="date"]');
      const selects = document.querySelectorAll('select');
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      
      // Fill text inputs
      const fieldsToFill = {
        'mobile_number': '9876543210',
        'first_name': 'Aarav',
        'middle_name': 'Kumar',
        'last_name': 'Sharma',
        'email': 'aarav@example.com',
        'whatsapp': '9876543210',
        'birth_date': '1995-05-15',
        'birth_place': 'Delhi',
        'height': '5\\'10\\"',
        'qualification': 'Bachelor of Technology',
        'education_details': 'IIT Delhi',
        'job_title': 'Software Engineer',
        'job_location': 'Bangalore',
        'annual_income': '1500000',
        'gotra': 'Bharadwaj',
        'address': '123 MG Road, Bangalore',
        'pincode': '560001',
        'city': 'Bangalore',
        'district': 'Bengaluru Urban',
        'state': 'Karnataka'
      };
      
      inputs.forEach(input => {
        const name = input.getAttribute('name');
        if (fieldsToFill[name]) {
          input.value = fieldsToFill[name];
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      // Fill selects
      const selectsToFill = {
        'gender': 'Groom',
        'marriage_type': 'First Marriage',
        'complexion': 'Fair',
        'blood_group': 'O+'
      };
      
      selects.forEach(select => {
        const name = select.getAttribute('name');
        if (selectsToFill[name]) {
          select.value = selectsToFill[name];
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      // Check terms and conditions
      checkboxes.forEach(checkbox => {
        const label = checkbox.nextElementSibling?.textContent;
        if (label && label.includes('terms and conditions')) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      window.formTestComplete = true;
      console.log('✅ Form fields filled');
    `;
    document.body.appendChild(script);
    setTimeout(resolve, 500);
  });
  
  return true;
}

// Run the test
testFormSubmission().then(() => {
  console.log('✅ Form fill test completed');
  
  // Try to submit the form
  const submitButton = document.querySelector('button:contains("Register Now")') || 
                      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Register Now'));
  
  if (submitButton) {
    console.log('📝 Found submit button, submitting form...');
    submitButton.click();
  } else {
    console.log('⚠️  Submit button not found');
  }
}).catch(error => {
  console.error('❌ Error:', error);
});
