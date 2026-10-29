using Greenart.Application.DTOs;

namespace Greenart.Application.Common.Interfaces;

public interface IAuthService
{
    Task<AuthResultDto> GoogleLoginAsync(string idToken, CancellationToken cancellationToken = default);
    Task<RequestOtpResponseDto> RequestOtpAsync(RequestOtpRequestDto request, CancellationToken cancellationToken = default);
    Task<VerifyOtpResponseDto> VerifyOtpAsync(VerifyOtpRequestDto request, CancellationToken cancellationToken = default);
    Task<AuthResultDto> CompleteRegistrationAsync(CompleteRegistrationRequestDto request, CancellationToken cancellationToken = default);
    Task<AuthResultDto> PasswordLoginAsync(PasswordLoginRequestDto request, CancellationToken cancellationToken = default);
    Task<TokenRefreshResultDto> RefreshTokenAsync(string rawRefreshToken, CancellationToken cancellationToken = default);
    Task RevokeTokenAsync(string rawRefreshToken, CancellationToken cancellationToken = default);
    Task<UserProfileDto> GetCurrentUserProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<AdminUserDto>> GetAdminUsersListAsync(string? search = null, CancellationToken cancellationToken = default);
}

