using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostGisSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "land_price_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    state = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    taluk = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    locality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    street_or_landmark = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    survey_number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    land_usage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    original_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    normalized_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    normalized_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    source_category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    source_reference = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    observation_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    retrieval_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    verification_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_synthetic = table.Column<bool>(type: "boolean", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    location = table.Column<Point>(type: "geography(Point, 4326)", nullable: false),
                    original_unit = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    original_area = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    latitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false),
                    longitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_land_price_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "idx_land_price_records_land_usage",
                table: "land_price_records",
                column: "land_usage");

            migrationBuilder.CreateIndex(
                name: "idx_land_price_records_locality",
                table: "land_price_records",
                column: "locality");

            migrationBuilder.CreateIndex(
                name: "idx_land_price_records_location",
                table: "land_price_records",
                column: "location")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "idx_land_price_records_source_category",
                table: "land_price_records",
                column: "source_category");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "land_price_records");
        }
    }
}
