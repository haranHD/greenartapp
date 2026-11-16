import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { authService } from '../services/auth';
import { mobileApi } from '../services/api';

const originalFetch = globalThis.fetch;
beforeEach(async () => {
  await authService.logout();
  mobileApi.setBaseUrl('https://api.greenart.mock/api/v1');
});
afterEach(() => { globalThis.fetch = originalFetch; });

for (const failure of ['Network request failed', 'Cannot reach server', 'offline']) {
  test(`network failure (${failure}) never creates a signed-in session`, async () => {
    globalThis.fetch = async () => { throw new Error(failure); };
    await assert.rejects(() => authService.loginWithPassword('buyer@example.com', 'password'));
    assert.equal(authService.getState().isAuthenticated, false);
    assert.equal(authService.getAccessToken(), null);
    await assert.rejects(() => authService.completeRegistration('buyer@example.com', 'password', 'invalid'));
    assert.equal(authService.getState().isAuthenticated, false);
    assert.equal(authService.getAccessToken(), null);
  });
}

test('rejected demo credentials never create a local administrator session', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid credentials' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(() => authService.loginWithPassword('admin@greenart.com', 'Admin@123'));
  assert.equal(authService.getState().isAuthenticated, false);
  assert.equal(authService.getState().user, null);
  assert.equal(authService.getAccessToken(), null);
});

test('server OTP rejection is propagated to the registration flow', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid OTP' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(() => authService.verifyOtp('buyer@example.com', '123456'));
  assert.equal(authService.getState().isAuthenticated, false);
});

test('successful server login still creates a real session', async () => {
  const user = { id: 'server-user', email: 'buyer@example.com', role: 'Customer' };
  globalThis.fetch = async () => new Response(JSON.stringify({
    accessToken: 'server-access-token', refreshToken: 'server-refresh-token', user,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await authService.loginWithPassword(user.email, 'password');
  assert.equal(result.id, user.id);
  assert.equal(authService.getState().isAuthenticated, true);
  assert.equal(authService.getAccessToken(), 'server-access-token');
  await authService.logout();
});


test('an uncertain OTP request is never replayed against a different backend', async () => {
  mobileApi.setBaseUrl('https://chosen-api.example/api/v1');
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => authService.requestOtp('buyer@example.com', 'Buyer'));
  assert.equal(calls, 1);
  assert.equal(mobileApi.getBaseUrl(), 'https://chosen-api.example/api/v1');
});
