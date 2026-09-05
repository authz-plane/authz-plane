using System.Buffers.Binary;
using System.Buffers.Text;

namespace AuthzPlane.Application.Common;

/// <summary>Keyset position: the last row's (created_at, id), newest first.</summary>
public readonly record struct CursorPosition(DateTimeOffset CreatedAt, Guid Id);

/// <summary>
/// Opaque, URL-safe cursor for list endpoints. Keyset rather than offset so
/// page N+1 is one indexed range scan regardless of N, and rows inserted while a
/// client pages do not shift what they see.
/// </summary>
/// <remarks>
/// The encoding is 8 bytes of UTC ticks plus 16 bytes of id, base64url. Clients
/// must treat the string as opaque; nothing about it is a contract except that
/// a cursor from one list endpoint is meaningless on another.
/// </remarks>
public static class Cursor
{
    private const int Length = sizeof(long) + 16;

    public static string Encode(CursorPosition position)
    {
        Span<byte> bytes = stackalloc byte[Length];
        BinaryPrimitives.WriteInt64BigEndian(bytes, position.CreatedAt.UtcTicks);
        position.Id.TryWriteBytes(bytes[sizeof(long)..]);
        return Base64Url.EncodeToString(bytes);
    }

    public static string Encode(DateTimeOffset createdAt, Guid id) => Encode(new CursorPosition(createdAt, id));

    /// <summary>False for null, empty, malformed or wrong-length input. Never throws.</summary>
    public static bool TryDecode(string? cursor, out CursorPosition position)
    {
        position = default;
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return false;
        }

        Span<byte> bytes = stackalloc byte[Length];
        if (!Base64Url.IsValid(cursor, out var decodedLength) || decodedLength != Length)
        {
            return false;
        }

        if (!Base64Url.TryDecodeFromChars(cursor, bytes, out var written) || written != Length)
        {
            return false;
        }

        var ticks = BinaryPrimitives.ReadInt64BigEndian(bytes);
        if (ticks < DateTimeOffset.MinValue.Ticks || ticks > DateTimeOffset.MaxValue.Ticks)
        {
            return false;
        }

        position = new CursorPosition(new DateTimeOffset(ticks, TimeSpan.Zero), new Guid(bytes[sizeof(long)..]));
        return true;
    }
}
