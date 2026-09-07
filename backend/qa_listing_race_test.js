const axios = require('axios');
const BASE = 'http://localhost:5000/api';
async function login(email, password) {
  const { data } = await axios.post(`${BASE}/auth/login-email-password`, { email, password });
  return { token: data.token };
}
async function main() {
  const bob = await login('bob.consumer@example.com', 'Password123');
  const carol = await login('carol.consumer@example.com', 'Password123');
  const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

  const [bobRes, carolRes] = await Promise.allSettled([
    axios.post(`${BASE}/trades`, { quantityKWh: 5, tradingType: 'intraday' }, auth(bob.token)),
    axios.post(`${BASE}/trades`, { quantityKWh: 5, tradingType: 'intraday' }, auth(carol.token)),
  ]);
  console.log('bob:', bobRes.status, JSON.stringify(bobRes.value?.data ?? bobRes.reason?.response?.data));
  console.log('carol:', carolRes.status, JSON.stringify(carolRes.value?.data ?? carolRes.reason?.response?.data));

  const bobTradesCreated = (bobRes.value?.data?.trades || []).length;
  const carolTradesCreated = (carolRes.value?.data?.trades || []).length;
  console.log(`bob got ${bobTradesCreated} trade(s), carol got ${carolTradesCreated} trade(s)`);
  if (bobTradesCreated + carolTradesCreated === 1) {
    console.log('✅ FIXED: exactly one of them got the listing, the other correctly got 0 trades (unmatchedKwh instead).');
  } else {
    console.log(`❌ Unexpected: total trades created = ${bobTradesCreated + carolTradesCreated} (expected exactly 1 for a single 5kWh listing).`);
  }
}
main().catch((e) => { console.error('ERR', e.response?.data || e.message); process.exit(1); });
