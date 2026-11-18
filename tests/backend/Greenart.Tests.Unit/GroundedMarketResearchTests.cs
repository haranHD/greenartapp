using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.MarketResearch;
using Greenart.Domain.Enums;
using Greenart.Domain.Entities;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
namespace Greenart.Tests.Unit;
public class GroundedMarketResearchTests
{
    private static LandResearchInput Input() => new(Guid.NewGuid(), 11.4471, 77.684, "Bhavani", "Erode", "Bhavani",
        LandUsageType.Residential, 5, "Cent", 1000, "Layout Road", "", Enumerable.Range(1,3).Select(i => new AuthorizedMarketSourceInput("Client source " + i,
            "https://listings.example.com/plot-" + i, "private-contract-reference: client permits retrieval, storage and public evidence display", true, true)).ToArray());
    private static MarketEvidenceCandidate Observation(int i = 1) => new() {
        SourceCategory = "AdvertisedAskingPrice", Currency = "INR", SourceName = "Listing " + i, SourceUrl = "https://listings.example.com/plot-" + i,
        LandCategory = 1, Latitude = 11.4471 + i * .0001, Longitude = 77.684,
        Area = 5, AreaUnit = "Cent", AskingPrice = (20 + i) * 100000,
        ObservationDate = DateTime.UtcNow.Date.AddDays(-2), AskingContextQuote = "Residential land for sale", PriceQuote = "₹" + (20 + i) + " lakh", AreaQuote = "5 cents",
        DateQuote = DateTime.UtcNow.Date.AddDays(-2).ToString("yyyy-MM-dd"), LocationQuote = "Bhavani, Erode",
        CategoryQuote = "Residential land", CoordinateQuote = (11.4471 + i * .0001).ToString(System.Globalization.CultureInfo.InvariantCulture) + ", 77.684"
    };
    private static RetrievedMarketSource Source(MarketEvidenceCandidate e, string? text = null) => new("Retrieved", e.SourceUrl,
        text ?? string.Join(" | ", e.AskingContextQuote, e.PriceQuote, e.AreaQuote, e.DateQuote, e.LocationQuote, e.CategoryQuote, e.CoordinateQuote), DateTime.UtcNow);
    [Fact] public void SupportedSourceIsNormalisedInBackendDecimalArithmetic() {
        var e = Observation(); var result = MarketEvidenceValidator.Validate(e, Source(e), Input(), new HashSet<string> { e.SourceUrl }, 1, DateTime.UtcNow);
        Assert.Equal("EligibleAskingObservation", result.Status); Assert.Equal(2178m, result.AreaSqFt);
        Assert.Equal(420000m, result.RatePerCent); Assert.Equal(Math.Round(2100000m / 2178, 2), result.RatePerSqFt);
    }
    [Theory] [InlineData("MissingDate")] [InlineData("WrongLocality")] [InlineData("WrongCategory")] [InlineData("MissingCoordinates")]
    [InlineData("WrongArea")] [InlineData("UnsupportedSource")] [InlineData("WrongPrice")] [InlineData("Ungrounded")]
    [InlineData("OutsideRadius")] [InlineData("MissingQuote")]
    public void UnsupportedObservationsAreNotEligible(string scenario) {
        var e = Observation(); var source = Source(e);
        switch (scenario) {
            case "MissingDate": e.ObservationDate = null; break;
            case "WrongLocality": e.LocationQuote = "Chennai, Chennai"; break;
            case "WrongCategory": e.LandCategory = 2; break;
            case "MissingCoordinates": e.Latitude = null; break;
            case "WrongArea": e.Area = 8; break;
            case "UnsupportedSource": e.SourceCategory = "VerifiedTransaction"; break;
            case "WrongPrice": e.AskingPrice = -1; break;
            case "OutsideRadius": e.Latitude = 12.0; break;
            case "MissingQuote": source = Source(e, "Listing did not state any amounts"); break;
        }
        var result = MarketEvidenceValidator.Validate(e, source, Input(), scenario == "Ungrounded" ? new HashSet<string>() : new HashSet<string>{e.SourceUrl}, 1, DateTime.UtcNow);
        Assert.Equal("Rejected", result.Status); Assert.NotEmpty(result.Checks);
    }
    [Fact] public void DuplicateObservationsDoNotIncreaseIndependentSourceCount() {
        var e = Observation(); var a = MarketEvidenceValidator.Validate(e, Source(e), Input(), new HashSet<string>{e.SourceUrl}, 1, DateTime.UtcNow);
        var b = MarketEvidenceValidator.Validate(e, Source(e), Input(), new HashSet<string>{e.SourceUrl}, 2, DateTime.UtcNow);
        MarketEvidenceValidator.Deduplicate(new[] { a, b }); Assert.Equal("Rejected", b.Status);
    }
    [Theory] [InlineData("https://127.0.0.1/test")] [InlineData("http://example.com")]
    [InlineData("https://169.254.169.254/latest/meta-data")][InlineData("https://10.0.0.1")]
    [InlineData("https://user:pass@example.com")][InlineData("https://example.com:8443")]
    [InlineData("https://metadata.google.internal")][InlineData("file:///etc/passwd")]
    public void RetrievalRejectsPrivateAndUnsupportedDestinations(string url) => Assert.False(SafeMarketEvidenceRetriever.IsPublicUrl(url));
    [Fact] public void ReviewCannotPassWithContradictionsUnknownIdsOrWrongArithmetic() {
        foreach (var issue in new[] { "unknown", "arithmetic", "contradiction", "location", "category" }) {
            var r = new MarketEvidenceReview { Status = "PassedEvidenceReview", AcceptedEvidenceIds = ["e1", "e2", "e3"] };
            if (issue == "unknown") r.AcceptedEvidenceIds = ["e1", "e2", "invented"];
            if (issue == "arithmetic") r.CalculationErrors = ["Incorrect conversion"];
            if (issue == "contradiction") r.Contradictions = ["Source amounts conflict"];
            r.LocationMismatch = issue == "location"; r.CategoryMismatch = issue == "category";
            Assert.Equal("NeedsManualReview", LandMarketResearchService.EnforceReview(r, [new(){Id="e1"},new(){Id="e2"},new(){Id="e3"}], 3).Status);
        }
    }
    [Fact] public async Task ValidGroundingAndSeparateReviewProduceOnlyAProvisionalAskingRange() {
        var handler = new GeminiHandler(); var service = Service(handler, new Retriever());
        var outcome = await service.AnalyzeAsync(Input(), default);
        Assert.Equal("PassedEvidenceReview", outcome.Review.Status); Assert.Equal("AIResearchEstimate", outcome.Research.SourceCategory);
        Assert.Equal(420000m, outcome.Research.LowPerCent); Assert.Equal(460000m, outcome.Research.HighPerCent);
        Assert.Equal(440000m, outcome.Research.TypicalPerCent); Assert.Equal(2, handler.Calls); Assert.False(handler.FirstWasGrounded); Assert.False(handler.SecondWasGrounded);
        Assert.Equal("AuthorizedSourcesRetrieved", outcome.Research.GroundingStatus); Assert.DoesNotContain("private-contract-reference", handler.Prompts);
        Assert.Equal(3, outcome.Research.SourceCount); Assert.Equal(300, outcome.Research.TotalTokens);
    }
    [Theory] [InlineData("MissingEvidence")] [InlineData("RetrievalFailure")] [InlineData("WrongSource")]
    public async Task UnusableFirstStageSkipsSecondCallAndReturnsNoPrice(string issue) {
        var handler = new GeminiHandler { Issue = issue }; var retriever = new Retriever { Fails = issue == "RetrievalFailure" };
        var result = await Service(handler, retriever).AnalyzeAsync(Input(), default);
        Assert.Null(result.Research.LowPerCent); Assert.NotEqual("PassedEvidenceReview", result.Research.Status);
        Assert.Equal(issue == "RetrievalFailure" ? 0 : 1, handler.Calls); Assert.Equal(0, result.Review.AttemptedCalls);
    }
    [Fact] public async Task ProviderTimeoutNeverProducesANumericRange() {
        var result = await Service(new GeminiHandler { Issue = "Timeout" }, new Retriever()).AnalyzeAsync(Input(), default);
        Assert.Equal("Timeout", result.Research.Status); Assert.Null(result.Research.TypicalPerCent);
    }
    [Fact] public async Task ChangedSourceOnSecondRetrievalRequiresManualReviewAndSkipsSecondModel() {
        var handler = new GeminiHandler(); var result = await Service(handler, new Retriever { Changes = true }).AnalyzeAsync(Input(), default);
        Assert.Equal("NeedsManualReview", result.Review.Status); Assert.Equal(1, handler.Calls); Assert.Null(result.Research.LowPerCent);
    }
    [Fact] public void BrokerComparisonIsADiscrepancyMetricAndDoesNotOverwriteAi() {
        var r = new PriceResearch("Bhavani", "Erode", 11.4471, 77.684, LandUsageType.Residential, 500, "Road", "");
        var opinion = new BrokerMarketObservation(r, r.Version, "Broker", "b1", "internal contact", "Bhavani", "Independent observations", "High", "", 400000, 500000, 600000, DateTime.UtcNow.AddDays(-1), 400000, "admin");
        Assert.Equal(20m, opinion.DifferencePercentage); Assert.Equal("BrokerMarketOpinion", opinion.SourceCategory);
        Assert.Throws<ArgumentException>(() => new BrokerMarketObservation(r, r.Version, "Broker", "", "", "", "", "", "", 400000, 900000, 500000, DateTime.UtcNow, null, "admin"));
    }
    [Fact] public async Task StandardGroundingTermsDoNotEnableDatabaseCollectionWithoutExplicitRights() {
        var handler = new GeminiHandler();
        var config = new TestConfiguration(new Dictionary<string,string?> { ["PRICE_RESEARCH_ENABLED"]="true", ["MARKET_RESEARCH_SOURCE_MODE"]="GoogleSearch", ["GEMINI_API_KEY"]="test-key", ["PRICE_RESEARCH_GEMINI_MODEL"]="test-model" });
        var result = await new LandMarketResearchService(new HttpClient(handler), config, new Retriever()).AnalyzeAsync(Input(), default);
        Assert.Equal("GroundingUnavailable", result.Research.Status); Assert.Equal(0, handler.Calls);
    }
    [Theory] [InlineData(false)] [InlineData(true)]
    public async Task MissingOrUnauthorisedSourcesNeverStartAModelCall(bool missing) {
        var handler = new GeminiHandler();
        var input = Input() with { AuthorizedSources = missing ? [] : Input().AuthorizedSources!.Select(s => s with { RetrievalAndStorageAuthorized = false }).ToArray() };
        var result = await Service(handler, new Retriever()).AnalyzeAsync(input, default);
        Assert.Equal("InsufficientEvidence", result.Research.Status); Assert.Equal("AuthorizedSourcesMissing", result.Research.GroundingStatus);
        Assert.Equal(0, handler.Calls); Assert.Null(result.Research.LowPerCent);
    }
    [Theory] [InlineData("https://example.com/listing?api_key=private")][InlineData("https://example.com/listing?access_token=private")]
    public void SourceReferencesCannotContainCredentials(string url) => Assert.False(SafeMarketEvidenceRetriever.IsPublicUrl(url));
    private static LandMarketResearchService Service(GeminiHandler handler, Retriever retriever) => new(new HttpClient(handler),
        new TestConfiguration(new Dictionary<string,string?> { ["PRICE_RESEARCH_ENABLED"]="true",["GEMINI_API_KEY"]="test-only-key",["PRICE_RESEARCH_GEMINI_MODEL"]="test-model" }), retriever);
    private class TestConfiguration(Dictionary<string,string?> values) : IConfiguration {
        public string? this[string key] { get => values.GetValueOrDefault(key); set => values[key] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => [];
        public IConfigurationSection GetSection(string key) => throw new NotSupportedException();
        public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => throw new NotSupportedException();
    }
    private class Retriever : IMarketEvidenceRetriever {
        public bool Fails; public bool Changes; private int calls;
        public Task<RetrievedMarketSource> RetrieveAsync(string url, CancellationToken ct) {
            calls++; var e = Observation(int.Parse(url.Split('-').Last()));
            return Task.FromResult(Fails || Changes && calls > 3 ? new RetrievedMarketSource("RetrievalFailed", url, "", DateTime.UtcNow) : Source(e));
        }
    }
    private class GeminiHandler : HttpMessageHandler {
        public string Prompts = ""; public int Calls; public string Issue=""; public bool FirstWasGrounded; public bool SecondWasGrounded;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Calls++; if (Issue == "Timeout") throw new TaskCanceledException();
            var requestBody = await request.Content!.ReadAsStringAsync(ct); Prompts += requestBody;
            var payload = JsonDocument.Parse(requestBody).RootElement;
            if (Calls == 1) FirstWasGrounded = payload.TryGetProperty("tools", out _); else SecondWasGrounded = payload.TryGetProperty("tools", out _);
            var evidence = Enumerable.Range(1, 3).Select(Observation).ToArray();
            if (Issue == "WrongSource") evidence[0].SourceUrl = "https://invented.example.com/plot-1";
            var answer = Calls == 1 ? JsonSerializer.Serialize(new { evidenceItems = Issue == "MissingEvidence" ? Array.Empty<MarketEvidenceCandidate>() : evidence, assumptions = Array.Empty<string>(), limitations = Array.Empty<string>() })
                : JsonSerializer.Serialize(new { status="PassedEvidenceReview", evidenceQuality="Adequate asking observations", acceptedEvidenceIds=new[]{"e1","e2","e3"}, rejectedEvidenceIds=Array.Empty<string>(),calculationErrors=Array.Empty<string>(),locationMismatch=false,categoryMismatch=false,contradictions=Array.Empty<string>(),recommendedCorrections=Array.Empty<string>() });
            var c = new Dictionary<string,object> { ["content"]=new {parts=new[]{new{text=answer}}} };
            if (Issue != "NoGrounding") c["groundingMetadata"] = new { groundingChunks = Enumerable.Range(1,3).Select(i=>new{web=new{uri=Observation(i).SourceUrl,title="Listing"}}).ToArray(), webSearchQueries = new[]{"Bhavani Erode residential land"} };
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { candidates=new[]{c}, usageMetadata=new{promptTokenCount=100,candidatesTokenCount=200,totalTokenCount=300} }) };
        }
    }
}
