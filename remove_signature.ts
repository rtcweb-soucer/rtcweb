import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const strToRemove = `    // E se ele alterou e removeu o texto original, a gente só acrescenta algo:
    if (!msg.includes('Condição super especial') && msg.length > 0) {
      msg = msg + " [Revisado e melhorado pela IA Gemini 🪄]";
    }`;

if (code.includes(strToRemove)) {
    code = code.replace(strToRemove, '');
    fs.writeFileSync(file, code, 'utf8');
    console.log("Done");
} else {
    console.log("Could not find the signature block to remove.");
}
