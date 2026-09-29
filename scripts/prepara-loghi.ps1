# Ricava dal logo Magistra (JPG 1024x1024 su fondo bianco) le versioni usate dal sito:
#   logo-magistra.png           ritagliato, fondo trasparente, con pay off
#   logo-magistra-compatto.png  ritagliato, fondo trasparente, senza pay off (smartphone)
#   logo-magistra-bianco.jpg    ritagliato su fondo bianco (documenti ed email)
# Uso: powershell -ExecutionPolicy Bypass -File scripts\prepara-loghi.ps1 -Src design\logo_magistra.jpg -OutDir public\brand
param([string]$Src, [string]$OutDir)
Add-Type -AssemblyName System.Drawing
$Src = (Resolve-Path $Src).Path
$OutDir = (Resolve-Path $OutDir).Path
$img = [System.Drawing.Bitmap]::FromFile($Src)
$W = $img.Width; $H = $img.Height
$thr = 235

# Righe e colonne con contenuto (pixel non quasi-bianchi)
$rowHas = New-Object bool[] $H
$colMin = $W; $colMax = -1
for ($y = 0; $y -lt $H; $y++) {
  for ($x = 0; $x -lt $W; $x++) {
    $p = $img.GetPixel($x, $y)
    if ([Math]::Min([Math]::Min($p.R, $p.G), $p.B) -lt $thr) {
      $rowHas[$y] = $true
      if ($x -lt $colMin) { $colMin = $x }
      if ($x -gt $colMax) { $colMax = $x }
    }
  }
}
# Bande orizzontali di contenuto (scritta, linea, pay off)
$bands = @(); $start = -1
for ($y = 0; $y -lt $H; $y++) {
  if ($rowHas[$y] -and $start -lt 0) { $start = $y }
  if (-not $rowHas[$y] -and $start -ge 0) { $bands += ,@($start, ($y - 1)); $start = -1 }
}
if ($start -ge 0) { $bands += ,@($start, ($H - 1)) }
"Bande: " + (($bands | ForEach-Object { "$($_[0])-$($_[1])" }) -join ', ')
"Colonne: $colMin-$colMax"

# Rende trasparente il bianco mantenendo i bordi morbidi (unmultiply sul bianco)
function Save-Transparent($rect, $path, $pad) {
  $out = New-Object System.Drawing.Bitmap ($rect.Width + 2 * $pad), ($rect.Height + 2 * $pad), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $rect.Height; $y++) {
    for ($x = 0; $x -lt $rect.Width; $x++) {
      $p = $img.GetPixel($rect.X + $x, $rect.Y + $y)
      $a = [Math]::Max([Math]::Max(255 - $p.R, 255 - $p.G), 255 - $p.B)
      if ($a -lt 8) { continue }
      $af = $a / 255.0
      $r = [int][Math]::Round(255 - (255 - $p.R) / $af)
      $g = [int][Math]::Round(255 - (255 - $p.G) / $af)
      $b = [int][Math]::Round(255 - (255 - $p.B) / $af)
      $out.SetPixel($x + $pad, $y + $pad, [System.Drawing.Color]::FromArgb($a, [Math]::Max(0, $r), [Math]::Max(0, $g), [Math]::Max(0, $b)))
    }
  }
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

$top = $bands[0][0]; $bottom = $bands[-1][1]
$full = New-Object System.Drawing.Rectangle $colMin, $top, ($colMax - $colMin + 1), ($bottom - $top + 1)
Save-Transparent $full (Join-Path $OutDir 'logo-magistra.png') 8

# Versione compatta: tutte le bande tranne l'ultima (il pay off)
$cBottom = $bands[-2][1]
$compact = New-Object System.Drawing.Rectangle $colMin, $top, ($colMax - $colMin + 1), ($cBottom - $top + 1)
Save-Transparent $compact (Join-Path $OutDir 'logo-magistra-compatto.png') 6

# Versione su bianco ritagliata (documenti ed email)
$pad = 16
$wide = New-Object System.Drawing.Rectangle ([Math]::Max(0, $colMin - $pad)), ([Math]::Max(0, $top - $pad)), ($colMax - $colMin + 1 + 2 * $pad), ($bottom - $top + 1 + 2 * $pad)
$crop = $img.Clone($wide, $img.PixelFormat)
$crop.Save((Join-Path $OutDir 'logo-magistra-bianco.jpg'), [System.Drawing.Imaging.ImageFormat]::Jpeg)
$crop.Dispose()
$img.Dispose()
