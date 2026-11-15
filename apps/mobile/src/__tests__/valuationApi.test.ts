import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mobileApi,
  ApiUnavailableError,
  ApiValidationError,
  EstimateSuccessResponse,
  EstimateInsufficientDataResponse,
} from '../services/api';

describe('Task 2 Mobile API - Evidence-Based Valuation & Error Handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mobileApi.setBaseUrl('https://api.greenart.mock/api/v1');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('calculateEstimate throws ApiUnavailableError on network failure without inventing prices', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network request failed');
    };

    await assert.rejects(
      async () => {
        await mobileApi.calculateEstimate(11.0012, 77.0874, 1, 1000, 'Kannampalayam', 'Coimbatore');
      },
      (err: any) => {
        assert(err instanceof ApiUnavailableError, 'Expected ApiUnavailableError instance');
        assert.equal(err.message, 'Could not reach the server. Please try again.');
        // Ensure no fake price fields leaked
        assert.equal((err as any).priceRangePerCent, undefined);
        return true;
      }
    );
  });

  test('calculateEstimate throws ApiUnavailableError on HTTP 500 server error', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await assert.rejects(
      async () => {
        await mobileApi.calculateEstimate(11.0012, 77.0874, 1, 1000, 'Kannampalayam', 'Coimbatore');
      },
      (err: any) => {
        assert(err instanceof ApiUnavailableError, 'Expected ApiUnavailableError instance');
        assert.equal(err.message, 'Could not reach the server. Please try again.');
        return true;
      }
    );
  });

  test('calculateEstimate throws ApiValidationError on HTTP 400 validation error (e.g. coordinates outside India)', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: 'Target coordinates are outside supported India regions.' }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await mobileApi.calculateEstimate(0.0, 0.0, 1, 1000, 'Invalid', 'Unknown');
      },
      (err: any) => {
        assert(err instanceof ApiValidationError, 'Expected ApiValidationError instance');
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'Target coordinates are outside supported India regions.');
        return true;
      }
    );
  });

  test('calculateEstimate returns verified EstimateSuccessResponse when sufficient evidence exists', async () => {
    const mockSuccess: EstimateSuccessResponse = {
      status: 'Success',
      sectionLabel: 'Completed Transaction Evidence',
      targetCoordinates: { latitude: 11.0012, longitude: 77.0874 },
      searchRadiusMeters: 1000,
      comparableRecordCount: 4,
      confidence: 'High',
      priceRangePerCent: {
        minRate: 1400000,
        percentile25: 1450000,
        medianRate: 1500000,
        percentile75: 1550000,
        maxRate: 1600000,
        unit: 'Cent',
      },
      priceRangePerSqFt: {
        minRate: 3214,
        percentile25: 3329,
        medianRate: 3444,
        percentile75: 3558,
        maxRate: 3673,
        unit: 'Sq.Ft',
      },
      earliestRecordDate: '2024-01-01T00:00:00Z',
      latestRecordDate: '2024-10-01T00:00:00Z',
      sourceBreakdown: [{ category: 'VerifiedDeed', count: 4 }],
      disclaimer: 'Based strictly on 4 verified deeds.',
      askingPriceReference: {
        listingCount: 2,
        medianRatePerCent: 1600000,
        medianRatePerSqFt: 3673,
        minRatePerSqFt: 3500,
        maxRatePerSqFt: 3800,
        notice: 'Seller asking benchmark.',
        sectionLabel: 'Asking Price Benchmark',
      },
      governmentGuidelineReference: {
        guidelineRatePerCent: 650000,
        guidelineRatePerSqFt: 1492,
        locality: 'Kannampalayam',
        legalNotice: 'TNREGINET official benchmark.',
        sectionLabel: 'Government Guideline Benchmark',
      },
    };

    globalThis.fetch = async () => {
      return new Response(JSON.stringify(mockSuccess), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = await mobileApi.calculateEstimate(11.0012, 77.0874, 1, 1000);
    assert.equal(res.status, 'Success');
    if (res.status === 'Success') {
      assert.equal(res.comparableRecordCount, 4);
      assert.equal(res.priceRangePerCent.medianRate, 1500000);
      assert.equal(res.confidence, 'High');
      assert.notEqual(res.confidence, 'AI-Synthesized');
      assert.equal(res.sectionLabel, 'Completed Transaction Evidence');
      assert.equal(res.askingPriceReference?.sectionLabel, 'Asking Price Benchmark');
      assert.equal(res.governmentGuidelineReference?.sectionLabel, 'Government Guideline Benchmark');
    }
  });

  test('calculateEstimate returns EstimateInsufficientDataResponse with benchmarks and no invented price', async () => {
    const mockInsufficient: EstimateInsufficientDataResponse = {
      status: 'InsufficientData',
      sectionLabel: 'Completed Transaction Evidence',
      targetCoordinates: { latitude: 11.0012, longitude: 77.0874 },
      searchRadiusMeters: 1000,
      comparableRecordsFound: 1,
      minimumRequiredRecords: 3,
      message: 'Only 1 verified record found. Minimum 3 required.',
      recommendations: ['Expand radius', 'Check adjacent localities'],
      governmentGuidelineReference: {
        guidelineRatePerCent: 650000,
        guidelineRatePerSqFt: 1492,
        locality: 'Kannampalayam',
        legalNotice: 'TNREGINET benchmark.',
        sectionLabel: 'Government Guideline Benchmark',
      },
      askingPriceReference: {
        listingCount: 3,
        medianRatePerCent: 1200000,
        medianRatePerSqFt: 2755,
        minRatePerSqFt: 2500,
        maxRatePerSqFt: 2900,
        notice: 'Public asking listings.',
        sectionLabel: 'Asking Price Benchmark',
      },
    };

    globalThis.fetch = async () => {
      return new Response(JSON.stringify(mockInsufficient), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = await mobileApi.calculateEstimate(11.0012, 77.0874, 1, 1000);
    assert.equal(res.status, 'InsufficientData');
    if (res.status === 'InsufficientData') {
      assert.equal(res.comparableRecordsFound, 1);
      assert.equal(res.minimumRequiredRecords, 3);
      assert.equal((res as any).priceRangePerCent, undefined);
      assert.equal(res.sectionLabel, 'Completed Transaction Evidence');
      assert.equal(res.governmentGuidelineReference?.guidelineRatePerCent, 650000);
    }
  });

  test('getAiLandIntelligence throws ApiUnavailableError on network failure without fake 1050000 price', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    await assert.rejects(
      async () => {
        await mobileApi.getAiLandIntelligence(11.0012, 77.0874, 1);
      },
      (err: any) => {
        assert(err instanceof ApiUnavailableError, 'Expected ApiUnavailableError instance');
        assert.equal(err.message, 'Could not reach the server. Please try again.');
        // Ensure no fake 1050000 price leaked
        assert.equal((err as any).estimatedCurrentPricePerCent, undefined);
        return true;
      }
    );
  });

  test('getLandRecords returns empty array on failure instead of fake records', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const records = await mobileApi.getLandRecords();
    assert.deepEqual(records, []);
  });

  test('getNearbyLandRecords returns empty array on failure instead of fake records', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const nearby = await mobileApi.getNearbyLandRecords(11.0012, 77.0874, 1000);
    assert.deepEqual(nearby, []);
  });
});
