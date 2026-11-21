using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Greenart.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSellerApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "reviewed_seller_application_id",
                table: "marketplace_listings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "seller_applications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    applicant_feedback = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    review_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    reviewed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    submitted_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    applicant_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    authorisation_information = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    business_details = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    contact_information = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    declares_accuracy = table.Column<bool>(type: "boolean", nullable: false),
                    operating_district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    operating_locality = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    seller_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seller_applications", x => x.id);
                    table.ForeignKey(
                        name: "FK_seller_applications_users_reviewed_by_user_id",
                        column: x => x.reviewed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_seller_applications_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "seller_profiles",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    approved_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    suspended_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    suspension_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seller_profiles", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_seller_profiles_seller_applications_current_application_id",
                        column: x => x.current_application_id,
                        principalTable: "seller_applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_seller_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_listings_reviewed_seller_application_id",
                table: "marketplace_listings",
                column: "reviewed_seller_application_id");

            migrationBuilder.CreateIndex(
                name: "IX_seller_applications_reviewed_by_user_id",
                table: "seller_applications",
                column: "reviewed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_seller_applications_status_submitted_at_utc",
                table: "seller_applications",
                columns: new[] { "status", "submitted_at_utc" });

            migrationBuilder.CreateIndex(
                name: "IX_seller_applications_user_id",
                table: "seller_applications",
                column: "user_id",
                unique: true,
                filter: "status IN ('PendingReview', 'NeedsInformation')");

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_current_application_id",
                table: "seller_profiles",
                column: "current_application_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_status",
                table: "seller_profiles",
                column: "status");

            migrationBuilder.AddForeignKey(
                name: "FK_marketplace_listings_seller_applications_reviewed_seller_ap~",
                table: "marketplace_listings",
                column: "reviewed_seller_application_id",
                principalTable: "seller_applications",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_marketplace_listings_seller_applications_reviewed_seller_ap~",
                table: "marketplace_listings");

            migrationBuilder.DropTable(
                name: "seller_profiles");

            migrationBuilder.DropTable(
                name: "seller_applications");

            migrationBuilder.DropIndex(
                name: "IX_marketplace_listings_reviewed_seller_application_id",
                table: "marketplace_listings");

            migrationBuilder.DropColumn(
                name: "reviewed_seller_application_id",
                table: "marketplace_listings");
        }
    }
}
