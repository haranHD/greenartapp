var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Greenart Properties API", Version = "v1" });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Greenart Properties API v1"));
}

app.UseHttpsRedirection();

app.MapGet("/api/v1/health", () => Results.Ok(new
{
    Status = "Healthy",
    Application = "Greenart Properties — Land Market Rate Analyst API",
    Environment = app.Environment.EnvironmentName,
    TimestampUtc = DateTime.UtcNow
}))
.WithName("HealthCheck")
.WithOpenApi();

app.Run();
