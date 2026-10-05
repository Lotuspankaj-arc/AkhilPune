(async ()=>{
  try{
    const API_BASE = process.env.VITE_API_BASE || process.env.API_BASE || 'http://localhost:5000';
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'autotest+1@example.com', password: 'secret123' })
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log(text);
  } catch (e) { console.error('ERR', e); }
})();
