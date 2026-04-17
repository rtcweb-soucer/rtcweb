import os

file_path = r'c:\Users\SAMSUNG\Downloads\rtc---toldos-&-cortinas\rtcweb\pages\Finance.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
header_added = False
body_added = False
colspan_fixed = False

for line in lines:
    # Fix Colspan
    if 'colSpan={12}' in line and not colspan_fixed:
        line = line.replace('colSpan={12}', 'colSpan={13}')
        colspan_fixed = True
    
    # Fix Header
    if 'text-right\">Valor</th>' in line and not header_added:
        # Check if following line contains Status to be sure it's the right table
        new_lines.append(line)
        indent = line[:line.find('<th')]
        new_lines.append(f'{indent}<th className=\"px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right\">Valor Pago</th>\n')
        header_added = True
        continue

    # Fix Body (The data cell is already there from previous script, but let's double check alignment)
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Finance.tsx fixed successfully with Python")
