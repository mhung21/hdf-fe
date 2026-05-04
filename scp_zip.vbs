Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.Run "cmd /c scp fe-test.zip hypm@103.176.179.103:~/fe-temp/fe-test.zip"
WScript.Sleep 3000
WshShell.SendKeys "12345678"
WshShell.SendKeys "{ENTER}"
