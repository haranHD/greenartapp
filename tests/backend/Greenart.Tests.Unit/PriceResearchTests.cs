using System.Net;
using System.Text.Json;
using Greenart.Domain.Entities;
using Greenart.Domain.Enums;
using Greenart.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Greenart.Tests.Unit;
public class PriceResearchTests
{
    private static PriceResearch Draft() => new("Bhavani", "Erode", 11.4471, 77.684, LandUsageType.Residential, 500, "Layout Road", "Near schools");
    private static void Review(PriceResearch item) => item.RecordBrokerReview("Local broker", "Cross-checked three local plots with dated property references.", 3, 400000, 500000, DateTime.UtcNow.AddDays(-1));
    [Fact] public void CannotPublishAiProposalWithoutBrokerReview() {
        var item = Draft(); item.StartResearch(); item.FinishResearch("[]");
        Assert.Throws<InvalidOperationException>(() => item.Approve(400000, 500000, DateTime.UtcNow.AddDays(30), "Checked", "admin"));
    }
    [Fact] public void ApprovalRetainsBrokerRangeWhenAdminRevisesIt() {
        var item = Draft(); var version = item.Version; Review(item);
        Assert.NotEqual(version, item.Version);
        item.Approve(410000, 490000, DateTime.UtcNow.AddDays(30), "Adjusted after cross-check", "admin-1");
        Assert.Equal("Approved", item.Status); Assert.Equal(400000m, item.BrokerLowPerCent);
        Assert.Equal(410000m, item.LowPerCent); Assert.Equal("admin-1", item.ReviewedBy);
        Assert.Throws<InvalidOperationException>(() => Review(item));
        item.Withdraw("Broker reported changed conditions", "admin-2"); Assert.Equal("Withdrawn", item.Status);
    }
    [Theory] [InlineData(0, 500000)] [InlineData(600000, 500000)] [InlineData(400000, 1000000001)]
    public void RejectsInvalidBrokerRanges(int low, long high) {
        Assert.Throws<ArgumentException>(() => Draft().RecordBrokerReview("Broker", "Checked against documented local observations.", 3, low, high, DateTime.UtcNow.AddDays(-1)));
    }
    [Fact] public void RejectsStaleOrFutureEvidenceAndExcessiveExpiry() {
        Assert.Throws<ArgumentException>(() => Draft().RecordBrokerReview("Broker", "Checked against documented local observations.", 3, 4, 5, DateTime.UtcNow.AddDays(-91)));
        Assert.Throws<ArgumentException>(() => Draft().RecordBrokerReview("Broker", "Checked against documented local observations.", 3, 4, 5, DateTime.UtcNow.AddDays(1)));
        var item = Draft(); Review(item);
        Assert.Throws<ArgumentException>(() => item.Approve(400000, 500000, DateTime.UtcNow.AddDays(90), "Checked", "admin"));
    }
    [Fact] public void RejectedResearchCannotBePublished() {
        var item = Draft(); Review(item); item.Reject("Evidence does not match the selected parcel", "admin");
        Assert.Throws<InvalidOperationException>(() => item.Approve(400000, 500000, DateTime.UtcNow.AddDays(30), "Checked", "admin"));
    }
    [Fact] public void CannotOverwriteSavedModelProposals() {
        var item = Draft(); item.StartResearch(); item.FinishResearch("[{\"status\":\"NoEstimate\"}]");
        Assert.Throws<InvalidOperationException>(() => item.StartResearch());
    }
    [Theory] [InlineData(double.NaN, 77)] [InlineData(11, double.PositiveInfinity)] [InlineData(0, 0)]
    public void RejectsInvalidCoordinates(double lat, double lng) => Assert.Throws<ArgumentException>(() => new PriceResearch("A", "B", lat, lng, LandUsageType.Residential, 500, "Road", ""));
    [Theory] [InlineData("USD", "Cent")] [InlineData("INR", "Acre")] [InlineData("INR", "SqFt")]
    public void RejectsModelUnitOrCurrencyMismatch(string currency, string unit) {
        var json = JsonSerializer.Serialize(new { currency, unit, lowPerCent = 4, highPerCent = 5, reasoning = "Guess", sources = Array.Empty<string>() });
        Assert.Throws<ArgumentException>(() => PriceResearchModels.ParseProposal("test", "model", json));
    }
    [Fact] public void NullEstimateNeverInventsARange() {
        var proposal = PriceResearchModels.ParseProposal("test", "model", """{"currency":"INR","unit":"Cent","lowPerCent":null,"highPerCent":null,"reasoning":"No reliable evidence","sources":[]}""");
        Assert.Equal("NoEstimate", proposal.Status); Assert.Null(proposal.LowPerCent);
    }
    [Fact] public async Task DisabledProvidersMakeNoNetworkRequestsEvenIfKeysExist() {
        var config = new DictionaryConfiguration(new Dictionary<string,string?> { ["OPENAI_API_KEY"] = "private-test-key", ["PRICE_RESEARCH_OPENAI_MODEL"] = "test" });
        var handler = new FakeHandler(); var service = new PriceResearchModels(new HttpClient(handler), config);
        var result = await service.ResearchAsync(Draft(), default);
        Assert.All(result, r => Assert.Equal("NotConfigured", r.Status)); Assert.Equal(0, handler.Calls);
    }
    [Fact] public async Task OneProviderFailureDoesNotDiscardOthersOrLeakSecrets() {
        var settings = new Dictionary<string,string?> { ["PRICE_RESEARCH_ENABLED"] = "true" };
        foreach (var provider in new[] { "OpenAI", "Claude", "Gemini" }) { settings[$"PriceResearch:{provider}:ApiKey"] = "private-test-key"; settings[$"PriceResearch:{provider}:Model"] = "test-model"; }
        var handler = new FakeHandler();
        var service = new PriceResearchModels(new HttpClient(handler), new DictionaryConfiguration(settings));
        var result = await service.ResearchAsync(Draft(), default);
        Assert.Equal(3, handler.Calls); Assert.Equal("Proposed", result.Single(x => x.Provider == "OpenAI").Status);
        Assert.Equal(400000m, result.Single(x => x.Provider == "OpenAI").LowPerCent);
        Assert.Equal("Failed", result.Single(x => x.Provider == "Claude").Status);
        Assert.Equal("NoEstimate", result.Single(x => x.Provider == "Gemini").Status);
        Assert.DoesNotContain("private-test-key", JsonSerializer.Serialize(result));
    }
    private class DictionaryConfiguration(Dictionary<string, string?> values) : IConfiguration {
        public string? this[string key] { get => values.GetValueOrDefault(key); set => values[key] = value; }
        public IEnumerable<IConfigurationSection> GetChildren() => [];
        public IConfigurationSection GetSection(string key) => throw new NotSupportedException();
        public Microsoft.Extensions.Primitives.IChangeToken GetReloadToken() => throw new NotSupportedException();
    }
    private class FakeHandler : HttpMessageHandler {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Interlocked.Increment(ref Calls);
            var json = """{"currency":"INR","unit":"Cent","lowPerCent":400000,"highPerCent":500000,"reasoning":"Unvalidated hypothesis","sources":[]}""";
            object body = new { choices = new[] { new { message = new { content = json } } } };
            if (request.RequestUri!.Host.Contains("anthropic")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden) { Content = new StringContent("private-test-key") });
            if (request.RequestUri.Host.Contains("google")) body = new { candidates = new[] { new { content = new { parts = new[] { new { text = """{"currency":"INR","unit":"Cent","lowPerCent":null,"highPerCent":null,"reasoning":"No evidence","sources":[]}""" } } } } } };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(body)) });
        }
    }
}
