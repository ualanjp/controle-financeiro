# Servidor local simples para testar o app no computador (nao precisa instalar nada).
# Uso: clique duas vezes em "Iniciar servidor.bat" (ou rode este script no PowerShell).
param([int]$Porta = 8000, [switch]$Abrir)

$raiz = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'
}

$servidor = New-Object System.Net.HttpListener
$servidor.Prefixes.Add("http://localhost:$Porta/")
try { $servidor.Start() } catch {
  Write-Host "Nao foi possivel usar a porta $Porta. Talvez o servidor ja esteja aberto em outra janela." -ForegroundColor Red
  Read-Host "Pressione Enter para fechar"; exit 1
}
Write-Host ""
Write-Host "  Servidor rodando!" -ForegroundColor Green
Write-Host "  Abra no navegador:  http://localhost:$Porta/" -ForegroundColor Cyan
Write-Host "  Testes:             http://localhost:$Porta/testes.html"
Write-Host "  Para parar, feche esta janela."
Write-Host ""
if ($Abrir) { Start-Process "http://localhost:$Porta/" }

while ($servidor.IsListening) {
  $ctx = $servidor.GetContext()
  $resp = $ctx.Response
  try {
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($caminho.EndsWith('/')) { $caminho += 'index.html' }
    $arquivo = [IO.Path]::GetFullPath((Join-Path $raiz $caminho.TrimStart('/')))
    if ($arquivo.StartsWith($raiz) -and (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($arquivo)
      $ext = [IO.Path]::GetExtension($arquivo).ToLower()
      $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
      $resp.Headers.Add('Cache-Control', 'no-cache')
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
    }
  } catch {
    try { $resp.StatusCode = 500 } catch {}
  } finally {
    try { $resp.Close() } catch {}
  }
}
