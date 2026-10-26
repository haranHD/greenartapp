using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Greenart.Infrastructure.Persistence;

public class LandPriceDbContextFactory : IDesignTimeDbContextFactory<LandPriceDbContext>
{
    public LandPriceDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<LandPriceDbContext>();

        // Default local dev connection string for design-time migrations
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=greenart_db;Username=postgres";

        var password = Environment.GetEnvironmentVariable("DB_PASSWORD");
        if (!string.IsNullOrWhiteSpace(password) && !connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase))
        {
            connectionString = $"{connectionString.TrimEnd(';')};Password={password}";
        }

        optionsBuilder.UseNpgsql(connectionString, o => o.UseNetTopologySuite());

        return new LandPriceDbContext(optionsBuilder.Options);
    }
}

