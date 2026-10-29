using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Domain.ValueObjects;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Xunit;

namespace Greenart.Tests.Integration;

public class AuthAndMarketplaceDbContextModelTests
{
    private LandPriceDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<LandPriceDbContext>()
            .UseNpgsql("Host=localhost;Database=greenart_dummy;Username=dummy;Password=dummy", o => o.UseNetTopologySuite())
            .Options;

        return new LandPriceDbContext(options);
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_UsersTable_WithUniqueIndexesAndLengths()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(User));
        Assert.NotNull(entityType);
        Assert.Equal("users", entityType.GetTableName());

        // Primary key
        var pk = entityType.FindPrimaryKey();
        Assert.NotNull(pk);
        Assert.Equal("id", pk.Properties.Single().GetColumnName());

        // Email column and unique index
        var emailProp = entityType.FindProperty(nameof(User.Email));
        Assert.NotNull(emailProp);
        Assert.Equal("email", emailProp.GetColumnName());
        Assert.Equal(256, emailProp.GetMaxLength());
        Assert.False(emailProp.IsNullable);

        var emailIndex = entityType.GetIndexes().FirstOrDefault(i => i.Properties.Any(p => p.Name == nameof(User.Email)));
        Assert.NotNull(emailIndex);
        Assert.True(emailIndex.IsUnique);
        Assert.Equal("idx_users_email_unique", emailIndex.GetDatabaseName());

        // GoogleSubjectId column and unique index
        var googleSubProp = entityType.FindProperty(nameof(User.GoogleSubjectId));
        Assert.NotNull(googleSubProp);
        Assert.Equal("google_subject_id", googleSubProp.GetColumnName());
        Assert.Equal(255, googleSubProp.GetMaxLength());
        Assert.False(googleSubProp.IsNullable);

        var googleSubIndex = entityType.GetIndexes().FirstOrDefault(i => i.Properties.Any(p => p.Name == nameof(User.GoogleSubjectId)));
        Assert.NotNull(googleSubIndex);
        Assert.True(googleSubIndex.IsUnique);
        Assert.Equal("idx_users_google_subject_id_unique", googleSubIndex.GetDatabaseName());

        // Enums configured as strings
        var roleProp = entityType.FindProperty(nameof(User.Role));
        Assert.NotNull(roleProp);
        Assert.Equal("role", roleProp.GetColumnName());
        Assert.Equal(50, roleProp.GetMaxLength());

        var statusProp = entityType.FindProperty(nameof(User.AccountStatus));
        Assert.NotNull(statusProp);
        Assert.Equal("account_status", statusProp.GetColumnName());
        Assert.Equal(50, statusProp.GetMaxLength());
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_UserRefreshTokensTable_WithCascadeDelete()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(UserRefreshToken));
        Assert.NotNull(entityType);
        Assert.Equal("user_refresh_tokens", entityType.GetTableName());

        // Foreign key to User with Cascade delete
        var fk = entityType.GetForeignKeys().FirstOrDefault(k => k.PrincipalEntityType.ClrType == typeof(User));
        Assert.NotNull(fk);
        Assert.Equal(DeleteBehavior.Cascade, fk.DeleteBehavior);

        // Indexes
        var indexes = entityType.GetIndexes().ToList();
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_user_refresh_tokens_token_hash");
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_user_refresh_tokens_user_expiry");
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_MarketplaceListingsTable_WithGistIndexAndPrecision()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(MarketplaceListing));
        Assert.NotNull(entityType);
        Assert.Equal("marketplace_listings", entityType.GetTableName());

        // Spatial Location property
        var locationProp = entityType.FindProperty("Location");
        Assert.NotNull(locationProp);
        Assert.Equal("location", locationProp.GetColumnName());
        Assert.Equal("geography(Point, 4326)", locationProp.GetColumnType());

        // GIST spatial index
        var spatialIndex = entityType.GetIndexes().FirstOrDefault(i => i.Properties.Any(p => p.Name == "Location"));
        Assert.NotNull(spatialIndex);
        Assert.Equal("idx_marketplace_listings_location", spatialIndex.GetDatabaseName());

        // Coordinates complex property
        var complexProps = entityType.GetComplexProperties().ToList();
        Assert.Contains(complexProps, cp => cp.Name == nameof(MarketplaceListing.Coordinates));

        // Decimal precisions for price and extent
        var askingPrice = entityType.FindProperty(nameof(MarketplaceListing.AskingPriceTotal))!;
        Assert.Equal(18, askingPrice.GetPrecision());
        Assert.Equal(2, askingPrice.GetScale());

        var extentCent = entityType.FindProperty(nameof(MarketplaceListing.ExtentCent))!;
        Assert.Equal(18, extentCent.GetPrecision());
        Assert.Equal(4, extentCent.GetScale());

        // Seller relationship with Restrict delete
        var sellerFk = entityType.GetForeignKeys().FirstOrDefault(k => k.Properties.Any(p => p.Name == nameof(MarketplaceListing.SellerId)));
        Assert.NotNull(sellerFk);
        Assert.Equal(DeleteBehavior.Restrict, sellerFk.DeleteBehavior);
    }

    [Fact]
    public void ModelBuilder_ShouldConfigure_ListingEnquiriesTable_WithForeignKeysAndIndexes()
    {
        using var context = CreateInMemoryDbContext();
        var entityType = context.Model.FindEntityType(typeof(ListingEnquiry));
        Assert.NotNull(entityType);
        Assert.Equal("listing_enquiries", entityType.GetTableName());

        // Listing foreign key with Cascade delete
        var listingFk = entityType.GetForeignKeys().FirstOrDefault(k => k.Properties.Any(p => p.Name == nameof(ListingEnquiry.ListingId)));
        Assert.NotNull(listingFk);
        Assert.Equal(DeleteBehavior.Cascade, listingFk.DeleteBehavior);

        // BuyerUser foreign key with Restrict delete
        var buyerFk = entityType.GetForeignKeys().FirstOrDefault(k => k.Properties.Any(p => p.Name == nameof(ListingEnquiry.BuyerUserId)));
        Assert.NotNull(buyerFk);
        Assert.Equal(DeleteBehavior.Restrict, buyerFk.DeleteBehavior);

        // Indexes
        var indexes = entityType.GetIndexes().ToList();
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_listing_enquiries_listing_submitted");
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_listing_enquiries_buyer_user_id");
        Assert.Contains(indexes, i => i.GetDatabaseName() == "idx_listing_enquiries_status");
    }

    [Fact]
    public void SyncSpatialLocations_ShouldPopulatePostGisPoint_ForMarketplaceListing()
    {
        using var context = CreateInMemoryDbContext();

        var listing = new MarketplaceListing(
            id: Guid.NewGuid(),
            title: "Coimbatore Prime Plot",
            description: "Clear title residential plot",
            sellerId: Guid.NewGuid(),
            locality: "Kannampalayam",
            district: "Coimbatore",
            state: "Tamil Nadu",
            coordinates: new GeoCoordinate(11.0012, 77.0874),
            landUsage: LandUsageType.Residential,
            extentCent: 5m,
            extentSqFt: 2178m,
            askingPriceTotal: 5000000m,
            askingRatePerCent: 1000000m,
            askingRatePerSqFt: 2295.68m
        );

        context.MarketplaceListings.Add(listing);

        // Access ChangeTracker entry and verify spatial location before save
        var entry = context.Entry(listing);
        Assert.Equal(EntityState.Added, entry.State);

        // Invoke SaveChanges or trigger Sync via reflection / SaveChanges interception
        // In EF Core, SaveChanges() calls SyncSpatialLocations before attempting DB roundtrip.
        // Even if DB connection fails, SyncSpatialLocations runs first.
        try
        {
            context.SaveChanges();
        }
        catch
        {
            // Expected Npgsql connection failure against dummy database
        }

        var spatialPoint = entry.Property<Point>("Location").CurrentValue;
        Assert.NotNull(spatialPoint);
        Assert.Equal(4326, spatialPoint.SRID);
        Assert.Equal(77.0874, spatialPoint.X); // Longitude
        Assert.Equal(11.0012, spatialPoint.Y); // Latitude
    }
}

