using Greenart.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NetTopologySuite.Geometries;
namespace Greenart.Infrastructure.Persistence.Configurations;
public class MarketResearchEvidenceConfiguration : IEntityTypeConfiguration<MarketResearchEvidence>
{
    public void Configure(EntityTypeBuilder<MarketResearchEvidence> b) {
        b.ToTable("market_research_evidence", t => { t.HasCheckConstraint("ck_research_asking_amount", "\"OriginalPrice\" IS NULL OR \"OriginalPrice\" > 0"); t.HasCheckConstraint("ck_research_asking_area", "\"OriginalArea\" IS NULL OR \"OriginalArea\" > 0"); }); b.HasKey(x => x.Id);
        b.HasOne<PriceResearch>().WithMany().HasForeignKey(x => x.ResearchId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ResearchId, x.EvidenceId }).IsUnique(); b.HasIndex(x => new { x.SourceCategory, x.ObservationDateUtc });
        b.Property(x => x.OriginalPrice).HasPrecision(20, 2); b.Property(x => x.OriginalArea).HasPrecision(20, 6);
        b.Property(x => x.AreaSqFt).HasPrecision(20, 6); b.Property(x => x.RatePerCent).HasPrecision(18, 2); b.Property(x => x.RatePerSqFt).HasPrecision(18, 2);
        b.Property(x => x.SourceName).HasMaxLength(300); b.Property(x => x.SourceUrl).HasMaxLength(4000); b.Property(x => x.EvidenceId).HasMaxLength(64);
        b.Property(x => x.SourceCategory).HasMaxLength(50); b.Property(x => x.Status).HasMaxLength(60); b.Property(x => x.OriginalAreaUnit).HasMaxLength(30);
        b.Property<Point>("Location").HasColumnType("geography(Point,4326)").IsRequired(false);
        b.HasIndex("Location").HasMethod("gist");
    }
}
public class BrokerMarketObservationConfiguration : IEntityTypeConfiguration<BrokerMarketObservation>
{
    public void Configure(EntityTypeBuilder<BrokerMarketObservation> b) {
        b.ToTable("broker_market_observations", t => { t.HasCheckConstraint("ck_broker_opinion_range", "\"LowPerCent\" > 0 AND \"HighPerCent\" >= \"LowPerCent\" AND (\"TypicalPerCent\" IS NULL OR (\"TypicalPerCent\" >= \"LowPerCent\" AND \"TypicalPerCent\" <= \"HighPerCent\"))"); t.HasCheckConstraint("ck_broker_opinion_category", "\"SourceCategory\" = 'BrokerMarketOpinion'"); }); b.HasKey(x => x.Id);
        b.HasOne<PriceResearch>().WithMany().HasForeignKey(x => x.ResearchId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ResearchId, x.ResearchVersion }).IsUnique(); b.HasIndex(x => new { x.LandUsage, x.AssessmentDateUtc, x.VerificationStatus });
        foreach (var name in new[] { "TypicalPerCent", "AiTypicalPerCent" }) b.Property<decimal?>(name).HasPrecision(18, 2);
        b.Property(x => x.LowPerCent).HasPrecision(18, 2); b.Property(x => x.HighPerCent).HasPrecision(18, 2);
        b.Property(x => x.DifferencePercentage).HasPrecision(18, 2);
        b.Property(x => x.BrokerName).HasMaxLength(150); b.Property(x => x.BrokerId).HasMaxLength(150); b.Property(x => x.ContactReference).HasMaxLength(250);
        b.Property(x => x.BrokerLocality).HasMaxLength(150); b.Property(x => x.DocumentReference).HasMaxLength(1000); b.Property(x => x.EvidenceNotes).HasMaxLength(6000);
        b.Property(x => x.Familiarity).HasMaxLength(100); b.Property(x => x.SourceCategory).HasMaxLength(50); b.Property(x => x.EvidenceType).HasMaxLength(50);
        b.Property<Point>("Location").HasColumnType("geography(Point,4326)"); b.HasIndex("Location").HasMethod("gist");
    }
}
