# Normalise les visuels produit.
#
#   powershell -File normaliser-images.ps1
#
# Les fichiers d'origine sont des cartes a coins arrondis posees sur un fond
# BLANC OPAQUE, avec une marge differente sur chacun et un leger halo sur le
# pourtour. Pose tel quel sur le fond de la page, ce blanc formait un cadre
# visible autour de la carte. Ce script :
#
#   1. detecte la boite englobante de la carte (contenu non blanc),
#   2. mesure le rayon de ses coins arrondis,
#   3. mesure l'epaisseur du halo clair sur son pourtour,
#   4. rogne au ras de la carte, halo compris : la carte remplit le cadre,
#   5. reduit a la taille cible et enregistre en JPEG.
#
# Les coins ne sont PAS decoupes en transparence ici : ils sont arrondis en
# CSS, ce qui permet d'utiliser du JPEG plutot que du PNG. A resolution egale
# c'est environ neuf fois plus leger (150 Ko contre 1,4 Mo), pour un rendu
# identique. Le script affiche a la fin le pourcentage a reporter dans la cle
# `radius` de chaque variante, dans assets/js/config.js.
#
# Lit  : assets/img/_sources/*.png
# Ecrit: assets/img/*.jpg           1024 px, grand visuel
#        assets/img/thumbs/*.jpg    192 px, vignettes et pastilles
#
# NOTE : fichier a garder en ASCII pur (PowerShell 5.1 lit les .ps1 sans BOM
# comme de l'ANSI). Et attention, les variables PowerShell ignorent la casse :
# ne pas nommer une variable $b et une autre $B.

Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$src = Join-Path $root 'assets\img\_sources'
$out = Join-Path $root 'assets\img'
$thumbDir = Join-Path $out 'thumbs'

$bigSize   = 1024
$thumbSize = 192
$quality   = 88
$whiteLevel = 244    # au-dela, le pixel est du fond blanc
$solidLevel = 205    # en deca, on est franchement dans la carte

if (-not (Test-Path $src)) { Write-Host "Dossier introuvable : $src"; exit 1 }
New-Item -ItemType Directory -Force $thumbDir | Out-Null

# --- Acces rapide aux pixels -------------------------------------------
# GetPixel appele un million de fois prend plusieurs minutes ; LockBits copie
# tout d'un coup dans un tableau d'octets (BGRA).
function Read-Pixels($bitmap) {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $bitmap.Width, $bitmap.Height)
  $data = $bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                           [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bitmap.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bitmap.UnlockBits($data)
  return @{ bytes = $bytes; stride = $data.Stride; w = $bitmap.Width; h = $bitmap.Height }
}

# Renvoie le maximum des trois canaux : proche de 255 = blanc, bas = carte.
function Get-Level($px, $x, $y) {
  $i = $y * $px.stride + $x * 4
  $bl = $px.bytes[$i]; $gr = $px.bytes[$i + 1]; $re = $px.bytes[$i + 2]
  $m = $bl
  if ($gr -gt $m) { $m = $gr }
  if ($re -gt $m) { $m = $re }
  return $m
}

# --- Analyse ------------------------------------------------------------
# La carte est un rectangle arrondi centre : elle est la plus large sur sa
# ligne mediane et la plus haute sur sa colonne mediane. Quatre balayages de
# ligne suffisent donc a trouver la boite, au lieu de parcourir l'image.
function Get-Card($px, $level) {
  $midY = [int]($px.h / 2)
  $midX = [int]($px.w / 2)

  $L = -1; for ($x = 0;          $x -lt $px.w; $x++) { if ((Get-Level $px $x $midY) -le $level) { $L = $x; break } }
  $R = -1; for ($x = $px.w - 1;  $x -ge 0;     $x--) { if ((Get-Level $px $x $midY) -le $level) { $R = $x; break } }
  $T = -1; for ($y = 0;          $y -lt $px.h; $y++) { if ((Get-Level $px $midX $y) -le $level) { $T = $y; break } }
  $Bo = -1; for ($y = $px.h - 1; $y -ge 0;     $y--) { if ((Get-Level $px $midX $y) -le $level) { $Bo = $y; break } }

  if ($L -lt 0 -or $T -lt 0) { return $null }
  return @{ L = $L; T = $T; R = $R; B = $Bo; W = ($R - $L + 1); H = ($Bo - $T + 1) }
}

# Rayon : premiere ligne, sous le haut de la carte, ou son bord gauche
# rejoint le bord gauche de la boite.
function Get-Radius($px, $card, $level) {
  $limit = [int]($card.W * 0.25)
  for ($dy = 0; $dy -lt $limit; $dy++) {
    $y = $card.T + $dy
    for ($x = $card.L; $x -le $card.L + $limit; $x++) {
      if ((Get-Level $px $x $y) -le $level) {
        if ($x -eq $card.L) { return $dy }
        break
      }
    }
  }
  return [int]($card.W * 0.05)
}

# Halo : nombre de pixels, depuis le bord de la boite, avant d'etre
# franchement dans la carte. C'est ce qu'il faut rogner en plus.
function Get-Fringe($px, $card, $solid) {
  $midY = [int](($card.T + $card.B) / 2)
  $midX = [int](($card.L + $card.R) / 2)
  $depths = @()

  $d = 0; while ($d -lt 40 -and (Get-Level $px ($card.L + $d) $midY) -gt $solid) { $d++ }; $depths += $d
  $d = 0; while ($d -lt 40 -and (Get-Level $px ($card.R - $d) $midY) -gt $solid) { $d++ }; $depths += $d
  $d = 0; while ($d -lt 40 -and (Get-Level $px $midX ($card.T + $d)) -gt $solid) { $d++ }; $depths += $d
  $d = 0; while ($d -lt 40 -and (Get-Level $px $midX ($card.B - $d)) -gt $solid) { $d++ }; $depths += $d

  $max = 0
  foreach ($v in $depths) { if ($v -gt $max) { $max = $v } }
  return @{ max = $max; detail = ($depths -join '/') }
}

# --- Ecriture -----------------------------------------------------------
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)

function Write-Jpeg($source, $rect, $size, $destPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $bmp.SetResolution(72, 72)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  # La carte remplit tout le cadre : les coins seront arrondis en CSS.
  $dest = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $g.DrawImage($source, $dest, $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save($destPath, $codec, $encParams)
  $bmp.Dispose()
}

$resume = @()

Get-ChildItem -Path $src -Filter '*.png' | ForEach-Object {
  $file = $_
  $bitmap = New-Object System.Drawing.Bitmap($file.FullName)
  try {
    $px = Read-Pixels $bitmap
    $card = Get-Card $px $whiteLevel
    if (-not $card) { Write-Host "$($file.Name) : aucune carte detectee, ignoree"; return }

    $radius = Get-Radius $px $card $whiteLevel
    $fringe = Get-Fringe $px $card $solidLevel
    $inset = $fringe.max + 2

    $cropX = $card.L + $inset
    $cropY = $card.T + $inset
    $cropW = $card.W - 2 * $inset
    $cropH = $card.H - 2 * $inset
    $rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)

    $base = [IO.Path]::GetFileNameWithoutExtension($file.Name)
    Write-Jpeg $bitmap $rect $bigSize   (Join-Path $out      "$base.jpg")
    Write-Jpeg $bitmap $rect $thumbSize (Join-Path $thumbDir "$base.jpg")

    # Rayon visible apres rognage, en pourcentage de la largeur. On ajoute une
    # marge : mieux vaut mordre d'un cheveu sur le coin que laisser depasser
    # un eclat de blanc.
    $pct = [math]::Round(100 * (($radius - $inset) / $cropW) + 0.5, 1)

    $ko = [math]::Round((Get-Item (Join-Path $out "$base.jpg")).Length / 1KB)
    Write-Host ("$($file.Name) : $($bitmap.Width)x$($bitmap.Height)" +
                "  carte $($card.W)x$($card.H) a ($($card.L),$($card.T))" +
                "  rayon $radius px  halo $($fringe.detail)  ->  rogne $cropW x $cropH" +
                "  ->  $base.jpg ($bigSize px, $ko Ko) + vignette $thumbSize px")
    $resume += "  $base : radius: '$pct%'"
  }
  finally { $bitmap.Dispose() }
}

Write-Host ""
Write-Host "A reporter dans la cle 'radius' de chaque variante (assets/js/config.js) :"
$resume | ForEach-Object { Write-Host $_ }
