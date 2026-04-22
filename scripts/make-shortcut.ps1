$WshShell = New-Object -ComObject WScript.Shell
$lnkPath = [Environment]::GetFolderPath('Desktop') + '\ULTRONOS.lnk'
$Shortcut = $WshShell.CreateShortcut($lnkPath)
$Shortcut.TargetPath = 'powershell.exe'
$Shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\Dimax\Documents\claude-workspace\tiktok-clone\ultronos-desktop\scripts\start-ultronos.ps1"'
$Shortcut.WorkingDirectory = 'C:\Users\Dimax\Documents\claude-workspace\tiktok-clone\ultronos-desktop'
$Shortcut.IconLocation = 'C:\Users\Dimax\Documents\claude-workspace\tiktok-clone\ultronos-desktop\resources\icon.ico,0'
$Shortcut.Description = 'ULTRONOS AI Agent Command Station'
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Write-Host "Created: $lnkPath"
