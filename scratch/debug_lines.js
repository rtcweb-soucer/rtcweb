import fs from 'fs';
const lines = fs.readFileSync('c:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx', 'utf-8').split('\n');
for (let i = 480; i < 495; i++) {
    console.log(`${i+1}: [${lines[i].replace(/\r/g, '')}] (length: ${lines[i].length})`);
}
