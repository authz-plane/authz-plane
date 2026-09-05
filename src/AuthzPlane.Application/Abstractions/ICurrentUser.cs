namespace AuthzPlane.Application.Abstractions;

/// <summary>Who is acting. Used for spec authorship and audit rows.</summary>
public interface ICurrentUser
{
    /// <summary>Stable subject id, or a worker identity such as "system:reconciler".</summary>
    string Id { get; }

    bool IsSystem { get; }
}
