# Weryfikacja tożsamości opiekuna

Opiekun zapisuje profil, a następnie otwiera **Sprawdź status / przejdź
weryfikację** w swoim profilu. Ekran jest też dostępny pod
`/marketplace/verification`. Potwierdzenie adresu e-mail jest wymagane przed
wysyłką zdjęć. Dokument powinien pokazywać imię, nazwisko i fotografię;
pozostałe dane można zasłonić. Drugie zdjęcie przedstawia twarz opiekuna.

Administrator loguje się zwykłym formularzem konta z rolą `ADMIN` i trafia na
`/admin/sitter-verifications`. Wybiera zgłoszenie, otwiera dwa prywatne zdjęcia,
potwierdza sprawdzenie dokumentu i zgodność twarzy, a następnie zapisuje decyzję
z uzasadnieniem. To **ręczna weryfikacja**, bez automatycznego KYC ani sprawdzania
żywotności zdjęcia. Konto administratora nadaje operator zgodnie z README;
publiczna rejestracja nie nadaje tej roli.

## Status i dostęp do usług

- `UNVERIFIED`: profil i grafik można edytować; oferta nie jest publikowana.
- `PENDING`: zdjęcia wysłano, trwa oczekiwanie na decyzję. Nie można ich podmienić.
- `REJECTED`: opiekun widzi uzasadnienie i może przesłać nową parę zdjęć.
- `VERIFIED`: aktywna oferta może pojawić się w wyszukiwarce, a opiekun może
  przyjmować rezerwacje i rozpoczynać nowe spacery GPS.

Backend sprawdza status również przy bezpośrednim tworzeniu rezerwacji,
akceptacji zlecenia i rozpoczynaniu GPS. Bez zatwierdzenia zwraca
`SITTER_NOT_VERIFIED`. Publiczny grafik, publiczne opinie i otwieranie rozmowy
przez profil również wymagają zatwierdzonej tożsamości. Historia istniejących
rezerwacji i rozmów pozostaje dostępna ich uczestnikom.

Zmiana imienia i nazwiska lub potwierdzona zmiana e-maila unieważnia zgłoszenie
albo zatwierdzenie. Zmiana opisu, ceny, miejscowości i zdjęcia profilowego nie
resetuje tożsamości. Administrator zatwierdza konkretną wersję danych;
równoległe decyzje i nieaktualne formularze zwracają 409.

Migracja **nie zatwierdza automatycznie istniejących opiekunów**. Ich profile
otrzymują `UNVERIFIED`. Nie anuluje istniejących rezerwacji i nie przerywa już
rozpoczętej sesji GPS: można zachować trasę oraz zakończyć taki spacer.
Akceptacja nowego zlecenia i rozpoczęcie kolejnego spaceru wymagają weryfikacji.

## Prywatne zdjęcia

Pliki używają osobnego, prywatnego `S3_DOCUMENT_BUCKET`, pod prefiksem
`sitter-verification/`. W lokalnym Compose bucket ten ma wyłączony dostęp
anonimowy. Na wdrożeniu trzeba zachować tę konfigurację; nie używać publicznego
bucketu zdjęć profili. Maksymalny rozmiar to 10 MB; akceptowane są JPEG, PNG
i WebP. Aplikacja przygotowuje JPEG bez automatycznego kadrowania dokumentu.

Wysyłka trafia najpierw pod tymczasowy klucz. Potwierdzenie sprawdza rozmiar,
typ, sygnaturę pliku i ETag, a serwer zapisuje sprawdzone bajty pod innym kluczem.
Pozostały ważny link PUT nie pozwala zmienić zdjęć przekazanych do oceny.

Właściciel pliku i administrator obsługujący aktualne zgłoszenie mogą otrzymać
link GET ważny 60 sekund. Żądania odczytu są audytowane, API ma `no-store`.
Publiczne wyniki nie zawierają zdjęć dokumentów, ich kluczy ani uzasadnień.
Zmiana sesji oraz wyjście z ekranu usuwa prywatne podglądy z interfejsu.

Szkice wygasają po 24 godzinach. Zgłoszenie oczekuje maksymalnie 30 dni;
po tym czasie wraca do `UNVERIFIED`. Po decyzji zdjęcia wygasają od razu,
a proces maintenance usuwa obiekty przy najbliższym udanym przebiegu.
Przy niedostępnym storage usuwanie jest ponawiane. Audyt decyzji pozostaje.
Osierocone obiekty bez rekordu w bazie usuwa istniejący mechanizm porządkowania.
Kopie zapasowe mają osobną retencję ustawianą przez operatora.

## API i uruchomienie

Swagger: `/docs`, grupa **Sitter verification**.

| Metoda | Endpoint | Działanie |
| --- | --- | --- |
| GET / POST | `/api/sitters/me/verification` | Status / zgłoszenie pary zdjęć |
| POST | `/api/sitters/me/verification/files` | Link do wysyłki szkicu |
| POST | `/api/sitters/me/verification/files/:fileId/complete` | Sprawdzenie i utrwalenie zdjęcia |
| GET / DELETE | `/api/sitters/me/verification/files/:fileId` | Prywatny odczyt / usunięcie szkicu |
| GET | `/api/admin/sitters` | Kolejka, filtr statusu i paginacja |
| GET / POST | `/api/admin/sitters/:accountId/verification` | Szczegóły / decyzja administratora |
| GET | `/api/admin/sitters/:accountId/verification/files/:fileId` | Prywatny podgląd aktualnego zgłoszenia |

```sh
cd backend
npx prisma migrate deploy
npm run prisma:generate
cd ..
npm start
```

Migracja: `20261111090000_sitter_verification`. Testy backendu:
`backend/src/services/sitter-verification.integration.test.ts`. Scenariusze
wysyłki i usuwania wymagają własnego testowego MinIO i prywatnego bucketu
z `test` w nazwie; bez konfiguracji storage są pomijane. Zawsze używać oddzielnej
bazy testowej. Test interfejsu: `tests/sitter-verification-browser.cjs` zgodnie
z [instrukcją testów](../tests/README.md).
