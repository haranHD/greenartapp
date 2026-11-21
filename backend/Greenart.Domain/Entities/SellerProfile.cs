using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

public class SellerProfile
{
    public Guid UserId { get; private set; }
    public Guid CurrentApplicationId { get; private set; }
    public SellerStatus Status { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public DateTime? SuspendedAtUtc { get; private set; }
    public string? SuspensionReason { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    private SellerProfile() { }

    public SellerProfile(SellerApplication application, DateTime now)
    {
        UserId = application.UserId;
        CreatedAtUtc = now;
        TrackApplication(application, now);
    }

    public void TrackApplication(SellerApplication application, DateTime now)
    {
        if (application.UserId != UserId ||
            (CurrentApplicationId != application.Id && Status is not (SellerStatus.NotApplied or SellerStatus.Rejected)) ||
            Status == SellerStatus.Suspended)
            throw new InvalidOperationException("This application cannot update the seller profile.");

        CurrentApplicationId = application.Id;
        Status = application.Status;
        UpdatedAtUtc = now;
        if (Status == SellerStatus.Approved)
            ApprovedAtUtc = now;
    }

    public void Suspend(string reason, DateTime now)
    {
        if (Status != SellerStatus.Approved || string.IsNullOrWhiteSpace(reason))
            throw new InvalidOperationException("An approved seller and a reason are required.");

        Status = SellerStatus.Suspended;
        SuspensionReason = reason;
        SuspendedAtUtc = UpdatedAtUtc = now;
    }
}
