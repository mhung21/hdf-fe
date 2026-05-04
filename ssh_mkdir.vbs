Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.Run "cmd /c ssh hypm@103.176.179.103 ""mkdir -p ~/fe-temp && rm -rf ~/fe-temp/*"""
WScript.Sleep 3000
WshShell.SendKeys "12345678"
WshShell.SendKeys "{ENTER}"
