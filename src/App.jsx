import { useState, useCallback, useRef } from "react";

const DEFAULT_WATCHLIST = ["ADANIPOWER", "ABCCAPITAL", "ASHOKLEY", "BLINVEST"];

const FIELDS = [
  { key: "CLOSE_PRICE", label: "LTP", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "AVG_PRICE", label: "VWAP", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "PREV_CLOSE", label: "Prev Close", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "OPEN_PRICE", label: "Open", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "HIGH_PRICE", label: "High", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "LOW_PRICE", label: "Low", format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "TTL_TRD_QNTY", label: "Total Volume", format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_QTY", label: "Delivery Vol", format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_PER", label: "Delivery %", format: (v) => v != null ? `${Number(v).toFixed(2)}%` : "—" },
  { key: "NO_OF_TRADES", label: "Trades", format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "TURNOVER_LACS", label: "Turnover (L)", format: (v) => v != null ? `₹${Number(v).toFixed(2)}L` : "—" },
];

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i]; });
    return obj;
  });
}

function computeSignals(row) {
  const deliv = parseFloat(row.DELIV_PER);
  const close = parseFloat(row.CLOSE_PRICE);
  const prev = parseFloat(row.PREV_CLOSE);
  const high = parseFloat(row.HIGH_PRICE);
  const signals = [];
  if (deliv >= 50) signals.push({ label: "High Delivery", color: "#22c55e", bg: "#052e16" });
  if (close > prev * 1.02) signals.push({ label: "Volume Spike", color: "#facc15", bg: "#1c1917" });
  if (close >= high * 0.99) signals.push({ label: "Breakout", color: "#f97316", bg: "#1c0a00" });
  return signals;
}

function pctChange(row) {
  const close = parseFloat(row.CLOSE_PRICE);
  const prev = parseFloat(row.PREV_CLOSE);
  if (!prev) return null;
  return ((close - prev) / prev) * 100;
}

function getNseUrl() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `https://archives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
}

export default function App() {
  const [data, setData] = useState(null);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [date, setDate] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [newStock, setNewStock] = useState("");
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState(null);
  const fileRef = useRef();

  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(e.target.result);
      const map = {};
      rows.forEach((r) => { if (r.SYMBOL) map[r.SYMBOL.trim()] = r; });
      setData(map);
      const sample = Object.values(map)[0];
      if (sample?.DATE1) setDate(sample.DATE1);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const addStock = () => {
    const s = newStock.trim().toUpperCase();
    if (s && !watchlist.includes(s)) setWatchlist([...watchlist, s]);
    setNewStock("");
  };

  const removeStock = (sym) => setWatchlist(watchlist.filter((s) => s !== sym));
  const filtered = watchlist.filter((s) => s.includes(search.toUpperCase()));
  const found = data ? filtered.filter((s) => data[s]).length : 0;
  const notFound = data ? filtered.filter((s) => !data[s]).length : 0;
  const highDelivery = data ? filtered.filter((s) => data[s] && parseFloat(data[s].DELIV_PER) >= 50).length : 0;
  const nseUrl = getNseUrl();

  const S = {
    app: { minHeight: "100vh", background: "#09090b", color: "#e4e4e7", fontFamily: "'DM Mono','Fira Mono','Courier New',monospace" },
    header: { borderBottom: "1px solid #27272a", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#09090b", position: "sticky", top: 0, zIndex: 10 },
    title: { fontSize: 17, fontWeight: 700, letterSpacing: "0.08em", color: "#fafafa", textTransform: "uppercase" },
    dot: { width: 9, height: 9, borderRadius: "50%", background: data ? "#22c55e" : "#3f3f46", boxShadow: data ? "0 0 8px #22c55e" : "none", animation: "pulse 2s infinite", marginRight: 10 },
    badge: { fontSize: 11, background: "#18181b", border: "1px solid #3f3f46", padding: "3px 10px", borderRadius: 4, color: "#a1a1aa" },
    body: { padding: "28px 32px", maxWidth: 1400, margin: "0 auto" },
    btn: { background: "#22c55e", color: "#052e16", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", letterSpacing: "0.04em" },
    btnSm: { background: "transparent", border: "1px solid #3f3f46", color: "#71717a", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
    input: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6, padding: "8px 14px", color: "#e4e4e7", fontSize: 13, outline: "none", fontFamily: "inherit", flex: 1, minWidth: 140 },
    row: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
    tableWrap: { overflowX: "auto", borderRadius: 8, border: "1px solid #27272a" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { padding: "10px 14px", textAlign: "left", background: "#111113", color: "#52525b", fontWeight: 600, letterSpacing: "0.06em", fontSize: 11, borderBottom: "1px solid #27272a", whiteSpace: "nowrap", textTransform: "uppercase" },
    td: { padding: "11px 14px", borderBottom: "1px solid #18181b", whiteSpace: "nowrap", verticalAlign: "middle", color: "#fff" },
    signal: (bg, color) => ({ display: "inline-block", background: bg, color, border: `1px solid ${color}33`, borderRadius: 4, fontSize: 10, padding: "2px 7px", marginRight: 4, fontWeight: 600 }),
    notFound: { color: "#3f3f46", fontStyle: "italic" },
    pct: (v) => ({ color: v >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }),
    summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 },
    card: { background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: "14px 18px" },
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        tr:hover td { background: #111113 !important; }
        input:focus { border-color: #22c55e !important; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={S.dot} />
          <span style={S.title}>NSE Bhav Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {date && <span style={S.badge}>📅 {date}</span>}
          {fileName && <span style={S.badge}>📂 {fileName}</span>}
          <span style={S.badge}>{watchlist.length} stocks</span>
        </div>
      </div>

      <div style={S.body}>

        {/* Download + Drop — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>

          {/* Step 1 — Download */}
          <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Step 1 — Download</div>
            <a
              href={nseUrl}
              target="_blank"
              rel="noreferrer"
              style={{ ...S.btn, textDecoration: "none", fontSize: 15, padding: "12px 24px", display: "inline-block", textAlign: "center" }}
            >
              ⬇ Download NSE CSV
            </a>
            <div style={{ color: "#3f3f46", fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
              {nseUrl.split("/").pop()}
            </div>
          </div>

          {/* Step 2 — Drop */}
          <div
            style={{
              border: `2px dashed ${dragging ? "#22c55e" : data ? "#22c55e55" : "#3f3f46"}`,
              borderRadius: 8, padding: "28px 24px", textAlign: "center",
              cursor: "pointer", background: dragging ? "#052e16" : data ? "#041a0e" : "#0a0a0c",
              transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current.click()}
          >
            <div style={{ fontSize: 32 }}>{data ? "✅" : "📂"}</div>
            {data
              ? <div style={{ color: "#22c55e", fontSize: 13 }}>{fileName} loaded<br /><span style={{ color: "#3f3f46", fontSize: 11 }}>Drop new file to refresh</span></div>
              : <>
                  <div style={{ color: "#71717a", fontSize: 14 }}>Step 2 — Drop CSV here</div>
                  <div style={{ color: "#3f3f46", fontSize: 12 }}>or click to browse</div>
                </>
            }
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => processFile(e.target.files[0])} />
          </div>
        </div>

        {/* Summary */}
        {data && (
          <div style={S.summaryGrid}>
            <div style={S.card}><div style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase" }}>Watching</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#fafafa" }}>{watchlist.length}</div></div>
            <div style={S.card}><div style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase" }}>Found</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#22c55e" }}>{found}</div></div>
            <div style={S.card}><div style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase" }}>Not in CSV</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#ef4444" }}>{notFound}</div></div>
            <div style={S.card}><div style={{ fontSize: 11, color: "#52525b", textTransform: "uppercase" }}>High Delivery</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#22c55e" }}>{highDelivery}</div></div>
          </div>
        )}

        {/* Controls */}
        <div style={S.row}>
          <input style={S.input} placeholder="🔍 Filter watchlist..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <input style={S.input} placeholder="Add symbol (e.g. INFY)" value={newStock} onChange={(e) => setNewStock(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && addStock()} />
          <button style={S.btn} onClick={addStock}>+ Add</button>
        </div>

        {/* Table */}
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Symbol</th>
                <th style={S.th}>Chg%</th>
                {FIELDS.map((f) => <th key={f.key} style={S.th}>{f.label}</th>)}
                <th style={S.th}>Signals</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={FIELDS.length + 4} style={{ ...S.td, textAlign: "center", color: "#3f3f46", padding: 48 }}>
                  ⬆ Download CSV and drop it above to see your stock data
                </td></tr>
              ) : filtered.map((sym) => {
                const row = data[sym];
                const pct = row ? pctChange(row) : null;
                const signals = row ? computeSignals(row) : [];
                return (
                  <tr key={sym}>
                    <td style={{ ...S.td, fontWeight: 700, color: "#fafafa" }}>{sym}</td>
                    <td style={S.td}>
                      {pct != null
                        ? <span style={S.pct(pct)}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</span>
                        : <span style={S.notFound}>N/A</span>}
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={S.td}>
                        {row
                          ? <span style={
                              f.key === "DELIV_PER" && parseFloat(row[f.key]) >= 50 ? { color: "#22c55e", fontWeight: 700 }
                              : f.key === "CLOSE_PRICE" || f.key === "AVG_PRICE" ? { color: "#fff", fontWeight: 700, fontSize: 14 }
                              : f.key === "HIGH_PRICE" ? { color: "#86efac" }
                              : f.key === "LOW_PRICE" ? { color: "#fca5a5" }
                              : { color: "#e4e4e7" }
                            }>{f.format(row[f.key])}</span>
                          : <span style={S.notFound}>not in CSV</span>}
                      </td>
                    ))}
                    <td style={S.td}>
                      {signals.length === 0
                        ? <span style={{ color: "#3f3f46", fontSize: 11 }}>—</span>
                        : signals.map((s) => <span key={s.label} style={S.signal(s.bg, s.color)}>{s.label}</span>)}
                    </td>
                    <td style={S.td}><button style={S.btnSm} onClick={() => removeStock(sym)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, color: "#3f3f46", fontSize: 11, textAlign: "right" }}>
          Signals: High Delivery ≥50% · Volume Spike &gt;2% above prev close · Breakout ≥99% of day high
        </div>
      </div>
    </div>
  );
}
