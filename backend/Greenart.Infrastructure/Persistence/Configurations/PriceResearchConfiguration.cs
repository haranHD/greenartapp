using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Greenart.Infrastructure.Persistence.Configurations;
public class PriceResearchConfiguration : IEntityTypeConfiguration<PriceResearch>
{
    public void Configure(EntityTypeBuilder<PriceResearch> b)
    {
        b.Property(x => x.AuthorizedSourcesJson).HasDefaultValue("[]");
        b.Property(x => x.PipelineVersion).HasDefaultValue("Legacy");
        b.Property(x => x.ResearchStatus).HasDefaultValue("NotStarted"); b.Property(x => x.AiReviewStatus).HasDefaultValue("NotReviewed");
        b.Property(x => x.ResearchResultJson).HasDefaultValue("{}"); b.Property(x => x.ReviewResultJson).HasDefaultValue("{}");
        b.Property(x => x.InputArea).HasPrecision(20, 6); b.Property(x => x.AreaSqFt).HasPrecision(20, 6);
        b.Property(x => x.Taluk).HasMaxLength(150); b.Property(x => x.InputAreaUnit).HasMaxLength(30); b.Property(x => x.PipelineVersion).HasMaxLength(50);
        b.Property(x => x.ResearchStatus).HasMaxLength(60); b.Property(x => x.AiReviewStatus).HasMaxLength(60);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.SupersedesResearchId).IsUnique();
        b.HasOne<PriceResearch>().WithMany().HasForeignKey(x => x.SupersedesResearchId).OnDelete(DeleteBehavior.Restrict);
        b.Property<NetTopologySuite.Geometries.Point>("Location").HasColumnType("geography(Point,4326)").IsRequired(false);
        b.HasIndex("Location").HasMethod("gist");
        b.HasIndex(x => new { x.District, x.Taluk, x.LandUsage, x.ResearchStatus, x.CreatedAtUtc });
        b.ToTable("price_research", t => t.HasCheckConstraint("ck_grounded_request_area", "(\"InputArea\" IS NULL OR \"InputArea\" > 0) AND (\"AreaSqFt\" IS NULL OR \"AreaSqFt\" > 0)")); b.HasKey(x => x.Id);
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
