using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBrokerReviewedPriceResearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Deliberately scoped to pricing research; legacy Greenot schema drift is unchanged.
            migrationBuilder.CreateTable(
                name: "price_research",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    Locality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    District = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    LandUsage = table.Column<int>(type: "integer", nullable: false),
                    CoverageRadiusMeters = table.Column<int>(type: "integer", nullable: false),
                    RoadAccess = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Context = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ResearchStartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProposalsJson = table.Column<string>(type: "text", nullable: false),
                    BrokerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BrokerEvidence = table.Column<string>(type: "text", nullable: false),
                    ObservationCount = table.Column<int>(type: "integer", nullable: false),
                    BrokerLowPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    BrokerHighPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    LowPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    HighPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    BrokerReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ValidUntilUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNotes = table.Column<string>(type: "text", nullable: false),
                    ReviewedBy = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_price_research", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_price_research_Status_LandUsage_ValidUntilUtc",
                table: "price_research",
                columns: new[] { "Status", "LandUsage", "ValidUntilUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "price_research");
        }
    }
}
