using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HistoricalIntelligenceSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "data_quality_flags",
                table: "land_price_records",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "source_document_id",
                table: "land_price_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audit_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    performed_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    timestamp_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    details = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "historical_estimates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    state = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    taluk = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    locality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    target_year = table.Column<int>(type: "integer", nullable: false),
                    land_usage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    estimated_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    estimated_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    min_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    min_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    max_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    max_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    guideline_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    guideline_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    confidence_level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    review_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sample_count = table.Column<int>(type: "integer", nullable: false),
                    verified_sample_count = table.Column<int>(type: "integer", nullable: false),
                    methodology = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    algorithm_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    limitations = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    calculated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    reviewed_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    reviewed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    location = table.Column<Point>(type: "geography(Point, 4326)", nullable: false),
                    latitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false),
                    longitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_historical_estimates", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "import_batches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    total_rows = table.Column<int>(type: "integer", nullable: false),
                    valid_rows = table.Column<int>(type: "integer", nullable: false),
                    invalid_rows = table.Column<int>(type: "integer", nullable: false),
                    duplicate_rows = table.Column<int>(type: "integer", nullable: false),
                    imported_rows = table.Column<int>(type: "integer", nullable: false),
                    skipped_rows = table.Column<int>(type: "integer", nullable: false),
                    dry_run = table.Column<bool>(type: "boolean", nullable: false),
                    triggered_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    executed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    diagnostic_summary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "source_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    storage_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    mime_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    file_checksum_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    document_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    processing_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    validation_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    uploaded_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    uploaded_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    processed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    reviewed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    extracted_metadata_json = table.Column<string>(type: "text", nullable: true),
                    import_batch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false),
                    archived_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    archival_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "historical_estimate_observations",
                columns: table => new
                {
                    estimate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    observation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    contribution_weight = table.Column<double>(type: "double precision", precision: 5, scale: 4, nullable: false),
                    is_outlier = table.Column<bool>(type: "boolean", nullable: false),
                    distance_meters = table.Column<double>(type: "double precision", nullable: false),
                    temporal_offset_months = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_historical_estimate_observations", x => new { x.estimate_id, x.observation_id });
                    table.ForeignKey(
                        name: "FK_historical_estimate_observations_historical_estimates_estim~",
                        column: x => x.estimate_id,
                        principalTable: "historical_estimates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_historical_estimate_observations_land_price_records_observa~",
                        column: x => x.observation_id,
                        principalTable: "land_price_records",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_land_price_records_source_document_id",
                table: "land_price_records",
                column: "source_document_id");

            migrationBuilder.CreateIndex(
                name: "idx_audit_events_entity",
                table: "audit_events",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "idx_audit_events_timestamp",
                table: "audit_events",
                column: "timestamp_utc");

            migrationBuilder.CreateIndex(
                name: "idx_historical_estimate_observations_obs_id",
                table: "historical_estimate_observations",
                column: "observation_id");

            migrationBuilder.CreateIndex(
                name: "idx_historical_estimates_district_year",
                table: "historical_estimates",
                columns: new[] { "district", "target_year" });

            migrationBuilder.CreateIndex(
                name: "idx_historical_estimates_locality_year_usage",
                table: "historical_estimates",
                columns: new[] { "locality", "target_year", "land_usage" });

            migrationBuilder.CreateIndex(
                name: "idx_historical_estimates_location",
                table: "historical_estimates",
                column: "location")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "idx_import_batches_executed_at",
                table: "import_batches",
                column: "executed_at_utc");

            migrationBuilder.CreateIndex(
                name: "idx_source_documents_checksum_unique",
                table: "source_documents",
                column: "file_checksum_sha256",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_source_documents_document_type",
                table: "source_documents",
                column: "document_type");

            migrationBuilder.CreateIndex(
                name: "idx_source_documents_is_archived",
                table: "source_documents",
                column: "is_archived");

            migrationBuilder.CreateIndex(
                name: "idx_source_documents_status",
                table: "source_documents",
                columns: new[] { "processing_status", "validation_status" });

            migrationBuilder.AddForeignKey(
                name: "FK_land_price_records_source_documents_source_document_id",
                table: "land_price_records",
                column: "source_document_id",
                principalTable: "source_documents",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_land_price_records_source_documents_source_document_id",
                table: "land_price_records");

            migrationBuilder.DropTable(
                name: "audit_events");

            migrationBuilder.DropTable(
                name: "historical_estimate_observations");

            migrationBuilder.DropTable(
                name: "import_batches");

            migrationBuilder.DropTable(
                name: "source_documents");

            migrationBuilder.DropTable(
                name: "historical_estimates");

            migrationBuilder.DropIndex(
                name: "idx_land_price_records_source_document_id",
                table: "land_price_records");

            migrationBuilder.DropColumn(
                name: "data_quality_flags",
                table: "land_price_records");

            migrationBuilder.DropColumn(
                name: "source_document_id",
                table: "land_price_records");
        }
    }
}
