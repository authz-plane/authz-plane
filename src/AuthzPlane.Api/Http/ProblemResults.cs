using AuthzPlane.Application.Common;

namespace AuthzPlane.Api.Http;

/// <summary>
/// RFC 9457 problem+json for expected failures. One status per
/// <see cref="ErrorKind"/>, so a client can branch on the status and read the
/// title for humans; extension members carry machine-readable specifics.
/// </summary>
public static class ProblemResults
{
    private const string TypeBase = "https://authz-plane.dev/problems/";

    public static IResult From(Error error) =>
        Results.Problem(
            title: error.Title,
            detail: error.Detail,
            statusCode: StatusFor(error.Kind),
            type: TypeBase + Slug(error.Kind),
            extensions: error.Extensions is null ? null : new Dictionary<string, object?>(error.Extensions));

    public static IResult Problem(int statusCode, string title, string detail) =>
        Results.Problem(title: title, detail: detail, statusCode: statusCode);

    public static int StatusFor(ErrorKind kind) => kind switch
    {
        ErrorKind.Validation => StatusCodes.Status400BadRequest,
        ErrorKind.NotFound => StatusCodes.Status404NotFound,
        ErrorKind.Conflict => StatusCodes.Status409Conflict,
        ErrorKind.PreconditionRequired => StatusCodes.Status428PreconditionRequired,
        ErrorKind.PreconditionFailed => StatusCodes.Status412PreconditionFailed,
        _ => StatusCodes.Status500InternalServerError,
    };

    private static string Slug(ErrorKind kind) => kind switch
    {
        ErrorKind.Validation => "validation",
        ErrorKind.NotFound => "not-found",
        ErrorKind.Conflict => "conflict",
        ErrorKind.PreconditionRequired => "precondition-required",
        ErrorKind.PreconditionFailed => "precondition-failed",
        _ => "internal",
    };
}
