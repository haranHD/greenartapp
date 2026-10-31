using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using Greenart.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Greenart.Infrastructure.Services;

/// <summary>
/// SMTP email dispatch service supporting Google Workspace / Business Gmail and standard SMTP relays.
/// Formats institutional Greenart Properties branded emails for OTP verification and transactional notices.
/// </summary>
public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailService> _logger;

    private readonly string _host;
    private readonly int _port;
    private readonly bool _enableSsl;
    private readonly string _username;
    private readonly string _password;
    private readonly string _fromEmail;
    private readonly string _fromName;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_username) && !string.IsNullOrWhiteSpace(_password);

    public SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;

        // Resolve host (default smtp.gmail.com)
        _host = Environment.GetEnvironmentVariable("SMTP_HOST")
            ?? _configuration["EmailSettings:SmtpHost"]
            ?? "smtp.gmail.com";

        // Resolve port (default 587 for TLS)
        var portStr = Environment.GetEnvironmentVariable("SMTP_PORT")
            ?? _configuration["EmailSettings:SmtpPort"];
        _port = int.TryParse(portStr, out var parsedPort) && parsedPort > 0 ? parsedPort : 587;

        // Resolve SSL (default true)
        var sslStr = Environment.GetEnvironmentVariable("SMTP_ENABLE_SSL")
            ?? _configuration["EmailSettings:EnableSsl"];
        _enableSsl = !bool.TryParse(sslStr, out var parsedSsl) || parsedSsl;

        // Resolve credentials (supports SMTP_USERNAME / GMAIL_ADDRESS and SMTP_PASSWORD / GMAIL_APP_PASSWORD)
        _username = (Environment.GetEnvironmentVariable("SMTP_USERNAME")
            ?? Environment.GetEnvironmentVariable("GMAIL_ADDRESS")
            ?? _configuration["EmailSettings:Username"]
            ?? string.Empty).Trim();

        _password = (Environment.GetEnvironmentVariable("SMTP_PASSWORD")
            ?? Environment.GetEnvironmentVariable("GMAIL_APP_PASSWORD")
            ?? _configuration["EmailSettings:Password"]
            ?? string.Empty).Trim();

        // Resolve sender details
        _fromEmail = (Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL")
            ?? _configuration["EmailSettings:FromEmail"]
            ?? (string.IsNullOrWhiteSpace(_username) ? "noreply@greenartproperties.com" : _username)).Trim();

        _fromName = (Environment.GetEnvironmentVariable("SMTP_FROM_NAME")
            ?? _configuration["EmailSettings:FromName"]
            ?? "Greenart Properties").Trim();

        if (IsConfigured)
        {
            _logger.LogInformation(
                "SmtpEmailService initialized for host {Host}:{Port} with sender identity {SenderEmail} (SSL={Ssl}).",
                _host, _port, _fromEmail, _enableSsl);
        }
        else
        {
            _logger.LogWarning(
                "SmtpEmailService is not fully configured (SMTP_USERNAME or SMTP_PASSWORD is not set). Real email dispatch will be bypassed.");
        }
    }

    public async Task<bool> SendOtpEmailAsync(
        string recipientEmail,
        string recipientName,
        string otpCode,
        int expirationMinutes = 10,
        CancellationToken cancellationToken = default)
    {
        var subject = $"Greenart Properties — Account Verification Code ({otpCode})";
        var safeRecipientName = string.IsNullOrWhiteSpace(recipientName) ? "Valued Client" : recipientName.Trim();

        var plainText = GeneratePlainTextOtpBody(safeRecipientName, otpCode, expirationMinutes);
        var htmlBody = GenerateHtmlOtpBody(safeRecipientName, otpCode, expirationMinutes);

        return await SendEmailAsync(recipientEmail, safeRecipientName, subject, htmlBody, plainText, cancellationToken);
    }

    public async Task<bool> SendEmailAsync(
        string recipientEmail,
        string recipientName,
        string subject,
        string htmlBody,
        string? plainTextBody = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            _logger.LogWarning("SendEmailAsync aborted: Recipient email address is null or empty.");
            return false;
        }

        if (!IsConfigured)
        {
            _logger.LogWarning(
                "SMTP dispatch to {Recipient} skipped: SMTP_USERNAME or SMTP_PASSWORD not configured. Check environment variables or appsettings.json.",
                recipientEmail);
            return false;
        }

        try
        {
            using var message = new MailMessage();
            message.From = new MailAddress(_fromEmail, _fromName, Encoding.UTF8);
            message.To.Add(new MailAddress(recipientEmail.Trim(), recipientName.Trim(), Encoding.UTF8));
            message.Subject = subject;
            message.SubjectEncoding = Encoding.UTF8;
            message.BodyEncoding = Encoding.UTF8;
            message.HeadersEncoding = Encoding.UTF8;

            if (!string.IsNullOrWhiteSpace(plainTextBody))
            {
                var plainView = AlternateView.CreateAlternateViewFromString(plainTextBody, Encoding.UTF8, MediaTypeNames.Text.Plain);
                message.AlternateViews.Add(plainView);
            }

            var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, MediaTypeNames.Text.Html);
            message.AlternateViews.Add(htmlView);
            message.IsBodyHtml = true;

            using var client = new SmtpClient(_host, _port)
            {
                EnableSsl = _enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_username, _password),
                Timeout = 15000 // 15-second timeout
            };

            _logger.LogInformation("Dispatching SMTP email to {Recipient} via {Host}:{Port}...", recipientEmail, _host, _port);
            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("SMTP email successfully delivered to {Recipient}.", recipientEmail);
            return true;
        }
        catch (SmtpException smtpEx)
        {
            _logger.LogError(smtpEx, "SMTP error while sending email to {Recipient} via {Host}:{Port}: {Message} (StatusCode={StatusCode})",
                recipientEmail, _host, _port, smtpEx.Message, smtpEx.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error dispatching email to {Recipient} via SMTP: {Message}",
                recipientEmail, ex.Message);
            return false;
        }
    }

    private static string GeneratePlainTextOtpBody(string name, string otpCode, int expirationMinutes)
    {
        return $@"Hello {name},

Thank you for registering with Greenart Properties — Tamil Nadu's Land Market Rate Analyst.

Your single-use account verification code is:
=========================================
  {otpCode}
=========================================

This verification code will expire in {expirationMinutes} minutes.

Security Notice:
Greenart Properties representatives will never ask for your password, PIN, or OTP over the phone or email.
If you did not initiate this request, please safely disregard this email.

— Greenart Properties Team
Institutional Land Market Intelligence & Verified Marketplace";
    }

    private static string GenerateHtmlOtpBody(string name, string otpCode, int expirationMinutes)
    {
        return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>Greenart Properties Verification Code</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #F8F9FA;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1A1A1A;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      background-color: #F8F9FA;
      padding: 40px 15px;
    }}
    .container {{
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(36, 0, 70, 0.08);
      border: 1px solid #ECECEC;
    }}
    .header {{
      background: linear-gradient(135deg, #240046 0%, #3C096C 100%);
      padding: 36px 30px;
      text-align: center;
      border-bottom: 3px solid #D4AF37;
    }}
    .brand-title {{
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 0;
      text-transform: uppercase;
    }}
    .brand-subtitle {{
      color: #D4AF37;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-top: 6px;
      text-transform: uppercase;
    }}
    .content {{
      padding: 36px 32px;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 700;
      color: #240046;
      margin-top: 0;
      margin-bottom: 14px;
    }}
    .message-body {{
      font-size: 15px;
      line-height: 1.6;
      color: #4A4A4A;
      margin-bottom: 24px;
    }}
    .otp-card {{
      background-color: #FAF7EE;
      border: 2px dashed #D4AF37;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      margin: 28px 0;
    }}
    .otp-label {{
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #7B6220;
      margin-bottom: 8px;
    }}
    .otp-code {{
      font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #240046;
      margin: 0;
      padding-left: 10px;
    }}
    .otp-expiry {{
      font-size: 12px;
      color: #8C7335;
      margin-top: 8px;
      font-weight: 600;
    }}
    .security-notice {{
      background-color: #FBFBFD;
      border-left: 4px solid #D4AF37;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      line-height: 1.5;
      color: #555555;
      margin-bottom: 28px;
    }}
    .security-title {{
      font-weight: 700;
      color: #240046;
      display: block;
      margin-bottom: 4px;
    }}
    .footer {{
      background-color: #F8F9FA;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #ECECEC;
      font-size: 12px;
      color: #8E8E93;
      line-height: 1.5;
    }}
    .footer-brand {{
      color: #240046;
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <div class=""wrapper"">
    <div class=""container"">
      <div class=""header"">
        <h1 class=""brand-title"">Greenart Properties</h1>
        <div class=""brand-subtitle"">Land Market Rate Analyst</div>
      </div>
      <div class=""content"">
        <h2 class=""greeting"">Hello {WebUtility.HtmlEncode(name)},</h2>
        <p class=""message-body"">
          Thank you for choosing <strong>Greenart Properties</strong> — Tamil Nadu's institutional platform for verified land price intelligence, valuation analytics, and transparent marketplace listings.
        </p>
        <p class=""message-body"">
          Please enter the single-use 6-digit verification code below in your mobile application to verify your email address and activate your account:
        </p>
        <div class=""otp-card"">
          <div class=""otp-label"">One-Time Passcode (OTP)</div>
          <div class=""otp-code"">{WebUtility.HtmlEncode(otpCode)}</div>
          <div class=""otp-expiry"">&#x23F1; Valid for {expirationMinutes} minutes</div>
        </div>
        <div class=""security-notice"">
          <span class=""security-title"">&#x1F512; Security Advisory</span>
          For your account security, never disclose this code to anyone. Greenart Properties representatives will never ask you for your verification code or password over phone, WhatsApp, or email.
        </div>
        <p class=""message-body"" style=""font-size: 13px; color: #777777; margin-bottom: 0;"">
          If you did not initiate this registration or sign-in request, please safely ignore this email. No changes have been made to your account.
        </p>
      </div>
      <div class=""footer"">
        <p style=""margin: 0 0 6px 0;"">
          <span class=""footer-brand"">Greenart Properties</span> &bull; Tamil Nadu Statewide Coverage
        </p>
        <p style=""margin: 0 0 6px 0;"">
          PostGIS Spatial Intelligence &bull; TNREGINET Statutory Benchmarks &bull; Verified Ownership
        </p>
        <p style=""margin: 0; font-size: 11px; color: #A0A0A0;"">
          This is an automated operational notification. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  </div>
</body>
</html>";
    }
}

