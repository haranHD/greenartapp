# Greenart Properties — Machine Learning Readiness & Model Governance Specification

**Document Version:** 1.0.0-PROD-SPEC  
**Status:** Approved Architectural Blueprint & Readiness Framework  
**Scope:** Tamil Nadu-Wide Land Market Price Prediction Engine  

---

## 1. Executive Summary & Production Policy

The Greenart Properties platform requires transparent, legally defensible, and evidence-backed land valuation. Machine learning models offer non-linear multi-variable regression advantages over basic radius averaging, but in real estate markets with sparse data, unvalidated models produce high-variance, ungrounded estimates that risk severe legal and financial harm to land buyers and investors.

### Core Policy Directives:
1. **Rule-Based PostGIS Engine Priority:** The existing rule-based PostGIS estimator ([`EstimationEngine.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Application/Estimation/EstimationEngine.cs)) remains the primary valuation authority until an ML model surpasses it across held-out out-of-time test partitions.
2. **Zero Fake Predictions:** When data within a geographic buffer is insufficient, the system returns `InsufficientData`. It must **never** fabricate an AI price.
3. **Strict Separation from `EstimationEngine.cs`:** The future ML inference engine will be housed in an isolated micro-module (`Greenart.Ml`), consuming structured features and producing shadow scores before any production traffic cutover.

---

## 2. Feature Schema & Target Definition

### 2.1 Target Variable Definition ($y$)
- **Target Metric:** $\text{PricePerCent} = \frac{\text{Total Consideration (INR)}}{\text{Parcel Area in Cents}}$.
- **Ground Truth Source:** Only records categorized as `SourceCategory.VerifiedTransaction` with `VerificationStatus.Verified` (sourced from registered SRO sale deeds).
- **Transformation:** $\log_{10}(\text{PricePerCent})$ to stabilize right-skewed property price distributions.

### 2.2 Feature Matrix ($X$)

| Feature Name | Data Type | Role | Processing & Normalization |
| :--- | :--- | :--- | :--- |
| `latitude` | Float64 | Spatial Position | Centered & scaled within Tamil Nadu bounds [8.0–13.6° N] |
| `longitude` | Float64 | Spatial Position | Centered & scaled within Tamil Nadu bounds [76.2–80.4° E] |
| `land_usage` | Categorical | Zoning Modifier | One-Hot Encoded (`Residential`, `Commercial`, `Industrial`, `AgriculturalDry`, `AgriculturalWet`, `MixedUse`) |
| `log_area_sqft` | Float64 | Parcel Scale | $\log(\text{Area in SqFt})$ to capture size discounts (bulk land vs. subdivided plots) |
| `observation_recency_days`| Int32 | Time Decay | Days from observation date to training cutoff $T_{\text{split}}$ |
| `guideline_rate_cent` | Float64 | **Contextual Feature ONLY** | Statutory TNREGINET guideline value per Cent. **NEVER used as target $y$** |
| `distance_to_highway_m` | Float64 | Spatial Access | Haversine distance to nearest National/State Highway corridor |
| `sample_weight` | Float32 | Loss Weighting | $1.0$ for `VerifiedTransaction`, $0.35$ for `AdvertisedAskingPrice` |

---

## 3. Treatment of Distinct Data Classifications

To prevent data contamination and model corruption, data categories are partitioned strictly according to the following policies:

```
+---------------------------------------------------------------------------------------------------+
|                                      DATA TREATMENT POLICY                                        |
+-----------------------------+-----------------------+-------------------+-------------------------+
| Category                    | Role in ML Pipeline   | Sample Weight     | Justification           |
+-----------------------------+-----------------------+-------------------+-------------------------+
| VerifiedTransaction (Deed)  | Ground Truth ($y$)    | 1.0 (Full Weight) | Legally executed price  |
| AdvertisedAskingPrice       | Auxiliary Regressor   | 0.35 (Down-weighted)| Reflects vendor bias   |
| GovernmentGuideline         | Feature ($X$) ONLY    | N/A               | Statutory tax benchmark |
| ClientResearch (Surveyor)   | Holdout Validation    | 0.0 (Pre-audit)   | Must be audited first   |
+-----------------------------+-----------------------+-------------------+-------------------------+
```

1. **Government Guideline Values:** Statutory benchmarks reflect administrative minimums rather than negotiated open-market transactions. In many semi-urban Tamil Nadu corridors, market values are 1.5x–4x guideline values. Guideline values are provided as input signals ($X$) to establish local price floors, but are **never** treated as ground truth labels ($y$).
2. **Advertised Asking Prices:** Classified listings and broker advertisements include seller optimism and negotiation cushions (typically 10%–20% above transaction value). When used in training, they are down-weighted ($w = 0.35$) and regularized.
3. **Unverified Records:** Records with status `Unverified` are quarantined from production training datasets.

---

## 4. Data Leakage Prevention & Validation Methodology

Standard random $k$-fold cross-validation is **strictly prohibited** in spatial real estate modeling because it creates severe data leakage due to spatial autocorrelation: a model can memorize parcel coordinates within the same layout or street.

### 4.1 Spatial Block Cross-Validation (Spatial K-Fold)
- Tamil Nadu is partitioned into spatial clusters of $5\,\text{km} \times 5\,\text{km}$ grid blocks.
- All records within a single spatial block are assigned entirely to either the Training partition or the Validation partition, never split between the two.

### 4.2 Temporal Out-of-Time Validation Split
- Real estate prices experience inflation and market cycle shifts.
- **Training Epoch:** Observations recorded on or before $T_{\text{split}}$ (e.g., prior to 2024-01-01).
- **Test Epoch:** Observations recorded strictly after $T_{\text{split}}$ (e.g., 2024-01-01 to present).
- Forward-chaining backtesting ensures the model predicts the future from the past, preventing lookahead bias.

---

## 5. Baseline Benchmark & Model Promotion Gates

No machine learning model (e.g., LightGBM, CatBoost, or Geo-Spatial Graph Networks) shall be promoted to production without clearing the following quantitative criteria against [`EstimationEngine.cs`](file:///home/haran/SolveXaTech/GreenArt(Client%2001)/greenartapp/backend/Greenart.Application/Estimation/EstimationEngine.cs):

### 5.1 Primary Performance Metrics
- **Mean Absolute Error (MAE):** $\frac{1}{n} \sum |y_i - \hat{y}_i|$ evaluated in ₹/Cent.
- **Median Absolute Percentage Error (MdAPE):** $\text{median}\left(\frac{|y_i - \hat{y}_i|}{y_i}\right) \times 100\%$.
- **Prediction Interval Coverage Probability (PICP):** $\ge 85\%$ of ground truth values must fall within the predicted 25th–75th percentile range.

### 5.2 Mandatory Promotion Gates
1. **Sample Size Floor:** Minimum $500$ verified transaction records in the evaluated district over the preceding 36 months.
2. **Superiority over Baseline:** Model MdAPE must improve upon the rule-based PostGIS median estimator by at least **$15\%$ relative** on the out-of-time test partition.
3. **Outlier Robustness:** Maximum absolute percentage error on any single validation parcel must not exceed $45\%$.
4. **Fallback Automation:** If model uncertainty exceeds threshold $\sigma > 0.30$ or nearest verified record is $> 2,000\,\text{m}$ distant, the platform automatically falls back to `EstimationEngine.cs` with an explicit disclosure to the user.

---

## 6. Current State Audit & Gap Analysis

```
+-----------------------------------------------------------------------------------------------+
|                                CURRENT STATE STATEWIDE AUDIT                                  |
+--------------------------+-----------------------+------------------+-------------------------+
| District                 | Total Records Stored  | Verified Deeds   | ML Readiness Status     |
+--------------------------+-----------------------+------------------+-------------------------+
| Coimbatore (Pilot Hub)   | 13–25                 | 6–8              | INSUFFICIENT (< 500)    |
| Chennai                  | 0                     | 0                | NO DATA                 |
| Tiruppur                 | 0                     | 0                | NO DATA                 |
| Madurai                  | 0                     | 0                | NO DATA                 |
| 34 Other TN Districts    | 0                     | 0                | NO DATA                 |
+--------------------------+-----------------------+------------------+-------------------------+
```

### Gap Conclusion:
Training an ML model on the current Coimbatore dataset ($< 25$ records) would cause severe overfitting and ungrounded outputs. The primary engineering bottleneck is **data ingestion volume**, which is resolved by the newly deployed CSV Bulk Ingestion pipeline and certified surveyor workflows.

