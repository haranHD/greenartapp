namespace Greenart.Application.Common.Exceptions;

public sealed class EmailDeliveryException : Exception
{
    public EmailDeliveryException() : base("Verification email could not be sent. Please try again shortly. If the issue continues, contact support.") { }
}
