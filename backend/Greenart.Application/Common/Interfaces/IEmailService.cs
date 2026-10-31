namespace Greenart.Application.Common.Interfaces;

/// <summary>
/// Service interface for dispatching transactional and verification emails via SMTP or external providers.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Dispatches a branded, single-use 6-digit OTP verification email to the recipient.
    /// </summary>
    /// <param name="recipientEmail">Destination email address.</param>
    /// <param name="recipientName">User's full name for personalized greeting.</param>
    /// <param name="otpCode">6-digit verification code.</param>
    /// <param name="expirationMinutes">Validity window in minutes (default 10).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if the email was successfully accepted by the SMTP relay; false otherwise.</returns>
    Task<bool> SendOtpEmailAsync(
        string recipientEmail,
        string recipientName,
        string otpCode,
        int expirationMinutes = 10,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Dispatches a generic transactional email with HTML and optional plain-text fallbacks.
    /// </summary>
    Task<bool> SendEmailAsync(
        string recipientEmail,
        string recipientName,
        string subject,
        string htmlBody,
        string? plainTextBody = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Indicates whether the email dispatch service has valid SMTP credentials configured.
    /// </summary>
    bool IsConfigured { get; }
}

