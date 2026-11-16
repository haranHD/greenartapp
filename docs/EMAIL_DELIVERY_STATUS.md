# OTP email delivery status

Updated 16 November 2026.

## Confirmed configuration and code issue

The local configuration contains both Resend credentials and Gmail SMTP credentials. The current provider-selection order selects Resend first. The configured general sender is a Gmail address.

The previous Resend implementation silently replaced configured senders with onboarding@resend.dev unless the sender already ended in resend.dev. Resend documents that its test domain only permits sending to the email address associated with the Resend account. This prevents using that implementation for general customer registration.

## Local corrections

- Resend now uses RESEND_FROM_EMAIL (or EmailSettings:ResendFromEmail), falling back to the configured general sender. It never silently substitutes onboarding@resend.dev.
- A Gmail address is rejected as a Resend sender. Presence of a Resend key alone no longer means delivery is configured correctly.
- Provider HTTP calls are injectable and bounded by a 15-second timeout in API registration, so transport behavior is covered by mocked tests.
- Provider rejection returns unsuccessful dispatch. Provider acceptance is logged as acceptance, not confirmed inbox delivery. Raw provider response bodies are not logged.
- Unit validation: 213 tests passed, including configured sender preservation, invalid Gmail sender, explicit test-domain use, and provider rejection.

## Pending setup and verification

The user confirmed ownership of greenart.group. A read-only Resend domain-list request returned HTTP 403, so the configured credential could not confirm domain verification. This does not establish whether the domain is verified or whether email-sending permission is valid. No domain, DNS or email changes were made by that check.

1. Confirm the intended sending domain and sender address.
2. Review the exact DNS records Resend requires. DNS/account changes require approval before applying them.
3. Confirm domain verification and configure the selected sender locally/for deployment.
4. With explicit approval and a recipient address, send one real registration email and confirm inbox receipt and successful OTP verification.
5. Add delivery/bounce monitoring as part of production preparation.

No test email has been sent in this diagnostic task. No domain, DNS, account, or billing changes have been made. A real failed-send log has not yet been inspected, so additional issues such as an invalid key or recipient suppression remain unverified.

[Resend's test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)


## Local SMTP unblock

- Added explicit EMAIL_PROVIDER selection (Auto, SMTP/Gmail, Resend, or Brevo). A configured Resend key cannot override an explicit SMTP choice. Invalid provider names fail configuration instead of selecting a different provider.
- Selected EMAIL_PROVIDER=SMTP in the ignored local .env. Production domain verification remains separate; existing Resend credentials were retained.
- Gmail STARTTLS authentication succeeded with SMTP status 235. That check sent no message.
- Identified and restarted only the GreenArt API previously listening on local port 5039, preserving its process environment and disabling database startup migrations/seeding. The live diagnostic now reports provider Smtp and configured true.
- A delivery failure now returns HTTP 503 with email_delivery_unavailable rather than HTTP 409 account conflict.
- Current unit suite: 215 passed. With explicit user approval, exactly one real registration OTP request was made for the screenshot-provided address through the restarted local API. It returned HTTP 200 with no OTP hint exposed. Inbox receipt and actual code verification still require user confirmation.


The registration form now offers an "Already have a code? Enter it" action for resuming an existing email challenge. It changes only the displayed step: the code must still be verified by the backend before password setup or authentication. This avoids sending a second code just to recover the verification screen.

A mocked HTTP regression confirms that an email-delivery failure returns 503/email_delivery_unavailable rather than an account-conflict response. The API build completed without warnings or errors.


The mobile API client no longer automatically replays a failed request against a different backend or changes its active API URL. In particular, an uncertain OTP send is not duplicated against the hosted environment. A regression test covers this behavior.
