import os
import json
import requests
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from PIL import Image
import piexif  # pip install piexif

# --- Wczytanie zmiennych środowiskowych ---
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(dotenv_path)
CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")

if not CONNECTION_STRING:
    raise ValueError("Brak CONNECTION_STRING w .env")

# --- Połączenie z Azure (opcjonalne, używamy tylko do parsowania URL) ---
blob_service_client = BlobServiceClient.from_connection_string(CONNECTION_STRING)

# --- Pobranie listy plików z API ---
url = "https://chmuraprojekt.azurewebsites.net/api/files"  # Zmień na właściwy URL
response = requests.get(url)
response.raise_for_status()
data = response.json()
files = data["files"]

base_folder = "downloaded_images"
os.makedirs(base_folder, exist_ok=True)

# --- Grupowanie po batchID ---
batches = {}
for file in files:
    metadata = file.get("metadata", {})
    batchid = metadata.get("batchID") or metadata.get("batchid", "unknown_batch")
    if batchid not in batches:
        batches[batchid] = []
    batches[batchid].append(file)

# --- Pobieranie i przetwarzanie batchy ---
for batchid, files_in_batch in batches.items():
    batch_folder = os.path.join(base_folder, batchid)
    os.makedirs(batch_folder, exist_ok=True)

    # Sortujemy pliki po nazwie, zakładając format batchID_0.jpg, batchID_1.jpg, batchID_2.jpg
    # (0 = brama, 1 = podjazd, 2 = drzwi → ostatni)
    files_in_batch.sort(key=lambda f: f["fileName"])

    # Pobieramy opisy AI z metadanych ostatniego pliku (tam są zapisane w serverze)
    last_file_meta = files_in_batch[-1]["metadata"]
    ai_short = last_file_meta.get("ai_short") or last_file_meta.get("aiDescriptions_short") or ""
    ai_long  = last_file_meta.get("ai_long")  or last_file_meta.get("aiDescriptions_long")  or ""

    metadata_lines = []

    for idx, file in enumerate(files_in_batch):
        file_name = file["fileName"]
        url = file["url"]
        metadata = file.get("metadata", {})

        # Pobieranie pliku bezpośrednio z URL (szybsze niż przez SDK)
        print(f"Pobieranie {file_name} do folderu {batchid}...")
        img_response = requests.get(url)
        img_response.raise_for_status()

        file_path = os.path.join(batch_folder, file_name)

        # Tymczasowo zapisujemy obraz
        with open(file_path, "wb") as f:
            f.write(img_response.content)

        # Wczytujemy EXIF (jeśli istnieje) i dodajemy opis do odpowiedniego zdjęcia
        try:
            exif_dict = piexif.load(file_path)

            description = ""
            if idx == 0:          # Pierwsze zdjęcie (kamera przy bramie)
                description = ai_long.strip()
            elif idx == 2:        # Ostatnie zdjęcie (kamera przy drzwiach)
                description = ai_short.strip()

            if description:
                # ImageDescription to tag 270 w 0th IFD
                exif_dict["0th"][piexif.ImageIFD.ImageDescription] = description.encode("utf-8")

            # Zapisujemy z nowym EXIF
            exif_bytes = piexif.dump(exif_dict)
            img = Image.open(file_path)
            img.save(file_path, "jpeg", quality=95, exif=exif_bytes)
            print(f"  Dodano opis AI do EXIF: {description[:50]}..." if description else "  Brak opisu AI dla tego zdjęcia")

        except Exception as e:
            print(f"  Błąd przy modyfikacji EXIF dla {file_name}: {e}")

        # Linia do metadata.txt (bez batchID)
        meta_copy = metadata.copy()
        meta_copy.pop("batchID", None)
        meta_copy.pop("batchid", None)
        metadata_lines.append(f"{file_name}: {json.dumps(meta_copy)}")

    # Zapis dodatkowego pliku z opisami AI
    metadata_path = os.path.join(batch_folder, "metadata.txt")
    with open(metadata_path, "w", encoding="utf-8") as f:
        f.write("\n".join(metadata_lines))
        f.write("\n\n--- AI Descriptions ---\n")
        f.write(f"ai_short (ostatnie zdjęcie): {ai_short}\n")
        f.write(f"ai_long  (pierwsze zdjęcie): {ai_long}\n")

print("Pobieranie i modyfikacja EXIF zakończone.")