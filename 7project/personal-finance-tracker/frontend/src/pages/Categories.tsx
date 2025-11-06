// frontend/src/pages/Categories.tsx

// Categories management page:
// - Lists categories and allows creation/deletion.
// - Simple in-memory filtering (all | income | expense).
// - Uses shared API helper with uniform error handling.

import { useEffect, useMemo, useState } from "react";
import { api, apiList } from "../lib/api";

type Category = {
  id: number;
  user_id: number;
  name: string;
  type: "income" | "expense";
  created_at: string;
};

type Filter = "all" | "income" | "expense";

export default function Categories() {
  // Data set returned from the backend.
  const [items, setItems] = useState<Category[]>([]);
  // Create form state.
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  // UI state for errors and in-flight requests.
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false); // avoid blank page on slow/empty loads

  // Current filter selection.
  const [filter, setFilter] = useState<Filter>("all");

  // Initial load of categories.
  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      // Use apiList so 204/404/empty gracefully becomes []
      const data = await apiList<Category>("/categories");
      setItems(data);
    } catch (e: any) {
      setMsg(e.message || "Failed to load categories");
      setItems([]); // keep UI stable
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Create a category; prepend result on success.
  async function createCat() {
    if (!name.trim()) return;
    try {
      setBusy(true);
      setMsg(null);
      const c = await api<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name, type }),
      });
      setItems([c, ...items]);
      setName("");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Delete a category by id and remove it locally.
  async function del(id: number) {
    try {
      setBusy(true);
      setMsg(null);
      await api(`/categories/${id}`, { method: "DELETE" });
      setItems(items.filter((i) => i.id !== id));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Derived view: apply filter to the full list.
  const visible = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((c) => c.type === filter);
  }, [items, filter]);

  // Badge styling: green for income, red for expense (badge only).
  function badgeStyle(t: "income" | "expense"): React.CSSProperties {
    if (t === "income") {
      return {
        color: "#4CAF50",
        background: "rgba(76, 175, 80, 0.12)",
        border: "1px solid rgba(76, 175, 80, 0.35)",
      };
    }
    return {
      color: "#F44336",
      background: "rgba(244, 67, 54, 0.12)",
      border: "1px solid rgba(244, 67, 54, 0.35)",
    };
  }

  return (
    <div className="card section">
      <h1 className="h1">Categories</h1>
      <p className="muted">
        Create, view and remove categories used to label transactions.
      </p>

      <div className="spacer" />

      {/* Create form */}
      <div className="row">
        <input
          className="input"
          placeholder="e.g. Groceries"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="select"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="expense">expense</option>
          <option value="income">income</option>
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={createCat}>
          Add
        </button>
      </div>

      <div className="spacer" />

      {/* Filter control */}
      <div className="row" style={{ gap: 8 }}>
        <div className="segmented">
          <button
            className={`btn ${filter === "all" ? "btn-primary" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`btn ${filter === "income" ? "btn-primary" : ""}`}
            onClick={() => setFilter("income")}
          >
            income
          </button>
          <button
            className={`btn ${filter === "expense" ? "btn-primary" : ""}`}
            onClick={() => setFilter("expense")}
          >
            expense
          </button>
        </div>
        <span className="muted" style={{ marginLeft: 8 }}>
          {visible.length} shown / {items.length} total
        </span>
      </div>

      {/* Inline error message */}
      {msg && <div className="spacer" />}
      {msg && (
        <div
          className="card section"
          style={{ borderColor: "rgba(239,68,68,.4)" }}
        >
          {msg}
        </div>
      )}

      <div className="spacer" />

      {/* Loading, list or empty message */}
      {loading ? (
        <div className="muted">Loading…</div>
      ) : (
        <ul className="list">
          {visible.map((c) => (
            <li key={c.id} className="list-item">
              <div>
                <div className="h2" style={{ fontSize: 18, marginBottom: 4 }}>
                  {c.name}
                </div>
                <span className="badge" style={badgeStyle(c.type)}>
                  {c.type}
                </span>
              </div>
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() => del(c.id)}
              >
                Delete
              </button>
            </li>
          ))}

          {/* When no categories, show a friendly message instead of a blank page */}
          {visible.length === 0 && (
            <li className="muted">No Categories Yet!</li>
          )}
        </ul>
      )}
    </div>
  );
}
