import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mobileApi, LocalityApiError, LocalitySuggestionDto } from '../services/api';
import { LocalitySearchController, LocalitySearchState } from '../services/localitySearchController';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const suggestion = (name: string): LocalitySuggestionDto => ({ placeId: name, mainText: name, secondaryText: 'Tamil Nadu', fullText: name, types: ['locality'] });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('provider errors remain visible and never silently change the backend', async () => {
  mobileApi.setBaseUrl('https://selected-api.example/api/v1');
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  await assert.rejects(() => mobileApi.searchLocalities('Bhavani'), error => error instanceof LocalityApiError);
  assert.equal(calls, 1);
  assert.equal(mobileApi.getBaseUrl(), 'https://selected-api.example/api/v1');
});

test('backend provider error and a successful empty result stay distinct', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Location search is unavailable.', code: 'geocoding_permissiondenied' }), { status: 502 });
  await assert.rejects(() => mobileApi.searchLocalities('Bhavani'), (error: any) => error.code === 'geocoding_permissiondenied');
  globalThis.fetch = async () => new Response('[]', { status: 200 });
  assert.deepEqual(await mobileApi.searchLocalities('unknown-place'), []);
});

test('malformed suggestions and invalid coordinates are rejected', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  await assert.rejects(() => mobileApi.searchLocalities('Bhavani'), LocalityApiError);
  globalThis.fetch = async () => new Response(JSON.stringify({ name: 'Bhavani', latitude: null, longitude: 77.684 }), { status: 200 });
  await assert.rejects(() => mobileApi.getLocalityDetails('place-id'), LocalityApiError);
});

test('an older slow response cannot overwrite a newer query', async () => {
  const resolvers = new Map<string, (items: LocalitySuggestionDto[]) => void>();
  const signals = new Map<string, AbortSignal>();
  const states: LocalitySearchState[] = [];
  const controller = new LocalitySearchController((query, signal) => {
    signals.set(query, signal);
    return new Promise(resolve => resolvers.set(query, resolve));
  }, state => states.push(state), 0);
  controller.update('Bhavani'); await tick();
  controller.update('Erode'); await tick();
  assert.equal(signals.get('Bhavani')!.aborted, true);
  resolvers.get('Erode')!([suggestion('Erode')]); await tick();
  resolvers.get('Bhavani')!([suggestion('Bhavani')]); await tick();
  assert.equal(states.at(-1)!.suggestions[0].mainText, 'Erode');
  assert.equal(states.at(-1)!.isLoading, false);
  controller.cancel();
});

test('clearing a search hides old suggestions and prevents late updates', async () => {
  let resolve!: (items: LocalitySuggestionDto[]) => void;
  const states: LocalitySearchState[] = [];
  const controller = new LocalitySearchController(() => new Promise(done => { resolve = done; }), state => states.push(state), 0);
  controller.update('Bhavani'); await tick();
  controller.update('');
  resolve([suggestion('Bhavani')]); await tick();
  assert.equal(states.at(-1)!.query, '');
  assert.deepEqual(states.at(-1)!.suggestions, []);
  assert.equal(states.at(-1)!.isLoading, false);
  controller.cancel();
});

test('a failed search can be retried without changing the query', async () => {
  let attempts = 0;
  const states: LocalitySearchState[] = [];
  const controller = new LocalitySearchController(async () => {
    if (++attempts === 1) throw new Error('temporarily unavailable');
    return [suggestion('Bhavani')];
  }, state => states.push(state), 0);
  controller.update('Bhavani'); await tick();
  assert.equal(states.at(-1)!.error, 'temporarily unavailable');
  controller.update('Bhavani'); await tick();
  assert.equal(states.at(-1)!.error, null);
  assert.equal(states.at(-1)!.suggestions[0].mainText, 'Bhavani');
  controller.cancel();
});

test('details preserve the selected place coordinates and district', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ name: 'Bhavani', latitude: 11.4471, longitude: 77.684, district: 'Erode' }), { status: 200 });
  const result = await mobileApi.getLocalityDetails('bhavani-place');
  assert.equal(result!.latitude, 11.4471);
  assert.equal(result!.district, 'Erode');
});
