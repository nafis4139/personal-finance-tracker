// frontend/src/pages/Transactions.tsx

// Transactions page:
// - Lists transactions for a selected month with optional category filter.
// - Supports creation and deletion of transactions.
// - Uses shared API helpers for consistent error handling and JSON parsing.

import { useEffect, useMemo, useState } from "react";
import { api, apiList } from "../lib/api";
import EmptyState from "../components/EmptyState";

type Category = { id:number; name:string; type:"income"|"expense" };
type Txn = {
  id:number; user_id:number; category_id:number|null;
  amount:number; type:"income"|"expense"; date:string; description:string|null;
};

// Date helpers for month boundaries and labels.
function firstDayOfMonth(yyyyMm:string){ return `${yyyyMm}-01`; }
function lastDayOfMonth(yyyyMm:string){
  const [y,m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0,10);
}
function yyyyMm(d=new Date()){
  const m=(d.getMonth()+1).toString().padStart(2,"0");
  return `${d.getFullYear()}-${m}`;
}
function niceMonth(yyyyMm:string){
  const [y,m] = yyyyMm.split("-").map(Number);
  return new Date(y, m-1, 1).toLocaleString(undefined, { month:"long", year:"numeric" });
}

export default function Transactions(){
  // Cached categories and currently loaded transactions.
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Txn[]>([]);
  // Month filter and category filter state.
  const [month, setMonth] = useState(yyyyMm());
  const [filterCat, setFilterCat] = useState<number | "all">("all");

  // Creation form state.
  const [fType, setFType] = useState<"income"|"expense">("expense");
  const [fAmount, setFAmount] = useState<string>("");
  const [fDate, setFDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [fCat, setFCat] = useState<number | "none">("none");
  const [fDesc, setFDesc] = useState<string>("");

  // UI state for progress and error messages.
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load categories once (used for filters and the add form).
  async function loadCats(){
    try {
      const cs = await apiList<Category>("/categories");
      setCats(cs);
    } catch (e:any) {
      setMsg(e.message);
    }
  }

  // Load transactions for the selected month.
  async function loadTxns(){
    try{
      setLoading(true); setMsg(null);
      const from = firstDayOfMonth(month);
      const to = lastDayOfMonth(month);
      const list = await apiList<Txn>(`/transactions?from=${from}&to=${to}`);
      setItems(list);
    }catch(e:any){
      // Reset list on error to keep the UI consistent.
      setMsg(e.message);
      setItems([]);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ loadCats(); }, []);
  useEffect(()=>{ loadTxns(); }, [month]);

  // Categories available in the "Add transaction" form should match the chosen type.
  const addableCats = useMemo(
    () => cats.filter(c => c.type === fType),
    [cats, fType]
  );

  // If current selected category becomes incompatible with the chosen type, reset it.
  useEffect(() => {
    if (typeof fCat === "number") {
      const match = cats.find(c => c.id === fCat);
      if (!match || match.type !== fType) {
        setFCat("none");
      }
    }
  }, [fType, cats]); // Re-evaluate when type changes or categories are fetched.

  // Apply the category filter to the loaded transactions.
  const filtered = useMemo(()=>{
    if(filterCat==="all") return items;
    return items.filter(t=>t.category_id===filterCat);
  },[items, filterCat]);

  // Create a transaction and prepend it when it falls within the current month.
  async function createTxn(){
    if(!fAmount) return;
    try{
      setBusy(true); setMsg(null);
      const payload:any = {
        amount: Number(fAmount),
        type: fType,
        date: fDate,
        description: fDesc || null,
      };
      if(fCat!=="none") payload.category_id = fCat;

      const t = await api<Txn>("/transactions", { method:"POST", body: JSON.stringify(payload) });

      // Insert into current view if date matches the active month filter.
      const d = t.date.slice(0,10);
      if (d >= firstDayOfMonth(month) && d <= lastDayOfMonth(month)) {
        setItems([t, ...items]);
      }
      // Reset form fields except type and date for quicker entry.
      setFAmount(""); setFDesc("");
    }catch(e:any){
      setMsg(e.message);
    } finally{
      setBusy(false);
    }
  }

  // Delete a transaction by id and remove it from local state.
  async function removeTxn(id:number){
    try{
      setBusy(true); setMsg(null);
      await api(`/transactions/${id}`, { method:"DELETE" });
      setItems(items.filter(i=>i.id!==id));
    }catch(e:any){
      setMsg(e.message);
    } finally{
      setBusy(false);
    }
  }

  // Aggregate totals for quick KPI cards.
  const totalInc = filtered.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0);
  const totalExp = filtered.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0);

  // --- NEW: badge style same as Categories page (green for income, red for expense).
  function typeBadgeStyle(t: "income" | "expense"): React.CSSProperties {
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

  // Helper to resolve a category name for a transaction (falls back to "Uncategorized").
  function categoryNameFor(t: Txn): string {
    if (t.category_id == null) return "Uncategorized";
    return cats.find(c => c.id === t.category_id)?.name ?? `#${t.category_id}`;
  }

  return (
    <div className="card section">
      <h1 className="h1">Transactions</h1>
      <p className="muted">Add transactions and filter by month & category.</p>

      <div className="spacer" />

      {/* Month and category filters */}
      <div className="row">
        <input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)} />
        <select className="select" value={filterCat} onChange={e=>setFilterCat(e.target.value==="all" ? "all" : Number(e.target.value))}>
          <option value="all">All categories</option>
          {cats.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="spacer" />

      {/* Creation form */}
      <div className="card section">
        <div className="h2" style={{marginBottom:10}}>Add transaction</div>
        <div className="row">
          <select
            className="select"
            value={fType}
            onChange={e=>setFType(e.target.value as "income"|"expense")}
            aria-label="Transaction type"
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>

          <input className="input" placeholder="Amount" inputMode="decimal" value={fAmount} onChange={e=>setFAmount(e.target.value)} />
          <input className="input" type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />

          <select
            className="select"
            value={fCat}
            onChange={e=>setFCat(e.target.value==="none" ? "none" : Number(e.target.value))}
            aria-label="Category"
          >
            <option value="none">No category</option>

            {/* Only categories that match the selected transaction type */}
            {addableCats.length === 0 ? (
              <option disabled>— no {fType} categories —</option>
            ) : (
              addableCats.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>

          <input className="input w-100" placeholder="Description (optional)" value={fDesc} onChange={e=>setFDesc(e.target.value)} />
          <button className="btn btn-primary" onClick={createTxn} disabled={busy}>Add</button>
        </div>
      </div>

      {/* Inline error banner */}
      {msg && (<><div className="spacer" /><div className="card section" style={{borderColor:"rgba(239,68,68,.35)"}}>{msg}</div></>)}

      <div className="spacer" />

      {/* KPI tiles: income, expense, and net for the filtered set */}
      <div className="row" style={{gap:16, flexWrap:"wrap"}}>
        <div className="card section" style={{minWidth:220, flex:"1"}}>
          <div className="muted">Total income</div>
          <div style={{fontSize:24, fontWeight:800}}>{totalInc.toFixed(2)}</div>
        </div>
        <div className="card section" style={{minWidth:220, flex:"1"}}>
          <div className="muted">Total expense</div>
          <div style={{fontSize:24, fontWeight:800}}>{totalExp.toFixed(2)}</div>
        </div>
        <div className="card section" style={{minWidth:220, flex:"1"}}>
          <div className="muted">Net</div>
          <div style={{fontSize:24, fontWeight:800, color:(totalInc-totalExp)>=0?"var(--accent)":"var(--danger)"}}>
            {(totalInc-totalExp).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="spacer" />

      {/* Conditional content: loading, empty state, or the list */}
      {loading ? (
        <div className="muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No transactions for ${niceMonth(month)}`}
          subtitle={
            filterCat === "all"
              ? "Try another month or add the first transaction."
              : "Try another category or add a transaction."
          }
          action={
            <button className="btn btn-primary" onClick={()=>document.querySelector<HTMLInputElement>('input[placeholder="Amount"]')?.focus()}>
              Add Transaction
            </button>
          }
        />
      ) : (
        <ul className="list">
          {filtered.map(t=>(
            <li key={t.id} className="list-item">
              <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
                {/* Colored income/expense label (same palette as Categories) */}
                <span className="badge" style={typeBadgeStyle(t.type)}>{t.type}</span>

                {/* Category name right after the label */}
                <span className="badge">{categoryNameFor(t)}</span>

                <div style={{fontWeight:700}}>{t.amount.toFixed(2)}</div>
                <div className="muted">{t.date.slice(0,10)}</div>
                {t.description && <div className="muted">• {t.description}</div>}
              </div>
              <button className="btn btn-danger" onClick={()=>removeTxn(t.id)} disabled={busy}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
