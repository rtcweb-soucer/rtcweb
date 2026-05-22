import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add audio state
if (!code.includes('const [lastMessageCount, setLastMessageCount] = useState(0);')) {
   const stateAdd = `
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    // Inicializa o áudio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);
`;
   code = code.replace('const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);', stateAdd + '\n  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);');
}

// 2. Play audio logic inside useEffect polling
const replaceLogic = `
          setInterestedCustomers(interested);
          
          if (interested.length > lastMessageCount) {
             // Toca o sininho se o número de mensagens aumentou!
             if (audioRef.current) {
                audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
             }
          }
          setLastMessageCount(interested.length);
`;

if (code.includes('setInterestedCustomers(interested);') && !code.includes('setLastMessageCount(interested.length);')) {
    code = code.replace('setInterestedCustomers(interested);', replaceLogic);
}

fs.writeFileSync(file, code, 'utf8');
console.log("Audio logic injected.");
