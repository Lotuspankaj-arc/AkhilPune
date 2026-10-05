(async ()=>{
  try{
    const payload = {
      firstName: 'UpdatedAuto',
      lastName: 'User',
      mobile: '9999999999',
      city: 'Mumbai'
    };
    const API_BASE = process.env.VITE_API_BASE || process.env.API_BASE || 'http://localhost:5000';
    const res = await fetch(`${API_BASE}/api/update/7`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log(text);
  } catch (e) { console.error('ERR', e); }
})();
