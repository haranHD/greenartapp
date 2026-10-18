# Client Handover & Operational Checklist — Greenart Properties

This document outlines the handover process and operational criteria for transferring ownership of the Greenart Properties Land Market Rate Analyst platform to the client.

---

## 1. Client Asset & Account Ownership

The client must maintain primary legal and administrative ownership of all production assets:

- [ ] **Domain Name Registration:** `greenart.group` registered under client company details and corporate email.
- [ ] **DNS & TLS Certificates:** Managed via client's registrar/DNS dashboard (e.g., Cloudflare).
- [ ] **Cloud & Database Accounts:** Cloud subscription (Azure, AWS, or VPS) billed directly to the client company card.
- [ ] **App Store Accounts:**
  - Google Play Console organization account.
  - Apple Developer Program organization account.
- [ ] **SMS Gateway Account:** Direct billing contract with the approved SMS vendor.
- [ ] **Source Code Repository:** Private repository owned by the client organization.

---

## 2. Database Backup & Disaster Recovery

### 2.1 Backup Policy
- **Automated Nightly Backups:** Managed database snapshot taken every 24 hours with a 30-day retention window.
- **Point-in-Time Recovery (PITR):** Transaction logs (WAL) retained for 7 days.
- **Manual Pre-Migration Backup:** Manual database dump executed prior to any schema migration.

### 2.2 Backup & Restore Commands
```bash
# Export full PostGIS database dump (compressed)
pg_dump -h <DB_HOST> -p 5432 -U <DB_USER> -F c -b -v -f greenart_backup_$(date +%Y%m%d).dump <DB_NAME>

# Restore from dump
pg_restore -h <DB_HOST> -p 5432 -U <DB_USER> -d <DB_NAME> -v greenart_backup_YYYYMMDD.dump
```

---

## 3. Migration & Environment Configuration

### 3.1 Applying EF Core Migrations
```bash
cd backend/Greenart.Infrastructure
dotnet ef database update --startup-project ../Greenart.Api
```

### 3.2 Environment Variable Verification Checklist
Before launching in production, verify all placeholders in `.env.example` are populated with production-grade values:
- [ ] `ASPNETCORE_ENVIRONMENT=Production`
- [ ] Strong, randomized database credentials with least-privilege DB role.
- [ ] Cryptographically secure JWT secret (minimum 256-bit).
- [ ] Explicit CORS origin whitelist matching `greenart.group` domains.
- [ ] Validated SMS provider API credentials.

---

## 4. Final Handover Deliverables

1. Full source code repository including Git history.
2. Complete architectural documentation (`docs/`).
3. Database ERD diagrams and seed scripts (`database/`).
4. Executable deployment container definitions (`infra/docker/`).
5. Post-launch maintenance agreement and support SLAs.

