Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
'@

$proc = Get-Process electron | Where-Object { $_.MainWindowTitle -like '*ULTRONOS*' } | Select-Object -First 1
if (-not $proc) { Write-Host 'No ULTRONOS window found'; exit 1 }
$hwnd = $proc.MainWindowHandle
if ([WinApi]::IsIconic($hwnd)) { [WinApi]::ShowWindow($hwnd, 9) | Out-Null }
[WinApi]::ShowWindow($hwnd, 5) | Out-Null
[WinApi]::SetForegroundWindow($hwnd) | Out-Null
Write-Host "Focused PID=$($proc.Id) HWND=$hwnd"
