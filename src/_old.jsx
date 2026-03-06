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

  const styles = {
    app: {
      minHeight: "100vh",
      background: "#09090b",
      color: "#e4e4e7",
      fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
      padding: "0",
    },
    header: {
      borderBottom: "1px solid #27272a",
      padding: "20px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#09090b",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    logo: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    dot: {
      width: 10, height: 10, borderRadius: "50%",
      background: "#22c55e",
      boxShadow: "0 0 8px #22c55e",
      animation: "pulse 2s infinite",
    },
    title: {
      fontSize: 18, fontWeight: 700, letterSpacing: "0.08em",
      color: "#fafafa", textTransform: "uppercase",
    },
    badge: {
      fontSize: 11, background: "#18181b", border: "1px solid #3f3f46",
      padding: "3px 10px", borderRadius: 4, color: "#a1a1aa",
      letterSpacing: "0.05em",
    },
    body: { padding: "28px 32px", maxWidth: 1400, margin: "0 auto" },
    dropzone: {
      border: `2px dashed ${dragging ? "#22c55e" : "#3f3f46"}`,
      borderRadius: 8,
      padding: "36px 24px",
      textAlign: "center",
      cursor: "pointer",
      background: dragging ? "#052e16" : "#111113",
      transition: "all 0.2s",
      marginBottom: 28,
    },
    dropText: { color: "#71717a", fontSize: 14 },
    dropHighlight: { color: "#22c55e", fontWeight: 600 },
    row: { display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" },
    input: {
      background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6,
      padding: "8px 14px", color: "#e4e4e7", fontSize: 13,
      outline: "none", fontFamily: "inherit", flex: 1, minWidth: 140,
    },
    btn: {
      background: "#22c55e", color: "#052e16", border: "none",
      borderRadius: 6, padding: "8px 18px", cursor: "pointer",
      fontWeight: 700, fontSize: 13, fontFamily: "inherit",
      letterSpacing: "0.04em",
    },
    btnSm: {
      background: "transparent", border: "1px solid #3f3f46",
      color: "#71717a", borderRadius: 4, padding: "2px 8px",
      cursor: "pointer", fontSize: 11, fontFamily: "inherit",
    },
    tableWrap: { overflowX: "auto", borderRadius: 8, border: "1px solid #27272a" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: {
      padding: "10px 14px", textAlign: "left",
      background: "#111113", color: "#52525b",
      fontWeight: 600, letterSpacing: "0.06em", fontSize: 11,
      borderBottom: "1px solid #27272a", whiteSpace: "nowrap",
      textTransform: "uppercase",
    },
    td: {
      padding: "11px 14px", borderBottom: "1px solid #18181b",
      whiteSpace: "nowrap", verticalAlign: "middle",
    },
    signal: (bg, color) => ({
      display: "inline-block", background: bg, color: color,
      border: `1px solid ${color}33`, borderRadius: 4,
      fontSize: 10, padding: "2px 7px", marginRight: 4,
      fontWeight: 600, letterSpacing: "0.05em",
    }),
    notFound: { color: "#52525b", fontStyle: "italic" },
    pct: (v) => ({ color: v >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }),
    summaryGrid: {
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: 12, marginBottom: 24,
    },
    card: {
      background: "#111113", border: "1px solid #27272a",
      borderRadius: 8, padding: "14px 18px",
    },
    cardLabel: { fontSize: 11, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em" },
    cardVal: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  };

  const found = data ? filtered.filter((s) => data[s]).length : 0;
  const notFound = data ? filtered.filter((s) => !data[s]).length : 0;
  const highDelivery = data ? filtered.filter((s) => data[s] && parseFloat(data[s].DELIV_PER) >= 50).length : 0;

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        tr:hover td { background: #111113 !important; }
        input:focus { border-color: #22c55e !important; }
        button:hover { opacity: 0.85; }
      `}</style>

      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.dot} />
          <span style={styles.title}>NSE Bhav Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {date && <span style={styles.badge}>📅 {date}</span>}
          {fileName && <span style={styles.badge}>📂 {fileName}</span>}
          <span style={styles.badge}>{watchlist.length} stocks</span>
        </div>
      </div>

      <div style={styles.body}>
        {/* Upload */}
        <div
          style={styles.dropzone}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current.click()}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={styles.dropText}>
            Drop your <span style={styles.dropHighlight}>NSE Bhav CSV</span> here, or click to upload
          </div>
          <div style={{ ...styles.dropText, fontSize: 12, marginTop: 4 }}>
            e.g. sec_bhavdata_full_DDMMYYYY.csv
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
            onChange={(e) => processFile(e.target.files[0])} />
        </div>

        {/* Summary cards */}
        {data && (
          <div style={styles.summaryGrid}>
            <div style={styles.card}>
              <div style={styles.cardLabel}>Watching</div>
              <div style={{ ...styles.cardVal, color: "#fafafa" }}>{watchlist.length}</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardLabel}>Data Found</div>
              <div style={{ ...styles.cardVal, color: "#22c55e" }}>{found}</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardLabel}>Not in CSV</div>
              <div style={{ ...styles.cardVal, color: "#ef4444" }}>{notFound}</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardLabel}>High Delivery</div>
              <div style={{ ...styles.cardVal, color: "#22c55e" }}>{highDelivery}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="🔍 Filter watchlist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Add stock symbol (e.g. INFY)"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
          />
          <button style={styles.btn} onClick={addStock}>+ Add</button>
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Symbol</th>
                <th style={styles.th}>Chg%</th>
                {FIELDS.map((f) => <th key={f.key} style={styles.th}>{f.label}</th>)}
                <th style={styles.th}>Signals</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={FIELDS.length + 4} style={{ ...styles.td, textAlign: "center", color: "#3f3f46" }}>
                  No stocks in watchlist
                </td></tr>
              ) : filtered.map((sym) => {
                const row = data?.[sym];
                const pct = row ? pctChange(row) : null;
                const signals = row ? computeSignals(row) : [];
                return (
                  <tr key={sym}>
                    <td style={{ ...styles.td, fontWeight: 700, color: "#fafafa" }}>{sym}</td>
                    <td style={styles.td}>
                      {pct != null
                        ? <span style={styles.pct(pct)}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</span>
                        : <span style={styles.notFound}>{data ? "N/A" : "—"}</span>}
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={styles.td}>
                        {row
                          ? <span style={f.key === "DELIV_PER" && parseFloat(row[f.key]) >= 50 ? { color: "#22c55e" } : {}}>
                              {f.format(row[f.key])}
                            </span>
                          : <span style={styles.notFound}>{data ? "not in CSV" : "—"}</span>}
                      </td>
                    ))}
                    <td style={styles.td}>
                      {signals.length === 0
                        ? <span style={{ color: "#3f3f46", fontSize: 11 }}>—</span>
                        : signals.map((s) => (
                            <span key={s.label} style={styles.signal(s.bg, s.color)}>{s.label}</span>
                          ))}
                    </td>
                    <td style={styles.td}>
                      <button style={styles.btnSm} onClick={() => removeStock(sym)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, color: "#3f3f46", fontSize: 11, textAlign: "right" }}>
          Signal rules: High Delivery ≥50% · Volume Spike = close &gt;2% above prev close · Breakout = close ≥99% of day high
        </div>
      </div>
    </div>
  );
}