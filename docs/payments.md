# Płatności PayU

Pierwsza wersja korzysta z **PayU GPO Europe REST API 2.1 i hosted checkout**.
Właściciel wybiera metodę na stronie PayU; aplikacja nie zbiera numerów kart,
CVV ani kodów BLIK. Dostępność poszczególnych metod zależy od konfiguracji POS.

## Przepływ w aplikacji

1. Właściciel wysyła prośbę o rezerwację. Backend ustala i zapisuje cenę w groszach.
2. Opiekun akceptuje. Rezerwacja dostaje termin płatności: domyślnie 30 minut od
   akceptacji, maksymalnie do planowanego rozpoczęcia usługi.
3. W „Moje rezerwacje” właściciel wybiera **Zapłać przez PayU**, a potem
   **Przejdź do PayU**. Opiekun nie otrzymuje adresu checkoutu.
4. Po powrocie aplikacja sprawdza status na backendzie. Sam parametr powrotu
   ani komunikat przeglądarki nie oznacza zapłaty. Potwierdza ją podpisany webhook
   lub autoryzowany odczyt zamówienia z API PayU.
5. Dopiero `COMPLETED` pozwala rozpocząć GPS i zakończyć usługę. Przy POS z ręcznym
   odbiorem `WAITING_FOR_CONFIRMATION` jest pobierane przed rozpoczęciem usługi.
6. Po zakończeniu usługi zapisujemy rozliczenie brutto opiekuna. Jest to zapis
   w bazie, a nie przelew bankowy. Historia jest dostępna w **Płatności i rozliczenia**.

`ACCEPTED` oznacza zgodę opiekuna. Przy braku zapłaty UI pokazuje osobno
oczekiwanie na płatność. Nieopłacona rezerwacja wygasa po `paymentDueAt`,
zwalniając termin. Spóźniona wpłata zleca pełny zwrot, bez przywracania rezerwacji.

Każda nowa rezerwacja z dodatnią ceną wymaga płatności, również kiedy checkout
jest wyłączony lub nieskonfigurowany: wyłączenie PayU nie omija blokady rozpoczęcia.
Usługi za 0 zł są zwolnione. Migracja zachowuje dotychczasowe rezerwacje jako
`paymentRequired=false`, aby nie pobierać opłaty za wcześniejsze zlecenia.

Na telefonie checkout otwiera się w przeglądarce systemowej. Po płatności
należy zamknąć okno PayU i wrócić do aplikacji; status zostanie sprawdzony.
Automatyczny powrót przez natywny deep link nie jest częścią tej wersji.

## Anulowanie i zwroty

- Anulowanie opłaconej rezerwacji przez właściciela **co najmniej 24 godziny**
  przed terminem: pełny zwrot.
- Anulowanie przez właściciela **mniej niż 24 godziny** przed terminem:
  zatrzymanie 50% jako opłaty, reszta wraca przez PayU. Połowa nieparzystej kwoty
  jest zaokrąglana w górę do grosza dla opłaty, np. 30,01 zł → 15,01 zł opłaty
  i 15,00 zł zwrotu. UI pokazuje kwoty przed potwierdzeniem.
- Anulowanie przez opiekuna albo blokada/dezaktywacja uczestnika: pełny zwrot.
- Anulowanie przed potwierdzeniem wpłaty nie nalicza opłaty. Jeśli płatność
  dopłynie później, zostanie zwrócona w całości.

API podaje wycenę anulowania. Przy opłacie backend wymaga potwierdzenia dokładnej
kwoty `expectedCancellationFeeCents`; jej zmiana wymaga ponownego potwierdzenia.
Anulowanie i zapis zlecenia zwrotu odbywają się w tej samej transakcji DB.
Wywołanie PayU wykonuje osobny proces z ponawianiem.

Zwrot ma stany `REQUESTED`, `PENDING`, `FINALIZED`, `CANCELED`. **Zlecenie zwrotu
nie oznacza jego wykonania.** UI pokazuje „Zwrócono” dopiero po `FINALIZED`.
Odmowa zwrotu, np. niewystarczające saldo sklepu PayU, wymaga obsługi sprzedawcy;
historia nie podaje wtedy sukcesu. Zwroty należy inicjować przez anulowanie
w aplikacji; osobne ręczne zwroty z panelu PayU nie mają jeszcze pełnego importu
i uzgadniania w tym modelu.

## Rozliczenie i granice tej wersji

`PaymentSettlement` zapisuje kwotę brutto za wykonaną usługę lub zatrzymaną
opłatę za anulowanie. Nie reprezentuje wypłaty ani portfela środków do wypłacenia.
Kwoty z sandboxa są prezentowane oddzielnie od rzeczywistych rozliczeń.
Nie naliczamy dodatkowej prowizji platformy; opłaty operatora nie są tu obliczane.

**Automatyczne wypłaty do wielu opiekunów**, onboarding i weryfikacja sprzedawców,
podział środków oraz rachunki bankowe wymagają osobnej integracji **PayU Marketplace**
i konfiguracji/umowy po stronie PayU. Standardowy POS przyjmuje środki na saldo
sklepu i nie realizuje tych operacji samoczynnie. Dodatkowa rekompensata 50%
na saldo właściciela po anulowaniu przez opiekuna także pozostaje do osobnego
wdrożenia; obecnie właściciel otrzymuje pełny zwrot swojej wpłaty.

## Konfiguracja

Ustawienia są wyłącznie na backendzie, w `backend/.env`. Szablon jest w
`backend/.env.example`. Klucze nigdy nie powinny mieć prefiksu `EXPO_PUBLIC_`.

```dotenv
PAYU_ENABLED=true
PAYU_ENVIRONMENT=sandbox
PAYU_POS_ID=<POS z panelu PayU>
PAYU_CLIENT_ID=<ten sam POS>
PAYU_CLIENT_SECRET=<klucz OAuth>
PAYU_SECOND_KEY=<drugi klucz do podpisów powiadomień>
PAYU_NOTIFY_URL=https://publiczny-adres-api/api/payments/payu/notify
PAYU_CONTINUE_URL=https://adres-aplikacji/marketplace/payment
PAYMENT_TIMEOUT_MINUTES=30
```

Do demonstracji lokalnej skonfigurowano **publiczny testowy POS 300746**,
udostępniony w oficjalnej dokumentacji PayU. Jest współdzielony i jego klucze
są publiczne: służy wyłącznie do sandboxa. Własny sandbox daje izolację,
konfigurację metod, panel i pełniejsze testy zwrotów.

Webhook wymaga adresu dostępnego z serwerów PayU. `localhost` i adres LAN
nie są publicznie dostępne. Lokalny sandbox może mimo tego odczytywać potwierdzenie
przez `POST /payments/:id/sync` i proces okresowy. Do pełnego sprawdzenia webhooków
potrzebny jest publiczny HTTPS. Adres powrotu należy ustawić na rzeczywisty adres
webowej aplikacji. Lokalny `localhost:8081` działa na tym samym komputerze;
na telefonie trzeba wrócić z okna płatności do aplikacji.

Tryb produkcyjny wymaga własnego POS, kluczy i publicznych adresów HTTPS.
Backend odrzuca znane publiczne testowe POS w trybie `production`. Nie zmieniaj
POS/środowiska wdrożenia, kiedy obsługuje ono niezakończone płatności lub zwroty:
muszą być dalej uzgadniane z właściwymi danymi sprzedawcy.
Compose przekazuje ustawienia `PAYU_*` i `PAYMENT_TIMEOUT_MINUTES` ze środowiska
lub lokalnego pliku `.env` Compose. Pliki z rzeczywistymi kluczami pozostają poza gitem.

Po pobraniu zmian:

```sh
cd backend
npx prisma migrate deploy
npm run prisma:generate
cd ..
npm start
```

Migracja: `20261110120000_payu_payments`. Po zmianie konfiguracji zrestartuj backend.

## Bezpieczeństwo i niezawodność

- Kwota, właściciel i waluta pochodzą z rezerwacji, nie z żądania checkoutu.
- OAuth `client_credentials` jest buforowane tylko na serwerze. HTTP nie podąża
  automatycznie za 302; do aplikacji wraca sprawdzony adres checkoutu PayU.
- Webhook jest wpięty przed parserem JSON. Sprawdzamy MD5 dokładnych bajtów
  dokumentu z drugim kluczem, a podpis porównujemy stałoczasowo.
- Następnie sprawdzamy POS, środowisko, kwotę, PLN, zewnętrzny identyfikator
  płatności i zapisany `orderId`. Obce zamówienia z tego samego POS są ignorowane.
- `COMPLETED` nie jest cofane przez starsze powiadomienia. Duplikaty nie tworzą
  kolejnych powiadomień, zwrotów ani rozliczeń.
- Próba płatności powstaje w bazie przed kontaktem z PayU. Ponowienia zachowują
  `extOrderId`. Zwroty zachowują `extRefundId` i przed ponowieniem sprawdzają
  listę zwrotów u operatora. Nie trzymamy transakcji DB podczas żądań HTTP.
- Proces okresowy działa niezależnie od maili/push, co 15 sekund, z dzierżawą
  zadania i narastającymi odstępami po błędach. Błędy operatora nie ujawniają
  sekretów ani danych kupującego w API.
- Gdy operator utworzy zamówienie, ale odpowiedź z jego ID zostanie utracona,
  aplikacja zachowuje próbę zamiast ryzykować drugie obciążenie. Webhook może
  odzyskać ID. W razie potrzeby administrator odczytuje `orderId` z panelu PayU
  i używa audytowanego endpointu `/api/admin/payments/:paymentId/recover`.
  Backend weryfikuje zamówienie w PayU. Nieopłacone odzyskane zamówienie bez
  użytecznego linku jest anulowane przed dopuszczeniem następnej próby.
- Gdy mimo to dotrą dwie płatności, tylko jedna jest przypisana jako właściwa;
  drugą zapisujemy i zlecamy jej pełny zwrot.

## Pliki i API

Backend: `services/payu.client.ts`, `payment.service.ts`, `payment-state.service.ts`,
`routes/payment.routes.ts`. Modele: `Payment`, `PaymentRefund`, `PaymentSettlement`
oraz pola rezerwacji w `prisma/schema.prisma`.
Frontend: `app/marketplace/payment.tsx`, `payments.tsx`, `src/features/payments`.

| Metoda | Endpoint | Zastosowanie |
| --- | --- | --- |
| POST | `/api/bookings/:bookingId/payment` | Utworzenie/odzyskanie checkoutu właściciela |
| GET | `/api/bookings/:bookingId/cancellation-quote` | Opłata i zwrot przed potwierdzeniem anulowania |
| GET | `/api/payments?perspective=owner\|sitter&page=1` | Prywatna historia, 30 pozycji na stronę |
| GET | `/api/payments/:paymentId` | Status i podsumowanie płatności |
| POST | `/api/payments/:paymentId/sync` | Sprawdzenie bezpośrednio w PayU |
| POST | `/api/payments/payu/notify` | Podpisane powiadomienie operatora |
| POST | `/api/admin/payments/:paymentId/recover` | Odzyskanie nieznanego wyniku tworzenia przez administratora |

Kontrakty są w Swaggerze `/docs`, sekcja **Payments**.

## Sprawdzenie

Testy bazodanowe `backend/src/services/payment.integration.test.ts` korzystają
z osobnej, chronionej bazy i atrap operatora. Obejmują cykl rezerwacji, uprawnienia,
cenę, podpisy, konkurencję, spóźnione/zdublowane wpłaty, blokadę GPS, wygasanie,
potwierdzenie opłaty, zwroty z ponawianiem i lokalne rozliczenie.
`payu.client.test.ts` sprawdza kontrakt HTTP, OAuth, 302, dozwolone hosty,
podpis surowego dokumentu i formaty odpowiedzi. Zasady uruchamiania: `tests/README.md`.

`tests/payments-browser.cjs` sprawdza UI na atrapach HTTP, bez zmieniania kont
użytkowników: checkout i powrót bez zapłaty, utratę odpowiedzi, ponowienie,
historię, potwierdzanie opłaty, rozdzielenie kwot testowych i status zwrotu.
Osobno sprawdzono z prawdziwym sandboxem PayU utworzenie, odczyt `NEW`
i anulowanie nieopłaconego zamówienia, także przez API aplikacji na osobnej bazie:
ponowne otwarcie zwróciło tę samą płatność, a anulowanie doprowadziło do `CANCELED`.
Nie jest to test rzeczywistego obciążenia,
zwrotu bankowego, wypłaty ani odbioru webhooka przez publiczny HTTPS.

Źródła: [PayU API](https://developers.payu.com/europe/api/),
[cykl płatności i podpisy](https://developers.payu.com/europe/docs/payment-flows/lifecycle/),
[zamówienia](https://developers.payu.com/europe/docs/payment-flows/auth-and-order/),
[zwroty](https://developers.payu.com/europe/docs/payment-flows/refunds/),
[sandbox](https://developers.payu.com/europe/docs/testing/sandbox/),
[Marketplace](https://developers.payu.com/europe/docs/services/marketplace/integration/).
