
# Trójkamerowy System Fotopułapkowy Zintegrowany z Chmurą

## Konfiguracja Azure Blob Storage

Po zalogowaniu się na konto studenckie:

1. **Utwórz Storage Account**
    - Przejdź do Azure Services → Storage accounts
    - Kliknij "Create"
    - Podaj nazwę, ustaw region na **Poland Central**
    - Kliknij "Review + create" → "Create"

    <img src="readme_images/image.png" alt="Tworzenie Storage Account" width="50%"/>

    <img src="readme_images/image-1.png" alt="Tworzenie Storage Account" width="50%"/>

2. **Dodaj Container**
    - Otwórz utworzony Storage Account
    - Przejdź do Data storage → Containers → Add container
    - Utwórz container o nazwie `uploads`

    <img src="readme_images/image-2.png" alt="Dodawanie Container" width="50%"/>

3. **Pobierz Connection String**
    - Przejdź do Security + Networking → Access keys
    - Skopiuj **Connection string**
    - Wklej do pliku `.env` jako `AZURE_STORAGE_CONNECTION_STRING`

## Konfiguracja .env

Utwórz plik `.env` w głównym katalogu projektu i uzupełnij następujące zmienne:

```env
AZURE_STORAGE_CONNECTION_STRING=<twoja-wartość>
GEMINI_API_KEY=<twoja-wartość>
OPENROUTER_API_KEY=<twoja-wartość>
UPLOAD_URL=http://localhost:3000/api/upload
```

**Opis zmiennych:**
- `GEMINI_API_KEY` - wygeneruj na [Google AI Studio](https://aistudio.google.com/u/1/api-keys)
- `OPENROUTER_API_KEY` - wygeneruj na [OpenRouter](https://openrouter.ai/google/gemini-flash-1.5)
- `UPLOAD_URL` - dla pracy lokalnej użyj `http://localhost:3000/api/upload`

> Klucz OPENROUTER umożliwia automatyczne przełączanie między modelami, gdy zabraknie tokenów GEMINI.

## Backend

### Wymagania
- **Python**: 3.14.0
- **Node**: 24.11.0
- **npm**: 11.6.1

### Uruchamianie lokalnie

1. Sprawdź, czy pierwsza linia pliku `server.js` zawiera:
    ```javascript
    require('dotenv').config();
    ```

2. Zainstaluj zależności:
    ```bash
    npm install
    ```

3. Uruchom projekt:
    ```bash
    npm start
    ```

Aplikacja będzie dostępna pod adresem: `http://localhost:3000`

### Wdrażanie na Azure

1. Sprawdź, czy pierwsza linia pliku `server.js` zawiera:
    ```javascript
    require('dotenv').config();
    ```
    Jeśli tak, usuń ją.

2. W Azure Services wybierz **App Services** → Create → Web App
    <img src="readme_images/image-3.png" alt="Tworzenie Storage Account" width="50%"/>
3. Ustaw:
    - Nową lub istniejącą Resource Group
    - Nazwę aplikacji
    - Region: **Poland Central**
    - Runtime stack: **Node 24 LTS**
4. Kliknij "Review + create" → "Create"

    <img src="readme_images/image-4.png" alt="Tworzenie Storage Account" width="50%"/>
5. W stworzonej aplikacji ustaw zmienne środowiskowe:
    - Settings → Environment variables → Add
    - Dodaj wszystkie zmienne z pliku `.env`

6. Wdróż projekt:
    - Utwórz archiwum ZIP zawierające: `package.json`, `package-lock.json`, `server.js`
    - Przejdź do Deployment → Deployment Center
    - Wybierz "Publish files"
    - Prześlij archiwum ZIP i kliknij "Save"

        <img src="readme_images/image-5.png" alt="Tworzenie Storage Account" width="50%"/>

## Testy w Pythonie

### Przesyłanie plików

1. Utwórz środowisko wirtualne:
    ```bash
    python -m venv env
    env\Scripts\activate
    pip install -r requirements.txt
    ```

2. W folderze `images` umieść pliki: `1.jpeg`, `2.jpeg`, `3.jpeg`

3. Uruchom test przesyłania:
    ```bash
    python upload.py
    ```

### Pobieranie danych

Aby pobrać dane z Azure, uruchom:
```bash
python download.py
```

Pobrane pliki pojawią się w folderze `downloaded_images`
