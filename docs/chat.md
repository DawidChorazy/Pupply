# Czat właściciel–opiekun

Czat zapisuje wiadomości w PostgreSQL. Jedna rozmowa jest wspólna dla danej pary
kont, niezależnie od liczby rezerwacji. Można napisać do aktywnego opiekuna bez
rezerwacji, a także otworzyć rozmowę z dowolnej własnej rezerwacji, w tym oczekującej.
Z wyszukiwarki służy do tego „Napisz do opiekuna”, z rezerwacji — „Czat”.
Ikona wiadomości na ekranie głównym otwiera „Moje rozmowy” i pokazuje liczbę
nieprzeczytanych wiadomości, bez uwzględniania własnych wysyłek.

## API

Wszystkie endpointy wymagają JWT konta `USER`. Odczyt, zapis i oznaczanie jako
przeczytane są dostępne tylko uczestnikom. Osoby trzecie otrzymują `404`.
Kliniki i administratorzy nie uzyskują dostępu do prywatnych rozmów tym API.
Wysyłanie i rozpoczęcie rozmowy wymagają aktywnych kont obu uczestników oraz
potwierdzonych adresów e-mail. Zablokowanie/dezaktywacja konta blokuje dalsze
wysyłki; drugi uczestnik zachowuje dostęp do swojej historii.

| Metoda | Endpoint | Zastosowanie |
| --- | --- | --- |
| POST | `/api/conversations` | `{sitterProfileId}` albo `{bookingId}`; utworzenie lub odtworzenie rozmowy |
| GET | `/api/conversations` | Własne rozmowy, `limit` 1–50 i opcjonalny `cursor` |
| GET | `/api/conversations/unread-count` | Liczba przychodzących nieprzeczytanych wiadomości |
| GET | `/api/conversations/:id` | Rozmówca, dostępność wysyłania, ostatnia wiadomość i licznik |
| GET | `/api/conversations/:id/messages` | Historia, `limit` 1–100, opcjonalnie `before` albo `after` |
| POST | `/api/conversations/:id/messages` | `{clientMessageId, text}`; identyfikator UUID i tekst do 4000 znaków |
| PATCH | `/api/conversations/:id/read` | `{throughSequence}`; oznaczenie wyświetlonych wiadomości jako przeczytanych |

Pełne kontrakty są w Swaggerze w sekcji **Chat**. Domyślnie historia zwraca
ostatnie 50 wiadomości. Elementy zawsze mają kolejność rosnącą według `sequence`.
`before` pobiera starsze, a `after` — najwcześniejsze nowsze wiadomości. Wartość
`hasMore` dotyczy wybranego kierunku. `nextBefore` służy do starszych stron,
`nextAfter` do kolejnych nowych wiadomości. Nie należy łączyć `before` i `after`.

Wysyłający pochodzi wyłącznie z sesji. Tekst jest przycinany z białych znaków na
brzegach. Wiadomość, numer sekwencji i powiadomienie zapisują się atomowo.
Ponowienie tego samego UUID przez tego samego nadawcę w tej samej rozmowie zwraca
pierwotną wiadomość. Użycie go z inną treścią zwraca `409 MESSAGE_KEY_REUSED`.
Przy utracie odpowiedzi interfejs oferuje ponowienie z tym samym UUID; odczyt
historii również rozpoznaje już zapisane wiadomości. Niewysłane szkice i próby
wysyłki są przechowywane tylko w pamięci ekranu. Po przeładowaniu pozostają
wiadomości zatwierdzone przez serwer.

Odczyt wymaga numeru ostatniej wyświetlonej wiadomości, a nie globalnego „teraz”.
Znacznik może się tylko przesuwać do przodu i nie obejmuje wiadomości, które
nadeszły później. Odczyt nie zmienia kolejności rozmów. Limity na minutę i konto:
300 operacji łącznie, 30 prób wysłania i 10 prób rozpoczęcia/otwarcia rozmowy.

## Odświeżanie i powiadomienia

Otwarta rozmowa i lista rozmów odświeżają się co 4 sekundy, a licznik na ekranie
głównym co 5 sekund. Odświeżanie zatrzymuje się po opuszczeniu ekranu, ukryciu karty,
przejściu aplikacji w tło i zmianie sesji. Ponowna aktywacja odświeża dane.
Żądania czatu mają limit 15 sekund. Wyniki starej sesji nie są dopisywane do nowej.
Podczas przeglądania starszej historii nowe wiadomości pozostają nieprzeczytane;
przycisk „Nowe wiadomości” przenosi do końca rozmowy.
Web wysyła Enterem, Shift+Enter dodaje nowy wiersz; telefon korzysta z przycisku.

Nowa wiadomość tworzy powiadomienie `NEW_MESSAGE` dla odbiorcy. Dzwonek i lista
powiadomień prowadzą bezpośrednio do właściwej rozmowy. Treść wiadomości nie trafia
do e-maila ani na ekran blokady — powiadomienia zawierają ogólny komunikat.
Odczyt rozmowy oznacza odpowiadające wiadomościom powiadomienia jako przeczytane.
Kolejka pomija już przeczytane powiadomienia, jeśli nie zostały jeszcze wysłane.

Push korzysta z istniejącego Expo Push Service: wymagane są `PUSH_ENABLED=true`,
własny build mobilny, projekt EAS i poświadczenia FCM/APNs oraz zgoda użytkownika.
Dotknięcie push otwiera rozmowę tylko na koncie odbiorcy wskazanym w danych push.
Web i Expo Go korzystają z powiadomień wewnątrz aplikacji. E-mail jest wysyłany
zgodnie z istniejącą zgodą `emailNotifications` i konfiguracją SMTP.
Nie dodano WebSocketów, załączników ani statusów pisania.

## Uruchomienie i testy

Przed uruchomieniem backendu zastosuj migrację `20261105140000_chat` oraz wygeneruj
klienta Prisma (`npx prisma migrate deploy` i `npm run prisma:generate` w `backend`).
Migracja dodaje tabele rozmów i wiadomości oraz pola powiadomień, zachowując dane.

`backend/src/services/chat.integration.test.ts` sprawdza uprawnienia, kontakt
przed rezerwacją, wspólną historię rezerwacji, równoczesne wysyłki i ponowienia,
walidację, limity, paginację, odczyty, nieaktywne konta i prywatne powiadomienia.

`tests/chat-browser.cjs` sprawdza prawdziwy przepływ dwóch kont, odświeżenie strony,
nieprzeczytane, odtworzenie wysyłki po utracie odpowiedzi, historię i dostęp osoby
trzeciej. Wymaga Expo na 8081, osobnej bazy kończącej się `_test`, wszystkich
migracji, zbudowanego backendu i osobnego API testowego na **4001**. Nie uruchamiaj
tego API na bazie deweloperskiej. Skrypt przekierowuje żądania wyłącznie swoich
kontekstów przeglądarki do testowego API; nie zmienia `.env.local` aplikacji.
Uruchom z `NODE_ENV=test`, testowym `DATABASE_URL` i konfiguracją JWT, po
zainstalowaniu Playwright w katalogu tymczasowym zgodnie z `tests/README.md`:

```sh
NODE_PATH=/tmp/pupply-browser/node_modules node tests/chat-browser.cjs
```

Opcjonalne zmienne: `PUPPLY_WEB_URL`, `PUPPLY_CHAT_TEST_API_URL` (port musi wynosić
4001) i `PUPPLY_CHROMIUM_EXECUTABLE`. Zrzut mobilny: `/tmp/pupply-chat-mobile.png`.
