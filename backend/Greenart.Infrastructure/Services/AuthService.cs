using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace Greenart.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly LandPriceDbContext _dbContext;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        LandPriceDbContext dbContext,
        IGoogleTokenValidator googleTokenValidator,
        ITokenService tokenService,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _googleTokenValidator = googleTokenValidator;
        _tokenService = tokenService;
        _logger = logger;
    }

    public async Task<AuthResultDto> GoogleLoginAsync(string idToken, CancellationToken cancellationToken = default)
    {
        var payload = await _googleTokenValidator.ValidateTokenAsync(idToken, cancellationToken);
        var normalizedEmail = payload.Email.Trim().ToLowerInvariant();

        // 1. Look up user by Google immutable Subject identifier
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.GoogleSubjectId == payload.Subject, cancellationToken);

        if (user != null)
        {
            // Reject suspended or deactivated accounts
            if (user.AccountStatus != AccountStatus.Active)
            {
                _logger.LogWarning("Login rejected for non-active account. User: {UserId}, Status: {Status}", user.Id, user.AccountStatus);
                throw new InvalidOperationException($"Your Greenart account is {user.AccountStatus}. Please contact support.");
            }

            // Update profile info if Google provided updated name/avatar
            if (!string.IsNullOrWhiteSpace(payload.Name) && string.IsNullOrWhiteSpace(user.PhoneNumber))
            {
                user.UpdateProfile(payload.Name, user.PhoneNumber, payload.Picture ?? user.AvatarUrl);
            }
            user.RecordLogin(DateTime.UtcNow);
        }
        else
        {
            // 2. Reject if email already exists under a different identity provider key
            var emailExists = await _dbContext.Users.AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
            if (emailExists)
            {
                _logger.LogWarning("Identity conflict: Email {Email} exists under a different Subject ID.", normalizedEmail);
                throw new InvalidOperationException("An account with this email address already exists under another identity.");
            }

            // 3. Register new Customer user (Never elevate role from client or Google)
            user = new User(
                id: Guid.NewGuid(),
                email: normalizedEmail,
                fullName: payload.Name,
                googleSubjectId: payload.Subject,
                phoneNumber: payload.PhoneNumber,
                avatarUrl: payload.Picture,
                role: UserRole.Customer,
                accountStatus: AccountStatus.Active,
                isSellerVerified: false,
                sellerType: SellerType.IndividualOwner
            );
            user.RecordLogin(DateTime.UtcNow);
            _dbContext.Users.Add(user);
        }

        // 4. Issue and persist cryptographically secure refresh token hash
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var expiresAtUtc = DateTime.UtcNow.AddDays(_tokenService.RefreshTokenLifetimeDays);

        var refreshTokenEntity = new UserRefreshToken(
            id: Guid.NewGuid(),
            userId: user.Id,
            tokenHash: tokenHash,
            expiresAtUtc: expiresAtUtc
        );
        _dbContext.UserRefreshTokens.Add(refreshTokenEntity);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Failed to persist user or refresh token on Google login.");
            throw new InvalidOperationException("Failed to persist user credentials. Concurrent registration may have occurred.", ex);
        }

        // 5. Generate short-lived JWT access token
        var accessToken = _tokenService.GenerateAccessToken(user);

        var safeProfile = new UserProfileDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            user.Role,
            user.AccountStatus,
            user.IsSellerVerified,
            user.SellerType,
            user.CreatedAtUtc,
            user.LastLoginAtUtc
        );

        return new AuthResultDto(
            accessToken,
            rawRefreshToken,
            "Bearer",
            _tokenService.AccessTokenLifetimeMinutes * 60,
            safeProfile
        );
    }

    public async Task<TokenRefreshResultDto> RefreshTokenAsync(string rawRefreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            throw new ArgumentException("Refresh token cannot be empty.", nameof(rawRefreshToken));
        }

        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var existingToken = await _dbContext.UserRefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (existingToken == null)
        {
            _logger.LogWarning("Refresh token not found for hash: {TokenHash}", tokenHash);
            throw new UnauthorizedAccessException("Invalid refresh token.");
        }

        // Replay attack prevention: if an already revoked token is used, invalidate all sessions for this user
        if (existingToken.IsRevoked)
        {
            _logger.LogWarning("Replay attack detected for user {UserId}. Invalidation of all active sessions initiated.", existingToken.UserId);
            var activeTokens = await _dbContext.UserRefreshTokens
                .Where(t => t.UserId == existingToken.UserId && t.RevokedAtUtc == null)
                .ToListAsync(cancellationToken);

            foreach (var t in activeTokens)
            {
                t.Revoke();
            }
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedAccessException("Refresh token has been revoked. Security policy invalidated all active sessions.");
        }

        if (existingToken.IsExpired)
        {
            throw new UnauthorizedAccessException("Refresh token has expired.");
        }

        if (existingToken.User == null || existingToken.User.AccountStatus != AccountStatus.Active)
        {
            throw new UnauthorizedAccessException("Associated user account is deactivated or suspended.");
        }

        // Atomic rotation: revoke old token and issue new refresh token
        existingToken.Revoke();

        var newRawRefreshToken = _tokenService.GenerateRefreshToken();
        var newTokenHash = _tokenService.HashToken(newRawRefreshToken);
        var newExpiresAtUtc = DateTime.UtcNow.AddDays(_tokenService.RefreshTokenLifetimeDays);

        var newToken = new UserRefreshToken(
            id: Guid.NewGuid(),
            userId: existingToken.UserId,
            tokenHash: newTokenHash,
            expiresAtUtc: newExpiresAtUtc
        );
        _dbContext.UserRefreshTokens.Add(newToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var newAccessToken = _tokenService.GenerateAccessToken(existingToken.User);

        return new TokenRefreshResultDto(
            newAccessToken,
            newRawRefreshToken,
            "Bearer",
            _tokenService.AccessTokenLifetimeMinutes * 60
        );
    }

    public async Task RevokeTokenAsync(string rawRefreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken)) return;

        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var token = await _dbContext.UserRefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (token != null && !token.IsRevoked)
        {
            token.Revoke();
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<UserProfileDto> GetCurrentUserProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
        {
            throw new KeyNotFoundException($"User with ID {userId} was not found.");
        }

        return new UserProfileDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            user.Role,
            user.AccountStatus,
            user.IsSellerVerified,
            user.SellerType,
            user.CreatedAtUtc,
            user.LastLoginAtUtc
        );
    }

    public async Task<RequestOtpResponseDto> RequestOtpAsync(RequestOtpRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email is required.", nameof(request.Email));
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ArgumentException("Full name is required.", nameof(request.FullName));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var randomCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString("D6");
        var otpHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(randomCode)));
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(10);

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (user != null)
        {
            if (user.AccountStatus != AccountStatus.Active)
            {
                _logger.LogWarning("OTP request rejected for non-active user {Email}", normalizedEmail);
                throw new InvalidOperationException($"This account is {user.AccountStatus}. Please contact support.");
            }
            user.SetOtp(otpHash, expiresAtUtc);
        }
        else
        {
            user = new User(
                id: Guid.NewGuid(),
                email: normalizedEmail,
                fullName: request.FullName.Trim(),
                googleSubjectId: $"email:{normalizedEmail}",
                phoneNumber: request.PhoneNumber?.Trim(),
                avatarUrl: null,
                role: UserRole.Customer,
                accountStatus: AccountStatus.Active,
                isSellerVerified: false,
                sellerType: SellerType.IndividualOwner,
                isEmailVerified: false
            );
            user.SetOtp(otpHash, expiresAtUtc);
            _dbContext.Users.Add(user);
        }

        // Record security audit event
        var audit = new AuditEvent(
            Guid.NewGuid(),
            "UserAuth",
            user.Id,
            "OtpRequested",
            normalizedEmail,
            $"Registration/verification OTP generated for {normalizedEmail}. Valid for 10 minutes.");
        _dbContext.AuditEvents.Add(audit);

        await _dbContext.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Security OTP dispatched for {Email} [Development Code: {Code}]", normalizedEmail, randomCode);

        return new RequestOtpResponseDto(
            "Verification code sent to your email address.",
            normalizedEmail,
            randomCode
        );
    }

    public async Task<VerifyOtpResponseDto> VerifyOtpAsync(VerifyOtpRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email is required.", nameof(request.Email));
        if (string.IsNullOrWhiteSpace(request.Otp))
            throw new ArgumentException("Verification code is required.", nameof(request.Otp));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (user == null)
        {
            throw new ArgumentException("No account registration found for this email address.");
        }

        if (user.OtpExpiresAtUtc == null || DateTime.UtcNow > user.OtpExpiresAtUtc.Value)
        {
            throw new InvalidOperationException("Verification code has expired. Please request a new code.");
        }

        var inputHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Otp.Trim())));
        if (string.IsNullOrWhiteSpace(user.OtpHash) ||
            !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(inputHash), Convert.FromHexString(user.OtpHash)))
        {
            _dbContext.AuditEvents.Add(new AuditEvent(
                Guid.NewGuid(), "UserAuth", user.Id, "OtpVerificationFailed", normalizedEmail, "Invalid OTP code attempted."));
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedAccessException("Invalid verification code. Please check your email and try again.");
        }

        user.VerifyEmail();

        var tempVerificationToken = Convert.ToHexString(SHA256.HashData(
            Encoding.UTF8.GetBytes($"{user.Id}:{user.Email}:{DateTime.UtcNow:yyyyMMddHH}:{_tokenService.HashToken(user.Id.ToString())}")));

        _dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), "UserAuth", user.Id, "OtpVerified", normalizedEmail, "Email successfully verified via OTP."));
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new VerifyOtpResponseDto(true, "Email verified successfully.", tempVerificationToken);
    }

    public async Task<AuthResultDto> CompleteRegistrationAsync(CompleteRegistrationRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("Email is required.", nameof(request.Email));
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new ArgumentException("Password must be at least 6 characters long.", nameof(request.Password));
        if (string.IsNullOrWhiteSpace(request.TempVerificationToken))
            throw new ArgumentException("Verification token is required.", nameof(request.TempVerificationToken));

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (user == null)
            throw new ArgumentException("Account not found.");

        var expectedToken = Convert.ToHexString(SHA256.HashData(
            Encoding.UTF8.GetBytes($"{user.Id}:{user.Email}:{DateTime.UtcNow:yyyyMMddHH}:{_tokenService.HashToken(user.Id.ToString())}")));

        if (!CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(request.TempVerificationToken),
            Convert.FromHexString(expectedToken)))
        {
            throw new UnauthorizedAccessException("Verification token is invalid or expired. Please verify OTP again.");
        }

        var (hash, salt) = HashPassword(request.Password);
        user.SetPassword(hash, salt);
        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.UpdateProfile(request.FullName.Trim(), request.PhoneNumber ?? user.PhoneNumber, user.AvatarUrl);
        }
        user.RecordLogin(DateTime.UtcNow);

        // Issue refresh token & access token
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var expiresAtUtc = DateTime.UtcNow.AddDays(_tokenService.RefreshTokenLifetimeDays);

        var refreshTokenEntity = new UserRefreshToken(
            id: Guid.NewGuid(),
            userId: user.Id,
            tokenHash: tokenHash,
            expiresAtUtc: expiresAtUtc
        );
        _dbContext.UserRefreshTokens.Add(refreshTokenEntity);

        _dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(),
            "UserAuth",
            user.Id,
            "UserRegistrationCompleted",
            normalizedEmail,
            "User verified email and configured password. First login granted."));

        await _dbContext.SaveChangesAsync(cancellationToken);

        var accessToken = _tokenService.GenerateAccessToken(user);
        var safeProfile = new UserProfileDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            user.Role,
            user.AccountStatus,
            user.IsSellerVerified,
            user.SellerType,
            user.CreatedAtUtc,
            user.LastLoginAtUtc
        );

        return new AuthResultDto(
            accessToken,
            rawRefreshToken,
            "Bearer",
            _tokenService.AccessTokenLifetimeMinutes * 60,
            safeProfile
        );
    }

    public async Task<AuthResultDto> PasswordLoginAsync(PasswordLoginRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.EmailOrUsername))
            throw new ArgumentException("Email or username is required.", nameof(request.EmailOrUsername));
        if (string.IsNullOrWhiteSpace(request.Password))
            throw new ArgumentException("Password is required.", nameof(request.Password));

        var input = request.EmailOrUsername.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(
            u => u.Email == input || (u.PhoneNumber != null && u.PhoneNumber == input),
            cancellationToken);

        if (user == null || string.IsNullOrWhiteSpace(user.PasswordHash) || string.IsNullOrWhiteSpace(user.PasswordSalt))
        {
            _dbContext.AuditEvents.Add(new AuditEvent(
                Guid.NewGuid(), "UserAuth", null, "LoginFailed", input, "Account not found or password not configured."));
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        if (user.AccountStatus != AccountStatus.Active)
        {
            _dbContext.AuditEvents.Add(new AuditEvent(
                Guid.NewGuid(), "UserAuth", user.Id, "LoginRejected", user.Email, $"Login rejected due to status: {user.AccountStatus}"));
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException($"Your Greenart account is {user.AccountStatus}. Please contact support.");
        }

        var isPasswordValid = VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt);
        if (!isPasswordValid)
        {
            _dbContext.AuditEvents.Add(new AuditEvent(
                Guid.NewGuid(), "UserAuth", user.Id, "LoginFailed", user.Email, "Incorrect password attempt."));
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        user.RecordLogin(DateTime.UtcNow);

        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var expiresAtUtc = DateTime.UtcNow.AddDays(_tokenService.RefreshTokenLifetimeDays);

        var refreshTokenEntity = new UserRefreshToken(
            id: Guid.NewGuid(),
            userId: user.Id,
            tokenHash: tokenHash,
            expiresAtUtc: expiresAtUtc
        );
        _dbContext.UserRefreshTokens.Add(refreshTokenEntity);

        _dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), "UserAuth", user.Id, "LoginSuccess", user.Email, "Password authenticated successfully."));

        await _dbContext.SaveChangesAsync(cancellationToken);

        var accessToken = _tokenService.GenerateAccessToken(user);
        var safeProfile = new UserProfileDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            user.Role,
            user.AccountStatus,
            user.IsSellerVerified,
            user.SellerType,
            user.CreatedAtUtc,
            user.LastLoginAtUtc
        );

        return new AuthResultDto(
            accessToken,
            rawRefreshToken,
            "Bearer",
            _tokenService.AccessTokenLifetimeMinutes * 60,
            safeProfile
        );
    }

    public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ArgumentException("Full name is required.", nameof(request.FullName));

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
            throw new KeyNotFoundException("User not found.");

        user.UpdateProfile(request.FullName.Trim(), request.PhoneNumber?.Trim(), request.AvatarUrl?.Trim());

        _dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), "UserProfile", user.Id, "ProfileUpdated", user.Email, "User updated their profile information."));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new UserProfileDto(
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            user.AvatarUrl,
            user.Role,
            user.AccountStatus,
            user.IsSellerVerified,
            user.SellerType,
            user.CreatedAtUtc,
            user.LastLoginAtUtc
        );
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new ArgumentException("New password must be at least 6 characters long.", nameof(request.NewPassword));

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
            throw new KeyNotFoundException("User not found.");

        // If user already has a password, verify current password
        if (!string.IsNullOrWhiteSpace(user.PasswordHash) && !string.IsNullOrWhiteSpace(user.PasswordSalt))
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword))
                throw new ArgumentException("Current password is required.", nameof(request.CurrentPassword));

            var isCurrentValid = VerifyPassword(request.CurrentPassword, user.PasswordHash, user.PasswordSalt);
            if (!isCurrentValid)
                throw new UnauthorizedAccessException("Current password does not match.");
        }

        var (newHash, newSalt) = HashPassword(request.NewPassword);
        user.SetPassword(newHash, newSalt);

        _dbContext.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), "UserAuth", user.Id, "PasswordChanged", user.Email, "User successfully updated their password."));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<AdminUserDto>> GetAdminUsersListAsync(string? search = null, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.Email.Contains(s) ||
                u.FullName.ToLower().Contains(s) ||
                (u.PhoneNumber != null && u.PhoneNumber.Contains(s)));
        }

        return await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Select(u => new AdminUserDto(
                u.Id,
                u.Email,
                u.FullName,
                u.PhoneNumber,
                u.AvatarUrl,
                u.Role,
                u.AccountStatus,
                u.IsEmailVerified,
                u.IsSellerVerified,
                u.SellerType,
                u.CreatedAtUtc,
                u.LastLoginAtUtc,
                !string.IsNullOrEmpty(u.PasswordHash),
                !string.IsNullOrEmpty(u.GoogleSubjectId) && !u.GoogleSubjectId.StartsWith("email:")
            ))
            .ToListAsync(cancellationToken);
    }

    private static (string Hash, string Salt) HashPassword(string password)
    {
        byte[] saltBytes = RandomNumberGenerator.GetBytes(16);
        byte[] hashBytes = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            saltBytes,
            iterations: 100_000,
            HashAlgorithmName.SHA256,
            outputLength: 32);
        return (Convert.ToHexString(hashBytes), Convert.ToHexString(saltBytes));
    }

    private static bool VerifyPassword(string password, string storedHash, string storedSalt)
    {
        try
        {
            byte[] saltBytes = Convert.FromHexString(storedSalt);
            byte[] expectedHashBytes = Convert.FromHexString(storedHash);
            byte[] computedHashBytes = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password),
                saltBytes,
                iterations: 100_000,
                HashAlgorithmName.SHA256,
                outputLength: 32);
            return CryptographicOperations.FixedTimeEquals(computedHashBytes, expectedHashBytes);
        }
        catch
        {
            return false;
        }
    }
}

