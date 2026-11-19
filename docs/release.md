# Odbiór lokalnego MVP backendu

19 listopada 2026 r. sprawdziliśmy bezpłatną rezerwację spaceru na osobnej
bazie PostgreSQL. Na pustej bazie przeszło 20 migracji. Zestaw 158 testów
backendu zakończył się powodzeniem.

Osobna próba przez HTTP objęła rejestrację i weryfikację kont linkami z poczty
SMTP w Mailpit, zatwierdzenie opiekuna, przesłanie dokumentu do prywatnego
MinIO, rezerwację za 0 zł, spacer GPS i reset hasła. Powtórne wysłanie żądania
rezerwacji oraz tej samej paczki punktów zachowało pojedynczą rezerwację
i pojedynczy zapis każdego punktu.

Próba na Androidzie 16 potwierdziła zapis przy zablokowanym ekranie i dosłanie
punktów po odzyskaniu połączenia. [Wynik testu na telefonie](android-gps-test.md)

### Powtórzenie testów backendu

Testy uruchamia się z katalogu głównego projektu. Wymagają Node.js 22 i działającego Dockera lub Podmana.

```sh
npm --prefix backend ci
npm run test:backend
npm run test:backend -- --smoke
```

Obie próby używają tymczasowych kontenerów. Zakres odbioru obejmuje lokalne
MVP z ofertą za 0 zł. Odbiór płatnej oferty wymaga osobnej próby opłacenia
rezerwacji, odbioru webhooka i potwierdzenia zwrotu przez PayU. [Płatności](payments.md)
