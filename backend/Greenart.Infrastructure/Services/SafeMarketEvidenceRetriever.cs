using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using Greenart.Application.Common.Interfaces;
using Greenart.Application.DTOs;
using Greenart.Application.MarketResearch;
namespace Greenart.Infrastructure.Services;

public class SafeMarketEvidenceRetriever(HttpClient http) : IMarketEvidenceRetriever
{
    public static bool IsPublicAddress(IPAddress ip) {
        if (ip.IsIPv4MappedToIPv6) return IsPublicAddress(ip.MapToIPv4());
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any)) return false;
        var b = ip.GetAddressBytes();
        if (b.Length == 16) return (b[0] & 0xe0) == 0x20 && !(b[0] == 0x20 && b[1] == 1 && b[2] == 0x0d && b[3] == 0xb8);
        return !(b[0] is 0 or 10 or 127 || b[0] >= 224 || b[0] == 169 && b[1] == 254 ||
            b[0] == 172 && b[1] >= 16 && b[1] <= 31 || b[0] == 192 && (b[1] == 168 || b[1] == 0 || b[1] == 2) ||
            b[0] == 100 && b[1] >= 64 && b[1] <= 127 || b[0] == 198 && (b[1] is 18 or 19 || b[1] == 51 && b[2] == 100) ||
            b[0] == 203 && b[1] == 0 && b[2] == 113);
    }
    public static bool IsPublicUrl(string url) {
        if (!MarketEvidenceValidator.IsSafeReference(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || !uri.Host.Contains('.') ||
            uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase) ||
            IPAddress.TryParse(uri.Host, out var ip) && !IsPublicAddress(ip)) return false;
        foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)) {
            var name = Uri.UnescapeDataString(part.Split('=',2)[0]).ToLowerInvariant();
            if (new[] { "token", "key", "secret", "password", "credential", "signature", "authorization", "sig" }.Any(k => name.Contains(k))) return false;
        }
        return true;
    }

    public static SocketsHttpHandler CreateHandler() => new() {
        AllowAutoRedirect = false, UseCookies = false, AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
        ConnectCallback = async (context, ct) => {
            var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
            if (addresses.Length == 0 || addresses.Any(ip => !IsPublicAddress(ip))) throw new HttpRequestException("Non-public source destination.");
            // Connect to the validated address, preventing a second DNS resolution/rebinding.
            var socket = new Socket(addresses[0].AddressFamily, SocketType.Stream, ProtocolType.Tcp);
            try { await socket.ConnectAsync(new IPEndPoint(addresses[0], context.DnsEndPoint.Port), ct); return new NetworkStream(socket, ownsSocket: true); }
            catch { socket.Dispose(); throw; }
        }
    };
    public async Task<RetrievedMarketSource> RetrieveAsync(string url, CancellationToken ct) {
        var now = DateTime.UtcNow;
        if (!IsPublicUrl(url)) return new("UnsafeSource", "", "", now);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(7));
        try {
            for (var redirects = 0; redirects <= 3; redirects++) {
                if (!IsPublicUrl(url)) return new("UnsafeSource", "", "", now);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd("PropertyResearch/1.0");
                using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
                if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location != null) {
                    url = new Uri(new Uri(url), response.Headers.Location).AbsoluteUri; continue;
                }
                if (!response.IsSuccessStatusCode) return new("RetrievalFailed", url, "", now);
                var type = response.Content.Headers.ContentType?.MediaType ?? "";
                if (type != "text/html" && type != "text/plain" && type != "application/json") return new("UnsupportedContent", url, "", now);
                await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
                using var bytes = new MemoryStream(); var chunk = new byte[8192]; int count;
                while ((count = await stream.ReadAsync(chunk, deadline.Token)) > 0) {
                    if (bytes.Length + count > 524288) return new("SourceTooLarge", url, "", now);
                    bytes.Write(chunk, 0, count);
                }
                var text = Encoding.UTF8.GetString(bytes.ToArray());
                text = Regex.Replace(text, @"<(script|style)\b[^>]*>[\s\S]*?</\1>", " ", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
                text = Regex.Replace(text, @"<[^>]*>", " ", RegexOptions.None, TimeSpan.FromSeconds(1));
                return new("Retrieved", url, MarketEvidenceValidator.Text(text), DateTime.UtcNow);
            }
            return new("TooManyRedirects", url, "", now);
        } catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return new("RetrievalTimeout", url, "", now); }
        catch (HttpRequestException) { return new("RetrievalFailed", url, "", now); }
        catch (RegexMatchTimeoutException) { return new("UnsupportedContent", url, "", now); }
    }
}
