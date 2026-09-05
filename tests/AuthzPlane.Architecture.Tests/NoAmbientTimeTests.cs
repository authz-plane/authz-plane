using System.Text.RegularExpressions;
using Xunit;

namespace AuthzPlane.Architecture.Tests;

/// <summary>
/// Bans ambient clock reads outside the single clock adapter.
/// </summary>
/// <remarks>
/// Deliberately a source-text scan, which is cruder than the NetArchTest rules
/// next door. NetArchTest inspects type references, and a call to a static
/// property on System.DateTime does not show up as a distinguishable dependency
/// - every file touching a date references that type. Backoff, convergence and
/// resync are all time-dependent, and this rule is what keeps them testable
/// without sleeping, so a crude check that works beats an elegant one that does
/// not.
/// </remarks>
public sealed class NoAmbientTimeTests
{
    /// <summary>The one file permitted to read ambient time.</summary>
    private static readonly string[] Allowed = ["SystemClock.cs"];

    private static readonly string[] Banned =
    [
        "DateTime.UtcNow",
        "DateTime.Now",
        "DateTimeOffset.UtcNow",
        "DateTimeOffset.Now",
        "DateTime.Today",
    ];

    [Fact]
    public void Production_code_reads_time_only_through_IClock()
    {
        var srcRoot = Path.Combine(RepositoryRoot(), "src");
        Assert.True(Directory.Exists(srcRoot), $"src not found at {srcRoot}");

        var offenders = new List<string>();

        foreach (var file in Directory.EnumerateFiles(srcRoot, "*.cs", SearchOption.AllDirectories))
        {
            var name = Path.GetFileName(file);
            var sep = Path.DirectorySeparatorChar;

            if (file.Contains($"{sep}obj{sep}", StringComparison.Ordinal) ||
                file.Contains($"{sep}bin{sep}", StringComparison.Ordinal) ||
                Allowed.Contains(name))
            {
                continue;
            }

            var text = StripComments(File.ReadAllText(file));
            foreach (var banned in Banned)
            {
                if (text.Contains(banned, StringComparison.Ordinal))
                {
                    offenders.Add($"{name} uses {banned}");
                }
            }
        }

        Assert.True(
            offenders.Count == 0,
            "Ambient time outside SystemClock: " + string.Join("; ", offenders) +
            ". Inject IClock instead - the retry and convergence tests depend on it.");
    }

    [Fact]
    public void The_scan_would_actually_catch_an_offender()
    {
        // Without this, a bug in StripComments that blanked everything would
        // make the rule above pass silently forever.
        const string sample = "var now = DateTime.UtcNow; // comment";
        Assert.Contains("DateTime.UtcNow", StripComments(sample), StringComparison.Ordinal);
    }

    [Fact]
    public void Comments_explaining_the_rule_do_not_trip_it()
    {
        const string sample = "// never call DateTime.UtcNow here";
        Assert.DoesNotContain("DateTime.UtcNow", StripComments(sample), StringComparison.Ordinal);
    }

    /// <summary>
    /// Removes block and line comments so that prose explaining this very rule
    /// does not trip it. Naive about a double slash inside a string literal,
    /// which this codebase does not contain; if that changes, switch to a
    /// Roslyn syntax walk rather than accreting special cases here.
    /// </summary>
    private static string StripComments(string source)
    {
        // Block comments first, so a line comment inside one cannot survive.
        var withoutBlocks = Regex.Replace(
            source, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline);

        var kept = new List<string>();
        foreach (var line in withoutBlocks.Split('\n'))
        {
            var index = line.IndexOf("//", StringComparison.Ordinal);
            kept.Add(index >= 0 ? line[..index] : line);
        }

        return string.Join('\n', kept);
    }

    /// <summary>Walks up from the test binary until the solution file appears.</summary>
    private static string RepositoryRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "AuthzPlane.slnx")))
        {
            dir = dir.Parent;
        }

        Assert.NotNull(dir);
        return dir.FullName;
    }
}
