# Oceny spacerowiczów

Właściciel wystawia ocenę w „Moje rezerwacje” po spacerze DOG_WALK oznaczonym
jako COMPLETED i po upływie jego godziny zakończenia. Konto musi być aktywne
i mieć potwierdzony e-mail. Spacerowicz i osoby spoza rezerwacji nie mogą go ocenić.

Trzy wymagane kryteria to punktualność, kontakt i jakość spaceru: liczby całkowite
od 1 do 5. Komentarz jest opcjonalny, publiczny, przycinany z białych znaków
i ograniczony do 2000 znaków. Jeden spacer ma jedną nieedytowalną ocenę.

## API

- `POST /api/bookings/:bookingId/review`: JWT właściciela; JSON
  `{ "punctuality": 5, "communication": 4, "quality": 3, "comment": "Dobry kontakt" }`.
  Zwraca 201 `{ review }`. Identyczne ponowienie zwraca tę samą ocenę;
  próba zmiany opublikowanej oceny zwraca 409 `REVIEW_ALREADY_EXISTS`.
  Limit: 10 prób na konto na minutę. Transakcja i unikalny bookingId zabezpieczają
  przed równoległymi duplikatami.
- `GET /api/sitters/:profileId/reviews`: publiczna lista, `limit` 1–50 (domyślnie 20),
  `cursor` z poprzedniego `nextCursor`. Zwraca `sitter`, `summary`, `items`,
  `nextCursor`. Kolejność: data i ID malejąco. Limit: 60 zapytań na IP na minutę.
- `GET /api/sitters?...&minRating=4`: filtr minimalnej średniej stosowany przed
  paginacją. Zachowuje sortowanie po odległości. Opiekunowie bez ocen odpadają
  tylko po ustawieniu tego filtra.

Średnia ogólna jest liczona ze wszystkich trzech kryteriów wszystkich ocen,
z zaokrągleniem do dwóch miejsc. Brak opinii oznacza średnie `null`, nie zero.
Liczba zakończonych spacerów jest niezależna od liczby opinii.

Autor opinii jest pokazywany jako imię i inicjał nazwiska. Konto nieaktywne
lub zablokowane jest anonimowe. Lista publiczna nie zawiera identyfikatorów
konta autora, rezerwacji, danych pupila ani adresów e-mail. Wstrzymana oferta
zachowuje opinie; profil zablokowanego, nieaktywnego lub niezweryfikowanego
opiekuna jest niedostępny. Usunięcie konta lub rezerwacji usuwa powiązane oceny.

Migracja: `20261105160000_sitter_reviews`. Schematy i endpointy są w Swaggerze
pod `/docs` i `/openapi.json`. Testy backendu:
`backend/src/services/review.integration.test.ts`; uruchamiać wyłącznie na
oddzielnej bazie testowej zgodnie z [tests/README.md](../tests/README.md).
