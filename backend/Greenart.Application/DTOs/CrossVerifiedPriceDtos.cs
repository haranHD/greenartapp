namespace Greenart.Application.DTOs;

public record CrossVerifiedPriceResultDto(
    PriceRangeDto PriceRangePerCent,
    PriceRangeDto PriceRangePerSqFt,
    ValuationFactorBreakdownDto? FactorBreakdown,
    string Summary,
    string Confidence,
    string AuditorNotes
);
