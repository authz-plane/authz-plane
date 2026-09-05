using AuthzPlane.Application.Common;

namespace AuthzPlane.Application.UnitTests;

public sealed class CursorTests
{
    [Fact]
    public void Round_trips_position_and_normalises_to_utc()
    {
        var position = new CursorPosition(new DateTimeOffset(2026, 9, 4, 12, 15, 0, TimeSpan.FromHours(2)), Guid.NewGuid());

        var encoded = Cursor.Encode(position);
        Assert.True(Cursor.TryDecode(encoded, out var decoded));

        Assert.Equal(position.Id, decoded.Id);
        Assert.Equal(position.CreatedAt.ToUniversalTime(), decoded.CreatedAt);
        Assert.Equal(TimeSpan.Zero, decoded.CreatedAt.Offset);
    }

    [Fact]
    public void Is_url_safe_with_no_padding()
    {
        var encoded = Cursor.Encode(DateTimeOffset.UnixEpoch, Guid.Empty);
        Assert.DoesNotContain('+', encoded);
        Assert.DoesNotContain('/', encoded);
        Assert.DoesNotContain('=', encoded);
        Assert.Equal(32, encoded.Length);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-cursor")]
    [InlineData("AAAA")]
    [InlineData("!!!!")]
    public void Rejects_garbage_without_throwing(string? input)
    {
        Assert.False(Cursor.TryDecode(input, out var position));
        Assert.Equal(default, position);
    }

    [Fact]
    public void Two_positions_never_collide()
    {
        var a = Cursor.Encode(DateTimeOffset.UnixEpoch, Guid.NewGuid());
        var b = Cursor.Encode(DateTimeOffset.UnixEpoch, Guid.NewGuid());
        Assert.NotEqual(a, b);
    }
}
