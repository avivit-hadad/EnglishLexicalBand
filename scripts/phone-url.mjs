import os from 'os';

const port = process.argv[2] || process.env.PORT || '5173';
const nets = os.networkInterfaces();
const wifi = [];
const other = [];

for (const ifaces of Object.values(nets)) {
  for (const net of ifaces ?? []) {
    if (net.family !== 'IPv4' || net.internal) continue;
    if (net.address.startsWith('169.254.')) continue;
    if (net.address.startsWith('192.168.') || net.address.startsWith('172.16.')) {
      wifi.push(net.address);
    } else {
      other.push(net.address);
    }
  }
}

wifi.sort();
other.sort();

console.log('');
console.log('========================================');
console.log('  Lexical Band — פתיחה מהטלפון');
console.log('========================================');
console.log('');
console.log('  1. הטלפון והמחשב על אותו Wi-Fi');
console.log('  2. כבו נתונים סלולריים בטלפון');
console.log('  3. אם לא נפתח — הריצו scripts/open-firewall.bat כמנהל');
console.log('');

if (wifi.length > 0) {
  console.log('  >>> כתובת לטלפון (העתיקו):');
  console.log('');
  for (const ip of wifi) {
    console.log(`      http://${ip}:${port}`);
  }
} else {
  console.log('  לא נמצא IP של Wi-Fi (192.168.x.x).');
  console.log('  חברו את המחשב ל-Wi-Fi ונסו שוב.');
}

if (other.length > 0) {
  console.log('');
  console.log('  (אל תשתמשו בכתובות אלה — VPN/רשת וירטואלית):');
  for (const ip of other) {
    console.log(`      http://${ip}:${port}`);
  }
}

console.log('');
console.log('  במחשב: http://localhost:' + port);
console.log('========================================');
console.log('');
