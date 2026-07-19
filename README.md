# Pupply

Repozytorium zawiera aplikacje mobilna/web w Expo oraz backend marketplace opieki nad zwierzetami.

## Stack

- Frontend: React Native + Expo + TypeScript
- Backend: Node.js + Express + TypeScript
- Baza danych: PostgreSQL + Prisma ORM
- Auth: JWT access token + refresh token
- Pliki: S3-compatible storage (lokalnie MinIO)

## Co jest zaimplementowane

- Rejestracja uzytkownika: POST /api/auth/register/user
- Rejestracja kliniki: POST /api/auth/register/clinic
- Logowanie: POST /api/auth/login
- Odswiezanie sesji: POST /api/auth/refresh
- Profil zalogowanego uzytkownika: GET /api/users/me
- Profile opiekunow, uslugi i dostepnosc: /api/sitters
- Rezerwacje spacerow i opieki: /api/bookings
- Powiadomienia: /api/notifications
- Podpisane uploady zdjec: POST /api/uploads/pet-photo
- Healthcheck backendu: GET /api/health
- Readiness bazy: GET /api/ready
- Swagger UI: GET /docs
- OpenAPI JSON: GET /openapi.json

## Struktura projektu

- app/ - frontend Expo Router
- backend/ - backend API
- backend/prisma/schema.prisma - model danych

## Szybki start przez Docker

Wymagany jest Docker Desktop lub Docker Engine z Compose v2. Całą aplikację uruchamia jedno polecenie:

```bash
docker compose up --build
```

Podman również jest obsługiwany po zainstalowaniu providera `podman-compose`; odpowiednikiem polecenia jest `podman compose up --build`.

Compose automatycznie:

- buduje frontend i backend,
- uruchamia PostgreSQL oraz MinIO,
- tworzy bucket `pupply`,
- wykonuje migracje Prisma,
- uruchamia API dopiero po uzyskaniu gotowości bazy,
- monitoruje gotowość API i frontendu przez healthchecki.

Po starcie dostępne są:

- aplikacja: http://localhost:8081
- backend: http://localhost:4000/api/ready
- Swagger UI: http://localhost:4000/docs
- panel MinIO: http://localhost:9001

Zatrzymanie aplikacji:

```bash
docker compose down
```

Dane PostgreSQL i MinIO pozostają w nazwanych wolumenach. Polecenie `docker compose down -v` usuwa również te dane.

Domyślna konfiguracja jest przeznaczona do lokalnego uruchomienia i nie wymaga plików ENV. Własne wartości można umieścić w pliku `.env` obok `docker-compose.yml`. Przykładowo, dla dostępu z innego urządzenia w sieci LAN:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api
APP_PUBLIC_URL=http://192.168.1.10:8081
API_PUBLIC_URL=http://192.168.1.10:4000
CORS_ORIGIN=http://192.168.1.10:8081
S3_PUBLIC_ENDPOINT=http://192.168.1.10:9000
S3_PUBLIC_BASE_URL=http://192.168.1.10:9000/pupply
```

Po zmianie `EXPO_PUBLIC_*` trzeba ponownie wykonać `docker compose up --build`, ponieważ te wartości są osadzane w webowym bundle podczas budowania. Domyślne sekrety JWT i dane MinIO nadają się wyłącznie do lokalnego developmentu; przed publicznym wdrożeniem należy je nadpisać.

## Uruchomienie bez konteneryzowania aplikacji

Wymagane są Node.js 20+, npm 10+ oraz Docker dla PostgreSQL i MinIO.

1. Skopiuj `.env.example` do `.env.local` oraz `backend/.env.example` do `backend/.env`.
2. Zainstaluj zależności: `npm install` oraz `npm --prefix backend install`.
3. Uruchom infrastrukturę: `npm run db:up`.
4. Wykonaj `npm run backend:prisma:generate` i `npm run backend:prisma:migrate`.
5. Uruchom frontend i backend: `npm start`.

W trybie lokalnym `S3_ENDPOINT` służy backendowi do komunikacji z MinIO, natomiast `S3_PUBLIC_ENDPOINT` jest adresem używanym w podpisanych URL-ach wysyłanych do przeglądarki.

## Podglad API w UI

- Otworz Swagger UI: http://localhost:4000/docs
- Surowa specyfikacja OpenAPI: http://localhost:4000/openapi.json
- Konsola MinIO: http://localhost:9001 (lokalnie minioadmin/minioadmin)

## Testy backendu

- Utworz osobna baze testowa zgodnie z backend/.env.test.example
- Zastosuj migracje do tej bazy
- Uruchom: npm --prefix backend test

## Troubleshooting

- Port jest już zajęty
	- Zatrzymaj wcześniejszą instancję albo ustaw odpowiedni port w `.env`, np. `FRONTEND_PORT=8082`
- Zmiana `EXPO_PUBLIC_API_URL` nie pojawia się w aplikacji Docker
	- Przebuduj obraz poleceniem `docker compose up --build`
- Blad Prisma P1012: Environment variable not found DATABASE_URL
	- Upewnij sie, ze istnieje plik backend/.env i zawiera DATABASE_URL
- Blad Prisma P1001: Can't reach database server at localhost:5432
	- Uruchom baze: npm run db:up
	- Sprawdz, czy Docker Desktop jest uruchomiony
- Blad frontendu Failed to fetch mimo dzialajacego backendu
	- Ustaw w backend/.env: CORS_ORIGIN=*
	- Zrestartuj backend: npm run backend:dev

## Przeplyw auth

- Ekran logowania i rejestracji korzysta z backend API
- Po sukcesie access/refresh token zapisywane sa lokalnie
- Po zalogowaniu lub rejestracji aplikacja przechodzi do sekcji tabs

## Poza zakresem obecnego MVP

- Platnosci online
- Czat i powiadomienia push
- Oceny opiekunow
- Pelny modul obslugi klinik
