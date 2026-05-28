Add-Type -AssemblyName System.Drawing

# Use .NET to read image and convert to SoftwareBitmap for OCR
$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
Write-Host "OCR Engine loaded: $($ocrEngine.RecognizerLanguage.DisplayName)"

$img_dir = "E:\RJ\SSBB\meoo_zip_1779612767549\图片"
$files = Get-ChildItem $img_dir -Filter "*.png" | Sort-Object Name

foreach ($f in $files) {
    Write-Host "===== $($f.Name) ====="
    try {
        # Use .NET Bitmap to load the image
        $bitmap = [System.Drawing.Bitmap]::FromFile($f.FullName)
        Write-Host "Size: $($bitmap.Width)x$($bitmap.Height)"

        # Convert to stream
        $ms = New-Object System.IO.MemoryStream
        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $ms.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null

        # Create WinRT stream from managed stream
        $wrappedStream = $ms -as [Windows.Storage.Streams.IRandomAccessStream]
        if (-not $wrappedStream) {
            # Need to use different approach
            Write-Host "Cannot convert to IRandomAccessStream"
            $ms.Dispose()
            $bitmap.Dispose()
            continue
        }

        $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($wrappedStream).GetAwaiter().GetResult()
        $swBitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
        $result = $ocrEngine.RecognizeAsync($swBitmap).GetAwaiter().GetResult()

        foreach ($line in $result.Lines) {
            Write-Host $line.Text
        }
        $ms.Dispose()
        $bitmap.Dispose()
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)"
    }
    Write-Host ""
}
