# Security Baseline & Policy — Greenart Properties

## 1. Core Security Commitments

1. **Zero Secret Leakage:**
   - No database passwords, JWT private keys, SMS provider API tokens, or production credentials in source code.
   - All secret configurations are injected via environment variables or secret managers (e.g., Azure Key Vault / AWS Secrets Manager) in production.
2. **Frontend Isolation:**
   - Neither the React Native mobile app nor the React admin web app ever connects directly to PostgreSQL.
   - Database connection strings are never exposed or bundled into client application code.
3. **No Backdoors or Fake OTP Claims:**
   - Do not claim SMS messages have been dispatched when no provider is connected.
   - In local development, an explicit, isolated mock auth provider will be documented and gated strictly behind `ASPNETCORE_ENVIRONMENT=Development`.
4. **Data Privacy:**
   - No Personally Identifiable Information (PII) such as phone numbers or customer search coordinates in application log sinks.

---

## 2. Authentication & Authorization Baseline

### 2.1 Role-Based Access Control (RBAC)
- **Roles:**
  - `Customer`: Can execute location estimates, view valuation reports, and manage their profile.
  - `Admin`: Can perform CRUD operations on land records, trigger CSV imports, view audit logs, and modify system settings.
- **Enforcement:** Enforced server-side using ASP.NET Core `[Authorize(Roles = "Admin")]` policies on all administrative endpoints.

### 2.2 Mobile Client Authentication (Design Specification)
- OTP-based login via registered mobile number.
- OTPs must:
  - Be cryptographically random (minimum 6 digits).
  - Expire within 5 minutes.
  - Limit attempts to 3 invalid entries before invalidation.
  - Enforce resend cooldown (minimum 60 seconds).

---

## 3. Network & Transport Security

- **HTTPS Mandatory in Production:** TLS 1.3 enforced for all API traffic.
- **CORS Configuration:**
  - Strict origin whitelist (`ALLOWED_CORS_ORIGINS`).
  - Wildcard `*` origins are strictly prohibited in production.
- **Rate Limiting:**
  - Rate limiting applied to public estimation endpoints (`POST /api/v1/estimates/calculate`) to protect against scraping and denial-of-service.
  - Aggressive rate limiting on authentication and OTP request endpoints.

---

## 4. Input Validation & Injection Defense

- **Spatial Coordinate Validation:** Latitude strictly bounded between `[-90.0, 90.0]` and Longitude between `[-180.0, 180.0]`. Search radius capped at `5000` meters.
- **SQL / Spatial Injection Defense:** All database interactions handled through Entity Framework Core with parameterized queries and strongly typed NetTopologySuite spatial geometry.
- **File Upload Security:** CSV/Excel imports verified for MIME type, file size ceilings (max 10MB), and parsed using secure streaming parsers.

---

## 5. Unresolved Security Decisions

- **SMS Provider Selection:** Provider pending commercial agreement (e.g., MSG91, Twilio).
- **Token Mechanism:** Decision between HttpOnly secure cookies vs. Bearer JWT tokens for the admin web portal.
- **Production Secret Manager:** Choice between Azure Key Vault, AWS Secrets Manager, or HashiCorp Vault.

