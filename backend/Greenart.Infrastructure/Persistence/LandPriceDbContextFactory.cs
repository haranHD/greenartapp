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
            ?? "Host=localhost;Port=5433;Database=greenart_dev;Username=greenart_user;Password=greenart_dev_password";

        optionsBuilder.UseNpgsql(connectionString, o => o.UseNetTopologySuite());

        return new LandPriceDbContext(optionsBuilder.Options);
    }
}

