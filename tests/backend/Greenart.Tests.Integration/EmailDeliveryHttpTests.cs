using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using Greenart.Application.Common.Exceptions;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Greenart.Tests.Integration;

public class EmailDeliveryHttpTests
{
    [Fact]
    public async Task FailedEmailDelivery_Returns503_NotAnAccountConflict()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Database:InitializeOnStartup", "false");
            builder.UseSetting("JWT_SECRET_KEY", "EmailTestOnlySigningKeyWithMoreThan32Characters!");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IAuthService>();
                services.AddSingleton(DispatchProxy.Create<IAuthService, FailingEmailAuthProxy>());
            });
        });
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/auth/register/request-otp",
            new RequestOtpRequestDto("test@example.com", "Test"));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("email_delivery_unavailable", body);
        Assert.DoesNotContain("DevOtpHint", body);
    }

    public class FailingEmailAuthProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? method, object?[]? args) =>
            method?.Name == nameof(IAuthService.RequestOtpAsync)
                ? Task.FromException<RequestOtpResponseDto>(new EmailDeliveryException())
                : throw new NotSupportedException();
    }
}
