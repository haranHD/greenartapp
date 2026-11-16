namespace Greenart.Application.Common.Exceptions;

public enum LandLensFailure
{
    Authentication,
    PermissionDenied,
    RateLimited,
    InsufficientCredits,
    Unavailable,
    InvalidResponse,
    Timeout
}

/// <summary>Sanitized provider failure. Never contains a credential or upstream response body.</summary>
public sealed class LandLensUpstreamException : Exception
{
    public LandLensFailure Failure { get; }
    public int? RetryAfterSeconds { get; }
    public bool ChargeOutcomeUnknown { get; }

    public LandLensUpstreamException(LandLensFailure failure, int? retryAfterSeconds = null,
        bool chargeOutcomeUnknown = false) : base(failure switch
    {
        LandLensFailure.Authentication => "LandLens could not authenticate the configured account.",
        LandLensFailure.PermissionDenied => "The configured LandLens account does not have access to this tool.",
        LandLensFailure.RateLimited => "LandLens is temporarily rate limited. Please try again later.",
        LandLensFailure.InsufficientCredits => "The LandLens account does not have enough credits for this operation.",
        LandLensFailure.InvalidResponse => "LandLens returned an unexpected response. Please try again later.",
        LandLensFailure.Timeout => "LandLens did not respond in time. Please try again later.",
        _ => "LandLens is temporarily unavailable. Please try again later."
    })
    {
        Failure = failure;
        RetryAfterSeconds = retryAfterSeconds;
        ChargeOutcomeUnknown = chargeOutcomeUnknown;
    }
}
