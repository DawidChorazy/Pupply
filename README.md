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
- Udostępnianie karty pupila: link bez logowania, ważny 7 dni, z możliwością cofnięcia i opcjonalnymi PDF-ami
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
- lokalna skrzynka e-mail Mailpit: http://localhost:8025

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

## Logowanie Google na telefonie

Expo Go nie obsługuje używanego przez aplikację przepływu Google OAuth. W Expo Go korzystaj z logowania e-mailem i hasłem. Do testowania Google potrzebny jest własny build deweloperski, zgodnie z [dokumentacją Expo](https://docs.expo.dev/guides/authentication/).

- Web korzysta z `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Telefon wymaga osobnego `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` lub `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; nie kopiuj w to miejsce webowego ID.
- Utwórz klientów OAuth w Google Cloud dla docelowej platformy. Android wymaga zgodnego identyfikatora pakietu i odcisku SHA-1 certyfikatu podpisującego build, a iOS zgodnego bundle identifier. Ustaw te identyfikatory również w `app.json` (`android.package`, `ios.bundleIdentifier`).
- Dodaj używane ID klientów do `GOOGLE_CLIENT_IDS` w `backend/.env`, oddzielając je przecinkami, i zrestartuj backend.
- `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` dotyczy tylko aplikacji natywnej. Usuń webowy `http://localhost:8081`, jeśli został tam ustawiony. Domyślny redirect biblioteki bazuje na identyfikatorze aplikacji; ewentualny własny redirect musi pasować do konfiguracji klienta Google i obsługi linków w buildzie.
- Zainstaluj klienta deweloperskiego (`npx expo install expo-dev-client`) i przygotuj build według [instrukcji Expo](https://docs.expo.dev/develop/development-builds/create-a-build/). Na Windows lokalny build Androida wymaga Android Studio: `npx expo run:android`. Build iOS wymaga macOS lub EAS Build.
- Po zmianie zmiennych uruchom Metro ponownie: `npx expo start --dev-client --clear`. Na fizycznym telefonie adres API musi wskazywać komputer w sieci LAN, a nie `localhost`.

## Lokalizacja w wyszukiwaniu opieki

Pole miejscowości pobiera podpowiedzi dla Polski z Photon / OpenStreetMap przez backend (`GET /api/locations/search`). Po wybraniu wyniku wyszukiwanie opiekunów używa współrzędnych miejscowości. Pobranie pozycji urządzenia wymaga kliknięcia przycisku i zgody na lokalizację; odbywa się jednorazowo, bez śledzenia w tle. Backend ustala nazwę miejscowości przez `/api/locations/reverse`, a wyszukiwanie opiekunów nadal używa pozycji urządzenia.

Na webie geolokalizacja wymaga HTTPS lub `localhost`; przy otwarciu strony przez zwykłe HTTP pod adresem LAN można wpisać miejscowość ręcznie. `expo-location` działa również w Expo Go. Po dodaniu modułu zrestartuj Metro; własny build natywny wymaga przebudowania, aby uwzględnić uprawnienia.

Publiczny serwer Photon nie wymaga klucza API, ale nie gwarantuje dostępności. Podpowiedzi mają opóźnienie 400 ms, cache na backendzie i limit zapytań. Przed wdrożeniem na dużą skalę skonfiguruj własny serwer Photon lub dostawcę geokodowania z gwarancją dostępności.

## Profil opiekuna

Formularz „Zostań opiekunem” zapisuje opis, miejscowość i województwo, zasięg działania, opcjonalne zdjęcie oraz do 20 ofert z osobnymi cenami. Można dodać kilka wariantów jednej usługi o różnym czasie. Cena jest kwotą za jedną rezerwację o podanym czasie. Usunięte warianty zostają nieaktywne w bazie, aby zachować historię rezerwacji.

Zdjęcia są przesyłane przez `POST /api/uploads/sitter-photo` do storage i przypisane do konta opiekuna. Przed zapisaniem backend sprawdza własność i istnienie zdjęcia. Wstrzymanie widoczności profilu nie usuwa istniejących rezerwacji. Dodanie i usunięcie dostępności zapisuje się od razu, a pozostałe zmiany po kliknięciu „Zapisz”.

Po aktualizacji zastosuj migracje (`npx prisma migrate deploy` w `backend`) oraz wygeneruj klienta (`npm run backend:prisma:generate`). Przy korzystaniu z telefonu `S3_PUBLIC_ENDPOINT` i `S3_PUBLIC_BASE_URL` w `backend/.env` muszą wskazywać dostępny w LAN adres komputera, tak samo jak API; `localhost` na telefonie nie prowadzi do MinIO na komputerze.

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
- Czat
- Oceny opiekunow
- Pelny modul obslugi klinik

## Questy i ranking

Questy są weryfikowane przez backend, a odebrane nagrody zapisywane w `QuestClaim`.
Każdy quest można odebrać raz na konto; ponowienie żądania i równoczesne kliknięcia nie naliczają punktów ponownie.

- Pierwszy pupil: 50 pkt za posiadanie pupila.
- Pełny profil pupila: 75 pkt za imię, wiek, rasę, dodatnią wagę i kontakt do weterynarza u jednego pupila. Brak alergii nie blokuje zadania.
- Pierwszy zakończony spacer: 90 pkt za rezerwację `DOG_WALK` w stanie `COMPLETED` po stronie właściciela.
- Regularna opieka: 300 pkt za 5 zakończonych rezerwacji właściciela, niezależnie od rodzaju usługi.

Istniejące dane konta również liczą się do postępu. Nagrody nie są odbierane po usunięciu pupila; punkty z wcześniejszej makiety nie są przenoszone. Dokumenty PDF nie naliczają punktów; questy spacerów bazują na zakończonych rezerwacjach backendu.

Ranking jest ogólny, bez resetów: pokazuje 50 pierwszych kont użytkowników oraz własne miejsce także poza tą listą. Remisy mają wspólne miejsce (1, 1, 3). Wyświetlane są imię i inicjał nazwiska, bez danych kontaktowych. Nowe konta zaczynają od 0 pkt.

API (wymaga zalogowanego konta `USER`): `GET /api/gamification/quests`, `POST /api/gamification/quests/:questId/claim`, `GET /api/gamification/leaderboard`. Kontrakty są dostępne w Swaggerze. Po aktualizacji uruchom migracje i wygeneruj klienta Prisma, następnie zrestartuj backend.

## Rezerwacje, dokumenty i bezpieczeństwo kont

Główne ekrany spacerów i marketplace korzystają teraz z tego samego API rezerwacji. Ekran główny pokazuje prawdziwe rezerwacje `DOG_WALK`, a szczegóły pobierają aktualny status z serwera. Mapa i etapy spaceru nie są już symulowane w tym przepływie; rzeczywiste śledzenie GPS pozostaje osobnym rozszerzeniem.

Rezerwacja zapisuje własne `startsAt`, `endsAt` i `expiresAt`. Parametr `startsAt` jest opcjonalny przy tworzeniu rezerwacji; bez niego używany jest początek slotu. Wyszukiwarka zwraca wolne fragmenty dostępności, więc kilka fragmentów może mieć ten sam identyfikator slotu. Klient musi przekazać również wybrany `startsAt`. Godzinna usługa rezerwuje godzinę, a reszta przedziału pozostaje dostępna. PostgreSQL blokuje nakładające się terminy opiekuna i pupila; sąsiednie przedziały są dozwolone.

Prośby `REQUESTED` wygasają po 24 godzinach lub z chwilą rozpoczęcia terminu, zależnie od tego, co nastąpi wcześniej. Ustawienie `BOOKING_REQUEST_TTL_HOURS` zmienia ten limit dla nowych rezerwacji. Status `EXPIRED` ustawia serwer; obie strony otrzymują powiadomienie. Opiekun może zakończyć zaakceptowaną rezerwację dopiero po jej własnym `endsAt`.

Dokumenty medyczne są zapisane w PostgreSQL i prywatnym buckecie `S3_DOCUMENT_BUCKET` (domyślnie `pupply-documents`). Ten bucket musi być inny niż publiczny bucket zdjęć i nie może mieć publicznego odczytu. Compose tworzy go z prywatną polityką. Upload obejmuje przygotowanie URL-a, wysłanie PDF-a i potwierdzenie pliku; serwer sprawdza rozmiar, typ oraz sygnaturę `%PDF-`. Pobieranie wymaga uprawnień właściciela i zwraca podpisany URL ważny przez 5 minut. Daty ważności w API mają format `RRRR-MM-DD`, w formularzu `DD.MM.RRRR`. Nie ma migracji dokumentów przechowywanych wcześniej wyłącznie w pamięci przeglądarki.

Reset hasła jest dostępny pod `/reset-password`, potwierdzanie adresu pod `/verify-email`, a ustawienia konta pod `/account-settings`. Rezerwowanie i oferowanie opieki wymagają potwierdzonego e-maila. W lokalnym Docker Compose wiadomości trafiają do **Mailpit: http://localhost:8025**; nie są wysyłane do zewnętrznych odbiorców. Przy dostępie z telefonu `APP_PUBLIC_URL` musi wskazywać adres aplikacji dostępny z telefonu. W publicznym wdrożeniu zastąp Mailpit własnym SMTP, ustaw `SMTP_HOST`, `SMTP_PORT`, dane logowania oraz poprawny `SMTP_FROM`; skrzynka Mailpit służy do developmentu. Bez SMTP produkcyjne operacje e-mailowe zwracają `503 MAIL_UNAVAILABLE`. W trybie development/test API dodatkowo zwraca `debugToken` i informację `delivered`.

Zmiana hasła, potwierdzona zmiana e-maila, wylogowanie ze wszystkich urządzeń i blokada konta natychmiast unieważniają sesje. Zmiana e-maila wymaga obecnego hasła i potwierdzenia nowego adresu; odłącza też poprzednie powiązanie z Google. Dla kont korzystających wyłącznie z Google zmiana hasła/adresu tym formularzem nie jest dostępna. Dezaktywacja zachowuje historię, ukrywa profil opiekuna i anuluje aktywne rezerwacje. To dezaktywacja, a nie trwałe usunięcie danych.

Administrator może blokować i przywracać konta przez `/api/admin/accounts/:accountId/state` oraz czytać `/api/admin/audit`. Operacje mają historię z aktorem, czasem i uzasadnieniem. Nie ma publicznej rejestracji administratorów. Uprawnienia nadaje operator dedykowanemu, aktywnemu kontu ze zweryfikowanym adresem:

```sh
npm --prefix backend run admin:grant -- administrator@example.com
```

## Migracje i testy

Po aktualizacji zastosuj migracje i wygeneruj klienta Prisma:

```sh
cd backend
npx prisma migrate deploy
npm run prisma:generate
```

Migracja wymaga rozszerzenia PostgreSQL `btree_gist`. Przy istniejących nakładających się dostępnościach migracja przerwie się zamiast usuwać dane. Przed wdrożeniem sprawdź kolizje:

```sql
SELECT a.id, b.id, a."sitterProfileId"
FROM "AvailabilitySlot" a JOIN "AvailabilitySlot" b
  ON a."sitterProfileId" = b."sitterProfileId" AND a.id < b.id
  AND a."startsAt" < b."endsAt" AND b."startsAt" < a."endsAt";
```

Rozwiąż znalezione konflikty terminów wraz z powiązanymi rezerwacjami przed ponowieniem migracji. Nie uruchamiaj migracji testowych na bazie używanej przez aplikację.

Testy ładują **`backend/.env.test`**, a nie deweloperski `backend/.env`. Skopiuj `.env.test.example`, ustaw osobną bazę o nazwie `test` lub kończącej się `_test`, a następnie zastosuj do niej migracje z odpowiednim `DATABASE_URL`. Strażnik blokuje testy, jeśli nazwa bazy lub `NODE_ENV` są nieprawidłowe. Pełny zestaw nadal czyści dane w bazie testowej. CI tworzy osobną bazę oraz publiczny bucket zdjęć i prywatny bucket dokumentów.

```sh
npm --prefix backend test
node tests/profile-validation.test.cjs
```

## Udostępnianie karty pupila

W szczegółach pupila wybierz „Udostępnij kartę pupila”. Nadaj opcjonalną nazwę (widoczną tylko na liście właściciela), zdecyduj o dokumentach PDF i utwórz link. Skopiuj go na tym ekranie; później lista pokazuje metadane i pozwala cofnąć dostęp, ale nie odtwarza tajnego linku. Każdy link wygasa po 7 dniach. Można mieć do 20 aktywnych linków dla jednego pupila.

Odbiorca otwiera `/shared-pet#token=…` bez konta. Widzi aktualne zdjęcie, dane podstawowe, historię chorób, alergie, szczepienia, weterynarza i notatki. Nie widzi konta właściciela i nie uzyskuje możliwości edycji. PDF-y są domyślnie wyłączone; po włączeniu obejmują wszystkie ukończone dokumenty pupila, również dodane później. Osoba posiadająca link może przekazać go dalej.

W bazie jest wyłącznie skrót SHA-256 losowego tokenu. Fragment adresu nie trafia do serwera strony; klient przesyła token do API nagłówkiem `X-Pet-Share-Token`, bez zapisywania go w localStorage. Publiczny ekran ma politykę `no-referrer` i zakaz indeksowania; odpowiedzi API nie są cache'owane. Cofnięty lub wygasły link i nieaktywne konto właściciela powodują jednakowe `404`. Otwarta karta odświeża uprawnienia co 30 sekund i po powrocie na ekran. Po wygaśnięciu usuwa wyświetlane dane. Zdjęcia korzystają z dotychczasowego storage zdjęć; udostępnienie nie zmienia polityk bucketów.

API właściciela: `GET/POST /api/pets/:petId/shares`, `DELETE /api/pets/:petId/shares/:shareId`. Publiczny odczyt: `GET /api/shared-pets/card` i `GET /api/shared-pets/documents/:documentId/download`. Pobranie PDF-u wymaga aktywnego linku z dokumentami i dokumentu należącego do tego pupila. Podpisany URL prywatnego PDF-u działa do 60 sekund, maksymalnie do końca ważności linku. Cofnięcie blokuje kolejne pobrania; wcześniej wydany URL może działać do końca swojego krótkiego terminu, a zapisanych kopii nie można usunąć z urządzenia odbiorcy.

`APP_PUBLIC_URL` musi wskazywać adres frontendu dostępny dla odbiorcy. W lokalnym środowisku adres LAN działa w tej samej sieci; po wdrożeniu ustaw publiczną domenę HTTPS, poprawny `EXPO_PUBLIC_API_URL`, `CORS_ORIGIN` i dostępny z zewnątrz endpoint storage. Zastosuj migrację `20261018150000_pet_sharing` i wygeneruj klienta Prisma.

## Powiadomienia i zadania okresowe

Backend co 60 sekund wygasza prośby, tworzy przypomnienia dokumentów, wysyła kolejkę powiadomień i sprząta stare tokeny. Interwał ustawia `MAINTENANCE_INTERVAL_SECONDS`. Nieprzypisane pliki starsze niż dobę są sprzątane co godzinę. Powiadomienie o ważności dokumentu jest tworzone raz dla danej konfiguracji daty i wyprzedzenia; zmiana tych ustawień pozwala utworzyć nowe przypomnienie.

Powiadomienia e-mail są domyślnie wyłączone; użytkownik włącza je w ustawieniach konta. Kolejka jest trwała, używa blokad czasowych i ponawia nieudane wysyłki do 8 razy z rosnącym opóźnieniem. Wysyłka ma semantykę co najmniej raz: utrata potwierdzenia od dostawcy może spowodować powtórzenie wiadomości.

Push wymaga `PUSH_ENABLED=true`, konfiguracji projektu EAS oraz poświadczeń FCM/APNs. Opcjonalny `EXPO_PUSH_ACCESS_TOKEN` włącza autoryzację do Expo Push Service. Aplikacja rejestruje token dopiero po wybraniu „Włącz push na tym telefonie” i zgodzie użytkownika. Po ponownym zalogowaniu włącz push dla nowej sesji; wylogowanie usuwa rejestrację tej sesji. Web i Expo Go nie obsługują tego przepływu. Dodanie `expo-notifications` wymaga przebudowania własnego klienta natywnego. Serwer sprawdza tickets/receipts i usuwa nieaktualne tokeny zgodnie z [dokumentacją Expo](https://docs.expo.dev/push-notifications/sending-notifications/). Treść push na ekranie blokady jest ogólna i nie zawiera danych medycznych.

## Kopie zapasowe i monitoring

Skrypty `ops/backup.sh` i `ops/restore.sh` obsługują PostgreSQL oraz oba buckety MinIO. Uruchamiaj je z katalogu projektu. Backup na czas zrzutu bazy i kopiowania plików zatrzymuje backend, a potem go uruchamia; frontend może w tym czasie zgłaszać brak połączenia. Wybierz nowy, bezwzględny katalog na każdą kopię:

```sh
ops/backup.sh /absolute/path/backups/2026-10-18
# Odtwarzanie zastępuje bazę i przywraca pliki; wymaga świadomego wskazania flagi.
ops/restore.sh /absolute/path/backups/2026-10-18 --confirm-restore
```

Dla Podmana ustaw `CONTAINER_ENGINE=podman` i zainstaluj provider Compose. Skrypty tworzą sumę kontrolną bazy i znacznik `COMPLETE`; nie odtwarzają nieukończonej kopii. Przechowuj kopie poza hostem aplikacji, z ograniczonym dostępem. Harmonogram można dodać w cron/systemd, np. raz dziennie; sprawdzaj kod zakończenia i cyklicznie ćwicz restore na osobnej instancji.

Endpoint `/metrics` jest dostępny tylko po ustawieniu `METRICS_TOKEN` (minimum 32 znaki) i z nagłówkiem Bearer. Metryki obejmują żądania HTTP, błędy i pracę zadań okresowych. Opcjonalny Prometheus i reguły alertów:

```sh
mkdir -p .secrets
# Zapisz losowy sekret w .secrets/metrics-token i ustaw tę samą wartość jako METRICS_TOKEN.
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Prometheus jest dostępny lokalnie pod http://localhost:9090. Reguły wykrywają niedostępność API, wzrost błędów 5xx, zatrzymanie zadań okresowych oraz opóźnienia i nieudane wysyłki powiadomień. Aby wysyłać alarmy poza Prometheusa, podłącz własny Alertmanager i odbiorcę; repozytorium nie zawiera danych zewnętrznych kanałów alertowania.
