import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mobileApi } from '../services/api';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const saved = { basis: 'AiSuggested', groundingStatus: 'AuthorizedSourcesRetrieved', reviewStatus: 'PassedEvidenceReview', sourceCount: 3, lowPerCent: 400000, highPerCent: 500000, lowPerSqFt: 918.27, highPerSqFt: 1147.84 };
test('market pricing reads saved suggestions using the exact pin, land type and road without a generation request', async () => {
  mobileApi.setBaseUrl('https://api.example.test/api/v1');
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/api/v1/pricing/market-range');
    assert.equal(parsed.searchParams.get('latitude'), '11.4471');
    assert.equal(parsed.searchParams.get('landUsage'), '1');
    assert.equal(parsed.searchParams.get('roadAccess'), 'Standard Layout Road (24ft-30ft)');
    assert(!options?.method || options.method === 'GET');
    return new Response(JSON.stringify({ range: saved }), { status: 200 });
  };
  assert.deepEqual(await mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Standard Layout Road (24ft-30ft)'), { range: saved });
});
test('no matching market range remains empty instead of becoming a sample price', async () => {
  globalThis.fetch = async () => new Response('{"range":null}', { status: 200 });
  assert.deepEqual(await mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Road'), { range: null });
});
test('unsupported source labels and invalid numeric ranges are rejected before display', async () => {
  for (const changes of [{ basis: 'VerifiedAi' }, { lowPerCent: -1 }, { highPerCent: 1 }, { lowPerSqFt: 0 }]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ range: { ...saved, ...changes } }), { status: 200 });
    await assert.rejects(mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Road'));
  }
});
test('generation sends one authenticated POST with the same request ID and never retries on provider errors', async () => {
  let calls = 0;
  const input = { requestId: '11111111-1111-4111-8111-111111111111', locality: 'Bhavani', district: 'Erode', latitude: 11.4471, longitude: 77.684, landUsage: 1, roadAccess: 'Layout Road' };
  globalThis.fetch = async (url, options) => {
    calls++;
    assert(String(url).endsWith('/pricing/research'));
    assert.equal(options?.method, 'POST');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-access-token');
    assert.deepEqual(JSON.parse(options?.body as string), input);
    return new Response('{"error":"Daily allowance reached"}', { status: 429 });
  };
  await assert.rejects(mobileApi.generatePriceResearch(input, 'test-access-token'), /Daily allowance reached/);
  assert.equal(calls, 1);
});
test('generation preserves saved result and no-estimate status without supplying fallback prices', async () => {
  const input = { requestId: '11111111-1111-4111-8111-111111111111', locality: 'Bhavani', district: 'Erode', latitude: 11.4471, longitude: 77.684, landUsage: 1, roadAccess: 'Layout Road' };
  const data = { range: null, status: 'NoEstimate', cached: false, message: 'Saved for admin review' };
  globalThis.fetch = async () => new Response(JSON.stringify(data), { status: 200 });
  assert.deepEqual(await mobileApi.generatePriceResearch(input, 'test-access-token'), data);
});

test('an older backend missing the pricing route is identified instead of reported as missing price data', async () => {
  globalThis.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Road'), /updated backend.*Restart the backend/);
});

test('legacy text-only AI prices cannot be presented as evidence-backed asking research', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ range: { ...saved, groundingStatus: 'Unavailable' } }), { status: 200 });
  await assert.rejects(mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Road'), /insufficient grounded evidence/);
});
test('research matching includes the selected area and unit', async () => {
  globalThis.fetch = async url => {
    const query = new URL(String(url)).searchParams;
    assert.equal(query.get('area'), '5'); assert.equal(query.get('areaUnit'), 'Cent');
    return new Response('{"range":null}', { status: 200 });
  };
  await mobileApi.getMarketPriceRange(11.4471, 77.684, 1, 'Road', undefined, 5, 'Cent');
});
