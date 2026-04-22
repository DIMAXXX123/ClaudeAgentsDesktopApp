Get-Process electron | Select-Object Id, MainWindowTitle, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,0)}}, @{N='HasWin';E={$_.MainWindowHandle -ne 0}} | Format-Table -AutoSize
