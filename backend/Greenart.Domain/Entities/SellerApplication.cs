using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

public record SellerApplicationDetails(
    string ApplicantName, SellerType SellerType, string ContactInformation,
    string OperatingDistrict, string? OperatingLocality, string? BusinessDetails,
    string? AuthorisationInformation, bool DeclaresAccuracy);

public class SellerApplication
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public SellerApplicationDetails Details { get; private set; } = null!;
    public SellerStatus Status { get; private set; }
    public string? ApplicantFeedback { get; private set; }
    public string? ReviewNotes { get; private set; }
    public Guid? ReviewedByUserId { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    public DateTime SubmittedAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }
    public int Version { get; private set; }

    private SellerApplication() { }

    public SellerApplication(Guid userId, SellerApplicationDetails details, DateTime now)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        Details = details;
        Status = SellerStatus.PendingReview;
        CreatedAtUtc = UpdatedAtUtc = SubmittedAtUtc = now;
        Version = 1;
    }

    public void Resubmit(SellerApplicationDetails details, DateTime now)
    {
        if (Status != SellerStatus.NeedsInformation)
            throw new InvalidOperationException("Only applications awaiting information may be corrected.");

        Details = details;
        Status = SellerStatus.PendingReview;
        ApplicantFeedback = ReviewNotes = null;
        ReviewedByUserId = null;
        ReviewedAtUtc = null;
        UpdatedAtUtc = SubmittedAtUtc = now;
        Version++;
    }

    public void AutoApproveForDirectListing(DateTime now)
    {
        if (Status != SellerStatus.PendingReview)
            throw new InvalidOperationException("Only pending applications can be auto-approved.");

        Status = SellerStatus.Approved;
        ReviewedByUserId = null;
        ReviewedAtUtc = UpdatedAtUtc = now;
        ReviewNotes = "Direct mobile seller auto-enrolled on listing submission";
        Version++;
    }

    public void Review(Guid reviewerId, SellerStatus decision, string? feedback, string? notes, DateTime now)
    {
        if (Status != SellerStatus.PendingReview || reviewerId == Guid.Empty || reviewerId == UserId ||
            decision is not (SellerStatus.Approved or SellerStatus.NeedsInformation or SellerStatus.Rejected))
            throw new InvalidOperationException("This application cannot receive that decision.");

        Status = decision;
        ReviewedByUserId = reviewerId;
        ReviewedAtUtc = UpdatedAtUtc = now;
        ApplicantFeedback = feedback;
        ReviewNotes = notes;
        Version++;
    }
}
