Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.Run "cmd /c scp -r dist/crediflow-fe/browser/* hypm@103.176.179.103:/var/www/hdf-fe-test/"
WScript.Sleep 5000
WshShell.SendKeys "12345678"
WshShell.SendKeys "{ENTER}"
