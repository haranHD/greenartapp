using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;
public class PriceResearchConfiguration : IEntityTypeConfiguration<PriceResearch>
{
    public void Configure(EntityTypeBuilder<PriceResearch> b)
    {
        b.ToTable("price_research"); b.HasKey(x => x.Id);
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.Locality).HasMaxLength(150);
        b.Property(x => x.District).HasMaxLength(150);
        b.Property(x => x.RoadAccess).HasMaxLength(150);
        b.Property(x => x.BrokerName).HasMaxLength(150);
        b.Property(x => x.Status).HasMaxLength(30);
        b.Property(x => x.BrokerLowPerCent).HasPrecision(18, 2);
        b.Property(x => x.BrokerHighPerCent).HasPrecision(18, 2);
        b.Property(x => x.LowPerCent).HasPrecision(18, 2);
        b.Property(x => x.HighPerCent).HasPrecision(18, 2);
        b.HasIndex(x => new { x.Status, x.LandUsage, x.ValidUntilUtc });
    }
}
