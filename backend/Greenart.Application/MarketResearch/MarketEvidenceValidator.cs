using System.Globalization;
using System.Text.RegularExpressions;
using Greenart.Application.DTOs;
using Greenart.Domain.ValueObjects;
using Greenart.Domain.Enums;
namespace Greenart.Application.MarketResearch;

public static class MarketEvidenceValidator
{
    public static decimal AreaSqFt(decimal area, string unit) {
        if (area <= 0 || area > 100000000) throw new ArgumentException("A positive, bounded land area is required.");
        var key = Regex.Replace((unit ?? "").Trim().ToLowerInvariant(), @"[\.\s]", "");
        var selected = key switch {
            "sqft" or "squarefeet" => AreaUnit.SqFt, "cent" or "cents" => AreaUnit.Cent,
            "acre" or "acres" => AreaUnit.Acre, "sqm" or "sqmeter" or "squaremetres" or "hectare" or "hectares" => AreaUnit.SqMeter,
            "ground" or "grounds" => AreaUnit.Ground, "kuzhi" => AreaUnit.Kuzhi,
            _ => throw new ArgumentException("Unsupported land area unit.") };
        var sqFt = new LandArea(key.StartsWith("hectare") ? area * 10000m : area, selected).ToSqFt();
        if (sqFt <= 0) throw new ArgumentException("Land area is below supported precision.");
        return decimal.Round(sqFt, 6);
    }
    public static string Text(string text) => Regex.Replace(System.Net.WebUtility.HtmlDecode(text ?? ""), @"\s+", " ").Trim();
    private static string LocationText(string text) => string.Concat((text ?? "").ToLowerInvariant().Where(c => char.IsLetterOrDigit(c) || char.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark));
    public static bool IsSafeReference(string value) => value?.Length <= 4000 && Uri.TryCreate(value, UriKind.Absolute, out var u) && u.Scheme == "https" &&
        u.Port == 443 && string.IsNullOrEmpty(u.UserInfo) && !string.IsNullOrWhiteSpace(u.Host) && u.Host.Length <= 253;
    public static string CanonicalUrl(string url) {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return "";
        return u.GetLeftPart(UriPartial.Path).TrimEnd('/').ToLowerInvariant();
    }
    private static bool SupportsCoordinate(string quote, double value) => Regex.Matches(quote, @"-?[0-9]+(?:\.[0-9]+)?")
        .Any(m => double.TryParse(m.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && Math.Abs(n - value) < .0000001);
    public static bool SupportsPrice(string quote, decimal amount) {
        if (Regex.IsMatch(quote, @"(?i)(\$|USD|EUR|€|GBP|£|AUD|CAD|SGD|AED)")) return false;
        var matches = Regex.Matches(quote, @"(?i)(?<currency>₹|INR|Rs\.?)?\s*(?<n>[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?<m>crores?|cr\b|lakhs?|lacs?|lac\b|lakh\b|L\b|million|thousand|k\b)?");
        var money = matches.Where(m => m.Groups["currency"].Success || m.Groups["m"].Success).ToArray();
        if (money.Length != 1 || !decimal.TryParse(money[0].Groups["n"].Value.Replace(",", ""), NumberStyles.Number, CultureInfo.InvariantCulture, out var n)) return false;
        var suffix = money[0].Groups["m"].Value.ToLowerInvariant();
        var factor = suffix.StartsWith("cr") ? 10000000m : suffix.StartsWith("la") || suffix == "l" ? 100000m : suffix == "million" ? 1000000m : suffix is "k" or "thousand" ? 1000m : 1m;
        try { return checked(n * factor) == amount; } catch (OverflowException) { return false; }
    }
    public static bool SupportsArea(string quote, decimal area, string unit) {
        var match = Regex.Match(quote, @"(?i)(?<n>[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?<u>sq\.?\s*ft|sqft|square feet|sq\.?\s*m|cents?|acres?|grounds?|sqm|hectares?)\b");
        if (!match.Success || !decimal.TryParse(match.Groups["n"].Value.Replace(",", ""), NumberStyles.Number, CultureInfo.InvariantCulture, out var n)) return false;
        var quotedUnit = Regex.Replace(match.Groups["u"].Value, @"[\.\s]", "");
        static string OriginalUnit(string value) => Regex.Replace((value ?? "").ToLowerInvariant(), @"[\.\s]", "") switch {
            "sqft" or "squarefeet" => "sqft", "cent" or "cents" => "cent", "acre" or "acres" => "acre", "sqm" or "sqmeter" or "squaremetres" => "sqm",
            "ground" or "grounds" => "ground", "hectare" or "hectares" => "hectare", _ => "unsupported" };
        return n == area && OriginalUnit(quotedUnit) != "unsupported" && OriginalUnit(quotedUnit) == OriginalUnit(unit);
    }
    public static MarketEvidenceAssessment Validate(MarketEvidenceCandidate candidate, RetrievedMarketSource source,
        LandResearchInput input, ISet<string> groundedReferences, int index, DateTime now, int maxAgeDays = 90) {
        var result = new MarketEvidenceAssessment { Id = "e" + index, Observation = candidate, ResolvedUrl = source.Url,
            RetrievalStatus = source.Status, RetrievedAtUtc = source.RetrievedAtUtc };
        void Fail(string reason) => result.Checks.Add(reason);
        if (!IsSafeReference(candidate.SourceUrl) || !groundedReferences.Contains(candidate.SourceUrl)) Fail("Source is not a registered authorized reference.");
        if (source.Status != "Retrieved" || !IsSafeReference(source.Url)) Fail("Source could not be independently retrieved.");
        if (candidate.SourceCategory != "AdvertisedAskingPrice" || candidate.Currency != "INR") Fail("Unsupported source classification or currency.");
        if (candidate.LandCategory != (int)input.LandUsage) Fail("Land category mismatch.");
        var body = Text(source.Text);
        bool Quote(string q) => !string.IsNullOrWhiteSpace(q) && q.Length <= 500 && body.Contains(Text(q), StringComparison.OrdinalIgnoreCase);
        if (!Quote(candidate.AskingContextQuote) || !new[] { "for sale", "for_sale", "asking price", "negotiable", "விற்பனைக்கு" }.Any(x => candidate.AskingContextQuote.Contains(x, StringComparison.OrdinalIgnoreCase)))
            Fail("Source does not identify an advertised asking-price observation.");
        if (!Quote(candidate.PriceQuote) || !SupportsPrice(candidate.PriceQuote, candidate.AskingPrice)) Fail("Source does not support the claimed total asking price.");
        if (!Quote(candidate.AreaQuote) || !SupportsArea(candidate.AreaQuote, candidate.Area, candidate.AreaUnit)) Fail("Source does not support the claimed area/unit.");
        if (!Quote(candidate.LocationQuote) || !LocationText(candidate.LocationQuote).Contains(LocationText(input.Locality)) ||
            !LocationText(candidate.LocationQuote).Contains(LocationText(input.District))) Fail("Source locality/district mismatch.");
        var categoryWords = (int)input.LandUsage switch { 1 => new[] { "residential", "குடியிருப்பு" }, 2 => new[] { "commercial", "வணிக" },
            3 or 4 => new[] { "agricultural", "agriculture", "விவசாய" }, 5 => new[] { "industrial", "தொழிற்" }, _ => new[] { "mixed-use", "mixed use" } };
        if (!Quote(candidate.CategoryQuote) || !categoryWords.Any(w => candidate.CategoryQuote.Contains(w, StringComparison.OrdinalIgnoreCase))) Fail("Source does not support the land classification.");
        if (candidate.ObservationDate == null || candidate.ObservationDate.Value.Date > now.Date || candidate.ObservationDate.Value.Date < now.Date.AddDays(-maxAgeDays) ||
            !Quote(candidate.DateQuote) || !DateTime.TryParse(candidate.DateQuote, CultureInfo.GetCultureInfo("en-GB"), DateTimeStyles.AllowWhiteSpaces, out var quotedDate) || quotedDate.Date != candidate.ObservationDate.Value.Date)
            Fail("Missing, unsupported, future or stale observation date.");
        if (!candidate.Latitude.HasValue || !candidate.Longitude.HasValue || !double.IsFinite(candidate.Latitude.Value) || !double.IsFinite(candidate.Longitude.Value) ||
            candidate.Latitude < 6 || candidate.Latitude > 38 || candidate.Longitude < 68 || candidate.Longitude > 98) Fail("Missing or invalid source coordinates.");
        else {
            result.DistanceMeters = new GeoCoordinate(input.Latitude, input.Longitude).DistanceToMeters(new GeoCoordinate(candidate.Latitude.Value, candidate.Longitude.Value));
            if (result.DistanceMeters > input.RadiusMeters) Fail("Source lies outside the selected radius.");
            if (!Quote(candidate.CoordinateQuote) || !SupportsCoordinate(candidate.CoordinateQuote, candidate.Latitude.Value) || !SupportsCoordinate(candidate.CoordinateQuote, candidate.Longitude.Value)) Fail("Source coordinates are not supported by retrieved content.");
        }
        try {
            var areaSqFt = AreaSqFt(candidate.Area, candidate.AreaUnit);
            if (candidate.AskingPrice <= 0 || candidate.AskingPrice > 100000000000m) Fail("Invalid asking amount.");
            else {
                var rate = candidate.AskingPrice / areaSqFt;
                if (rate * 435.6m > 1000000000m || Math.Round(rate, 2) <= 0 || Math.Round(rate * 435.6m, 2) <= 0) Fail("Out-of-bounds normalised rate.");
                else { result.AreaSqFt = areaSqFt; result.RatePerSqFt = Math.Round(rate, 2); result.RatePerCent = Math.Round(rate * 435.6m, 2); }
            }
        } catch (ArgumentException) { Fail("Invalid area."); }
        if (result.Checks.Count == 0) result.Status = "EligibleAskingObservation";
        return result;
    }
    public static void Deduplicate(IList<MarketEvidenceAssessment> evidence) {
        var seen = new List<MarketEvidenceAssessment>();
        foreach (var e in evidence.Where(x => x.Status == "EligibleAskingObservation")) {
            var duplicate = seen.Any(s => CanonicalUrl(s.ResolvedUrl) == CanonicalUrl(e.ResolvedUrl) ||
                (s.Observation.Latitude == e.Observation.Latitude && s.Observation.Longitude == e.Observation.Longitude &&
                 s.AreaSqFt == e.AreaSqFt && s.Observation.AskingPrice == e.Observation.AskingPrice));
            if (duplicate) { e.Status = "Rejected"; e.Checks.Add("Duplicate source or same property observation."); } else seen.Add(e);
        }
    }
}
