@echo off
echo Adding Windows Firewall rules for Lexical Band...
netsh advfirewall firewall add rule name="Lexical Band Dev 5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Lexical Band Preview 4173" dir=in action=allow protocol=TCP localport=4173
echo Done. Try opening the phone URL again.
pause
