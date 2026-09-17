# Generic headless opencode runner (ASCII only, fire-and-forget).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/Run-Headless.ps1 -PromptFile <txt> -LogFile <log>
param([string]$PromptFile = "", [string]$LogFile = "")

$workdir = "C:\Users\ADMIN\Desktop\Student_Notice"
if ($PromptFile -eq "" -or $LogFile -eq "") { exit 2 }
$prompt = Get-Content -LiteralPath $PromptFile -Encoding UTF8 -Raw
Start-Process -FilePath "C:\Users\ADMIN\AppData\Roaming\npm\opencode.cmd" `
  -ArgumentList @("run", $prompt) `
  -WorkingDirectory $workdir -WindowStyle Hidden `
  -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + ".err") | Out-Null
exit 0
