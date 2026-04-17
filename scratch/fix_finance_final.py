import os

file_path = r'c:\Users\SAMSUNG\Downloads\rtc---toldos-&-cortinas\rtcweb\pages\Finance.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
found_header = False
header_fixed = False

for line in lines:
    if 'Contrato / Cliente' in line:
        found_header = True
    
    if found_header and 'text-right\">Valor</th>' in line and not header_fixed:
        new_lines.append(line)
        # Calculate indentation
        indent = line[:line.find('<th')]
        new_lines.append(f'{indent}<th className=\"px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right\">Valor Pago</th>\n')
        header_fixed = True
        continue
    
    if found_header and '</tr>' in line:
        found_header = False # Done with this header
        
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Finance.tsx header fixed successfully")
