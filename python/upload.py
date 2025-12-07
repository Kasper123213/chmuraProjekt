
import requests

# Adres lokalnego serwera lub Azure
# url = "http://localhost:3000/api/upload"
url = "https://chmuraapp-gsc3fkf2d8dnamc2.polandcentral-01.azurewebsites.net/api/upload"

# Ścieżki do plików
file_paths = [
    r"images/1_1.jpeg",
    r"images/2_1.jpeg",
    r"images/3_1.jpeg"
]

# Przygotowanie form-data dla wielu plików
files = [
    ("files", (file_paths[0], open(file_paths[0], "rb"), "image/jpeg")),
    ("files", (file_paths[1], open(file_paths[1], "rb"), "image/jpeg")),
    ("files", (file_paths[2], open(file_paths[2], "rb"), "image/jpeg"))
]

# Wysłanie żądania POST
response = requests.post(url, files=files)

# Zamknięcie otwartych plików
for _, (_, f, _) in files:
    f.close()

# Wynik
print("Status code:", response.status_code)
print("Response JSON:", response.json())
