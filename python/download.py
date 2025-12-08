import os
import json
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv

# url = "http://localhost:3000/api/files"
url = "https://chmuraapp-gsc3fkf2d8dnamc2.polandcentral-01.azurewebsites.net/api/files"


# --- Wczytanie zmiennych środowiskowych ---
# Ścieżka do .env w folderze wyżej
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(dotenv_path)
CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")  # connection string z .env

if not CONNECTION_STRING:
    raise ValueError("Brak CONNECTION_STRING w .env")

# --- Połączenie z Azure ---
blob_service_client = BlobServiceClient.from_connection_string(CONNECTION_STRING)

# --- Pobranie JSON z lokalnego endpointu ---
import requests
response = requests.get(url)
data = response.json()
files = data["files"]
base_folder = "downloaded_images"
os.makedirs(base_folder, exist_ok=True)

# --- Grupowanie po batchID ---
batches = {}
for file in files:
    batchid = file["metadata"].get("batchid", "unknown_batch")
    if batchid not in batches:
        batches[batchid] = []
    batches[batchid].append(file)

# --- Pobieranie plików i tworzenie folderów ---
for batchid, files_in_batch in batches.items():
    os.makedirs(os.path.join(base_folder, batchid), exist_ok=True)
    metadata_lines = []

    for file in files_in_batch:
        file_name = file["fileName"]
        metadata = file["metadata"]

        # Wyciągamy container i blob name z URL
        url_parts = file["url"].split("/")
        container_name = url_parts[3]  # trzeci element po https://<account>.blob.core.windows.net/
        blob_name = "/".join(url_parts[4:])

        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)

        print(f"Pobieranie {file_name} do folderu {os.path.join(base_folder, batchid)}...")

        try:
            download_stream = blob_client.download_blob()
            file_path = os.path.join(os.path.join(base_folder, batchid), file_name)
            with open(file_path, "wb") as f:
                f.write(download_stream.readall())
        except Exception as e:
            print(f"Nie udało się pobrać {file_name}: {e}")
            continue

        # Tworzymy linię metadanych (bez batchid bo już folder)
        meta_copy = metadata.copy()
        meta_copy.pop("batchid", None)
        metadata_lines.append(f"{file_name}: {json.dumps(meta_copy)}")

    # Zapis metadanych do pliku metadata.txt w folderze
    metadata_path = os.path.join(os.path.join(base_folder, batchid), "metadata.txt")
    with open(metadata_path, "w", encoding="utf-8") as f:
        f.write("\n".join(metadata_lines))

print("Pobieranie zakończone.")
