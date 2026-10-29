using Greenart.Domain.Enums;

namespace Greenart.Application.DTOs;

public record GoogleLoginRequestDto(string IdToken);

public record RefreshTokenRequestDto(string RefreshToken);

public record RevokeTokenRequestDto(string RefreshToken);

public record UserProfileDto(
    Guid Id,
    string Email,
    string FullName,
    string? PhoneNumber,
    string? AvatarUrl,
    UserRole Role,
    AccountStatus AccountStatus,
    bool IsSellerVerified,
    SellerType SellerType,
    DateTime CreatedAtUtc,
    DateTime? LastLoginAtUtc);

public record AuthResultDto(
    string AccessToken,
    string RefreshToken,
    string TokenType,
    int ExpiresIn,
    UserProfileDto User);

public record TokenRefreshResultDto(
    string AccessToken,
    string RefreshToken,
    string TokenType,
    int ExpiresIn);

public record RevokeTokenResponseDto(string Message);

// First-Time OTP & Password Authentication DTOs
public record RequestOtpRequestDto(
    string Email,
    string FullName,
    string? PhoneNumber = null);

public record RequestOtpResponseDto(
    string Message,
    string Email,
    string? DevOtpHint = null);

public record VerifyOtpRequestDto(
    string Email,
    string Otp);

public record VerifyOtpResponseDto(
    bool Success,
    string Message,
    string TempVerificationToken);

public record CompleteRegistrationRequestDto(
    string Email,
    string Password,
    string TempVerificationToken,
    string? FullName = null,
    string? PhoneNumber = null);

public record PasswordLoginRequestDto(
    string EmailOrUsername,
    string Password);

// Admin User Accounts DTO
public record AdminUserDto(
    Guid Id,
    string Email,
    string FullName,
    string? PhoneNumber,
    string? AvatarUrl,
    UserRole Role,
    AccountStatus AccountStatus,
    bool IsEmailVerified,
    bool IsSellerVerified,
    SellerType SellerType,
    DateTime CreatedAtUtc,
    DateTime? LastLoginAtUtc,
    bool HasPassword,
    bool HasGoogleAuth);

