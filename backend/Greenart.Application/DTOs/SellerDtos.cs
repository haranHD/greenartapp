using Greenart.Domain.Entities;
using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record SellerApplicationRequest(
    string? ApplicantName, SellerType SellerType, string? ContactInformation,
    string? OperatingDistrict, string? OperatingLocality, string? BusinessDetails,
    string? AuthorisationInformation, bool DeclaresAccuracy, int? Version = null);

public record ReviewSellerApplicationRequest(
    SellerStatus Decision, int Version, string? ApplicantFeedback, string? ReviewNotes);

public record SuspendSellerRequest(string? Reason);

public record SellerApplicationDto(
    Guid Id, Guid UserId, SellerApplicationDetails Details, SellerStatus Status, string? ApplicantFeedback,
    DateTime CreatedAtUtc, DateTime SubmittedAtUtc, DateTime UpdatedAtUtc, DateTime? ReviewedAtUtc, int Version);

public record SellerStatusDto(
    SellerStatus Status, SellerApplicationDto? Application, DateTime? ApprovedAtUtc,
    DateTime? SuspendedAtUtc, string? SuspensionReason);
