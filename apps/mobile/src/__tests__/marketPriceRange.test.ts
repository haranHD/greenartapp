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

test('acre valuation applies the 3/4 layout factor rule (RatePerCent * 3/4 * 100 = RatePerCent * 75)', async () => {
  const { convertCentToAcreRate, formatRateForUnit, calculateMarketRateBuffer } = await import('../utils/formatters');

  // Urban/Suburban: ₹10.00 Lakhs / cent -> (10L * 0.75) * 100 = ₹7.50 Crores / acre
  assert.equal(convertCentToAcreRate(1000000), 75000000);
  assert.equal(formatRateForUnit(convertCentToAcreRate(1000000), 'Acre'), '₹7.50\u00a0Cr');

  // Rural/Agri: ₹40,000 / cent -> (40k * 0.75) * 100 = ₹30.00 Lakhs / acre
  assert.equal(convertCentToAcreRate(40000), 3000000);
  assert.equal(formatRateForUnit(convertCentToAcreRate(40000), 'Acre'), '₹30.00\u00a0L');

  // ₹1.00 Lakh / cent -> (1L * 0.75) * 100 = ₹75.00 Lakhs / acre
  assert.equal(convertCentToAcreRate(100000), 7500000);
  assert.equal(formatRateForUnit(convertCentToAcreRate(100000), 'Acre'), '₹75.00\u00a0L');

  // Buffer formatting for Acre in Crores
  const bufferCr = calculateMarketRateBuffer(75000000, 'Acre');
  assert(bufferCr.rangeFormatted.includes('Cr'));
  assert.equal(bufferCr.unit, 'Acre');

  // Buffer formatting for Acre in Lakhs
  const bufferL = calculateMarketRateBuffer(3000000, 'Acre');
  assert(bufferL.rangeFormatted.includes('L'));
  assert.equal(bufferL.unit, 'Acre');

  // Verify multi-unit price formatting for hero card: Cent, SqFt, and Acre
  const minCentRupees = 1400000; // 14 Lakhs
  const maxCentRupees = 1800000; // 18 Lakhs
  assert.equal(formatRateForUnit(minCentRupees, 'Cent'), '₹14.00\u00a0L');
  assert.equal(formatRateForUnit(maxCentRupees, 'Cent'), '₹18.00\u00a0L');

  const minSqFt = Math.round(minCentRupees / 435.6);
  const maxSqFt = Math.round(maxCentRupees / 435.6);
  assert.equal(formatRateForUnit(minSqFt, 'SqFt'), '₹3,214');
  assert.equal(formatRateForUnit(maxSqFt, 'SqFt'), '₹4,132');

  const minAcre = convertCentToAcreRate(minCentRupees); // 1.05 Cr
  const maxAcre = convertCentToAcreRate(maxCentRupees); // 1.35 Cr
  assert.equal(formatRateForUnit(minAcre, 'Acre'), '₹10.50\u00a0Cr');
  assert.equal(formatRateForUnit(maxAcre, 'Acre'), '₹13.50\u00a0Cr');
});
