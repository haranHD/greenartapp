# Local Development Infrastructure Guide

## 1. Running with Docker Compose (Recommended)
From the repository root:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
This starts PostgreSQL 16 with PostGIS 3.4 on `localhost:5432`.

To stop the container:
```bash
docker compose -f infra/docker/docker-compose.yml down
```

---

## 2. Running with Native PostgreSQL (Without Docker)
If you already have PostgreSQL 16 installed locally on Linux:
1. Ensure the `postgresql-16-postgis-3` package is installed:
   ```bash
   sudo apt-get install -y postgresql-16-postgis-3
   ```
2. Create the development database and enable PostGIS:
   ```sql
   CREATE DATABASE greenart_dev;
   \c greenart_dev;
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Update connection parameters in `.env` or `backend/Greenart.Api/appsettings.Development.json`.

