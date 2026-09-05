namespace AuthzPlane.Domain.Common;

/// <summary>
/// Thrown when an operation would violate a domain invariant. These represent
/// programmer or caller error, not user input problems - input is validated at
/// the API boundary before it reaches the domain.
/// </summary>
public sealed class DomainException(string message) : Exception(message);
