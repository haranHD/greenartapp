# Stage 1: Build .NET 8 API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files and restore dependencies
COPY ["backend/Greenart.Domain/Greenart.Domain.csproj", "backend/Greenart.Domain/"]
COPY ["backend/Greenart.Application/Greenart.Application.csproj", "backend/Greenart.Application/"]
COPY ["backend/Greenart.Infrastructure/Greenart.Infrastructure.csproj", "backend/Greenart.Infrastructure/"]
COPY ["backend/Greenart.Api/Greenart.Api.csproj", "backend/Greenart.Api/"]

RUN dotnet restore "backend/Greenart.Api/Greenart.Api.csproj"

# Copy full source and build release
COPY . .
WORKDIR "/src/backend/Greenart.Api"
RUN dotnet publish "Greenart.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose standard port
ENV ASPNETCORE_HTTP_PORTS=5039
EXPOSE 5039

ENTRYPOINT ["dotnet", "Greenart.Api.dll"]

