namespace Greenart.Domain.Entities;

/// <summary>
/// Domain entity representing an issued refresh token for user session lifecycle.
/// Only cryptographically secure opaque token hashes are stored; raw tokens are never persisted.
/// </summary>
public class UserRefreshToken
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }

    // Navigation property
    public User? User { get; private set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsRevoked => RevokedAtUtc.HasValue;
    public bool IsActive => !IsRevoked && !IsExpired;

    // EF Core constructor
    private UserRefreshToken() { }

    public UserRefreshToken(
        Guid id,
        Guid userId,
        string tokenHash,
        DateTime expiresAtUtc,
        DateTime? createdAtUtc = null)
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("UserId is required.", nameof(userId));
        if (string.IsNullOrWhiteSpace(tokenHash))
            throw new ArgumentException("TokenHash is required.", nameof(tokenHash));

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        UserId = userId;
        TokenHash = tokenHash.Trim();
        ExpiresAtUtc = expiresAtUtc;
        CreatedAtUtc = createdAtUtc ?? DateTime.UtcNow;
    }

    public void Revoke(DateTime? revokedAtUtc = null)
    {
        RevokedAtUtc = revokedAtUtc ?? DateTime.UtcNow;
    }
}

