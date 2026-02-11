$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/test-whatsapp-send?reinit=true'
$qr = $response.status.qrCodeDataUrl

if ($qr) {
    $html = @"
<!DOCTYPE html>
<html>
<head>
<title>QR WhatsApp - ESCANEA AHORA</title>
<style>
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;font-family:system-ui}
h1{color:#25D366;font-size:2em;margin-bottom:10px}
img{border:4px solid #25D366;border-radius:12px;padding:16px;background:#fff}
p{color:#f00;font-size:1.2em;margin-top:20px}
</style>
</head>
<body>
<h1>ESCANEA AHORA!</h1>
<img src="$qr">
<p>Este QR expira en segundos - Escanea rapido!</p>
</body>
</html>
"@
    Set-Content -Path 'C:\Users\Usuario\Desktop\Mawir\qr-whatsapp.html' -Value $html
    Start-Process 'C:\Users\Usuario\Desktop\Mawir\qr-whatsapp.html'
    Write-Host "QR abierto en navegador - ESCANEA AHORA!"
} else {
    Write-Host "Error: No hay QR disponible"
    Write-Host $response.status.lastError
    Write-Host $response.mensaje
}
