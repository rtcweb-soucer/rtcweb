import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldImageBlock = `                            {isImage ? (
                              <div className="space-y-1">
                                <img 
                                  src={mediaUrl || (text.startsWith('data:') ? text : \`data:image/jpeg;base64,\${text}\`)} 
                                  alt="Mídia" 
                                  className="rounded max-h-80 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(mediaUrl || (text.startsWith('data:') ? text : \`data:image/jpeg;base64,\${text}\`))}
                                />
                              </div>`;

const newImageBlock = `                            {isImage ? (
                              <div className="space-y-1">
                                {(() => {
                                   let imgSrc = msg.mediaUrl;
                                   if (!imgSrc && msg.base64) imgSrc = msg.base64.startsWith('data:') ? msg.base64 : \`data:image/jpeg;base64,\${msg.base64}\`;
                                   if (!imgSrc && text.startsWith('http')) imgSrc = text;
                                   if (!imgSrc && text.startsWith('data:')) imgSrc = text;
                                   if (!imgSrc && text.length > 200 && !text.includes(' ')) imgSrc = \`data:image/jpeg;base64,\${text.replace('base64,', '')}\`;
                                   
                                   if (!imgSrc) return <p className="text-[10px] italic text-slate-400">🖼️ Imagem indisponível</p>;
                                   
                                   return (
                                     <img 
                                       src={imgSrc} 
                                       alt="Mídia" 
                                       className="rounded max-h-80 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                       onClick={() => window.open(imgSrc)}
                                     />
                                   );
                                })()}
                              </div>`;

if (code.includes('src={mediaUrl || (text.startsWith(\'data:\') ? text : `data:image/jpeg;base64,${text}`)}')) {
   code = code.replace(oldImageBlock, newImageBlock);
   fs.writeFileSync(file, code, 'utf8');
   console.log("Image fix applied!");
} else {
   console.log("Image block not found!");
}
