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

## Wymagania

- Node.js 20+
- npm 10+
- lokalna instancja PostgreSQL lub Docker Desktop

## Konfiguracja ENV

1. Frontend
- Skopiuj plik .env.example do .env.local
- Ustaw EXPO_PUBLIC_API_URL pod adres backendu, np. http://localhost:4000/api

2. Backend
- Skopiuj backend/.env.example do backend/.env
- Ustaw DATABASE_URL pod lokalna baze PostgreSQL
- Ustaw JWT_ACCESS_SECRET i JWT_REFRESH_SECRET (min. 32 znaki)
- Dla zdjec ustaw S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID i S3_SECRET_ACCESS_KEY
- Dla e-maili resetu hasla ustaw SMTP_HOST oraz dane SMTP; w development link jest wypisywany w logu

## Pierwsze uruchomienie

1. Instalacja zaleznosci frontendu
- npm install

2. Instalacja zaleznosci backendu
- npm --prefix backend install

3. Generowanie klienta Prisma
- npm run backend:prisma:generate

4. Uruchom PostgreSQL i MinIO (jesli nie masz lokalnych instancji)
- npm run db:up

5. Migracje bazy
- npm run backend:prisma:migrate

6. Uruchom backend
- npm run backend:dev

7. Uruchom frontend (w drugim terminalu)
- npm start

## Podglad API w UI

- Otworz Swagger UI: http://localhost:4000/docs
- Surowa specyfikacja OpenAPI: http://localhost:4000/openapi.json
- Konsola MinIO: http://localhost:9001 (lokalnie minioadmin/minioadmin)

## Testy backendu

- Utworz osobna baze testowa zgodnie z backend/.env.test.example
- Zastosuj migracje do tej bazy
- Uruchom: npm --prefix backend test

## Troubleshooting

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
