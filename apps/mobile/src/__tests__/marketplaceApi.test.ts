import assert from 'node:assert/strict';
import test from 'node:test';
import { LandUsageType } from '@greenart/shared-types';
import { mobileApi } from '../services/api';

test('legacy listing responses are safe for the workspace, cards and detail gallery', async () => {
  const originalFetch = globalThis.fetch;
  mobileApi.setBaseUrl('https://api.greenart.mock/api/v1');
  const listing = {
    id: 'listing-1', status: 'PendingReview',
    latitude: 11.45, longitude: 77.68,
    createdAtUtc: '2026-11-21T06:00:00Z', updatedAtUtc: '2026-11-21T06:01:00Z',
  };
  globalThis.fetch = async (_url, options) => Response.json(
    options?.method === 'POST' ? listing : [{ ...listing, images: null, documentsAvailable: null }]
  );
  try {
    const submitted = await mobileApi.createMarketplaceListing({
      title: 'Test plot', description: '', locality: 'Bhavani', district: 'Erode', state: 'Tamil Nadu',
      latitude: listing.latitude, longitude: listing.longitude, landUsage: LandUsageType.Residential,
      extentCent: 1, askingPriceTotal: 500000,
    }, 'test.token');
    const [owned] = await mobileApi.getMyMarketplaceListings('test.token');
    const [publicListing] = await mobileApi.getMarketplaceListings();
    for (const result of [submitted, owned, publicListing]) {
      assert.equal(result.id, listing.id);
      assert.equal(result.images.length, 0);
      assert.equal(result.documentsAvailable.length, 0);
      assert.deepEqual(result.coordinates, { latitude: 11.45, longitude: 77.68 });
      assert.equal(result.createdAt, listing.createdAtUtc);
      assert.equal(result.updatedAt, listing.updatedAtUtc);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
