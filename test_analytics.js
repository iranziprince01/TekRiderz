const fetch = require('node-fetch');

async function testAnalytics() {
  try {
    console.log('Testing analytics endpoints...');
    
    // Test admin analytics endpoint
    console.log('\n1. Testing admin analytics endpoint...');
    const adminResponse = await fetch('http://localhost:3000/api/v1/analytics/admin', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Admin analytics status:', adminResponse.status);
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log('Admin analytics data:', JSON.stringify(adminData, null, 2));
    } else {
      const errorText = await adminResponse.text();
      console.log('Admin analytics error:', errorText);
    }
    
    // Test tutor analytics endpoint
    console.log('\n2. Testing tutor analytics endpoint...');
    const tutorResponse = await fetch('http://localhost:3000/api/v1/analytics/tutor', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Tutor analytics status:', tutorResponse.status);
    if (tutorResponse.ok) {
      const tutorData = await tutorResponse.json();
      console.log('Tutor analytics data:', JSON.stringify(tutorData, null, 2));
    } else {
      const errorText = await tutorResponse.text();
      console.log('Tutor analytics error:', errorText);
    }
    
  } catch (error) {
    console.error('Error testing analytics:', error);
  }
}

testAnalytics(); 