# Petit serveur statique de prévisualisation (aucune dépendance).
#   powershell -File serve.ps1
# puis ouvrir http://localhost:8099
# Le bouton de paiement ne fonctionne pas ici : il a besoin de la fonction Netlify.

$root = $PSScriptRoot
$prefix = 'http://localhost:8099/'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Tapline servi depuis $root sur $prefix (Ctrl+C pour arreter)"

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json; charset=utf-8'
  '.xml'  = 'application/xml; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.webp' = 'image/webp'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    # Les pages secondaires vivent maintenant en dossier/index.html (URLs
    # propres, ex. /contact/) : resoudre "/" et tout chemin finissant par
    # "/" vers son index.html, comme le fait Netlify en production.
    if ($path.EndsWith('/')) { $path = $path + 'index.html' }
    $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')

    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $ct
      $ctx.Response.StatusCode = 200
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404 - fichier introuvable')
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.Close()
  } catch {
    Write-Host "erreur: $_"
  }
}
