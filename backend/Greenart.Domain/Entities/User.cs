using Greenart.Domain.Enums;

namespace Greenart.Domain.Entities;

/// <summary>
/// Domain entity representing an authenticated user account.
/// Identity is federated via Google OAuth (GoogleSubjectId); passwords are never stored.
/// New users strictly default to Customer role, Active account status, and unverified seller status.
/// </summary>
public class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string? PhoneNumber { get; private set; }
    public string GoogleSubjectId { get; private set; } = string.Empty;
    public string? AvatarUrl { get; private set; }
    public UserRole Role { get; private set; } = UserRole.Customer;
    public AccountStatus AccountStatus { get; private set; } = AccountStatus.Active;
    public bool IsSellerVerified { get; private set; }
    public SellerType SellerType { get; private set; } = SellerType.IndividualOwner;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? LastLoginAtUtc { get; private set; }

    // First-time OTP & Password Authentication
    public string? PasswordHash { get; private set; }
    public string? PasswordSalt { get; private set; }
    public string? OtpHash { get; private set; }
    public DateTime? OtpExpiresAtUtc { get; private set; }
    public bool IsEmailVerified { get; private set; }

    // Navigation collections
    public ICollection<UserRefreshToken> RefreshTokens { get; private set; } = new List<UserRefreshToken>();
    public ICollection<MarketplaceListing> Listings { get; private set; } = new List<MarketplaceListing>();
    public ICollection<ListingEnquiry> Enquiries { get; private set; } = new List<ListingEnquiry>();

    // EF Core constructor
    private User() { }

    public User(
        Guid id,
        string email,
        string fullName,
        string googleSubjectId,
        string? phoneNumber = null,
        string? avatarUrl = null,
        UserRole role = UserRole.Customer,
        AccountStatus accountStatus = AccountStatus.Active,
        bool isSellerVerified = false,
        SellerType sellerType = SellerType.IndividualOwner,
        DateTime? createdAtUtc = null,
        bool isEmailVerified = false,
        string? passwordHash = null,
        string? passwordSalt = null)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.", nameof(email));
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("FullName is required.", nameof(fullName));
        if (string.IsNullOrWhiteSpace(googleSubjectId))
            throw new ArgumentException("GoogleSubjectId is required.", nameof(googleSubjectId));

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Email = email.Trim().ToLowerInvariant();
        FullName = fullName.Trim();
        GoogleSubjectId = googleSubjectId.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
        Role = role;
        AccountStatus = accountStatus;
        IsSellerVerified = isSellerVerified;
        SellerType = sellerType;
        CreatedAtUtc = createdAtUtc ?? DateTime.UtcNow;
        IsEmailVerified = isEmailVerified;
        PasswordHash = passwordHash;
        PasswordSalt = passwordSalt;
    }

    public void SetPassword(string passwordHash, string passwordSalt)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new ArgumentException("Password hash cannot be empty.", nameof(passwordHash));
        if (string.IsNullOrWhiteSpace(passwordSalt))
            throw new ArgumentException("Password salt cannot be empty.", nameof(passwordSalt));

        PasswordHash = passwordHash;
        PasswordSalt = passwordSalt;
    }

    public void SetOtp(string otpHash, DateTime expiresAtUtc)
    {
        if (string.IsNullOrWhiteSpace(otpHash))
            throw new ArgumentException("OTP hash cannot be empty.", nameof(otpHash));

        OtpHash = otpHash;
        OtpExpiresAtUtc = expiresAtUtc;
    }

    public void VerifyEmail()
    {
        IsEmailVerified = true;
        OtpHash = null;
        OtpExpiresAtUtc = null;
    }

    public void ClearOtp()
    {
        OtpHash = null;
        OtpExpiresAtUtc = null;
    }

    public void LinkGoogleSubject(string googleSubjectId, string? avatarUrl = null)
    {
        if (string.IsNullOrWhiteSpace(googleSubjectId))
            throw new ArgumentException("GoogleSubjectId cannot be empty.", nameof(googleSubjectId));

        GoogleSubjectId = googleSubjectId.Trim();
        if (!string.IsNullOrWhiteSpace(avatarUrl))
        {
            AvatarUrl = avatarUrl.Trim();
        }
        IsEmailVerified = true;
    }

    public void RecordLogin(DateTime loginTimeUtc)
    {
        LastLoginAtUtc = loginTimeUtc;
    }

    public void UpdateProfile(string fullName, string? phoneNumber, string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("FullName cannot be empty.", nameof(fullName));

        FullName = fullName.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        AvatarUrl = string.IsNullOrWhiteSpace(avatarUrl) ? null : avatarUrl.Trim();
    }

    public void SetSellerType(SellerType sellerType)
    {
        SellerType = sellerType;
    }

    public void SetSellerVerification(bool isVerified)
    {
        IsSellerVerified = isVerified;
    }

    public void UpdateRole(UserRole role)
    {
        Role = role;
    }

    public void UpdateAccountStatus(AccountStatus status)
    {
        AccountStatus = status;
    }
}

