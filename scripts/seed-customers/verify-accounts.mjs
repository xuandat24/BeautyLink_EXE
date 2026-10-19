import { readFileSync } from 'node:fs';

const [baseUrl, manifestPath, credentialPath] = process.argv.slice(2);
if (!baseUrl || !manifestPath || !credentialPath) {
  throw new Error('Usage: node verify-accounts.mjs <loopback-api-url> <manifest.psv> <private-credentials.psv>');
}
const endpoint = new URL(baseUrl);
const internalHost = process.env.CUSTOMER_SEED_TEST_HOST;
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
const isolatedDocker = internalHost?.startsWith('beautylink-customer-api-')
  && endpoint.hostname === internalHost && endpoint.protocol === 'http:';
if (!loopback && !isolatedDocker) {
  throw new Error('Account verification is restricted to a loopback or named isolated Docker test API');
}
const lines = (path) => readFileSync(path, 'utf8').trimEnd().split(/\r?\n/);
const manifest = lines(manifestPath).slice(1).map((line) => line.split('|'));
const credentials = lines(credentialPath).slice(1).map((line) => line.split('|'));
if (manifest.length !== 80 || credentials.length !== 80) throw new Error('Expected exactly 80 accounts');

const call = async (path, options = {}) => {
  const response = await fetch(new URL(path, endpoint), {
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
};

const login = (identifier, password) => call('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier, password }),
});

const ids = new Set();
let logins = 0;
let profiles = 0;
let bookingReads = 0;
for (let i = 0; i < 80; i++) {
  const [index, name, phone, email, gender, dateOfBirth] = manifest[i];
  const [credentialIndex, credentialEmail, password] = credentials[i];
  if (index !== String(i + 1) || credentialIndex !== index || credentialEmail !== email) {
    throw new Error(`Manifest and credential file differ at row ${i + 1}`);
  }
  try {
    const first = await login(email, password);
    if (!first.accessToken || first.user?.role !== 'CUSTOMER') throw new Error('login did not issue a CUSTOMER token');
    logins++;
    const auth = { headers: { Authorization: `Bearer ${first.accessToken}` } };
    const me = await call('/api/v1/auth/me', auth);
    if (me.id !== first.user.id || me.fullName !== name || me.phone !== phone
      || me.email !== email || me.gender !== gender || me.dateOfBirth !== dateOfBirth
      || me.role !== 'CUSTOMER' || ids.has(me.id)) {
      throw new Error('profile identity or attributes differ');
    }
    ids.add(me.id);
    profiles++;
    const bookings = await call('/api/v1/bookings/mine', auth);
    const history = await call('/api/v1/bookings/mine/history-status', auth);
    if (!Array.isArray(bookings) || bookings.length !== 0 || history.hasPreviousBooking !== false) {
      throw new Error('new customer booking history is not empty');
    }
    bookingReads++;
    const second = await login(phone, password);
    if (!second.accessToken || second.user?.id !== me.id) throw new Error('fresh phone login failed');
    logins++;
    const secondMe = await call('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${second.accessToken}` },
    });
    if (secondMe.id !== me.id) throw new Error('fresh session identity differs');
    profiles++;
  } catch (error) {
    throw new Error(`Account row ${i + 1} verification failed: ${error.message}`);
  }
}
const anonymous = await fetch(new URL('/api/v1/auth/me', endpoint));
if (anonymous.status !== 401) throw new Error('Anonymous profile endpoint was not protected');
console.log(JSON.stringify({
  accounts: ids.size,
  successfulLogins: logins,
  matchingProfileReads: profiles,
  emptyCustomerBookingHistories: bookingReads,
  anonymousProfileDenied: true,
}));
