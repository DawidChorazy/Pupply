# GPS na telefonie z Androidem

## Odbiór backendu 19 listopada 2026 r.

Na telefonie A024 z Androidem 16 wykonano pięciominutowy spacer testowy
z rzeczywistymi odczytami GPS. Wariant USB aplikacji korzystał z osobnej
bazy i zaakceptowanej rezerwacji za 0 zł.

| Próba | Wynik po stronie API |
| --- | --- |
| Zapis przy zablokowanym ekranie | Przez 29 sekund liczba odebranych punktów wzrosła z 22 do 28. |
| Utrata połączenia z testowym API | Przez 29 sekund licznik pozostał na 28. Po przywróceniu połączenia właściciel odczytał sześć punktów z czasem pomiaru przypadającym na przerwę. |
| Zakończenie z telefonu | Rezerwacja przeszła do `COMPLETED`. API właściciela zwróciło 62 punkty o 62 różnych identyfikatorach i kolejnych numerach od 1 do 62. Usługa lokalizacji na telefonie się zatrzymała. |

Po próbie usunięto tymczasową bazę z trasą i przywrócono poprzedni testowy APK.
Dokładność dystansu na dłuższej trasie pozostaje do osobnego pomiaru.
