# Database Seed Data & Synthetic Fixtures Policy

## 1. Zero Data Fabrication Rule
- **Strict Prohibition:** Never invent fake transaction prices, fabricated deed numbers, or false verification badges and describe them as real.
- **Explicit Synthetic Labelling:** All seed records used for local development, automated integration testing, or UI demonstrations must carry:
  - `IsSynthetic = true`
  - `SourceCategory = 'SyntheticFixture'` or `'ClientResearch'`
  - `VerificationStatus = 'Unverified'` or `'Synthetic'`

---

## 2. Planned Seed Datasets

1. **`01_reference_data.sql`**: Supported land classifications (residential, commercial, agricultural wet/dry), standardized unit factors (Cents, Acres, Grounds, Kuzhi to Sq.Meters).
2. **`02_coimbatore_pilot_fixtures.sql`**: Labelled demonstration fixtures centered around initial pilot areas (Kannampalayam, Sulur, Saravanampatti) for testing 1 km spatial bounding algorithms.

