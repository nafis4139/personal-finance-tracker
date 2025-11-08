// frontend/src/pages/Dashboard.tsx
//
// Financial dashboard with monthly and yearly views.
// - Monthly: KPIs (income/expense/net), category breakdown, budget vs. actual.
// - Yearly: trend bars, category breakdown, budget vs. actual.
// Charts are built with Recharts. We keep API calls small and cache minimal state.

import { useEffect, useMemo, useState } from "react";
import { apiList, apiMaybe } from "../lib/api";
import EmptyState from "../components/EmptyState";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

// Server-side monthly summary (income/expense totals).
type Summary = { month: string; income_total: number; expense_total: number };

// Minimal API models consumed on this page.
type Txn = {
  id: number;
  user_id: number;
  category_id: number | null;
  amount: number;
  type: "income" | "expense";
  date: string;
  description?: string | null;
};
type Category = { id: number; name: string; type: "income" | "expense" };
type Budget = {
  id: number;
  user_id: number;
  category_id: number | null;
  period_month: string;
  limit_amount: number;
  created_at: string;
};

// ---- Date helpers ----

function yyyyMm(d = new Date()) {
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}
function pad2(n: number) { return n.toString().padStart(2, "0"); }
function niceMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}
function monthStartEnd(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const start = `${y}-${pad2(m)}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  return { start, end };
}
function yearStartEnd(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}
function monthKey(dateISO: string) { return dateISO.slice(0, 7); }
function monthsOfYear(year: number) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`);
}

// Color palette for category slices.
const CAT_COLORS = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
  "#FF9F40", "#66BB6A", "#EC407A", "#26C6DA", "#8D6E63",
];

export default function Dashboard() {
  // View + period selection.
  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const [month, setMonth] = useState(yyyyMm());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Server-provided monthly KPI.
  const [sum, setSum] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Shared datasets for charts.
  const [txns, setTxns] = useState<Txn[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // ===== Loaders =====

  async function loadMonthly() {
    // Summary is separate so the KPI boxes are quick and resilient.
    try {
      setBusy(true);
      setErr(null);
      const s = await apiMaybe<Summary>(`/dashboard/summary?month=${month}`);
      setSum(s ?? { month, income_total: 0, expense_total: 0 });
    } catch (e: any) {
      setErr(e.message || "Failed to load");
      setSum({ month, income_total: 0, expense_total: 0 });
    } finally {
      setBusy(false);
    }

    // Charts need txns, categories and budgets for the month.
    try {
      setLoadingData(true);
      const { start, end } = monthStartEnd(month);
      const [list, cs, bs] = await Promise.all([
        apiList<Txn>(`/transactions?from=${start}&to=${end}`),
        apiList<Category>("/categories"),
        apiList<Budget>(`/budgets?month=${month}`),
      ]);
      setTxns(list); setCats(cs); setBudgets(bs);
    } catch {
      setTxns([]); setCats([]); setBudgets([]);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadYearly() {
    try {
      setLoadingData(true);
      const { start, end } = yearStartEnd(year);
      const [list] = await Promise.all([ apiList<Txn>(`/transactions?from=${start}&to=${end}&limit=5000`) ]);
      setTxns(list);

      // Budgets by month → flatten to a single array.
      const months = monthsOfYear(year);
      const perMonth = await Promise.all(months.map((m) => apiList<Budget>(`/budgets?month=${m}`)));
      setBudgets(perMonth.flat());

      const cs = await apiList<Category>("/categories");
      setCats(cs);
    } catch {
      setTxns([]); setBudgets([]);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => { if (mode === "monthly") loadMonthly(); /* eslint-disable-next-line */ }, [mode, month]);
  useEffect(() => { if (mode === "yearly") loadYearly();   /* eslint-disable-next-line */ }, [mode, year]);

  // ===== Derived values =====

  const income = sum?.income_total ?? 0;
  const expense = sum?.expense_total ?? 0;
  const net = income - expense;

  const yearlyData = useMemo(() => {
    const months = monthsOfYear(year);
    const agg: Record<string, { income: number; expense: number }> = {};
    for (const t of txns) {
      const mk = monthKey(t.date);
      if (!agg[mk]) agg[mk] = { income: 0, expense: 0 };
      if (t.type === "income") agg[mk].income += t.amount;
      else agg[mk].expense += t.amount;
    }
    return months.map((m) => ({
      key: m,
      month: new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString(undefined, { month: "short" }),
      income: +(agg[m]?.income ?? 0).toFixed(2),
      expense: +(agg[m]?.expense ?? 0).toFixed(2),
    }));
  }, [txns, year]);

  const monthlyCatTotals = useMemo(() => {
    const byCat: Record<number, { expense: number }> = {};
    for (const t of txns) {
      if (t.type !== "expense") continue;
      const id = t.category_id ?? -1; // -1 → uncategorized
      if (!byCat[id]) byCat[id] = { expense: 0 };
      byCat[id].expense += t.amount;
    }
    const rows = Object.entries(byCat).map(([cid, v]) => ({
      name: Number(cid) === -1 ? "Uncategorized" : (cats.find((c) => c.id === Number(cid))?.name || `#${cid}`),
      expense: +v.expense.toFixed(2),
    }));
    rows.sort((a, b) => b.expense - a.expense);
    return rows;
  }, [txns, cats]);

  const yearlyCatExpenses = useMemo(() => {
    const byCat = new Map<number, number>();
    for (const t of txns) {
      if (t.type !== "expense") continue;
      const id = t.category_id ?? -1;
      byCat.set(id, (byCat.get(id) ?? 0) + t.amount);
    }
    const rows = Array.from(byCat.entries()).map(([id, value]) => ({
      name: id === -1 ? "Uncategorized" : (cats.find((c) => c.id === id)?.name || `#${id}`),
      value: +value.toFixed(2),
    }));
    rows.sort((a, b) => b.value - a.value);
    return rows;
  }, [txns, cats]);

  const monthlyBudgetVsActual = useMemo(() => {
    const expenseCats = cats.filter((c) => c.type === "expense");
    const budgetByCat = new Map<number, number>();
    for (const b of budgets) {
      if (b.category_id != null) {
        budgetByCat.set(b.category_id, (budgetByCat.get(b.category_id) ?? 0) + b.limit_amount);
      }
    }
    const actualByCat = new Map<number, number>();
    for (const t of txns) {
      if (t.type === "expense" && t.category_id != null) {
        actualByCat.set(t.category_id, (actualByCat.get(t.category_id) ?? 0) + t.amount);
      }
    }
    const rows = expenseCats.map((c) => ({
      name: c.name,
      budget: +(budgetByCat.get(c.id) ?? 0).toFixed(2),
      actual: +(actualByCat.get(c.id) ?? 0).toFixed(2),
    }));
    return rows.filter((r) => r.budget > 0 || r.actual > 0).slice(0, 40);
  }, [cats, budgets, txns]);

  const yearlyBudgetVsActual = useMemo(() => {
    const expenseCats = cats.filter((c) => c.type === "expense");
    const budgetByCat = new Map<number, number>();
    for (const b of budgets) {
      if (b.category_id != null) {
        budgetByCat.set(b.category_id, (budgetByCat.get(b.category_id) ?? 0) + b.limit_amount);
      }
    }
    const actualByCat = new Map<number, number>();
    for (const t of txns) {
      if (t.type === "expense" && t.category_id != null) {
        actualByCat.set(t.category_id, (actualByCat.get(t.category_id) ?? 0) + t.amount);
      }
    }
    const rows = expenseCats.map((c) => ({
      name: c.name,
      budget: +(budgetByCat.get(c.id) ?? 0).toFixed(2),
      actual: +(actualByCat.get(c.id) ?? 0).toFixed(2),
    }));
    return rows.filter((r) => r.budget > 0 || r.actual > 0).slice(0, 40);
  }, [cats, budgets, txns]);

  const yearTotals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of txns) (t.type === "income" ? inc : (exp += t.amount));
    return { income: +inc.toFixed(2), expense: +exp.toFixed(2), net: +(inc - exp).toFixed(2) };
  }, [txns]);

  const hasMonthlyData = monthlyCatTotals.length > 0 || income > 0 || expense > 0;

  return (
    <div className="card section">
      {/* Local layout rules for the dashboard grid and panels */}
      <style>{`
        .dash-grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .dash-grid-2 { grid-template-columns: 1fr 1fr; align-items: stretch; }
          .span-2 { grid-column: 1 / -1; }
        }
        /* Extra height so legends fit comfortably; hide accidental overflow */
        .panel { height: 540px; overflow: hidden; }
      `}</style>

      <h1 className="h1">Dashboard</h1>
      <p className="muted">Quick overview of finances.</p>
      <div className="spacer" />

      {/* View switch + period controls */}
      <div className="row" style={{ gap: 8 }}>
        <div className="segmented">
          <button className={`btn ${mode === "monthly" ? "btn-primary" : ""}`} onClick={() => setMode("monthly")}>Monthly</button>
          <button className={`btn ${mode === "yearly" ? "btn-primary" : ""}`} onClick={() => setMode("yearly")}>Yearly</button>
        </div>

        {mode === "monthly" ? (
          <>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="btn" onClick={loadMonthly} disabled={busy}>Refresh</button>
          </>
        ) : (
          <>
            <input
              className="input"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))}
              style={{ width: 120 }}
            />
            <button className="btn" onClick={loadYearly} disabled={loadingData}>Refresh</button>
          </>
        )}
      </div>

      {/* Monthly error, if any */}
      {err && mode === "monthly" && (
        <>
          <div className="spacer" />
          <div className="card section" style={{ borderColor: "rgba(239,68,68,.35)" }}>{err}</div>
        </>
      )}

      <div className="spacer" />

      {mode === "monthly" ? (
        <>
          {/* KPI tiles */}
          <div className="kpi-grid">
            <div className="card section">
              <div className="h2">Income</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{income.toFixed(2)}</div>
              <div className="muted">for {month}</div>
            </div>
            <div className="card section">
              <div className="h2">Expenses</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{expense.toFixed(2)}</div>
              <div className="muted">for {month}</div>
            </div>
            <div className="card section">
              <div className="h2">{net >= 0 ? "Savings" : "Deficit"}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: net >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {net.toFixed(2)}
              </div>
              <div className="muted">{niceMonth(month)}</div>
            </div>
          </div>

          <div className="spacer" />

          {loadingData ? (
            <div className="muted">Loading charts…</div>
          ) : !hasMonthlyData ? (
            <EmptyState
              title={`No activity for ${niceMonth(month)}`}
              subtitle="Add income or expenses to visualize trends."
              action={<a href="/transactions" className="btn btn-primary">Go to Transactions</a>}
            />
          ) : (
            <>
              {/* Row 1: two pies */}
              <div className="dash-grid-2">
                <div className="card section panel">
                  <div className="h2" style={{ marginBottom: 10 }}>
                    Monthly summary — {niceMonth(month)}
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 64, left: 0 }}>
                      <Tooltip />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                      <Pie
                        data={[
                          { name: "Income", value: income },
                          { name: "Expense", value: expense },
                          { name: net >= 0 ? "Savings" : "Deficit", value: Math.abs(net) },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"   // center horizontally
                        cy="45%"   // leave space for legend below
                        outerRadius={120}
                        label
                      >
                        <Cell fill="#4CAF50" />
                        <Cell fill="#F44336" />
                        <Cell fill={net >= 0 ? "#2196F3" : "#9E9E9E"} />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card section panel">
                  <div className="h2" style={{ marginBottom: 10 }}>
                    Expenses by category — {niceMonth(month)}
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 64, left: 0 }}>
                      <Tooltip />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                      <Pie
                        data={monthlyCatTotals.filter((c) => c.expense > 0)}
                        dataKey="expense"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={120}
                        label
                      >
                        {monthlyCatTotals
                          .filter((c) => c.expense > 0)
                          .map((_, idx) => (
                            <Cell key={`exp-cell-${idx}`} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                          ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="spacer" />

              {/* Row 2: Budget vs Actual (expenses) */}
              <div className="card section panel">
                <div className="h2" style={{ marginBottom: 10 }}>
                  Budget vs Actual (expenses) — {niceMonth(month)}
                </div>
                {monthlyBudgetVsActual.length === 0 ? (
                  <div className="muted">No budgets/expenses this month.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyBudgetVsActual} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={{ fontSize: 12 }}
                        height={60}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="budget" name="Budget" fill="#90CAF9" />
                      <Bar dataKey="actual" name="Actual" fill="#EF5350" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        // ===== Yearly view =====
        <>
          {/* Annual KPI */}
          <div className="kpi-grid">
            <div className="card section">
              <div className="h2">Income</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{yearTotals.income.toFixed(2)}</div>
              <div className="muted">{year}</div>
            </div>
            <div className="card section">
              <div className="h2">Expenses</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{yearTotals.expense.toFixed(2)}</div>
              <div className="muted">{year}</div>
            </div>
            <div className="card section">
              <div className="h2">{yearTotals.net >= 0 ? "Savings" : "Deficit"}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: yearTotals.net >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {yearTotals.net.toFixed(2)}
              </div>
              <div className="muted">{year}</div>
            </div>
          </div>

          <div className="spacer" />

          {loadingData ? (
            <div className="muted">Loading charts…</div>
          ) : (
            <>
              {/* Monthly trend bars */}
              <div className="card section panel span-2">
                <div className="h2" style={{ marginBottom: 10 }}>Monthly trend — {year}</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 10, right: 24, left: 24, bottom: 10 }} barCategoryGap={16} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#4CAF50" />
                    <Bar dataKey="expense" name="Expense" fill="#F44336" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="spacer" />

              {/* Yearly category pie */}
              <div className="card section panel span-2">
                <div className="h2" style={{ marginBottom: 10 }}>Expenses by category — {year}</div>
                {yearlyCatExpenses.length === 0 ? (
                  <div className="muted">No expenses recorded this year.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 64, left: 0 }}>
                      <Tooltip />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                      <Pie
                        data={yearlyCatExpenses}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={120}
                        label
                      >
                        {yearlyCatExpenses.map((_, idx) => (
                          <Cell key={`year-exp-${idx}`} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="spacer" />

              {/* Yearly Budget vs Actual */}
              <div className="card section panel span-2">
                <div className="h2" style={{ marginBottom: 10 }}>Yearly Budget vs Actual (expenses) — {year}</div>
                {yearlyBudgetVsActual.length === 0 ? (
                  <div className="muted">No budgets/expenses this year.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyBudgetVsActual} margin={{ top: 10, right: 24, left: 24, bottom: 10 }} barCategoryGap={16} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} height={60} angle={-30} textAnchor="end" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="budget" name="Budget" fill="#90CAF9" />
                      <Bar dataKey="actual" name="Actual" fill="#EF5350" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
