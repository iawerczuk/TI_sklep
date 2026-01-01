# Shop API

Aplikacja realizująca prosty sklep internetowy z koszykiem i obsługą zamówień. Umożliwia zarządzanie produktami, dodawanie ich do koszyka oraz finalizację zamówień z zapisem danych w bazie SQLite.

## Technologia
- **Backend:** Node.js (Express)
- **Baza danych:** SQLite
- **Front-end:** HTML, CSS, JavaScript (katalog `public/`)
- **Testowanie API:** REST Client (Visual Studio Code)

## Uruchomienie aplikacji
1. `npm install`
2. `node server.js`
3. Adres: http://localhost:5050

## Zakres funkcjonalny

### Produkty
- Dodawanie produktów (nazwa, cena ≥ 0)
- Listowanie produktów
- Edycja produktu
- Usuwanie produktu

### Koszyk
- Dodawanie produktu do koszyka
- Zmiana ilości produktu (qty ≥ 1)
- Usuwanie produktu z koszyka
- Podgląd zawartości koszyka wraz z sumą

### Zamówienia
- Utworzenie zamówienia na podstawie zawartości koszyka
- Zapis zamówienia do bazy danych (orders, order_items)
- Snapshot ceny produktu w momencie zamówienia
- Automatyczne czyszczenie koszyka po checkout
- Wyświetlanie historii zamówień

## Model danych (SQLite)
- **products**(id, name, price)
- **orders**(id, created_at)
- **order_items**(id, order_id, product_id, qty, price)

*Pole `price` w tabeli `order_items` przechowuje cenę produktu z momentu złożenia zamówienia (snapshot ceny).*

## API

### Produkty
- `GET /api/products` – lista produktów
- `POST /api/products` – dodanie produktu
- `GET /api/products/:id` – szczegóły produktu
- `PATCH /api/products/:id` – edycja produktu
- `DELETE /api/products/:id` – usunięcie produktu

### Koszyk
- `GET /api/cart` – pobranie zawartości koszyka
- `POST /api/cart/add` – dodanie produktu do koszyka
- `PATCH /api/cart/item` – zmiana ilości produktu w koszyku
- `DELETE /api/cart/item/:product_id` – usunięcie produktu z koszyka

### Zamówienia
- `POST /api/checkout` – finalizacja zamówienia
- `GET /api/orders` – lista zamówień

## Walidacja i statusy HTTP
- **201 Created** – poprawne utworzenie zasobu
- **200 OK** – poprawna operacja
- **400 Bad Request** – błędne dane wejściowe
- **404 Not Found** – brak zasobu
- **409 Conflict** – konflikt stanu (np. pusty koszyk przy checkout)
- **500 Internal Server Error** – błąd serwera

## Bezpieczeństwo i HTTP
- Nagłówek `X-Content-Type-Options: nosniff`
- Nagłówek `Referrer-Policy: no-referrer`
- Nagłówek `Cache-Control: no-store` dla endpointów API
- Wyłączony nagłówek `X-Powered-By`

## Testowanie
Plik `tests.rest` zawiera przykładowe wywołania endpointów API. Testy wykonano przy użyciu rozszerzenia **REST Client** dla Visual Studio Code.
