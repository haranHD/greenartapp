using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthAndMarketplacePersistence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    full_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: true),
                    google_subject_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    avatar_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    account_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_seller_verified = table.Column<bool>(type: "boolean", nullable: false),
                    seller_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_login_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "marketplace_listings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    locality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    state = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    taluk = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    street_address = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    survey_number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    land_usage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    extent_cent = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    extent_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    asking_price_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    asking_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    asking_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    guideline_rate_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    guideline_rate_per_sqft = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    estimated_market_median_per_cent = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    rejection_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    moderation_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    reviewed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    location = table.Column<Point>(type: "geography(Point, 4326)", nullable: false),
                    latitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false),
                    longitude = table.Column<double>(type: "double precision", precision: 9, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_marketplace_listings", x => x.id);
                    table.ForeignKey(
                        name: "FK_marketplace_listings_users_reviewed_by_user_id",
                        column: x => x.reviewed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_marketplace_listings_users_seller_id",
                        column: x => x.seller_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_refresh_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_refresh_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "listing_enquiries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    buyer_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offered_price_total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    submitted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_listing_enquiries", x => x.id);
                    table.ForeignKey(
                        name: "FK_listing_enquiries_marketplace_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "marketplace_listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_listing_enquiries_users_buyer_user_id",
                        column: x => x.buyer_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "idx_listing_enquiries_buyer_user_id",
                table: "listing_enquiries",
                column: "buyer_user_id");

            migrationBuilder.CreateIndex(
                name: "idx_listing_enquiries_listing_submitted",
                table: "listing_enquiries",
                columns: new[] { "listing_id", "submitted_at_utc" });

            migrationBuilder.CreateIndex(
                name: "idx_listing_enquiries_status",
                table: "listing_enquiries",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_marketplace_listings_locality_status",
                table: "marketplace_listings",
                columns: new[] { "locality", "status" });

            migrationBuilder.CreateIndex(
                name: "idx_marketplace_listings_location",
                table: "marketplace_listings",
                column: "location")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "idx_marketplace_listings_seller_id",
                table: "marketplace_listings",
                column: "seller_id");

            migrationBuilder.CreateIndex(
                name: "idx_marketplace_listings_status",
                table: "marketplace_listings",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_listings_reviewed_by_user_id",
                table: "marketplace_listings",
                column: "reviewed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "idx_user_refresh_tokens_token_hash",
                table: "user_refresh_tokens",
                column: "token_hash");

            migrationBuilder.CreateIndex(
                name: "idx_user_refresh_tokens_user_expiry",
                table: "user_refresh_tokens",
                columns: new[] { "user_id", "expires_at_utc" });

            migrationBuilder.CreateIndex(
                name: "idx_users_email_unique",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_users_google_subject_id_unique",
                table: "users",
                column: "google_subject_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "listing_enquiries");

            migrationBuilder.DropTable(
                name: "user_refresh_tokens");

            migrationBuilder.DropTable(
                name: "marketplace_listings");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
