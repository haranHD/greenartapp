namespace Greenart.Domain.Enums;

/// <summary>
/// Role-based access control tiers.
/// Customer: Default registered Google user.
/// Reviewer: Quality assurance, deed and guideline reviewer.
/// Administrator: Full administrative privileges.
/// </summary>
public enum UserRole
{
    Customer = 1,
    Reviewer = 2,
    Administrator = 3
}

/// <summary>
/// User account status.
/// </summary>
public enum AccountStatus
{
    Active = 1,
    Suspended = 2,
    Deactivated = 3
}

