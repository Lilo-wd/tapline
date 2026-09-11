# Convertit les photos de rubrique deposees a la racine en JPEG web.
#
#   powershell -File convertir-photos.ps1
#
# Les fichiers .jfif d'origine sont des JPEG de 1024 px pesant 600 a 800 Ko :
# lisibles par les navigateurs, mais un format que personne n'attend et un
# poids qui plomberait la page. Ce script les redimensionne a 1000 px de large,
# les recompresse en qualite 82, les ecrit dans assets/img/ sous un nom propre,
# puis deplace les originaux dans assets/img/_sources/ ou ils sont conserves.
#
# Relancer apres avoir depose de nouveaux .jfif a la racine.
#
# NOTE : ce fichier doit rester en ASCII pur. PowerShell 5.1 lit les .ps1
# sans BOM comme de l'ANSI : un simple caractere accentue casse l'analyse.

Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$out = Join-Path $root 'assets\img'
$keep = Join-Path $root 'assets\img\_sources'
New-Item -ItemType Directory -Force $keep | Out-Null

$targetWidth = 1000
$quality = 82

# Nom du fichier depose (minuscules, sans accents, sans extension) -> destination.
$noms = @{
  'image pour rubrique - cinq etapes deviennent une' = 'section-cinq-etapes.jpg'
  'image pour rubrique - configurez'                 = 'section-configurez.jpg'
  'image pour rubrique - posez'                      = 'section-posez.jpg'
  'image pour rubrique - recoltez'                   = 'section-recoltez.jpg'
  'image pour rubrique- la carte reste...'           = 'section-carte-reste.jpg'
}

function Remove-Accents($s) {
  $n = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $n.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($c)
    }
  }
  return $sb.ToString().Normalize([Text.NormalizationForm]::FormC)
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)

$fichiers = @(Get-ChildItem -Path $root -Filter '*.jfif' -File)
if ($fichiers.Count -eq 0) {
  Write-Host "Aucun .jfif a la racine, rien a faire."
  exit 0
}

foreach ($f in $fichiers) {
  $cle = (Remove-Accents ([IO.Path]::GetFileNameWithoutExtension($f.Name))).ToLower().Trim()
  $dest = $noms[$cle]
  if (-not $dest) {
    Write-Host ("IGNORE, nom non reconnu : " + $f.Name)
    continue
  }

  $img = [System.Drawing.Image]::FromFile($f.FullName)
  try {
    $w = $targetWidth
    $h = [int][Math]::Round($img.Height * ($w / $img.Width))
    $srcDim = "$($img.Width)" + " x " + "$($img.Height)"
    $srcKo = [math]::Round($f.Length / 1KB)

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $bmp.SetResolution(72, 72)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()

    $cible = Join-Path $out $dest
    $bmp.Save($cible, $codec, $params)
    $bmp.Dispose()

    $ko = [math]::Round((Get-Item $cible).Length / 1KB)
    Write-Host ($f.Name + "  (" + $srcDim + ", " + $srcKo + " Ko)  ->  " + $dest + "  (" + $w + " x " + $h + ", " + $ko + " Ko)")
  }
  finally { $img.Dispose() }

  Move-Item -Path $f.FullName -Destination (Join-Path $keep $f.Name) -Force
}

Write-Host "Termine. Les .jfif d'origine sont dans assets/img/_sources/."
