# Shop API

Aplikacja sklepu internetowego z koszykiem i obsługą zamówień (Node.js + SQLite).

## Uruchomienie
1. `npm install`
2. `node server.js`
3. Adres: http://localhost:5050

## Funkcje
- **Produkty:** dodawanie, listowanie, edycja, usuwanie.
- **Koszyk:** dodawanie, zmiana ilości, podgląd sumy, usuwanie.
- **Zamówienia:** finalizacja (checkout), snapshot ceny, historia zamówień.

## API
- `GET/POST/PATCH/DELETE /api/products` - zarządzanie produktami.
- `GET/POST/PATCH/DELETE /api/cart` - obsługa koszyka.
- `POST /api/checkout` - finalizacja zamówienia.
- `GET /api/orders` - historia zamówień.

## Statusy HTTP
- **201/200** - sukces.
- **400/404/409** - błędy danych, brak zasobu lub pusty koszyk.

## Bezpieczeństwo
Nagłówki: `nosniff`, `no-referrer`, `no-store` (API), brak `X-Powered-By`.

## Testowanie
Wykonano w **REST Client (VS Code)**. Przykłady w pliku `tests.rest`.
