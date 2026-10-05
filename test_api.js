import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testAPI() {
  console.log('🧪 Starting API Tests\n');

  const tests = [
    {
      name: 'Get Client 1 (Pune)',
      url: `${BASE_URL}/api/clients/1`,
      method: 'GET'
    },
    {
      name: 'Get Event 1',
      url: `${BASE_URL}/api/events/1`,
      method: 'GET'
    },
    {
      name: 'Candidate Lookup (non-existent)',
      url: `${BASE_URL}/api/candidates/lookup?mobile=9999999999`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    console.log(`📝 TEST: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    try {
      const response = await fetch(test.url, {
        method: test.method
      });
      console.log(`   Status: ${response.status}`);
      const data = await response.json();
      console.log('   Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('✅ API Tests Complete');
}

testAPI();
