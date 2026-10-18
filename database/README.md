# Database Architecture & PostGIS Guide — Greenart Properties

## 1. Engine & Spatial Extension
- **Database Engine:** PostgreSQL 16+
- **Spatial Extension:** PostGIS 3.4+ (`CREATE EXTENSION IF NOT EXISTS postgis;`)
- **Spatial Coordinate System:** WGS 84 (SRID `4326`) for geographic latitude/longitude coordinates.
- **Distance Calculation:** All spatial distance calculations within the 1,000-meter radius are computed in meters using PostGIS native geography functions (`ST_DWithin` or `geography` type casting).

---

## 2. Spatial Indexing Strategy
To ensure sub-millisecond proximity queries across large land parcel datasets, all spatial columns must be indexed with Generalized Search Tree (`GIST`) indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_land_price_records_location
ON "LandPriceRecords" USING GIST ("Location");
```

---

## 3. Entity Framework Core Mapping
In the .NET 8 `Greenart.Infrastructure` project, PostGIS integration is configured via `Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite`:

```csharp
// In LandPriceDbContext.cs
protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
{
    optionsBuilder.UseNpgsql(connectionString, o => o.UseNetTopologySuite());
}
```

---

## 4. Schema Migrations Policy
- Database changes are exclusively managed via Entity Framework Core migrations in `backend/Greenart.Infrastructure`.
- Raw SQL scripts in `database/` are reserved for local Docker initializations, reference extensions, and synthetic seed data.

