# Śledzenie spacerów GPS

W „Moje rezerwacje” wybierz **Spacer GPS** przy usłudze `DOG_WALK`.
Ten sam ekran jest dostępny ze spacerów na stronie głównej. Opiekun rozpoczyna
zaakceptowany spacer przyciskiem **Rozpocznij spacer**, zezwala na lokalizację,
a po powrocie wybiera **Zakończ spacer** i potwierdza. Właściciel ogląda trasę
i ostatnią pozycję; nie może wysyłać współrzędnych ani zmieniać etapów spaceru.
Nowa płatna rezerwacja wymaga potwierdzenia płatności PayU przed rozpoczęciem GPS.
Starsze rezerwacje zachowują dotychczasowy tryb. Zobacz [płatności](payments.md).

## Co jest zapisywane

- Start według serwera oraz koniec z chwili zatrzymania zapisu, niezależnie od
  planowanego terminu. Serwer weryfikuje czas końca przesłany przez telefon.
- Punkty GPS z czasem pomiaru, dokładnością i identyfikatorem ponowienia.
- Dystans w metrach obliczany na serwerze, czas i przyczyna zakończenia.
- Powiadomienie właściciela o rozpoczęciu i zakończeniu; korzysta z istniejącej
  kolejki powiadomień, w tym push, jeśli został skonfigurowany.

Podgląd odpytuje API co 5 sekund przy aktywnym ekranie. Odczyt starszy niż
30 sekund jest oznaczany jako nieaktualny. Mapa OpenStreetMap pokazuje zielony
początek, pomarańczową ostatnią pozycję i zapisaną trasę. Ma powiększanie,
dopasowanie całej trasy, centrowanie ostatniej pozycji oraz link do OSM.
Podkład wymaga internetu, ale jego awaria nie zatrzymuje zapisu punktów.
`EXPO_PUBLIC_MAP_TILE_URL` pozwala zmienić adres kafelków `{z}/{x}/{y}`;
przy zmianie dostawcy należy dostosować także atrybucję w komponencie mapy.
Domyślne kafelki OSM są pobierane tylko dla widocznego fragmentu, bez prefetchu,
z atrybucją i identyfikatorem aplikacji na telefonie.
Na telefonie podkład ładuje `expo-image` z cache na dysku; przeglądarka korzysta
ze swojego cache HTTP. Natywny pasek aktywnego spaceru uwzględnia obszar
paska systemowego, aby nie nakładać tekstu na zegar i ikony telefonu.

## Telefon i przeglądarka

**Android/iOS:** `expo-location` i zadanie `expo-task-manager` mogą zapisywać
trasę w tle. Przełącznik przed rozpoczęciem wyjaśnia potrzebę odpowiedniej zgody.
Android pokazuje powiadomienie o zapisie, iOS wskaźnik używania lokalizacji.
Nowe uprawnienia i tryb background są skonfigurowane w `app.json`.
Po zmianie trzeba przebudować aplikację, np. `npm run android` w środowisku
z Android SDK. Na iOS build wymaga macOS/Xcode. Sam restart Metro nie wystarcza.
Gotowe polecenia do osobnego APK i instalacji przez USB opisuje
[instrukcja testów Androida](android-gps-test.md).
Własny build i rzeczywiste urządzenie są potrzebne do sprawdzenia pracy
przy zablokowanym ekranie; nie jest ona dostępna w Expo Go.

W Expo Go lub po odmowie zgody na tło aplikacja korzysta z lokalizacji przy
otwartej aplikacji i pokazuje ograniczenie. Trasa nie jest symulowana.
Zamknięcie aplikacji przez system/użytkownika, restrykcje oszczędzania baterii
lub brak GPS mogą przerwać pomiary. Po ponownym otwarciu zapis aktywnego
spaceru jest odzyskiwany, o ile zachowana została ta sama sesja konta.

**Web:** wymaga `localhost` lub HTTPS oraz zgody przeglądarki.
Używa bezpośrednio `navigator.geolocation.watchPosition`; adapter webowy
`expo-location` w SDK 57 miesza identyfikatory subskrypcji. Pozostaw kartę
otwartą; przy uśpieniu lub zamknięciu karty nie ma gwarancji ciągłego zapisu.
Odtwarzanie zapisanych punktów działa po ponownym wejściu na ekran.

## Brak GPS i przerwy w internecie

Odmowa lokalizacji nie cofa rozpoczęcia spaceru: status i czas zostają zapisane,
a opiekun widzi komunikat i przycisk ponownego włączenia GPS. Spacer można
zakończyć również bez trasy. Zapis przyjmuje dokładność do 100 m. Dystans
filtruje drobne ruchy w granicach błędu GPS, kumulując przesunięcie od stabilnego
punktu odniesienia również pomiędzy kolejnymi paczkami.
Przerwa powyżej 120 sekund lub skok z prędkością ponad 12 m/s rozpoczynają
oddzielny odcinek. Brakująca trasa nie jest łączona i nie zwiększa dystansu.
Wynik jest oszacowaniem z GPS, a nie pomiarem geodezyjnym.

Punkty oczekujące na wysłanie są przechowywane lokalnie w pamięci aplikacji
AsyncStorage (na webie localStorage). Kolejka ma limit 5000 punktów, a aplikacja
wysyła paczki do 100 z zachowaniem tych samych UUID przy ponowieniu. Odczyty
trwają także po wyjściu z ekranu szczegółów; widoczny pasek prowadzi do spaceru.

Potwierdzenie zakończenia zatrzymuje odczyty, najpierw wysyła kolejkę, a potem
kończy spacer na serwerze. Jeśli nie ma połączenia, punkty i czas zatrzymania
zostają zapisane lokalnie. Przy działającej aplikacji synchronizacja ponawia
się automatycznie, również po jej ponownym otwarciu. Oczekiwanie na internet
nie wydłuża czasu spaceru. Serwer odrzuca koniec wcześniejszy od startu lub
ostatniego pomiaru oraz czas przesunięty o ponad 30 sekund w przyszłość.
Odzyskiwanie aktywnego zapisu uruchamia GPS także przed odpowiedzią API
i nie otwiera ponownie okien zgód systemowych. Sama rejestracja zadania Expo
nie dowodzi, że Android nadal uruchamia usługę lokalizacji. Po pierwszym powrocie
danego procesu na pierwszy plan aplikacja ponownie przekazuje opcje zadania,
bez wyrejestrowywania go. Dzięki temu odtwarza usługę po zabiciu procesu;
kolejne odświeżenia nie uruchamiają jej ponownie.
Nową zgodę można wywołać przyciskiem; dostępny jest też link do ustawień aplikacji.
Zakończenie offline jest pokazywane jako oczekiwanie na synchronizację,
bez surowych błędów połączenia. Po synchronizacji szczegóły automatycznie
odświeżają podsumowanie, również gdy podczas ponownego otwarcia API nie działało.
Wylogowanie lub zmiana konta zatrzymuje zapis i usuwa lokalną kolejkę, aby
współrzędne poprzedniego konta nie przechodziły do następnej sesji.
Tokeny natywne pozostają w SecureStore; dostępność keychain po pierwszym
odblokowaniu telefonu pozwala wysyłać trasę przy zablokowanym ekranie.

## Zasady backendu

- Dostęp do trasy wyłącznie dla uczestników rezerwacji, przez JWT; odpowiedzi
  mają `Cache-Control: no-store`. Wyszukiwarka opiekunów nie ujawnia tras.
- Początek od 15 minut przed terminem do 2 godzin po planowanym końcu.
  Wymagana akceptacja rezerwacji i zweryfikowany e-mail opiekuna.
- Jeden aktywny spacer na opiekuna; ograniczenie egzekwuje PostgreSQL.
- Rozpoczęcie, wysyłka punktów i zakończenie obsługują ponowienia.
  Zmienione dane pod tym samym identyfikatorem punktu zwracają 409.
- Maksymalnie 20000 punktów na spacer. Zakresy współrzędnych, czas, dokładność,
  kolejność, rozmiar paczki i nieznane pola są walidowane. Błędna paczka nie
  zapisuje żadnego punktu. Limit wspólny endpointów: 120 zapytań/konto/minutę.
- Anulowanie rezerwacji i dezaktywacja/blokada konta zamykają zapis atomowo;
  dotychczasowa trasa zostaje w historii, a nowe punkty są odrzucane.
  Urządzenie zatrzymuje GPS przy następnej synchronizacji lub wysyłce.
- Zakończenie GPS ustawia rezerwację na `COMPLETED`, także przed planowanym
  końcem. Dotychczasowa reguła wystawiania opinii nadal wymaga upływu
  planowanego `endsAt`. Przy aktywnym GPS stary przycisk zmiany statusu nie
  pozwala pominąć zapisu oczekujących punktów.

## API i pliki

Wspólna ścieżka: `/api/bookings/:bookingId/walk`.

| Metoda | Ścieżka | Zastosowanie |
| --- | --- | --- |
| GET | `/` + `?after=0` | Sesja i do 500 punktów; `nextAfter` do pobierania dalszych stron |
| POST | `/start` | Rozpoczęcie lub odzyskanie istniejącej aktywnej sesji |
| POST | `/points` | `{ points: [{ clientPointId, latitude, longitude, accuracy, capturedAt }] }` |
| POST | `/finish` | Opcjonalne `{ endedAt }`; zakończenie i powiadomienie właściciela |

Kontrakty są w Swaggerze `/docs`, sekcja **Walk GPS**.
Migracja: `backend/prisma/migrations/20261110100000_walk_tracking`.
Backend: `backend/src/services/walk.service.ts`, `routes/walk.routes.ts`
i `validation/walk.schemas.ts`. Frontend: `app/walks/[id].tsx`
i `src/features/walks/{components,services,types,utils}`.

Po pobraniu zmian:

```sh
cd backend
npx prisma migrate deploy
npm run prisma:generate
cd ..
npm start
```

Wymagane są uruchomione usługi infrastruktury, zgodnie z README.

## Weryfikacja

- `backend/src/services/walk.integration.test.ts`: prawdziwa oddzielna baza,
  uprawnienia, cykl życia, powiadomienia, konkurencja, walidacja, przerwy GPS,
  dystans z filtrowaniem szumu, stronicowanie, blokada konta i anulowanie.
- `node --test tests/walk-tracking.test.cjs`: kolejka i UUID po utracie
  połączenia/reloadzie, zakończenie z oczekującymi punktami, zadanie natywne,
  brak zgody, wylogowanie, izolacja kont i keychain oraz projekcja mapy.
  Testy zadań natywnych używają atrap API systemu.
- `tests/walk-tracking-browser.cjs`: prawdziwy osobny backend na 4001 i baza
  testowa, dwa konta, emulowana geolokalizacja przeglądarki, trasa, dystans,
  zgubiona odpowiedź, ponowienie po reloadzie, zmiana ekranu, zakończenie
  i odczyt historii oraz brak dostępu obcej osoby. Zgodnie z `tests/README.md`.
- Fizyczne urządzenie Android/iOS: do ręcznego sprawdzenia blokada ekranu,
  odmowa zgód, optymalizacja baterii i rzeczywista jakość GPS w terenie.

Dokumentacja dostawców: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/),
[Expo TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/),
[zasady kafelków OSM](https://operations.osmfoundation.org/policies/tiles/).
