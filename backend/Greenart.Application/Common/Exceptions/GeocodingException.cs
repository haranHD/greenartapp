namespace Greenart.Application.Common.Exceptions;

public enum GeocodingFailure { NotConfigured, PermissionDenied, RateLimited, Timeout, InvalidResponse, Unavailable }

public sealed class GeocodingException : Exception
{
    public GeocodingFailure Failure { get; }
    public GeocodingException(GeocodingFailure failure) : base(failure switch
    {
        GeocodingFailure.NotConfigured => "Location search is not configured. You can choose the property on the map.",
        GeocodingFailure.PermissionDenied => "Location search is unavailable because the provider rejected access. You can choose the property on the map.",
        GeocodingFailure.RateLimited => "Location search is busy. Please wait a moment and try again, or choose the property on the map.",
        GeocodingFailure.Timeout => "Location search timed out. Please try again or choose the property on the map.",
        _ => "Location search is temporarily unavailable. Please try again or choose the property on the map."
    }) => Failure = failure;
}
