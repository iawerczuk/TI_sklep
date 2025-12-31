const API = window.API_BASE || window.location.origin;

const qs = (s, el = document) => el.querySelector(s);
const json = (r) =>
  r.ok
    ? r.json()
    : r.text().then((t) => Promise.reject({ status: r.status, text: t }));

const prodForm = qs("#product-form");
const prodMsg = qs("#prod-msg");
const productsTbody = qs("#products tbody");

const cartTbody = qs("#cart tbody");
const cartTotal = qs("#cart-total");
const checkoutBtn = qs("#checkout");
const checkoutMsg = qs("#checkout-msg");

const ordersDiv = qs("#orders");

async function loadProducts() {
  const data = await fetch(`${API}/api/products`).then(json);
  productsTbody.innerHTML = "";

  for (const p of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${Number(p.price).toFixed(2)} zł</td>
      <td><button data-id="${p.id}" class="add" type="button">Dodaj do koszyka</button></td>
    `;

    tr.querySelector("button.add").addEventListener("click", async () => {
      try {
        await fetch(`${API}/api/cart/add`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ product_id: p.id, qty: 1 }),
        }).then(json);

        checkoutMsg.textContent = "";
        await loadCart();
      } catch (err) {
        checkoutMsg.textContent = `Nie udało się dodać (${err.status}): ${err.text || ""}`;
      }
    });

    productsTbody.appendChild(tr);
  }
}

async function loadCart() {
  const data = await fetch(`${API}/api/cart`).then(json);
  cartTbody.innerHTML = "";

  for (const it of data.items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td><input type="number" min="1" value="${it.qty}" style="width:70px"></td>
      <td>${Number(it.unit_price).toFixed(2)} zł</td>
      <td>${Number(it.subtotal).toFixed(2)} zł</td>
      <td><button class="del" aria-label="Usuń" type="button">×</button></td>
    `;

    const qtyInput = tr.querySelector("input");
    const delBtn = tr.querySelector("button.del");

    qtyInput.addEventListener("change", async () => {
      const q = Math.max(1, Math.floor(+qtyInput.value || 1));
      qtyInput.value = q;

      try {
        await fetch(`${API}/api/cart/item`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ product_id: it.product_id, qty: q }),
        }).then(json);

        checkoutMsg.textContent = "";
        await loadCart();
      } catch (err) {
        checkoutMsg.textContent = `Nie udało się zmienić (${err.status}): ${err.text || ""}`;
      }
    });

    delBtn.addEventListener("click", async () => {
      try {
        await fetch(`${API}/api/cart/item/${it.product_id}`, {
          method: "DELETE",
        }).then(json);

        checkoutMsg.textContent = "";
        await loadCart();
      } catch (err) {
        checkoutMsg.textContent = `Nie udało się usunąć (${err.status}): ${err.text || ""}`;
      }
    });

    cartTbody.appendChild(tr);
  }

  cartTotal.textContent = Number(data.total).toFixed(2) + " zł";
}

async function loadOrders() {
  const data = await fetch(`${API}/api/orders`).then(json);
  ordersDiv.innerHTML = "";

  if (data.length === 0) {
    ordersDiv.textContent = "Brak zamówień.";
    return;
  }

  for (const o of data) {
    const box = document.createElement("div");
    box.className = "order";

    const items = o.items
      .map(
        (i) =>
          `• ${i.name} × ${i.qty} @ ${Number(i.price).toFixed(2)} = ${Number(
            i.subtotal
          ).toFixed(2)} zł`
      )
      .join("<br>");

    box.innerHTML = `
      <div><b>Zamówienie #${o.id}</b> <small>${o.created_at}</small></div>
      <div class="items">${items}</div>
      <div class="sum">Suma: <b>${Number(o.total).toFixed(2)} zł</b></div>
    `;

    ordersDiv.appendChild(box);
  }
}

prodForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(prodForm);
  const body = Object.fromEntries(fd.entries());

  const name = String(body.name || "").trim();
  const price = Number(body.price);

  if (!name) {
    prodMsg.textContent = "Podaj nazwę produktu.";
    return;
  }
  if (!Number.isFinite(price) || price < 0) {
    prodMsg.textContent = "Cena musi być liczbą >= 0.";
    return;
  }

  try {
    await fetch(`${API}/api/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, price }),
    }).then(json);

    prodMsg.textContent = "Dodano produkt";
    setTimeout(() => (prodMsg.textContent = ""), 2000);

    prodForm.reset();
    if (prodForm.elements.price) prodForm.elements.price.value = 9.99;

    await loadProducts();
  } catch (err) {
    prodMsg.textContent = `Błąd (${err.status}): ${err.text || ""}`;
  }
});

checkoutBtn.addEventListener("click", async () => {
  checkoutMsg.textContent = "";

  try {
    const r = await fetch(`${API}/api/checkout`, { method: "POST" });

    if (r.status === 201) {
      const { order_id, total } = await r.json();
      checkoutMsg.textContent = `Zamówienie #${order_id} złożone, suma: ${Number(
        total
      ).toFixed(2)} zł`;
      await Promise.all([loadCart(), loadOrders()]);
      return;
    }

    const t = await r.text();
    checkoutMsg.textContent =
      r.status === 409 ? "Koszyk pusty." : `Błąd (${r.status}) ${t || ""}`;
  } catch {
    checkoutMsg.textContent = "Błąd połączenia z API. Sprawdź czy serwer działa.";
  }
});

(async function init() {
  try {
    await loadProducts();
    await loadCart();
    await loadOrders();
  } catch {
    checkoutMsg.textContent = "Nie mogę połączyć się z API. Uruchom server.js i odśwież stronę.";
  }
})();