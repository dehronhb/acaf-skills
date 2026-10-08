# ACAF routing reminder — a Claude Code UserPromptSubmit hook.
# In a project that has an acaf/ folder, it adds one line to each prompt's context
# reminding the session to route through the ACAF skills. Anywhere else it prints nothing.
# Register it in ~/.claude/settings.json (see README, "Optional: routing reminder hook").

$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
$dir = $env:CLAUDE_PROJECT_DIR
if (-not $dir) { try { $dir = ($raw | ConvertFrom-Json).cwd } catch { } }
for ($i = 0; $dir -and $i -lt 6; $i++) {
  if (Test-Path -LiteralPath (Join-Path $dir 'acaf') -PathType Container) {
    Write-Output 'ACAF project: before acting, route this message through the routing table in CLAUDE.md and invoke the matching acaf skill (do not follow a skill from memory). Research, spikes, demos and comparisons go through acaf-explore.'
    break
  }
  $dir = Split-Path -Parent $dir
}
exit 0
