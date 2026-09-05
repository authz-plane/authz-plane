namespace AuthzPlane.Application.Common;

/// <summary>Categories of expected failure. The API maps each to one HTTP status.</summary>
public enum ErrorKind
{
    /// <summary>400. Input shape or value rejected before reaching the domain.</summary>
    Validation,

    /// <summary>404. Also used for soft-deleted resources, which are gone to callers.</summary>
    NotFound,

    /// <summary>409. Uniqueness or state conflict, e.g. slug taken, role bound to tuples.</summary>
    Conflict,

    /// <summary>428. A conditional header such as <c>If-Match</c> was required and missing.</summary>
    PreconditionRequired,

    /// <summary>412. The conditional header did not match current state.</summary>
    PreconditionFailed,
}

/// <summary>
/// An expected failure. Handlers return these; they never throw for outcomes a
/// caller can reasonably cause. <see cref="Extensions"/> become problem+json
/// extension members, e.g. <c>currentGeneration</c> on a 412.
/// </summary>
public sealed record Error(
    ErrorKind Kind,
    string Title,
    string Detail,
    IReadOnlyDictionary<string, object?>? Extensions = null);

public static class Errors
{
    public static Error Validation(string title, string detail) =>
        new(ErrorKind.Validation, title, detail);

    public static Error NotFound(string title, string detail) =>
        new(ErrorKind.NotFound, title, detail);

    public static Error Conflict(string title, string detail) =>
        new(ErrorKind.Conflict, title, detail);

    public static Error PreconditionRequired(string title, string detail) =>
        new(ErrorKind.PreconditionRequired, title, detail);

    public static Error PreconditionFailed(
        string title, string detail, IReadOnlyDictionary<string, object?>? extensions = null) =>
        new(ErrorKind.PreconditionFailed, title, detail, extensions);
}

/// <summary>
/// Success carrying a value, or an <see cref="Error"/>. Exceptions are reserved
/// for bugs and infrastructure faults; anything a client can trigger by sending
/// the wrong thing comes back through here.
/// </summary>
public sealed class Result<T>
{
    private readonly T? _value;

    private Result(T value)
    {
        _value = value;
        IsSuccess = true;
    }

    private Result(Error error)
    {
        Error = error;
        IsSuccess = false;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public Error? Error { get; }

    /// <summary>The value. Reading it on a failure is a programming error and throws.</summary>
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException($"Result is a failure: {Error!.Kind} {Error.Title}");

    public static Result<T> Success(T value) => new(value);

    public static Result<T> Failure(Error error) => new(error);

    public static implicit operator Result<T>(T value) => Success(value);

    public static implicit operator Result<T>(Error error) => Failure(error);

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<Error, TOut> onFailure) =>
        IsSuccess ? onSuccess(_value!) : onFailure(Error!);
}
