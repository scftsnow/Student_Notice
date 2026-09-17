$workdir = "C:\Users\ADMIN\Desktop\Student_Notice"

# Already running -> just open browser
$listening = netstat -ano | Select-String ":3001" | Select-String "LISTENING"
if ($listening) {
  Start-Process "http://localhost:3001"
  exit 0
}

# Start production server fully hidden (no console window)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm start" -WorkingDirectory $workdir -WindowStyle Hidden

# Wait up to 60s for port, then open browser
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  $listening = netstat -ano | Select-String ":3001" | Select-String "LISTENING"
  if ($listening) {
    Start-Process "http://localhost:3001"
    exit 0
  }
}
exit 1
