using SkiaSharp;

namespace Greenart.Api.Marketplace;

internal static class PropertyMediaContent
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private const int MaxPixels = 16_000_000;
    private const int MaxDimension = 5000;
    private static ReadOnlySpan<byte> PngSignature => [137, 80, 78, 71, 13, 10, 26, 10];
    private static ReadOnlySpan<byte> JpegSignature => [255, 216, 255];

    public static byte[]? NormalizeImage(byte[] input, string contentType)
    {
        var jpeg = contentType == "image/jpeg";
        var format = jpeg ? SKEncodedImageFormat.Jpeg : SKEncodedImageFormat.Png;
        if (!input.AsSpan().StartsWith(jpeg ? JpegSignature : PngSignature))
            return null;

        using var data = SKData.CreateCopy(input);
        using var codec = SKCodec.Create(data);
        if (codec is null || codec.EncodedFormat != format || codec.FrameCount > 1)
            return null;

        var width = codec.Info.Width;
        var height = codec.Info.Height;
        if (width is <= 0 or > MaxDimension || height is <= 0 or > MaxDimension || width * height > MaxPixels)
            return null;

        using var bitmap = new SKBitmap();
        var info = new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul);
        if (!bitmap.TryAllocPixels(info) || codec.GetPixels(info, bitmap.GetPixels()) != SKCodecResult.Success)
            return null;

        // Encoding fresh pixels discards embedded thumbnails, GPS, filenames and other source metadata.
        using var oriented = codec.EncodedOrigin == SKEncodedOrigin.TopLeft ? null : Reorient(bitmap, codec.EncodedOrigin);
        if (codec.EncodedOrigin != SKEncodedOrigin.TopLeft && oriented is null)
            return null;
        using var image = (oriented ?? bitmap).Encode(format, 88);
        return image is not null && image.Size <= MaxBytes ? image.ToArray() : null;
    }

    private static SKBitmap? Reorient(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        var w = bitmap.Width;
        var h = bitmap.Height;
        var transform = origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
            _ => SKMatrix.Identity
        };
        var swapsAxes = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
            or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var result = new SKBitmap();
        if (!result.TryAllocPixels(new SKImageInfo(swapsAxes ? h : w, swapsAxes ? w : h,
                SKColorType.Rgba8888, SKAlphaType.Premul)))
        {
            result.Dispose();
            return null;
        }
        using var canvas = new SKCanvas(result);
        canvas.Clear(SKColors.Transparent);
        canvas.Concat(transform);
        canvas.DrawBitmap(bitmap, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest));
        return result;
    }

    // PDFs are stored as opaque, authenticated downloads and are never embedded or executed by GreenArt.
    public static bool HasPdfEnvelope(ReadOnlySpan<byte> data)
    {
        if (data.Length < 16 || !data.StartsWith("%PDF-"u8) || data[5] is not ((byte)'1' or (byte)'2') ||
            data[6] != '.' || data[7] is < (byte)'0' or > (byte)'9')
            return false;

        while (!data.IsEmpty && data[^1] is (byte)'\r' or (byte)'\n' or (byte)' ' or (byte)'\t')
            data = data[..^1];
        return data.EndsWith("%%EOF"u8);
    }
}
