using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPropertyListingWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "approval_details",
                table: "marketplace_listings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "creation_request_id",
                table: "marketplace_listings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "electricity_available",
                table: "marketplace_listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "entered_area",
                table: "marketplace_listings",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "entered_area_unit",
                table: "marketplace_listings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "fenced",
                table: "marketplace_listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "has_exact_location",
                table: "marketplace_listings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "land_classification",
                table: "marketplace_listings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "landmark",
                table: "marketplace_listings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "negotiable",
                table: "marketplace_listings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "original_asking_price",
                table: "marketplace_listings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "parcel_fingerprint",
                table: "marketplace_listings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "plot_dimensions",
                table: "marketplace_listings",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pricing_notes",
                table: "marketplace_listings",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "published_at_utc",
                table: "marketplace_listings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "road_access",
                table: "marketplace_listings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "road_frontage_feet",
                table: "marketplace_listings",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "road_width_feet",
                table: "marketplace_listings",
                type: "numeric(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sale_status",
                table: "marketplace_listings",
                type: "character varying(25)",
                maxLength: 25,
                nullable: false,
                defaultValue: "Available");

            migrationBuilder.AddColumn<string>(
                name: "seller_relationship",
                table: "marketplace_listings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "version",
                table: "marketplace_listings",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "village",
                table: "marketplace_listings",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "water_available",
                table: "marketplace_listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "share_contact",
                table: "listing_enquiries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "updated_at_utc",
                table: "listing_enquiries",
                type: "timestamp with time zone",
                nullable: true);

            // Keep legacy rows and their raw moderation state. Previously substituted pins need seller correction.
            migrationBuilder.Sql("""
                UPDATE marketplace_listings
                SET original_asking_price = NULLIF(asking_price_total, 0),
                    sale_status = CASE WHEN status = 'Sold' THEN 'Sold' ELSE 'Available' END,
                    has_exact_location =
                        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
                        AND (latitude <> 0 OR longitude <> 0)
                        AND latitude <> 11.0012 AND longitude <> 77.0874
                        AND NOT (latitude = 11.0168 AND longitude = 76.9558);

                UPDATE marketplace_listings
                SET parcel_fingerprint = upper(encode(sha256(convert_to(
                    upper(trim(district) || chr(31) || trim(locality) || chr(31) ||
                        COALESCE(NULLIF(trim(survey_number), ''),
                            to_char(latitude, 'FM990.00000') || ',' || to_char(longitude, 'FM990.00000') || ',' ||
                            to_char(round(extent_cent * 435.6, 2), 'FM9999999999999990.00'))),
                    'UTF8')), 'hex'))
                WHERE has_exact_location AND extent_cent > 0
                    AND trim(district) <> '' AND trim(locality) <> '';
                """);

            migrationBuilder.AddColumn<Point>(
                name: "public_location",
                table: "marketplace_listings",
                type: "geography(Point, 4326)",
                nullable: true,
                computedColumnSql: "CASE WHEN has_exact_location THEN\n    ST_SetSRID(ST_MakePoint(\n        round(longitude::numeric, 2)::double precision,\n        round(latitude::numeric, 2)::double precision), 4326)::geography\nEND",
                stored: true);

            migrationBuilder.CreateTable(
                name: "listing_favourites",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_favourites", x => new { x.user_id, x.listing_id });
                    table.ForeignKey(
                        name: "FK_listing_favourites_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_listing_favourites_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "listing_media",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    content_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    is_cover = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_media", x => x.id);
                    table.ForeignKey(
                        name: "FK_listing_media_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "listing_moderation_changes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_status = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    new_status = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    listing_version = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_moderation_changes", x => x.id);
                    table.ForeignKey(
                        name: "FK_listing_moderation_changes_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_listing_moderation_changes_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "listing_price_changes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    changed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    new_price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    changed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_price_changes", x => x.id);
                    table.ForeignKey(
                        name: "FK_listing_price_changes_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_listing_price_changes_users_changed_by_user_id",
                        column: x => x.changed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "listing_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_reports", x => x.id);
                    table.ForeignKey(
                        name: "FK_listing_reports_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_listing_reports_users_reporter_user_id",
                        column: x => x.reporter_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "listing_media_blobs",
                columns: table => new
                {
                    media_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_media_blobs", x => x.media_id);
                    table.ForeignKey(
                        name: "FK_listing_media_blobs_listing_media_media_id",
                        column: x => x.media_id,
                        principalTable: "listing_media",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_marketplace_public_location",
                table: "marketplace_listings",
                column: "public_location")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_listings_parcel_fingerprint",
                table: "marketplace_listings",
                column: "parcel_fingerprint");

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_listings_seller_id_creation_request_id",
                table: "marketplace_listings",
                columns: new[] { "seller_id", "creation_request_id" },
                unique: true,
                filter: "creation_request_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_listings_status_sale_status_published_at_utc",
                table: "marketplace_listings",
                columns: new[] { "status", "sale_status", "published_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_listing_enquiries_buyer_user_id_submitted_at_utc",
                table: "listing_enquiries",
                columns: new[] { "buyer_user_id", "submitted_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_listing_favourites_listing_id",
                table: "listing_favourites",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "IX_listing_favourites_user_id_created_at_utc",
                table: "listing_favourites",
                columns: new[] { "user_id", "created_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_listing_media_listing_id_kind_sort_order",
                table: "listing_media",
                columns: new[] { "listing_id", "kind", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_listing_moderation_changes_actor_user_id",
                table: "listing_moderation_changes",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_listing_moderation_changes_listing_id_listing_version",
                table: "listing_moderation_changes",
                columns: new[] { "listing_id", "listing_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_listing_price_changes_changed_by_user_id",
                table: "listing_price_changes",
                column: "changed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_listing_price_changes_listing_id_changed_at_utc",
                table: "listing_price_changes",
                columns: new[] { "listing_id", "changed_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_listing_reports_created_at_utc",
                table: "listing_reports",
                column: "created_at_utc");

            migrationBuilder.CreateIndex(
                name: "IX_listing_reports_listing_id",
                table: "listing_reports",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "IX_listing_reports_reporter_user_id_listing_id",
                table: "listing_reports",
                columns: new[] { "reporter_user_id", "listing_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "listing_favourites");

            migrationBuilder.DropTable(
                name: "listing_media_blobs");

            migrationBuilder.DropTable(
                name: "listing_moderation_changes");

            migrationBuilder.DropTable(
                name: "listing_price_changes");

            migrationBuilder.DropTable(
                name: "listing_reports");

            migrationBuilder.DropTable(
                name: "listing_media");

            migrationBuilder.DropIndex(
                name: "idx_marketplace_public_location",
                table: "marketplace_listings");

            migrationBuilder.DropIndex(
                name: "IX_marketplace_listings_parcel_fingerprint",
                table: "marketplace_listings");

            migrationBuilder.DropIndex(
                name: "IX_marketplace_listings_seller_id_creation_request_id",
                table: "marketplace_listings");

            migrationBuilder.DropIndex(
                name: "IX_marketplace_listings_status_sale_status_published_at_utc",
                table: "marketplace_listings");

            migrationBuilder.DropIndex(
                name: "IX_listing_enquiries_buyer_user_id_submitted_at_utc",
                table: "listing_enquiries");

            migrationBuilder.DropColumn(
                name: "public_location",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "approval_details",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "creation_request_id",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "electricity_available",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "entered_area",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "entered_area_unit",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "fenced",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "has_exact_location",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "land_classification",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "landmark",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "negotiable",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "original_asking_price",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "parcel_fingerprint",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "plot_dimensions",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "pricing_notes",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "published_at_utc",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "road_access",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "road_frontage_feet",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "road_width_feet",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "sale_status",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "seller_relationship",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "version",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "village",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "water_available",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "share_contact",
                table: "listing_enquiries");

            migrationBuilder.DropColumn(
                name: "updated_at_utc",
                table: "listing_enquiries");
        }
    }
}
