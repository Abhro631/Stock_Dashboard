import { useState, useCallback, useRef, useEffect } from "react";

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

// ─── CSV parsing ────────────────────────────────────────────────────────────
const FIELDS = [
  { key: "CLOSE_PRICE",    label: "LTP",          format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "AVG_PRICE",      label: "VWAP",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "PREV_CLOSE",     label: "Prev Close",   format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "OPEN_PRICE",     label: "Open",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "HIGH_PRICE",     label: "High",         format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "LOW_PRICE",      label: "Low",          format: (v) => v != null ? `₹${Number(v).toFixed(2)}` : "—" },
  { key: "TTL_TRD_QNTY",  label: "Total Vol",    format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_QTY",     label: "Delivery Vol", format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "DELIV_PER",     label: "Del %",        format: (v) => v != null ? `${Number(v).toFixed(2)}%` : "—" },
  { key: "NO_OF_TRADES",  label: "Trades",       format: (v) => v != null ? Number(v).toLocaleString("en-IN") : "—" },
  { key: "TURNOVER_LACS", label: "Turnover(L)",  format: (v) => v != null ? `₹${Number(v).toFixed(2)}L` : "—" },
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
  if (deliv >= 50)          signals.push({ label: "High Del",  color: "#00ff88", bg: "rgba(0,255,136,0.12)" });
  if (close > prev * 1.02)  signals.push({ label: "Vol Spike", color: "#ffd700", bg: "rgba(255,215,0,0.12)" });
  if (close >= high * 0.99) signals.push({ label: "Breakout",  color: "#ff6b35", bg: "rgba(255,107,53,0.12)" });
  return signals;
}

function pctChange(row) {
  const close = parseFloat(row.CLOSE_PRICE);
  const prev  = parseFloat(row.PREV_CLOSE);
  if (!prev) return null;
  return ((close - prev) / prev) * 100;
}

function getNseUrlForDate(dateStr) {
  if (!dateStr) return null;
  const [yyyy, mm, dd] = dateStr.split("-");
  return `https://archives.nseindia.com/products/content/sec_bhavdata_full_${dd}${mm}${yyyy}.csv`;
}

function getDefaultDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

function getMaxDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

// ─── RSI Calculator ─────────────────────────────────────────────────────────
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

// ─── Yahoo Finance fetcher ───────────────────────────────────────────────────
async function fetchYahooQuote(symbol) {
  const ySym = `${symbol}.NS`;
  // Fetch current quote + 30d history in parallel
  const [quoteRes, histRes] = await Promise.all([
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1d&range=1d`),
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1d&range=1mo`)
  ]);
  const [quoteData, histData] = await Promise.all([quoteRes.json(), histRes.json()]);

  const result = quoteData?.chart?.result?.[0];
  const histResult = histData?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const closes = histResult?.indicators?.quote?.[0]?.close?.filter(Boolean) || [];
  const rsi = calculateRSI(closes);

  // VWAP approximation: (H+L+C)/3
  const h = meta.regularMarketDayHigh;
  const l = meta.regularMarketDayLow;
  const c = meta.regularMarketPrice;
  const vwap = h && l && c ? ((h + l + c) / 3).toFixed(2) : null;

  return {
    symbol,
    ltp:       meta.regularMarketPrice,
    change:    meta.regularMarketPrice - meta.previousClose,
    changePct: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2),
    open:      meta.regularMarketOpen,
    high:      h,
    low:       l,
    prevClose: meta.previousClose,
    volume:    meta.regularMarketVolume,
    vwap,
    rsi,
    updatedAt: new Date().toLocaleTimeString("en-IN"),
  };
}

// ─── Shared styles ───────────────────────────────────────────────────────────
const TH = {
  padding: "11px 14px", textAlign: "left",
  background: "linear-gradient(135deg, #080d1e, #0d1526)",
  color: "#00d4ff", fontWeight: 600, letterSpacing: "0.08em",
  fontSize: 10, borderBottom: "2px solid #00d4ff33",
  whiteSpace: "nowrap", textTransform: "uppercase",
  position: "sticky", top: 0, boxShadow: "0 2px 10px rgba(0,0,0,0.8)"
};
const TD = { padding: "10px 14px", borderBottom: "1px solid #0d1526", whiteSpace: "nowrap" };

function RsiBar({ val }) {
  if (val == null) return <span style={{ color: "#3d4f6e" }}>—</span>;
  const color = val >= 70 ? "#ff4757" : val <= 30 ? "#00ff88" : "#ffd700";
  const label = val >= 70 ? "OB" : val <= 30 ? "OS" : "OK";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 6, background: "#1a2540", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: 12 }}>{val}</span>
      <span style={{ fontSize: 9, color, background: `${color}22`, padding: "1px 5px", borderRadius: 3 }}>{label}</span>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,       setTab]       = useState("bhav");
  const [data,      setData]      = useState(null);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [csvDate,   setCsvDate]   = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const [newStock,  setNewStock]  = useState("");
  const [search,    setSearch]    = useState("");
  const [fileName,  setFileName]  = useState(null);
  const [selDate,   setSelDate]   = useState(getDefaultDate());

  // Live tab state
  const [liveData,     setLiveData]     = useState({});
  const [liveLoading,  setLiveLoading]  = useState(false);
  const [liveError,    setLiveError]    = useState("");
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [autoRefresh,  setAutoRefresh]  = useState(false);
  const [countdown,    setCountdown]    = useState(30);
  const [liveSearch,   setLiveSearch]   = useState("");
  const intervalRef = useRef(null);
  const countRef    = useRef(null);
  const fileRef     = useRef();

  // ── CSV processing ──
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
      if (sample?.DATE1) setCsvDate(sample.DATE1);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  // ── Live fetch ──
  const fetchAllLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError("");
    const results = {};
    // Fetch in batches of 5 to avoid rate limits
    const batch = 5;
    for (let i = 0; i < watchlist.length; i += batch) {
      const chunk = watchlist.slice(i, i + batch);
      await Promise.all(chunk.map(async (sym) => {
        try {
          const q = await fetchYahooQuote(sym);
          if (q) results[sym] = q;
        } catch (_) {}
      }));
    }
    setLiveData(results);
    setLastRefresh(new Date().toLocaleTimeString("en-IN"));
    setLiveLoading(false);
  }, [watchlist]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      setCountdown(30);
      intervalRef.current = setInterval(() => { fetchAllLive(); setCountdown(30); }, 30000);
      countRef.current    = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    } else {
      clearInterval(intervalRef.current);
      clearInterval(countRef.current);
    }
    return () => { clearInterval(intervalRef.current); clearInterval(countRef.current); };
  }, [autoRefresh, fetchAllLive]);

  const addStock = () => {
    const s = newStock.trim().toUpperCase();
    if (s && !watchlist.includes(s)) setWatchlist([...watchlist, s]);
    setNewStock("");
  };
  const removeStock = (sym) => setWatchlist(watchlist.filter((s) => s !== sym));

  const filtered     = watchlist.filter((s) => s.includes(search.toUpperCase()));
  const liveFiltered = watchlist.filter((s) => s.includes(liveSearch.toUpperCase()));
  const found        = data ? filtered.filter((s) => data[s]).length : 0;
  const notFound     = data ? filtered.filter((s) => !data[s]).length : 0;
  const highDel      = data ? filtered.filter((s) => data[s] && parseFloat(data[s].DELIV_PER) >= 50).length : 0;
  const nseUrl       = getNseUrlForDate(selDate);
  const liveFound    = Object.keys(liveData).length;

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
    @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes spin   { to{transform:rotate(360deg)} }
    @keyframes fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background:#0a0d1a; }
    ::-webkit-scrollbar-thumb { background:#1e2a4a; border-radius:3px; }
    tr { animation: fadein 0.15s ease; }
    tr:hover td { background:#0d1526 !important; }
    input[type=date]::-webkit-calendar-picker-indicator { filter:invert(0.7) sepia(1) saturate(3) hue-rotate(180deg); cursor:pointer; }
    .tab-btn { cursor:pointer; padding:10px 28px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:700; letter-spacing:0.06em; border:none; transition:all 0.2s; }
    .tab-active { background:linear-gradient(135deg,#00d4ff,#00ff88); color:#050810; }
    .tab-inactive { background:#0a0f24; color:#8892b0; border:1px solid #1e2a4a; }
    .tab-inactive:hover { border-color:#00d4ff55; color:#00d4ff; }
  `;

  return (
    <div style={{ minHeight:"100vh", background:"#050810", color:"#e8eaf6", fontFamily:"'IBM Plex Mono','Fira Mono',monospace" }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(135deg,#080d1e,#0d1526)", borderBottom:"1px solid #1a2540", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background: tab==="live" && liveFound > 0 ? "#00ff88" : data ? "#00d4ff" : "#ff4757", boxShadow:`0 0 12px ${tab==="live" && liveFound > 0 ? "#00ff88" : data ? "#00d4ff" : "#ff4757"}`, animation:"pulse 2s infinite" }} />
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, letterSpacing:"0.06em", background:"linear-gradient(90deg,#00d4ff,#00ff88)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            NSE BHAV DASHBOARD
          </span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {csvDate   && <span style={{ fontSize:11, background:"#0d1a30", border:"1px solid #00d4ff44", padding:"3px 10px", borderRadius:4, color:"#00d4ff" }}>📅 {csvDate}</span>}
          {fileName  && <span style={{ fontSize:11, background:"#0d1a30", border:"1px solid #00ff8844", padding:"3px 10px", borderRadius:4, color:"#00ff88" }}>📂 {fileName}</span>}
          {lastRefresh && tab==="live" && <span style={{ fontSize:11, background:"#0d1a30", border:"1px solid #ffd70044", padding:"3px 10px", borderRadius:4, color:"#ffd700" }}>🔄 {lastRefresh}</span>}
          <span style={{ fontSize:11, background:"#0d1a30", border:"1px solid #1e2a4a", padding:"3px 10px", borderRadius:4, color:"#8892b0" }}>{watchlist.length} stocks</span>
        </div>
      </div>

      <div style={{ padding:"24px 32px", maxWidth:1600, margin:"0 auto" }}>

        {/* ── TABS ── */}
        <div style={{ display:"flex", gap:10, marginBottom:24 }}>
          <button className={`tab-btn ${tab==="bhav" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("bhav")}>
            📊 Bhav Data
          </button>
          <button className={`tab-btn ${tab==="live" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("live")}>
            ⚡ Live Data
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 1 — BHAV DATA
        ══════════════════════════════════════════════════ */}
        {tab === "bhav" && (
          <>
            {/* Date + Download + Drop */}
            <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:16, marginBottom:24 }}>
              <div style={{ background:"linear-gradient(135deg,#0a0f24,#0d1526)", border:"1px solid #1a2540", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ fontSize:11, color:"#00d4ff", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 }}>Step 1 — Select Date</div>
                <input type="date" max={getMaxDate()} value={selDate} onChange={(e) => setSelDate(e.target.value)}
                  style={{ width:"100%", background:"#080d1e", border:"1px solid #00d4ff55", borderRadius:6, padding:"10px 12px", color:"#00d4ff", fontSize:14, fontFamily:"inherit", outline:"none" }} />
                <div style={{ fontSize:10, color:"#3d4f6e", fontFamily:"monospace", wordBreak:"break-all" }}>{nseUrl?.split("/").pop()}</div>
                <a href={nseUrl||"#"} target="_blank" rel="noreferrer"
                  style={{ display:"block", textAlign:"center", textDecoration:"none", background:"linear-gradient(135deg,#00d4ff,#00ff88)", color:"#050810", borderRadius:8, padding:"11px 0", fontWeight:700, fontSize:14, fontFamily:"inherit" }}>
                  ⬇ Download NSE CSV
                </a>
              </div>
              <div
                style={{ border:`2px dashed ${dragging ? "#00ff88" : data ? "#00ff8866" : "#1e2a4a"}`, borderRadius:12, padding:"28px", textAlign:"center", cursor:"pointer", background: dragging ? "rgba(0,255,136,0.05)" : data ? "rgba(0,255,136,0.03)" : "#080d1e", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, transition:"all 0.2s" }}
                onDragOver={(e)=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>fileRef.current.click()}
              >
                <div style={{ fontSize:40 }}>{data?"✅":"📂"}</div>
                <div style={{ fontSize:11, color:"#00d4ff", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 }}>Step 2 — Drop CSV Here</div>
                {data
                  ? <div style={{ color:"#00ff88", fontSize:13 }}>{fileName} loaded<br/><span style={{ color:"#3d4f6e", fontSize:11 }}>Drop new file to refresh</span></div>
                  : <div style={{ color:"#8892b0", fontSize:13 }}>Drag & drop CSV here<br/><span style={{ color:"#3d4f6e", fontSize:12 }}>or click to browse</span></div>}
                <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={(e)=>processFile(e.target.files[0])} />
              </div>
            </div>

            {/* Summary */}
            {data && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[{l:"Watching",v:watchlist.length,c:"#00d4ff"},{l:"Found",v:found,c:"#00ff88"},{l:"Not in CSV",v:notFound,c:"#ff4757"},{l:"High Del",v:highDel,c:"#ffd700"}].map(x=>(
                  <div key={x.l} style={{ background:"linear-gradient(135deg,#0a0f24,#0d1526)", border:`1px solid ${x.c}33`, borderRadius:10, padding:"14px 18px" }}>
                    <div style={{ fontSize:11, color:"#8892b0", textTransform:"uppercase" }}>{x.l}</div>
                    <div style={{ fontSize:26, fontWeight:700, marginTop:4, color:x.c, fontFamily:"'Syne',sans-serif" }}>{x.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <input style={{ background:"#0a0f24", border:"1px solid #1e2a4a", borderRadius:6, padding:"9px 14px", color:"#e8eaf6", fontSize:13, outline:"none", fontFamily:"inherit", flex:2, minWidth:160 }} placeholder="🔍 Search stocks..." value={search} onChange={(e)=>setSearch(e.target.value)} />
              <input style={{ background:"#0a0f24", border:"1px solid #1e2a4a", borderRadius:6, padding:"9px 14px", color:"#e8eaf6", fontSize:13, outline:"none", fontFamily:"inherit", flex:2, minWidth:160 }} placeholder="Add symbol..." value={newStock} onChange={(e)=>setNewStock(e.target.value.toUpperCase())} onKeyDown={(e)=>e.key==="Enter"&&addStock()} />
              <button onClick={addStock} style={{ background:"linear-gradient(135deg,#00d4ff,#0088ff)", color:"#050810", border:"none", borderRadius:6, padding:"9px 20px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+ Add</button>
            </div>

            {/* Bhav Table */}
            <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #1a2540", maxHeight:"65vh", overflowY:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>{["#","Symbol","Chg %",...FIELDS.map(f=>f.label),"Signals",""].map((h,i)=>(
                    <th key={i} style={TH}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {!data ? (
                    <tr><td colSpan={FIELDS.length+5} style={{ ...TD, textAlign:"center", padding:48, color:"#3d4f6e", fontSize:14 }}>⬆ Select date → Download CSV → Drop it above</td></tr>
                  ) : filtered.map((sym, idx) => {
                    const row = data[sym];
                    const pct = row ? pctChange(row) : null;
                    const sigs = row ? computeSignals(row) : [];
                    const up = pct != null && pct >= 0;
                    return (
                      <tr key={sym} style={{ background: idx%2===0 ? "#060b1a" : "#080d1e" }}>
                        <td style={{ ...TD, color:"#3d4f6e", fontSize:11 }}>{idx+1}</td>
                        <td style={{ ...TD, fontWeight:700, color:"#e8eaf6" }}>{sym}</td>
                        <td style={TD}>
                          {pct!=null ? <span style={{ color:up?"#00ff88":"#ff4757", fontWeight:700, background:up?"rgba(0,255,136,0.1)":"rgba(255,71,87,0.1)", padding:"2px 8px", borderRadius:4 }}>{up?"▲":"▼"} {Math.abs(pct).toFixed(2)}%</span>
                          : <span style={{ color:"#3d4f6e" }}>—</span>}
                        </td>
                        {FIELDS.map((f)=>(
                          <td key={f.key} style={TD}>
                            {row ? <span style={
                              f.key==="CLOSE_PRICE" ? {color:"#fff",fontWeight:700,fontSize:13}
                              :f.key==="AVG_PRICE"  ? {color:"#00d4ff",fontWeight:600}
                              :f.key==="HIGH_PRICE" ? {color:"#00ff88"}
                              :f.key==="LOW_PRICE"  ? {color:"#ff6b81"}
                              :f.key==="DELIV_PER"&&parseFloat(row[f.key])>=50 ? {color:"#ffd700",fontWeight:700}
                              :{color:"#c5cae9"}
                            }>{f.format(row[f.key])}</span>
                            : <span style={{ color:"#2a3550" }}>—</span>}
                          </td>
                        ))}
                        <td style={TD}>{sigs.length===0 ? <span style={{ color:"#2a3550" }}>—</span> : sigs.map(s=><span key={s.label} style={{ display:"inline-block",background:s.bg,color:s.color,border:`1px solid ${s.color}55`,borderRadius:4,fontSize:10,padding:"2px 7px",marginRight:4,fontWeight:600 }}>{s.label}</span>)}</td>
                        <td style={TD}><button onClick={()=>removeStock(sym)} style={{ background:"transparent",border:"1px solid #1e2a4a",color:"#3d4f6e",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit" }} onMouseEnter={e=>{e.target.style.borderColor="#ff4757";e.target.style.color="#ff4757";}} onMouseLeave={e=>{e.target.style.borderColor="#1e2a4a";e.target.style.color="#3d4f6e";}}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:10, color:"#2a3550", fontSize:11, textAlign:"right" }}>Signals — High Del ≥50% · Vol Spike &gt;2% above prev · Breakout ≥99% of day high</div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2 — LIVE DATA
        ══════════════════════════════════════════════════ */}
        {tab === "live" && (
          <>
            {/* Live controls */}
            <div style={{ background:"linear-gradient(135deg,#0a0f24,#0d1526)", border:"1px solid #1a2540", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <button
                  onClick={fetchAllLive} disabled={liveLoading}
                  style={{ background:"linear-gradient(135deg,#00d4ff,#00ff88)", color:"#050810", border:"none", borderRadius:8, padding:"10px 24px", cursor:liveLoading?"not-allowed":"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", opacity:liveLoading?0.7:1 }}
                >
                  {liveLoading ? "⏳ Fetching..." : "🔄 Fetch Live Data"}
                </button>

                <button
                  onClick={()=>setAutoRefresh(a=>!a)}
                  style={{ background: autoRefresh ? "rgba(255,71,87,0.15)" : "rgba(0,255,136,0.1)", color: autoRefresh ? "#ff4757" : "#00ff88", border:`1px solid ${autoRefresh?"#ff475755":"#00ff8855"}`, borderRadius:8, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}
                >
                  {autoRefresh ? `⏸ Stop Auto (${countdown}s)` : "▶ Auto Refresh (30s)"}
                </button>

                {lastRefresh && (
                  <span style={{ fontSize:12, color:"#8892b0" }}>Last updated: <span style={{ color:"#ffd700" }}>{lastRefresh}</span></span>
                )}

                <div style={{ marginLeft:"auto" }}>
                  <input style={{ background:"#080d1e", border:"1px solid #1e2a4a", borderRadius:6, padding:"9px 14px", color:"#e8eaf6", fontSize:13, outline:"none", fontFamily:"inherit", width:220 }} placeholder="🔍 Search stocks..." value={liveSearch} onChange={(e)=>setLiveSearch(e.target.value)} />
                </div>
              </div>

              {liveError && <div style={{ marginTop:12, color:"#ff4757", fontSize:12 }}>⚠️ {liveError}</div>}

              {!liveLoading && liveFound === 0 && (
                <div style={{ marginTop:12, fontSize:12, color:"#8892b0" }}>
                  💡 Click <strong style={{ color:"#00d4ff" }}>Fetch Live Data</strong> to load LTP, VWAP, RSI for all your stocks from Yahoo Finance. Enable <strong style={{ color:"#00ff88" }}>Auto Refresh</strong> to update every 30 seconds automatically.
                </div>
              )}
            </div>

            {/* Summary */}
            {liveFound > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { l:"Live Stocks", v:liveFound, c:"#00ff88" },
                  { l:"Gainers", v:Object.values(liveData).filter(d=>d.changePct>0).length, c:"#00ff88" },
                  { l:"Losers",  v:Object.values(liveData).filter(d=>d.changePct<0).length, c:"#ff4757" },
                  { l:"RSI > 70", v:Object.values(liveData).filter(d=>d.rsi>=70).length, c:"#ffd700" },
                ].map(x=>(
                  <div key={x.l} style={{ background:"linear-gradient(135deg,#0a0f24,#0d1526)", border:`1px solid ${x.c}33`, borderRadius:10, padding:"14px 18px" }}>
                    <div style={{ fontSize:11, color:"#8892b0", textTransform:"uppercase" }}>{x.l}</div>
                    <div style={{ fontSize:26, fontWeight:700, marginTop:4, color:x.c, fontFamily:"'Syne',sans-serif" }}>{x.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Table */}
            <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #1a2540", maxHeight:"65vh", overflowY:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>{["#","Symbol","LTP","Chg %","VWAP","Open","High","Low","Volume","RSI (14)","Updated"].map((h,i)=>(
                    <th key={i} style={TH}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {liveFound === 0 ? (
                    <tr><td colSpan={11} style={{ ...TD, textAlign:"center", padding:56, color:"#3d4f6e", fontSize:14 }}>
                      {liveLoading ? "⏳ Fetching live data from Yahoo Finance..." : "⬆ Click Fetch Live Data to load prices"}
                    </td></tr>
                  ) : liveFiltered.map((sym, idx) => {
                    const d = liveData[sym];
                    const up = d && parseFloat(d.changePct) >= 0;
                    return (
                      <tr key={sym} style={{ background: idx%2===0 ? "#060b1a" : "#080d1e" }}>
                        <td style={{ ...TD, color:"#3d4f6e", fontSize:11 }}>{idx+1}</td>
                        <td style={{ ...TD, fontWeight:700, color:"#e8eaf6" }}>{sym}</td>
                        <td style={{ ...TD, color:"#ffffff", fontWeight:700, fontSize:13 }}>{d ? `₹${Number(d.ltp).toFixed(2)}` : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={TD}>
                          {d ? <span style={{ color:up?"#00ff88":"#ff4757", fontWeight:700, background:up?"rgba(0,255,136,0.1)":"rgba(255,71,87,0.1)", padding:"2px 8px", borderRadius:4 }}>
                            {up?"▲":"▼"} {Math.abs(d.changePct)}%
                          </span> : <span style={{ color:"#2a3550" }}>—</span>}
                        </td>
                        <td style={{ ...TD, color:"#00d4ff", fontWeight:600 }}>{d ? `₹${Number(d.vwap).toFixed(2)}` : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={{ ...TD, color:"#c5cae9" }}>{d ? `₹${Number(d.open).toFixed(2)}` : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={{ ...TD, color:"#00ff88" }}>{d ? `₹${Number(d.high).toFixed(2)}` : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={{ ...TD, color:"#ff6b81" }}>{d ? `₹${Number(d.low).toFixed(2)}` : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={{ ...TD, color:"#c5cae9" }}>{d ? Number(d.volume).toLocaleString("en-IN") : <span style={{ color:"#2a3550" }}>—</span>}</td>
                        <td style={TD}><RsiBar val={d?.rsi} /></td>
                        <td style={{ ...TD, color:"#3d4f6e", fontSize:11 }}>{d?.updatedAt || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop:10, color:"#2a3550", fontSize:11, textAlign:"right" }}>
              Data from Yahoo Finance · RSI(14) calculated from 30-day history · OB=Overbought ≥70 · OS=Oversold ≤30
            </div>
          </>
        )}
      </div>
    </div>
  );
}
