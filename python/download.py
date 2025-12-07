
import requests
import base64
from pathlib import Path
import json
from datetime import datetime

# API z plikami w określonym przedziale dat
# url = "http://localhost:3000/api/files?from=2025-12-01&to=2025-12-08"
url = "https://chmuraapp-gsc3fkf2d8dnamc2.polandcentral-01.azurewebsites.net/api/files?from=2025-12-01&to=2025-12-09"

response = requests.get(url)
print("Status code:", response.status_code)
print("Response text:", response.text[:1000])

try:
    data = response.json()
except Exception as e:
    print("Błąd parsowania JSON:", e)
    exit(1)

files = data.get("files", [])
print(f"Znaleziono plików: {len(files)}")

output_dir = Path("downloaded_images")
output_dir.mkdir(exist_ok=True)

for f in files:
    name = f.get("originalName", "unknown")
    content_base64 = f.get("content")
    upload_date = f.get("uploadDate")
    
    if content_base64 and upload_date:
        # Dekodowanie base64 i zapis obrazu
        content_bytes = base64.b64decode(content_base64)
        ext = name.split(".")[-1] if "." in name else "jpg"
        
        # Folder po dacie i godzinie (YYYY-MM-DD_HH-MM-SS)
        dt = datetime.fromisoformat(upload_date)
        date_time_str = dt.strftime("%Y-%m-%d_%H-%M-%S")
        folder_name = output_dir / date_time_str
        folder_name.mkdir(exist_ok=True)
        
        # Zapis obrazu
        img_file_path = folder_name / name
        with open(img_file_path, "wb") as img_file:
            img_file.write(content_bytes)
        
        # Zapis informacji do pliku txt
        metadata = {
            "uploadDate": upload_date,
            "mimeType": f.get("mimeType"),
            "size": f.get("size"),
            "aiDescription_short": f.get("aiDescription_short"),
            "aiDescription_long": f.get("aiDescription_long"),
        }
        txt_file_path = folder_name / f"{Path(name).stem}.txt"
        with open(txt_file_path, "w", encoding="utf-8") as txt_file:
            json.dump(metadata, txt_file, ensure_ascii=False, indent=2)
        
        print(f"Zapisano plik i metadane w folderze: {folder_name}")
    else:
        print(f"Brak zawartości lub daty w pliku: {name}")
