const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

const db = new Database("shop.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0)
);

CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK(qty > 0),
  price REAL NOT NULL CHECK(price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
`);

if (db.prepare("SELECT COUNT(*) c FROM products").get().c === 0) {
  const seed = db.prepare("INSERT INTO products(name,price) VALUES(?,?)");
  seed.run("Herbata zielona 100g", 19.9);
}

const cart = new Map();

app.get("/api/products", (req, res) => {
  const rows = db.prepare("SELECT id,name,price FROM products ORDER BY name").all();
  res.json(rows);
});

app.post("/api/products", (req, res) => {
  const { name, price } = req.body || {};
  const trimmed = typeof name === "string" ? name.trim() : "";
  const p = Number(price);

  if (!trimmed || !Number.isFinite(p) || p < 0) return jsonError(res, 400, "Invalid name/price");

  const info = db.prepare("INSERT INTO products(name,price) VALUES(?,?)").run(trimmed, p);
  const created = db.prepare("SELECT id,name,price FROM products WHERE id=?").get(info.lastInsertRowid);

  res.location(`/api/products/${created.id}`).status(201).json(created);
});

app.get("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return jsonError(res, 400, "Invalid id");

  const p = db.prepare("SELECT id,name,price FROM products WHERE id=?").get(id);
  if (!p) return jsonError(res, 404, "Not found");

  res.json(p);
});

app.patch("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return jsonError(res, 400, "Invalid id");

  const existing = db.prepare("SELECT id,name,price FROM products WHERE id=?").get(id);
  if (!existing) return jsonError(res, 404, "Not found");

  const { name, price } = req.body || {};
  const newName = name === undefined ? existing.name : String(name).trim();
  const newPrice = price === undefined ? existing.price : Number(price);

  if (!newName || !Number.isFinite(newPrice) || newPrice < 0) return jsonError(res, 400, "Invalid data");

  db.prepare("UPDATE products SET name=?, price=? WHERE id=?").run(newName, newPrice, id);
  const updated = db.prepare("SELECT id,name,price FROM products WHERE id=?").get(id);

  res.json(updated);
});

app.delete("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return jsonError(res, 400, "Invalid id");

  const info = db.prepare("DELETE FROM products WHERE id=?").run(id);
  if (info.changes === 0) return jsonError(res, 404, "Not found");

  res.status(204).end();
});

const readCart = () => {
  const items = [];
  for (const [product_id, qty] of cart.entries()) {
    const p = db.prepare("SELECT id,name,price FROM products WHERE id=?").get(product_id);
    if (p) {
      const subtotal = +(p.price * qty).toFixed(2);
      items.push({
        product_id,
        name: p.name,
        unit_price: p.price,
        qty,
        subtotal,
      });
    }
  }
  const total = +items.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
  return { items, total };
};

app.get("/api/cart", (req, res) => {
  res.json(readCart());
});

app.post("/api/cart/add", (req, res) => {
  const { product_id, qty } = req.body || {};
  const pid = Number(product_id);
  const q = Math.floor(Number(qty));

  if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(q) || q < 1) {
    return jsonError(res, 400, "Invalid product/qty");
  }

  const exists = db.prepare("SELECT id FROM products WHERE id=?").get(pid);
  if (!exists) return jsonError(res, 404, "Product not found");

  cart.set(pid, (cart.get(pid) || 0) + q);
  res.status(201).json(readCart());
});

app.patch("/api/cart/item", (req, res) => {
  const { product_id, qty } = req.body || {};
  const pid = Number(product_id);
  const q = Math.floor(Number(qty));

  if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(q) || q < 1) {
    return jsonError(res, 400, "Invalid product/qty");
  }

  if (!cart.has(pid)) return jsonError(res, 404, "Item not in cart");
  cart.set(pid, q);
  res.json(readCart());
});

app.delete("/api/cart/item/:product_id", (req, res) => {
  const pid = Number(req.params.product_id);
  if (!Number.isFinite(pid) || pid <= 0) return jsonError(res, 400, "Invalid product_id");

  if (!cart.has(pid)) return jsonError(res, 404, "Item not in cart");
  cart.delete(pid);

  res.json(readCart());
});

const checkoutTx = db.transaction(() => {
  const snapshot = readCart();

  if (snapshot.items.length === 0) {
    return { status: 409, body: { error: "Cart empty" } };
  }

  const created_at = new Date().toISOString();
  const info = db.prepare("INSERT INTO orders(created_at) VALUES(?)").run(created_at);
  const order_id = info.lastInsertRowid;

  const insItem = db.prepare(
    "INSERT INTO order_items(order_id,product_id,qty,price) VALUES(?,?,?,?)"
  );

  for (const it of snapshot.items) {
    insItem.run(order_id, it.product_id, it.qty, it.unit_price);
  }

  cart.clear();

  return { status: 201, body: { order_id, total: snapshot.total } };
});

app.post("/api/checkout", (req, res) => {
  try {
    const result = checkoutTx();
    res.status(result.status).json(result.body);
  } catch (e) {
    console.error(e);
    jsonError(res, 500, "Internal server error");
  }
});

app.get("/api/orders", (req, res) => {
  const orders = db.prepare("SELECT id,created_at FROM orders ORDER BY id DESC").all();

  const itemsStmt = db.prepare(`
    SELECT
      oi.id,
      oi.product_id,
      p.name,
      oi.qty,
      oi.price,
      (oi.qty * oi.price) AS subtotal
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `);

  for (const o of orders) {
    o.items = itemsStmt.all(o.id);
    o.total = +o.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
  }

  res.json(orders);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT) || 5050;
app.listen(port, () => console.log(`🛒 Shop API on http://localhost:${port}`));