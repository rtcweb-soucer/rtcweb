import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldLine = `audioRef.current.play().catch(e => console.log('Audio play blocked:', e));`;
const newLine = `// audioRef.current.play().catch(e => console.log('Audio play blocked:', e)); // Desativado a pedido do usuário`;

if (code.includes(oldLine)) {
    code = code.replace(oldLine, newLine);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Audio disabled!");
} else {
    console.log("Audio logic not found");
}
