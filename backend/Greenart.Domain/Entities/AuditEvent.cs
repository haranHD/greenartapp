namespace Greenart.Domain.Entities;

/// <summary>
/// Immutable audit event for data ingestion, record moderation, and regulatory compliance.
/// </summary>
public class AuditEvent
{
    public Guid Id { get; private set; }
    public string EntityType { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string PerformedBy { get; private set; } = "Administrator";
    public DateTime TimestampUtc { get; private set; }
    public string Details { get; private set; } = string.Empty;

    // EF Core constructor
    private AuditEvent() { }

    public AuditEvent(
        Guid id,
        string entityType,
        Guid? entityId,
        string action,
        string performedBy,
        string details)
    {
        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        EntityType = string.IsNullOrWhiteSpace(entityType) ? "System" : entityType.Trim();
        EntityId = entityId;
        Action = string.IsNullOrWhiteSpace(action) ? "GenericAction" : action.Trim();
        PerformedBy = string.IsNullOrWhiteSpace(performedBy) ? "Administrator" : performedBy.Trim();
        TimestampUtc = DateTime.UtcNow;
        Details = details ?? string.Empty;
    }
}

