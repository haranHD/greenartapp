using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGroundedMarketResearch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "AuthorizedSourcesJson", table: "price_research", type: "text", nullable: false, defaultValue: "[]");
            migrationBuilder.AddColumn<string>(
                name: "AiReviewStatus",
                table: "price_research",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "NotReviewed");

            migrationBuilder.AddColumn<decimal>(
                name: "AreaSqFt",
                table: "price_research",
                type: "numeric(20,6)",
                precision: 20,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "InputArea",
                table: "price_research",
                type: "numeric(20,6)",
                precision: 20,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InputAreaUnit",
                table: "price_research",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Point>(
                name: "Location",
                table: "price_research",
                type: "geography(Point,4326)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PipelineVersion",
                table: "price_research",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Legacy");

            migrationBuilder.AddColumn<Guid>(
                name: "RequestedByUserId",
                table: "price_research",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResearchResultJson",
                table: "price_research",
                type: "text",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<string>(
                name: "ResearchStatus",
                table: "price_research",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "NotStarted");

            migrationBuilder.AddColumn<string>(
                name: "ReviewResultJson",
                table: "price_research",
                type: "text",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<Guid>(
                name: "SupersedesResearchId",
                table: "price_research",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Taluk",
                table: "price_research",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "broker_market_observations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResearchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResearchVersion = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceCategory = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BrokerId = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    BrokerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ContactReference = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    BrokerLocality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    EvidenceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Familiarity = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DocumentReference = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    EvidenceNotes = table.Column<string>(type: "character varying(6000)", maxLength: 6000, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    LandUsage = table.Column<int>(type: "integer", nullable: false),
                    LowPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TypicalPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    HighPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AiTypicalPerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    DifferencePercentage = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    AssessmentDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    VerificationStatus = table.Column<string>(type: "text", nullable: false),
                    RecordedBy = table.Column<string>(type: "text", nullable: false),
                    ReviewedBy = table.Column<string>(type: "text", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Location = table.Column<Point>(type: "geography(Point,4326)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_broker_market_observations", x => x.Id);
                    table.CheckConstraint("ck_broker_opinion_range", "\"LowPerCent\" > 0 AND \"HighPerCent\" >= \"LowPerCent\" AND (\"TypicalPerCent\" IS NULL OR (\"TypicalPerCent\" >= \"LowPerCent\" AND \"TypicalPerCent\" <= \"HighPerCent\"))");
                    table.CheckConstraint("ck_broker_opinion_category", "\"SourceCategory\" = 'BrokerMarketOpinion'");

                    table.ForeignKey(
                        name: "FK_broker_market_observations_price_research_ResearchId",
                        column: x => x.ResearchId,
                        principalTable: "price_research",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "market_research_evidence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResearchId = table.Column<Guid>(type: "uuid", nullable: false),
                    EvidenceId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SourceCategory = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SourceName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SourceUrl = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    ObservationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetrievedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OriginalPrice = table.Column<decimal>(type: "numeric(20,2)", precision: 20, scale: 2, nullable: true),
                    OriginalArea = table.Column<decimal>(type: "numeric(20,6)", precision: 20, scale: 6, nullable: true),
                    OriginalAreaUnit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    AreaSqFt = table.Column<decimal>(type: "numeric(20,6)", precision: 20, scale: 6, nullable: true),
                    RatePerCent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RatePerSqFt = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    Status = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ChecksJson = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<Point>(type: "geography(Point,4326)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_market_research_evidence", x => x.Id);
                    table.CheckConstraint("ck_research_asking_amount", "\"OriginalPrice\" IS NULL OR \"OriginalPrice\" > 0");
                    table.CheckConstraint("ck_research_asking_area", "\"OriginalArea\" IS NULL OR \"OriginalArea\" > 0");

                    table.ForeignKey(
                        name: "FK_market_research_evidence_price_research_ResearchId",
                        column: x => x.ResearchId,
                        principalTable: "price_research",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_price_research_District_Taluk_LandUsage_ResearchStatus_Crea~",
                table: "price_research",
                columns: new[] { "District", "Taluk", "LandUsage", "ResearchStatus", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_price_research_Location",
                table: "price_research",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_price_research_RequestedByUserId",
                table: "price_research",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_price_research_SupersedesResearchId",
                table: "price_research",
                column: "SupersedesResearchId", unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_broker_market_observations_LandUsage_AssessmentDateUtc_Veri~",
                table: "broker_market_observations",
                columns: new[] { "LandUsage", "AssessmentDateUtc", "VerificationStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_broker_market_observations_Location",
                table: "broker_market_observations",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_broker_market_observations_ResearchId_ResearchVersion",
                table: "broker_market_observations",
                columns: new[] { "ResearchId", "ResearchVersion" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_market_research_evidence_Location",
                table: "market_research_evidence",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_market_research_evidence_ResearchId_EvidenceId",
                table: "market_research_evidence",
                columns: new[] { "ResearchId", "EvidenceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_market_research_evidence_SourceCategory_ObservationDateUtc",
                table: "market_research_evidence",
                columns: new[] { "SourceCategory", "ObservationDateUtc" });

            migrationBuilder.AddForeignKey(
                name: "FK_price_research_price_research_SupersedesResearchId",
                table: "price_research",
                column: "SupersedesResearchId",
                principalTable: "price_research",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_price_research_users_RequestedByUserId",
                table: "price_research",
                column: "RequestedByUserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
            migrationBuilder.AddCheckConstraint("ck_grounded_request_area", "price_research", "(\"InputArea\" IS NULL OR \"InputArea\" > 0) AND (\"AreaSqFt\" IS NULL OR \"AreaSqFt\" > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AuthorizedSourcesJson", table: "price_research");
            migrationBuilder.DropCheckConstraint("ck_grounded_request_area", "price_research");
            migrationBuilder.DropForeignKey(
                name: "FK_price_research_price_research_SupersedesResearchId",
                table: "price_research");

            migrationBuilder.DropForeignKey(
                name: "FK_price_research_users_RequestedByUserId",
                table: "price_research");

            migrationBuilder.DropTable(
                name: "broker_market_observations");

            migrationBuilder.DropTable(
                name: "market_research_evidence");

            migrationBuilder.DropIndex(
                name: "IX_price_research_District_Taluk_LandUsage_ResearchStatus_Crea~",
                table: "price_research");

            migrationBuilder.DropIndex(
                name: "IX_price_research_Location",
                table: "price_research");

            migrationBuilder.DropIndex(
                name: "IX_price_research_RequestedByUserId",
                table: "price_research");

            migrationBuilder.DropIndex(
                name: "IX_price_research_SupersedesResearchId",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "AiReviewStatus",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "AreaSqFt",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "InputArea",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "InputAreaUnit",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "PipelineVersion",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "RequestedByUserId",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "ResearchResultJson",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "ResearchStatus",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "ReviewResultJson",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "SupersedesResearchId",
                table: "price_research");

            migrationBuilder.DropColumn(
                name: "Taluk",
                table: "price_research");
        }
    }
}
