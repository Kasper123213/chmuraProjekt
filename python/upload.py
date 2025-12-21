
import requests
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Adres lokalnego serwera lub Azure
# url = "http://localhost:3000/api/upload"
url = "https://chmuraprojekt.azurewebsites.net/api/upload"


data = {
    "batchID": "FinalTest"
}
# Ścieżki do plików
file_paths = [
    os.path.join(BASE_DIR, "images", "1_1.jpeg"),
    os.path.join(BASE_DIR, "images", "2_1.jpeg"),
    os.path.join(BASE_DIR, "images", "3_1.jpeg")
]

# Przygotowanie form-data dla wielu plików
files = [
    ("files", (os.path.basename(p), open(p, "rb"), "image/jpeg"))
    for p in file_paths
]

# Wysłanie żądania POST
response = requests.post(url, files=files, data=data)

# Zamknięcie otwartych plików
for _, (_, f, _) in files:
    f.close()

# Wynik
print("Status code:", response.status_code)
print(response.text)
print("Response JSON:", response.json())
