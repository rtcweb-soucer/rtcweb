import base64
import os

file_path = r'C:\Users\SAMSUNG\.gemini\antigravity\brain\101bbe87-2d4d-4e27-abd7-28cef1b4cf71\media__1770923791497.png'
with open(file_path, 'rb') as f:
    print(base64.b64encode(f.read()).decode())
