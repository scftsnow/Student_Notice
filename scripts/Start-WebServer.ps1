param()
$root = "C:\Users\USER\Desktop\Student_Notice"
$port = 3001
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm.cmd run dev" -WorkingDirectory $root -WindowStyle Hidden
    $ok = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        $l = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($l) { $ok = $true; break }
    }
    if (-not $ok) { exit 1 }
}
Start-Process "http://localhost:$port/"
