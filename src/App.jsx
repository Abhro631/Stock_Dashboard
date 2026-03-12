import { useState, useCallback, useRef } from "react";

const DEFAULT_WATCHLIST = [
  "ADANIPOWER","ABCAPITAL","ASHOKLEY","BHARATCOAL","BLIL","BEL","BPCL",
  "CANHLIFE","CANBK","COALINDIA","DEN","EXCELSOFT","FILATFASH","GAIL",
  "GKENERGY","GLOTTIS","IRFC","INDUSTOWER","IOC","IGL","LTF","NBCC",
  "NLCINDIA","NMDC","NAGAFERT","NILAINFRA","ONGC","PCJEWELLER","POWERGRID",
  "PNB","RCOM","RHFL","RITES","SUZLON","SOUTHBANK","SAIL","TATASTEEL",
  "TRIDENT","URBANCO","VIDYAWIRES","WIPRO","YESBANK","NATIONALUM","RECLTD",
  "HINDPETRO","HINDZINC","HINDCOPPER","OIL","MANALIPETC","PATELENG",
  "PROSTARM","SCODATUBES","BELRISE","AEGISVOPAK","HITECH","TATAPOWER",
  "NTPC","NHPC","GMRAIRPORT","CENTRALBK","AAATECH","BSOFT","ITC","EPL",
  "PFC","RELINFRA","VEDL","DCBBANK","HMVL","TATATECH","JAMNAAUTO","BEPL",
  "GULFPETRO","CASTROLIND","ASHOKA","PREMIERPOL","NDL","DYCL","UCOBANK",
  "7TEC","INDUSINVIT","UNIONBANK","IOB","TAPARIA","ENGINERSIN","DUGLOBAL",
  "ROLEXRINGS","BANKINDIA","BANKBARODA","NACDAC","NLFL","RELIANCE","STYL",
  "SHARVAYA","TRADEUNO","CONNPLEX","PETRONET","ROYALARC","PARMESHWAR",
  "CONSOFINVT","GMBREW","NITTAGELA","MAHABANK","VMM","VSTIND","TATACAP",
  "PARAGMILK","EMMVEE","TENNIND","UTLSOLAR","GROWW","SBC","PRECWIRE",
  "TGIF","WHITEFORCE","UML","DURLAX","REDINGTON","ASHWINI","LOYAL","VDEAL",
  "GOWRA","HELPAGE","ACEALPHA","IDEALTECHO","ITALIANE","ZELIO","SIGMA",
  "ARABIAN","PIOTEX","ESSEX","APL","NGIND","PARAGBOS"
];

const FIELDS = [
  { key: "CLOSE_PRICE",   label: "LTP",          format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "AVG_PRICE",     label: "VWAP",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "PREV_CLOSE",    label: "Prev Close",   format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "OPEN_PRICE",    label: "Open",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "HIGH_PRICE",    label: "High",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "LOW_PRICE",     label: "Low",          format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "TTL_TRD_QNTY", label: "Total Vol",    format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_QTY",    label: "Delivery Vol", format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_PER",    label: "Del %",        format: (v) => v != null ? `${Number(v).toFixed(2)}%` : "—" },
  { key: "NO_OF_TRADES", label: "Trades",       format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "TURNOVER_LACS",label: "Turnover(L)",  format: (v) => v != null ? `₹${Number(v).toFixed(2)}L` : "—" },
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
  const prev  = parseFloat(row.PREV_CLOSE);
  const high  = parseFloat(row.HIGH_PRICE);
  const signals = [];
  if (deliv >= 50)           signals.push({ label: "High Del",  color: "#00ff88", bg: "rgba(0,255,136,0.12)" });
  if (close > prev * 1.02)   signals.push({ label: "Vol Spike", color: "#ffd700", bg: "rgba(255,215,0,0.12)" });
  if (close >= high * 0.99)  signals.push({ label: "Breakout",  color: "#ff6b35", bg: "rgba(255,107,53,0.12)" });
  return signals;
}

function pctChange(row) {
  const close = parseFloat(row.CLOSE_PRICE);
  const prev  = parseFloat(row.PREV_CLOSE);
  if (!prev) return null;
  return ((close - prev) / prev) * 100;
}

function getNseUrlForDate(dateStr) {
  // dateStr format: YYYY-MM-DD (from input[type=date])
  if (!dateStr) return null;
  const [yyyy, mm, dd] = dateStr.split("-");
  return `https://archives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
}

function getDefaultDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getMaxDate() {
  // Max selectable = yesterday
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

export default function App() {
  const [data,      setData]      = useState(null);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [date,      setDate]      = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const [newStock,  setNewStock]  = useState("");
  const [search,    setSearch]    = useState("");
  const [fileName,  setFileName]  = useState(null);
  const [selDate,   setSelDate]   = useState(getDefaultDate());
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
  const found        = data ? filtered.filter((s) => data[s]).length : 0;
  const notFound     = data ? filtered.filter((s) => !data[s]).length : 0;
  const highDelivery = data ? filtered.filter((s) => data[s] && parseFloat(data[s].DELIV_PER) >= 50).length : 0;
  const nseUrl = getNseUrlForDate(selDate);

  return (
    <div style={{ minHeight: "100vh", background: "#050810", color: "#e8eaf6", fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glow  { 0%,100%{box-shadow:0 0 8px #00d4ff44} 50%{box-shadow:0 0 22px #00d4ff99} }
        @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0a0d1a; }
        ::-webkit-scrollbar-thumb { background: #1e2a4a; border-radius: 3px; }
        tr { animation: fadein 0.2s ease; }
        tr:hover td { background: #0d1526 !important; transition: background 0.15s; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.7) sepia(1) saturate(3) hue-rotate(180deg); cursor: pointer; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #080d1e 0%, #0d1526 100%)", borderBottom: "2px solid #00d4ff33", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: data ? "#00ff88" : "#ff4757", boxShadow: data ? "0 0 12px #00ff88" : "0 0 12px #ff4757", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "0.06em", background: "linear-gradient(90deg, #00d4ff, #00ff88)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            NSE BHAV DASHBOARD
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {date     && <span style={{ fontSize: 11, background: "#0d1a30", border: "1px solid #00d4ff44", padding: "3px 10px", borderRadius: 4, color: "#00d4ff" }}>📅 {date}</span>}
          {fileName && <span style={{ fontSize: 11, background: "#0d1a30", border: "1px solid #00ff8844", padding: "3px 10px", borderRadius: 4, color: "#00ff88" }}>📂 {fileName}</span>}
          <span style={{ fontSize: 11, background: "#0d1a30", border: "1px solid #1e2a4a", padding: "3px 10px", borderRadius: 4, color: "#8892b0" }}>{watchlist.length} stocks</span>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1600, margin: "0 auto" }}>

        {/* ── DATE PICKER + DOWNLOAD + DROPZONE ── */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginBottom: 24 }}>

          {/* Left: Date picker + Download */}
          <div style={{ background: "linear-gradient(135deg, #0a0f24, #0d1526)", border: "1px solid #1a2540", borderRadius: 12, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
              Step 1 — Select Date
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#8892b0", marginBottom: 6 }}>Pick any date up to yesterday</div>
              <input
                type="date"
                max={getMaxDate()}
                value={selDate}
                onChange={(e) => setSelDate(e.target.value)}
                style={{
                  width: "100%", background: "#080d1e", border: "1px solid #00d4ff55",
                  borderRadius: 6, padding: "10px 12px", color: "#00d4ff",
                  fontSize: 14, fontFamily: "inherit", outline: "none",
                  cursor: "pointer"
                }}
              />
            </div>
            {nseUrl && (
              <div style={{ fontSize: 10, color: "#3d4f6e", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5 }}>
                {nseUrl.split("/").pop()}
              </div>
            )}
            <a
              href={nseUrl || "#"}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block", textAlign: "center", textDecoration: "none",
                background: "linear-gradient(135deg, #00d4ff, #00ff88)",
                color: "#050810", borderRadius: 8, padding: "12px 0",
                fontWeight: 700, fontSize: 14, fontFamily: "inherit",
                letterSpacing: "0.04em", transition: "opacity 0.2s",
                pointerEvents: nseUrl ? "auto" : "none", opacity: nseUrl ? 1 : 0.4
              }}
            >
              ⬇ Download NSE CSV
            </a>
          </div>

          {/* Right: Drop zone */}
          <div
            style={{
              border: `2px dashed ${dragging ? "#00ff88" : data ? "#00ff8866" : "#1e2a4a"}`,
              borderRadius: 12, padding: "32px 24px", textAlign: "center",
              cursor: "pointer", transition: "all 0.2s",
              background: dragging ? "rgba(0,255,136,0.05)" : data ? "rgba(0,255,136,0.03)" : "#080d1e",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              animation: "glow 3s infinite"
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current.click()}
          >
            <div style={{ fontSize: 42 }}>{data ? "✅" : "📂"}</div>
            <div style={{ fontSize: 11, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
              Step 2 — Drop CSV Here
            </div>
            {data
              ? <div style={{ color: "#00ff88", fontSize: 13 }}>{fileName} loaded<br /><span style={{ color: "#3d4f6e", fontSize: 11 }}>Drop new file to refresh</span></div>
              : <div style={{ color: "#8892b0", fontSize: 13 }}>Drag & drop the downloaded CSV<br /><span style={{ color: "#3d4f6e", fontSize: 12 }}>or click to browse</span></div>
            }
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => processFile(e.target.files[0])} />
          </div>
        </div>

        {/* ── SUMMARY CARDS ── */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Watching",     val: watchlist.length, color: "#00d4ff" },
              { label: "Data Found",   val: found,            color: "#00ff88" },
              { label: "Not in CSV",   val: notFound,         color: "#ff4757" },
              { label: "High Del",     val: highDelivery,     color: "#ffd700" },
            ].map((c) => (
              <div key={c.label} style={{ background: "linear-gradient(135deg, #0a0f24, #0d1526)", border: `1px solid ${c.color}33`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#8892b0", textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: c.color, fontFamily: "'Syne',sans-serif" }}>{c.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONTROLS ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            style={{ background: "#0a0f24", border: "1px solid #1e2a4a", borderRadius: 6, padding: "9px 14px", color: "#e8eaf6", fontSize: 13, outline: "none", fontFamily: "inherit", flex: 2, minWidth: 160, transition: "border 0.2s" }}
            placeholder="🔍 Search stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            style={{ background: "#0a0f24", border: "1px solid #1e2a4a", borderRadius: 6, padding: "9px 14px", color: "#e8eaf6", fontSize: 13, outline: "none", fontFamily: "inherit", flex: 2, minWidth: 160 }}
            placeholder="Add symbol (e.g. INFY)"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
          />
          <button
            onClick={addStock}
            style={{ background: "linear-gradient(135deg, #00d4ff, #0088ff)", color: "#050810", border: "none", borderRadius: 6, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}
          >
            + Add
          </button>
        </div>

        {/* ── TABLE ── */}
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #1a2540", maxHeight: "72vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                {["#", "Symbol", "Chg %", ...FIELDS.map(f => f.label), "Signals", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "11px 14px", textAlign: "left",
                    background: "linear-gradient(135deg, #080d1e, #0d1526)",
                    color: "#00d4ff", fontWeight: 600, letterSpacing: "0.08em",
                    fontSize: 10, borderBottom: "2px solid #00d4ff33",
                    whiteSpace: "nowrap", textTransform: "uppercase", position: "sticky", top: 0, boxShadow: "0 2px 10px rgba(0,0,0,0.8)"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr>
                  <td colSpan={FIELDS.length + 5} style={{ textAlign: "center", padding: 56, color: "#3d4f6e", fontSize: 14 }}>
                    ⬆ Select a date, download the CSV, then drop it above
                  </td>
                </tr>
              ) : filtered.map((sym, idx) => {
                const row = data[sym];
                const pct = row ? pctChange(row) : null;
                const signals = row ? computeSignals(row) : [];
                const isUp = pct != null && pct >= 0;
                return (
                  <tr key={sym} style={{ background: idx % 2 === 0 ? "#060b1a" : "#080d1e" }}>
                    <td style={{ padding: "10px 14px", color: "#3d4f6e", fontSize: 11, borderBottom: "1px solid #0d1526" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#e8eaf6", borderBottom: "1px solid #0d1526", whiteSpace: "nowrap" }}>{sym}</td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #0d1526", whiteSpace: "nowrap" }}>
                      {pct != null
                        ? <span style={{ color: isUp ? "#00ff88" : "#ff4757", fontWeight: 700, background: isUp ? "rgba(0,255,136,0.1)" : "rgba(255,71,87,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                            {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                          </span>
                        : <span style={{ color: "#3d4f6e" }}>—</span>}
                    </td>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={{ padding: "10px 14px", borderBottom: "1px solid #0d1526", whiteSpace: "nowrap" }}>
                        {row
                          ? <span style={
                              f.key === "CLOSE_PRICE" ? { color: "#ffffff", fontWeight: 700, fontSize: 13 }
                              : f.key === "AVG_PRICE"  ? { color: "#00d4ff", fontWeight: 600 }
                              : f.key === "HIGH_PRICE" ? { color: "#00ff88" }
                              : f.key === "LOW_PRICE"  ? { color: "#ff6b81" }
                              : f.key === "DELIV_PER" && parseFloat(row[f.key]) >= 50 ? { color: "#ffd700", fontWeight: 700 }
                              : { color: "#c5cae9" }
                            }>{f.format(row[f.key])}</span>
                          : <span style={{ color: "#2a3550", fontStyle: "italic" }}>—</span>}
                      </td>
                    ))}
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #0d1526", whiteSpace: "nowrap" }}>
                      {signals.length === 0
                        ? <span style={{ color: "#2a3550" }}>—</span>
                        : signals.map((s) => (
                            <span key={s.label} style={{ display: "inline-block", background: s.bg, color: s.color, border: `1px solid ${s.color}55`, borderRadius: 4, fontSize: 10, padding: "2px 7px", marginRight: 4, fontWeight: 600, letterSpacing: "0.04em" }}>{s.label}</span>
                          ))}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: "1px solid #0d1526" }}>
                      <button onClick={() => removeStock(sym)} style={{ background: "transparent", border: "1px solid #1e2a4a", color: "#3d4f6e", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.target.style.borderColor = "#ff4757"; e.target.style.color = "#ff4757"; }}
                        onMouseLeave={e => { e.target.style.borderColor = "#1e2a4a"; e.target.style.color = "#3d4f6e"; }}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, color: "#2a3550", fontSize: 11, textAlign: "right", letterSpacing: "0.04em" }}>
          Signals — High Del: delivery ≥50% · Vol Spike: close &gt;2% above prev · Breakout: close ≥99% of day high
        </div>
      </div>
    </div>
  );
}
