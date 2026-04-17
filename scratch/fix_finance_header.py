import os

file_path = r'c:\Users\SAMSUNG\Downloads\rtc---toldos-&-cortinas\rtcweb\pages\Finance.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Using a very raw string matching for the header
header_target = 'text-right\">Valor</th>'
header_addition = '\n                               <th className=\"px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right\">Valor Pago</th>'

if header_target in content and 'Valor Pago</th>' not in content:
    content = content.replace(header_target, header_target + header_addition)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Finance.tsx header fixed with precision")
