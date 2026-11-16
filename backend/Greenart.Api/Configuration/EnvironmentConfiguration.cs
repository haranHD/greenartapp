using Microsoft.Extensions.Configuration.EnvironmentVariables;

namespace Greenart.Api.Configuration;

public static class EnvironmentConfiguration
{
    // .env values are installed after CreateBuilder. Reload the existing providers so
    // they see those values without adding a new provider or changing precedence.
    public static void RefreshEnvironmentProviders(IConfigurationRoot configuration)
    {
        foreach (var provider in configuration.Providers.OfType<EnvironmentVariablesConfigurationProvider>())
            provider.Load();
    }
}
