# Generates cue's own app icon (build-resources/icon.ico + icon.png) from the
# same pinwheel mark used in the renderer. No Microsoft assets are involved.
# Run with: powershell -ExecutionPolicy Bypass -File scripts/make-cue-icon.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "build-resources"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-CueBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 24.0
  $cx = 12 * $s

  # Rounded dark tile
  $pad = 0.6 * $s
  $rect = New-Object System.Drawing.RectangleF($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
  $radius = 5.2 * $s
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 17, 24, 39),
    [System.Drawing.Color]::FromArgb(255, 4, 7, 14),
    45.0)
  $g.FillPath($bg, $path)

  # Pinwheel blades
  $r = 6.6 * $s
  $box = New-Object System.Drawing.RectangleF(($cx - $r), ($cx - $r), ($r * 2), ($r * 2))
  $blades = @(
    @{ Start = 214.6; Sweep = 55.4; Alpha = 255 },
    @{ Start = 304.6; Sweep = 55.4; Alpha = 184 },
    @{ Start = 34.6;  Sweep = 55.4; Alpha = 128 },
    @{ Start = 124.6; Sweep = 55.4; Alpha = 217 }
  )
  foreach ($b in $blades) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddLine($cx, $cx, ($cx + $r * [Math]::Cos($b.Start * [Math]::PI / 180)), ($cx + $r * [Math]::Sin($b.Start * [Math]::PI / 180)))
    $p.AddArc($box, $b.Start, $b.Sweep)
    $p.AddLine(($cx + $r * [Math]::Cos(($b.Start + $b.Sweep) * [Math]::PI / 180)), ($cx + $r * [Math]::Sin(($b.Start + $b.Sweep) * [Math]::PI / 180)), $cx, $cx)
    $p.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($b.Alpha, 255, 255, 255))
    $g.FillPath($brush, $p)
    $brush.Dispose()
    $p.Dispose()
  }

  # Outer ring
  $ringR = 9.2 * $s
  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), (1.6 * $s))
  $g.DrawEllipse($ringPen, ($cx - $ringR), ($cx - $ringR), ($ringR * 2), ($ringR * 2))
  $ringPen.Dispose()

  $g.Dispose()
  return $bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngs = @()
foreach ($size in $sizes) {
  $bmp = New-CueBitmap $size
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += ,@{ Size = $size; Bytes = $ms.ToArray() }
  if ($size -eq 256) {
    $bmp.Save((Join-Path $outDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $ms.Dispose()
  $bmp.Dispose()
}

# Assemble a multi-resolution .ico with PNG-compressed entries (Vista+).
$icoPath = Join-Path $outDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)                 # reserved
$bw.Write([UInt16]1)                 # type: icon
$bw.Write([UInt16]$pngs.Count)       # image count

$offset = 6 + (16 * $pngs.Count)
foreach ($img in $pngs) {
  $dim = if ($img.Size -ge 256) { 0 } else { $img.Size }
  $bw.Write([Byte]$dim)              # width (0 means 256)
  $bw.Write([Byte]$dim)              # height
  $bw.Write([Byte]0)                 # palette count
  $bw.Write([Byte]0)                 # reserved
  $bw.Write([UInt16]1)               # color planes
  $bw.Write([UInt16]32)              # bits per pixel
  $bw.Write([UInt32]$img.Bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $img.Bytes.Length
}
foreach ($img in $pngs) { $bw.Write($img.Bytes) }
$bw.Flush()
$bw.Close()
$fs.Close()

Write-Output "Wrote $icoPath and $(Join-Path $outDir 'icon.png')"
