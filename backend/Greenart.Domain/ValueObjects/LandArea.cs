using Greenart.Domain.Enums;

namespace Greenart.Domain.ValueObjects;

public readonly struct LandArea : IEquatable<LandArea>
{
    // Conversion factors to square feet
    public const decimal SqFtPerCent = 435.6m;
    public const decimal SqFtPerAcre = 43560.0m;
    public const decimal SqFtPerGround = 2400.0m;
    public const decimal SqFtPerKuzhi = 144.0m;
    public const decimal SqFtPerSqMeter = 10.7639104m;

    public decimal Value { get; }
    public AreaUnit Unit { get; }

    public LandArea(decimal value, AreaUnit unit)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(value), value, "Land area must be strictly positive.");
        }

        Value = Math.Round(value, 4);
        Unit = unit;
    }

    /// <summary>
    /// Converts this area into equivalent Square Feet.
    /// </summary>
    public decimal ToSqFt() => Unit switch
    {
        AreaUnit.SqFt => Value,
        AreaUnit.Cent => Value * SqFtPerCent,
        AreaUnit.Acre => Value * SqFtPerAcre,
        AreaUnit.Ground => Value * SqFtPerGround,
        AreaUnit.Kuzhi => Value * SqFtPerKuzhi,
        AreaUnit.SqMeter => Value * SqFtPerSqMeter,
        _ => throw new InvalidOperationException($"Unsupported area unit: {Unit}")
    };

    /// <summary>
    /// Converts this area into equivalent Cents (Tamil Nadu standard, 1 Cent = 435.6 sq.ft).
    /// </summary>
    public decimal ToCents() => Unit switch
    {
        AreaUnit.Cent => Value,
        AreaUnit.SqFt => Value / SqFtPerCent,
        AreaUnit.Acre => Value * 100m,
        AreaUnit.Ground => (Value * SqFtPerGround) / SqFtPerCent,
        AreaUnit.Kuzhi => (Value * SqFtPerKuzhi) / SqFtPerCent,
        AreaUnit.SqMeter => (Value * SqFtPerSqMeter) / SqFtPerCent,
        _ => throw new InvalidOperationException($"Unsupported area unit: {Unit}")
    };

    /// <summary>
    /// Converts this area into equivalent Acres (1 Acre = 100 Cents).
    /// </summary>
    public decimal ToAcres() => ToCents() / 100m;

    /// <summary>
    /// Converts this area into equivalent Square Meters.
    /// </summary>
    public decimal ToSqMeters() => ToSqFt() / SqFtPerSqMeter;

    /// <summary>
    /// Converts this area into the requested target unit.
    /// </summary>
    public LandArea ConvertTo(AreaUnit targetUnit)
    {
        if (targetUnit == Unit) return this;

        var convertedValue = targetUnit switch
        {
            AreaUnit.SqFt => ToSqFt(),
            AreaUnit.Cent => ToCents(),
            AreaUnit.Acre => ToAcres(),
            AreaUnit.SqMeter => ToSqMeters(),
            AreaUnit.Ground => ToSqFt() / SqFtPerGround,
            AreaUnit.Kuzhi => ToSqFt() / SqFtPerKuzhi,
            _ => throw new ArgumentOutOfRangeException(nameof(targetUnit), targetUnit, null)
        };

        return new LandArea(convertedValue, targetUnit);
    }

    public bool Equals(LandArea other) =>
        Math.Abs(ToSqFt() - other.ToSqFt()) < 0.001m;

    public override bool Equals(object? obj) => obj is LandArea other && Equals(other);

    public override int GetHashCode() => ToSqFt().GetHashCode();

    public override string ToString() => $"{Value:N2} {Unit}";

    public static bool operator ==(LandArea left, LandArea right) => left.Equals(right);
    public static bool operator !=(LandArea left, LandArea right) => !left.Equals(right);
}
