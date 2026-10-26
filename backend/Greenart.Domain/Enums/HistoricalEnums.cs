namespace Greenart.Domain.Enums;

public enum SourceDocumentType
{
    TnReginetGuideline = 1,
    SroDeedExtract = 2,
    SurveyorValuationReport = 3,
    ClientResearchDocument = 4,
    MarketListingFeed = 5,
    Other = 99
}

public enum DocumentProcessingStatus
{
    Pending = 0,
    Extracted = 1,
    Validated = 2,
    Failed = 3
}

public enum DocumentValidationStatus
{
    Unreviewed = 0,
    Approved = 1,
    Rejected = 2,
    Archived = 3
}

public enum HistoricalEstimateStatus
{
    Success = 1,
    InsufficientData = 2
}

public enum HistoricalReviewStatus
{
    SystemGenerated = 1,
    Approved = 2,
    Flagged = 3
}

