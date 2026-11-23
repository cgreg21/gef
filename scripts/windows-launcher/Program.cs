using System.Diagnostics;

var root = AppContext.BaseDirectory;
var app = Path.Combine(root, "app");
var node = Path.Combine(root, "runtime", "node.exe");
var entry = "__ENTRY__";

if (!File.Exists(node) || !File.Exists(Path.Combine(app, entry)))
{
    Console.Error.WriteLine("The application package is incomplete.");
    return 1;
}

var start = new ProcessStartInfo
{
    FileName = node,
    WorkingDirectory = app,
    UseShellExecute = false
};
start.ArgumentList.Add("--import");
start.ArgumentList.Add("node-gtk/register");
start.ArgumentList.Add(entry);
foreach (var argument in args)
    start.ArgumentList.Add(argument);

using var process = Process.Start(start);
if (process is null)
{
    Console.Error.WriteLine("Unable to start the bundled Node.js runtime.");
    return 1;
}
process.WaitForExit();
return process.ExitCode;
