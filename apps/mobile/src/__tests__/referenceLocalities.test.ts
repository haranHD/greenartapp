import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mobileApi } from '../services/api';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('empty reference data never becomes sample counts or guideline prices', async () => {
  mobileApi.setBaseUrl('https://api.example.test/api/v1');
  globalThis.fetch = async () => new Response('[]', { status: 200 });
  assert.deepEqual(await mobileApi.getLocalities(), []);
});
test('unavailable reference data never becomes sample counts or guideline prices', async () => {
  mobileApi.setBaseUrl('https://api.example.test/api/v1');
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.deepEqual(await mobileApi.getLocalities(), []);
});
test('server-supplied reference coordinates and counts are retained', async () => {
  mobileApi.setBaseUrl('https://api.example.test/api/v1');
  const data = [{ name: 'Bhavani', district: 'Erode', latitude: 11.4471, longitude: 77.684, recordCount: 2, guidelineRatePerCent: 0, guidelineRatePerSqFt: 0 }];
  globalThis.fetch = async () => new Response(JSON.stringify(data), { status: 200 });
  assert.deepEqual(await mobileApi.getLocalities(), data);
});
