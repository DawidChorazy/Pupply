# Struktura frontendu

## Gdzie szukać kodu

`app/` zawiera pełny kod ekranów i layouty Expo Router. Każdy ekran definiuje swój lokalny `StyleSheet.create` na dole tego samego pliku. Nazwy plików tras są pisane małymi literami, a nazwy z kilku słów rozdzielamy myślnikiem.

```text
app/
  _layout.tsx
  index.tsx                 # logowanie
  register.tsx
  reset-password.tsx
  verify-email.tsx
  home.tsx
  account/
    profile.tsx
    settings.tsx
  pets/
    add.tsx
    [id].tsx
    sharing.tsx
  walks/
    [id].tsx
  marketplace/
    sitters.tsx
    sitter-profile.tsx
    book.tsx
    bookings.tsx
    chat.tsx
  gamification/
    leaderboard.tsx
    quests.tsx
  notifications.tsx
  shared-pet.tsx
```

`src/features/` zawiera komponenty, hooki, konteksty, usługi, typy, stałe i narzędzia wykorzystywane przez ekrany. Nie przechowujemy tu drugich plików z implementacją ekranów.

| Funkcja | Katalog | Zawartość |
| --- | --- | --- |
| Logowanie i rejestracja | `src/features/auth` | Hooki formularzy, walidacja, konfiguracja Google, API i typy |
| Ustawienia konta | `src/features/account` | API ustawień konta |
| Strona główna | `src/features/home` | Nagłówek i kafelki akcji |
| Zwierzęta | `src/features/pets` | Dodawanie, edycja, karta pupila, zdrowie, zdjęcia i dokumenty |
| Udostępnianie | `src/features/pet-sharing` | Zarządzanie linkami i publiczna karta pupila |
| Spacery | `src/features/walks` | Lista, szczegóły, postęp i podgląd mapy |
| Opieka i rezerwacje | `src/features/marketplace` | Opiekunowie, dostępność, lokalizacja, rezerwacje i czat |
| Profil użytkownika | `src/features/profile` | Walidacja formularza |
| Powiadomienia | `src/features/notifications` | Lista, licznik i obsługa push |
| Grywalizacja | `src/features/gamification` | Zadania, ranking i stan postępów |

Główne logowanie jest w `app/index.tsx`, rejestracja w `app/register.tsx`, a strona główna w `app/home.tsx`. W aplikacji nie ma drugiego ekranu logowania, przykładowych tras Expo ani aliasów tych samych ekranów.

Adresy ekranów odpowiadają nowej strukturze, np. `/account/profile`, `/pets/add`, `/gamification/quests`. Linki w nawigacji i scenariusze testów korzystają z tych adresów. Publiczny adres `/shared-pet` oraz adresy weryfikacji e-maila i resetu hasła pozostają takie same.

## Układ jednej funkcji

```text
src/features/pets/
  components/    # elementy UI związane ze zwierzętami
  hooks/         # usePetForm, usePetsList
  context/       # PetsContext i provider
  services/      # API i lokalny zapis danych tej funkcji
  types/         # modele, żądania i odpowiedzi
  constants/     # rasy, alergie
  utils/         # operacje na datach dokumentów
```

Pełne ekrany tej funkcji są w `app/pets/add.tsx`, `app/pets/[id].tsx` i `app/pets/sharing.tsx`. Tworzymy tylko katalogi, które są potrzebne. Nazwy plików komponentów odpowiadają nazwom komponentów, np. `PetPreview.tsx`. Pliki narzędziowe i usługowe mają nazwy opisujące ich zadanie.

## Style

- Każdy widok ma własne `const styles = StyleSheet.create({ ... })` na dole swojego pliku.
- Arkusz zawiera style używane przez ten widok. Nie eksportujemy `styles` i nie importujemy stylów innego komponentu.
- Zmiana stylu jednego ekranu nie zmienia definicji stylów pozostałych ekranów.
- Wspólne kolory i wartości motywu można pobierać z `src/shared/theme/theme.ts`.
- Wartości zależne od danych, np. wyliczony rozmiar, kolor z propsów lub animacja, mogą pozostać przy użyciu stylu i być łączone z `styles` w tablicy.
- Komponent wielokrotnego użytku, np. przycisk, definiuje własny wygląd. Ekran określa jego położenie w swoim układzie.
- Layouty, przekierowania i komponenty bez własnych stałych stylów nie potrzebują pustego arkusza.

## Elementy wspólne i importy

`src/shared/ui` zawiera ogólne komponenty, `shared/navigation` — dolne menu, `shared/session` — tokeny i zdarzenia sesji, a `shared/api` — klienta HTTP, konfigurację endpointów i uploady wykorzystywane przez różne funkcje. Hooki motywu i ogólne narzędzia są w `shared/hooks` i `shared/utils`.

Alias `@/` wskazuje na `src/`, np. `@/features/pets/hooks/usePetForm`. Alias `@/assets/` wskazuje na katalog zasobów w głównym katalogu projektu.

Dodając ekran:

1. Utwórz plik bezpośrednio w odpowiednim katalogu `app/` i umieść w nim pełny kod ekranu.
2. Dodaj lokalny `StyleSheet.create` na dole tego samego pliku.
3. Komponenty, usługi i typy specyficzne dla tej funkcji trzymaj w jej katalogu. Do `shared` trafiają elementy wykorzystywane w różnych funkcjach.

Backend ma osobną strukturę w `backend/`; nie korzysta z aliasów frontendu.
