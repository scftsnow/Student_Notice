$html = (Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing).Content
$m = [regex]::Match($html, "/_next/static/css/[^\x22\x27]+\.css")
if ($m.Success) {
  Write-Output ("CSS_PATH=" + $m.Value)
  try {
    $r = Invoke-WebRequest -Uri ("http://localhost:3001" + $m.Value) -UseBasicParsing -TimeoutSec 15
    Write-Output ("CSS_STATUS=" + $r.StatusCode)
    Write-Output ("CSS_BYTES=" + $r.RawContentLength)
  } catch {
    Write-Output "CSS_FAIL"
  }
} else {
  Write-Output "NO_CSS_LINK"
}
