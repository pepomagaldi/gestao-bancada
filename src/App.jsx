import './App.css'
import { useState, useEffect, createContext, useContext } from "react";

const SUPABASE_URL = "https://dtectoxgobrupwrfttgd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZWN0b3hnb2JydXB3cmZ0dGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjI4MzQsImV4cCI6MjA5MDEzODgzNH0.xd3CMtRYJvxZ_MnVK4lv4b1-V2o-I_Yyo1XH-VAuAKA";
const SUPABASE_SVC = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZWN0b3hnb2JydXB3cmZ0dGdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU2MjgzNCwiZXhwIjoyMDkwMTM4ODM0fQ.uAbqbe8iAtyCpNeCrJJyZlLMN5ppBcd33YCrSSyOhrI";
const CAKTO_LINK  = "https://pay.cakto.com.br/32coo5f_828361";

async function sbFetch(method, path, body, token) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token || SUPABASE_KEY}`, "Prefer": "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

const authAPI = {
  async signUp(email, password, nome) {
    const r = await sbFetch("POST", "/auth/v1/signup", { email, password, data: { nome } });
    if (r.error) throw new Error(r.error.message);
    const userId = r.user?.id || r.id;
    if (userId) {
      const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_SVC, "Authorization": `Bearer ${SUPABASE_SVC}`, "Prefer": "return=representation" },
        body: JSON.stringify({ id: userId, email, nome, trial_expires_at: trialExpires, assinante: false }),
      });
    }
    return r;
  },
  async signIn(email, password) { return sbFetch("POST", "/auth/v1/token?grant_type=password", { email, password }); },
  async resetPassword(email) { await sbFetch("POST", "/auth/v1/recover", { email }); },
  async signOut(token) { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } }); },
  async getProfile(userId, token) {
    const data = await sbFetch("GET", `/rest/v1/profiles?id=eq.${userId}&select=*`, null, token);
    return Array.isArray(data) ? data[0] : data;
  },
  getSession() { try { return JSON.parse(localStorage.getItem("gb_session")); } catch { return null; } },
  saveSession(s) { localStorage.setItem("gb_session", JSON.stringify(s)); },
  clearSession() { localStorage.removeItem("gb_session"); },
};

function getAccessStatus(profile) {
  if (!profile) return "blocked";
  if (profile.assinante) return "active";
  const expires = new Date(profile.trial_expires_at);
  if (new Date() < expires) return { status: "trial", diasRestantes: Math.ceil((expires - new Date()) / 86400000) };
  return "expired";
}

const fmt = (v) => "R$\u00a0" + Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const today = () => new Date().toISOString().slice(0, 10);
let _uid = 300; const uid = () => ++_uid;

const STATUS_CFG = {
  aberta:       { label: "Aberta",        color: "#2563eb", bg: "#eff6ff" },
  em_andamento: { label: "Em Andamento",  color: "#d97706", bg: "#fffbeb" },
  concluida:    { label: "Conclu\u00edda", color: "#16a34a", bg: "#f0fdf4" },
  cancelada:    { label: "Cancelada",     color: "#dc2626", bg: "#fef2f2" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:#f1f5f9;color:#1e293b;font-family:'Nunito',sans-serif;font-size:14px;}
  ::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:#f1f5f9;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
  input,select,textarea{background:#fff;border:1px solid #e2e8f0;border-radius:8px;color:#1e293b;padding:8px 12px;font-family:'Nunito',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color 0.2s;}
  input:focus,select:focus,textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb18;}
  input::placeholder,textarea::placeholder{color:#94a3b8;}
  button{font-family:'Nunito',sans-serif;cursor:pointer;}
  label{font-size:11px;color:#64748b;display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}
  .btn-p{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s;}
  .btn-p:hover{background:#1d4ed8;}
  .btn-s{background:#fff;color:#374151;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;}
  .btn-s:hover{border-color:#2563eb;color:#2563eb;}
  .btn-d{background:#fff;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:5px 9px;font-size:13px;transition:background 0.15s;}
  .btn-d:hover{background:#fef2f2;}
  .btn-i{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:5px 9px;font-size:13px;color:#64748b;transition:all 0.15s;}
  .btn-i:hover{border-color:#2563eb;color:#2563eb;}
  .btn-g{background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:700;width:100%;transition:background 0.15s;}
  .btn-g:hover{background:#15803d;}
  .btn-gh{background:transparent;color:#2563eb;border:1px solid #bfdbfe;border-radius:8px;padding:11px;font-size:14px;font-weight:600;width:100%;transition:all 0.15s;}
  .btn-gh:hover{background:#eff6ff;}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;}
  .modal-bg{position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px #00000022;}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f1f5f9;}
  .modal-hdr h2{font-size:17px;font-weight:800;}
  .modal-body{padding:20px 24px;}
  .modal-ftr{padding:16px 24px;border-top:1px solid #f1f5f9;display:flex;gap:10px;justify-content:flex-end;}
  .tag{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;}
  .tag::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .nav-top{background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:100;}
  .nav-inner{display:flex;align-items:center;padding:0 20px;height:54px;gap:0;overflow-x:auto;}
  .nav-logo{font-size:17px;font-weight:800;color:#1e293b;margin-right:24px;white-space:nowrap;flex-shrink:0;}
  .nav-logo span{color:#2563eb;}
  .nav-tab{padding:0 14px;height:54px;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:#64748b;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;background:none;border-top:none;border-left:none;border-right:none;transition:all 0.15s;flex-shrink:0;}
  .nav-tab:hover{color:#2563eb;}
  .nav-tab.active{color:#2563eb;border-bottom-color:#2563eb;}
  .nav-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .avatar{width:30px;height:30px;border-radius:50%;background:#eff6ff;color:#2563eb;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;}
  .page{padding:20px 24px;max-width:1200px;margin:0 auto;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
  .page-title{font-size:13px;font-weight:800;color:#64748b;letter-spacing:0.07em;text-transform:uppercase;}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px;}
  .stat-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;border-top:3px solid var(--ac,#2563eb);}
  .stat-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;}
  .stat-val{font-size:22px;font-weight:800;color:#1e293b;}
  table{width:100%;border-collapse:collapse;}
  thead tr{border-bottom:1px solid #f1f5f9;}
  thead th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;}
  tbody tr{border-bottom:1px solid #f8fafc;transition:background 0.1s;}
  tbody tr:last-child{border-bottom:none;}
  tbody tr:hover{background:#f8fafc;}
  tbody td{padding:11px 14px;font-size:13px;color:#374151;}
  .ftabs{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap;}
  .ftab{padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;transition:all 0.15s;}
  .ftab.active{background:#2563eb;color:#fff;border-color:#2563eb;}
  .ftab:hover:not(.active){border-color:#2563eb;color:#2563eb;}
  .sbar{position:relative;margin-bottom:14px;}
  .sbar input{padding-left:34px;}
  .sbar::before{content:'\uD83D\uDD0D';position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;}
  .frow{display:grid;gap:12px;}
  .frow-2{grid-template-columns:1fr 1fr;}
  .frow-3{grid-template-columns:1fr 1fr 1fr;}
  .field{margin-bottom:12px;}
  .os-num{color:#2563eb;font-weight:800;font-size:12px;}
  .auth-wrap{min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:24px;}
  .auth-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:36px 32px;width:100%;max-width:400px;box-shadow:0 4px 24px #0000000e;}
  .auth-logo{text-align:center;margin-bottom:24px;}
  .auth-logo-t{font-size:26px;font-weight:800;}
  .auth-logo-t span{color:#2563eb;}
  .auth-logo-s{font-size:11px;color:#94a3b8;margin-top:2px;letter-spacing:0.08em;text-transform:uppercase;}
  .auth-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;}
  .auth-ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;}
  .auth-lnk{color:#2563eb;background:none;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:'Nunito',sans-serif;}
  .auth-lnk:hover{text-decoration:underline;}
  .eye-btn{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .spinner{width:15px;height:15px;border:2px solid #ffffff55;border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;}
  .trial-bar{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 24px 0;flex-wrap:wrap;}
  .trial-bar.urgent{background:#fef2f2;border-color:#fecaca;}
  .pw-wrap{min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;padding:24px;}
  .pw-card{background:#fff;border:2px solid #22c55e;border-radius:20px;padding:36px;width:100%;max-width:420px;text-align:center;box-shadow:0 8px 32px #22c55e15;}
  @media(max-width:640px){.nav-tab{padding:0 10px;font-size:12px;}.page{padding:14px 16px;}.frow-2,.frow-3{grid-template-columns:1fr;}.auth-card{padding:24px 18px;}}
  @media print{.no-print{display:none!important;}}
`;

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = authAPI.getSession();
    if (s?.user && s?.access_token) {
      setUser(s.user);
      authAPI.getProfile(s.user.id, s.access_token).then(setProfile).catch(() => {}).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const signIn = async (email, password) => {
    const data = await authAPI.signIn(email, password);
    const user = data.user || data;
    if (!user?.id) throw new Error(data.error_description || data.msg || "E-mail ou senha incorretos.");
    authAPI.saveSession({ ...data, user }); setUser(user);
    try { setProfile(await authAPI.getProfile(user.id, data.access_token)); } catch {}
  };
  const signUp = async (e, p, n) => authAPI.signUp(e, p, n);
  const signOut = async () => {
    const s = authAPI.getSession();
    if (s?.access_token) await authAPI.signOut(s.access_token);
    authAPI.clearSession(); setUser(null); setProfile(null);
  };
  const refreshProfile = async () => {
    const s = authAPI.getSession();
    if (s) setProfile(await authAPI.getProfile(s.user.id, s.access_token));
  };
  return (
    <AuthCtx.Provider value={{ user, profile, signIn, signUp, signOut, refreshProfile, resetPassword: authAPI.resetPassword }}>
      {!loading && children}
    </AuthCtx.Provider>
  );
}

function Modal({ onClose, children }) {
  return <div className="modal-bg" onClick={e => e.target===e.currentTarget&&onClose()}><div className="modal">{children}</div></div>;
}

function StatusTag({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.aberta;
  return <span className="tag" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
}

function StatCard({ label, value, accent = "#2563eb" }) {
  return <div className="stat-card" style={{ "--ac": accent }}><div className="stat-label">{label}</div><div className="stat-val">{value}</div></div>;
}

// ── PDF ──────────────────────────────────────────────────────────
function gerarPDF(os, cfg) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${os.numero}</title><style>
    *{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:28px;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px;}
    .emp-nome{font-size:20px;font-weight:800;color:#2563eb;}.emp-info{font-size:11px;color:#64748b;margin-top:3px;line-height:1.6;}
    .os-box{background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:8px 14px;text-align:center;}
    .os-n{font-size:18px;font-weight:800;color:#2563eb;}.os-d{font-size:11px;color:#64748b;}
    .sec{margin-bottom:14px;}.sec-t{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;border-bottom:1px solid #f1f5f9;padding-bottom:3px;}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.fl{font-size:11px;color:#64748b;margin-bottom:2px;}.fv{font-weight:700;}
    .vbox{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;}
    .vn{font-size:22px;font-weight:800;color:#2563eb;}.ass{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:36px;}
    .ass-l{border-top:1px solid #1e293b;padding-top:5px;text-align:center;font-size:11px;color:#64748b;margin-top:36px;}
    .gar{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px;font-size:11px;color:#64748b;line-height:1.6;margin-top:10px;}
    .obs{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:9px 12px;font-size:12px;margin-top:8px;}
  </style></head><body>
  <div class="hdr">
    <div><div class="emp-nome">${cfg.nome}</div><div class="emp-info">${cfg.cnpj?`CNPJ: ${cfg.cnpj}<br>`:""}${cfg.endereco?`${cfg.endereco}${cfg.cidade?` — ${cfg.cidade}`:""}<br>`:""}${cfg.telefone?`Tel: ${cfg.telefone}`:""}${cfg.email?` · ${cfg.email}`:""}</div></div>
    <div class="os-box"><div class="os-n">${os.numero}</div><div class="os-d">${os.data}</div></div>
  </div>
  <div class="sec"><div class="sec-t">Dados do Cliente</div><div class="g2"><div><div class="fl">Nome</div><div class="fv">${os.cliente}</div></div><div><div class="fl">Telefone</div><div class="fv">${os.telefone||"—"}</div></div></div></div>
  <div class="sec"><div class="sec-t">Equipamento</div><div class="g2"><div><div class="fl">Aparelho</div><div class="fv">${os.aparelho}</div></div><div><div class="fl">Técnico</div><div class="fv">${os.tecnico||"—"}</div></div></div><div style="margin-top:8px"><div class="fl">Defeito</div><div class="fv">${os.defeito}</div></div>${os.obs?`<div class="obs"><b>Obs:</b> ${os.obs}</div>`:""}</div>
  <div class="sec"><div class="sec-t">Serviço & Pagamento</div><div class="g2" style="margin-bottom:8px"><div><div class="fl">Status</div><div class="fv">${STATUS_CFG[os.status]?.label||os.status}</div></div><div><div class="fl">Pagamento</div><div class="fv">${os.pagamento||"—"}</div></div></div>
  <div class="vbox"><div><div class="fl">Garantia: ${os.garantia||"90 dias"}</div></div><div><div class="fl">Total</div><div class="vn">${fmt(os.valor)}</div></div></div></div>
  ${cfg.garantia?`<div class="gar"><b>Garantia:</b> ${cfg.garantia}</div>`:""}
  <div class="ass"><div><div class="ass-l">Assinatura do Cliente</div></div><div><div class="ass-l">Assinatura do Técnico</div></div></div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── DADOS MOCK ────────────────────────────────────────────────────
const initOS = [
  { id:1, numero:"OS-0001", cliente:"João Silva",  telefone:"54999991234", aparelho:"iPhone 13",    defeito:"Display quebrado",   tecnico:"Pedro", status:"concluida",    valor:320, pagamento:"Pix",      data:"2026-04-01", garantia:"90 dias", obs:"" },
  { id:2, numero:"OS-0002", cliente:"Maria Souza", telefone:"54988885678", aparelho:"Samsung A54",  defeito:"Não carrega",        tecnico:"Pedro", status:"em_andamento", valor:150, pagamento:"Dinheiro", data:"2026-04-01", garantia:"90 dias", obs:"" },
  { id:3, numero:"OS-0003", cliente:"Pedro Alves", telefone:"54977779012", aparelho:"Motorola G73", defeito:"Câmera travada",     tecnico:"Pedro", status:"aberta",       valor:200, pagamento:"Pix",      data:"2026-04-01", garantia:"90 dias", obs:"" },
];
const initMovs = [
  { id:1, tipo:"receita", categoria:"Serviço", descricao:"Serviço OS OS-0001 — João Silva",   valor:320, pagamento:"Pix",      data:"2026-04-01" },
  { id:2, tipo:"despesa", categoria:"Peças",   descricao:"Compra peças RL Distribuidora",     valor:185, pagamento:"Débito",   data:"2026-04-01" },
  { id:3, tipo:"receita", categoria:"Serviço", descricao:"Serviço OS OS-0002 — Maria Souza",  valor:150, pagamento:"Dinheiro", data:"2026-04-01" },
];
const initClientes = [
  { id:1, nome:"João Silva",  telefone:"54999991234", email:"joao@gmail.com",  cidade:"Vacaria", totalOS:3, ultimaOS:"2026-04-01" },
  { id:2, nome:"Maria Souza", telefone:"54988885678", email:"maria@gmail.com", cidade:"Vacaria", totalOS:1, ultimaOS:"2026-04-01" },
];
const initPecas = [
  { id:1, nome:"Display iPhone 13",          categoria:"Display",   custo:180, venda:290, estoque:3 },
  { id:2, nome:"Bateria iPhone 12 Pro",       categoria:"Bateria",   custo:120, venda:200, estoque:2 },
  { id:3, nome:"Conector carga Motorola G73", categoria:"Conector",  custo:25,  venda:55,  estoque:8 },
  { id:4, nome:"Película 9H universal",       categoria:"Acessório", custo:3,   venda:15,  estoque:0 },
];
const initCfg = { nome:"Minha Assistência Técnica", cnpj:"", telefone:"", email:"", endereco:"", cidade:"", cep:"", tecnico:"", garantia:"A empresa garante o serviço realizado pelo prazo de 90 (noventa) dias contados da data de entrega ao cliente." };


// ── CAMPO GENÉRICO (global para evitar re-render) ─────────────────
function F({ label, field, type = "text", as, opts, form, setForm }) {
  return (
    <div className="field"><label>{label}</label>
      {as === "select"
        ? <select value={form[field] || ""} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}>
            {(opts||[]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        : as === "textarea"
        ? <textarea rows={3} value={form[field] || ""} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder="(opcional)" />
        : <input type={type} value={form[field] || ""} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
      }
    </div>
  );
}

// ── MÓDULO OS ─────────────────────────────────────────────────────
function ModuloOS({ cfg }) {
  const [lista, setLista] = useState(initOS);
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const filtered = lista.filter(o => (filtro==="todas"||o.status===filtro) && (!busca||o.cliente.toLowerCase().includes(busca.toLowerCase())||o.aparelho.toLowerCase().includes(busca.toLowerCase())||o.numero.includes(busca)));

  const nova = () => { setForm({ numero:"OS-"+String(lista.length+1).padStart(4,"0"), cliente:"", telefone:"", aparelho:"", defeito:"", tecnico:cfg.tecnico||"", status:"aberta", valor:"", pagamento:"Pix", data:today(), garantia:"90 dias", obs:"" }); setModal("novo"); };
  const salvar = () => {
    if(!form.cliente||!form.aparelho)return;
    if(modal==="novo") setLista(p=>[...p,{...form,id:uid(),valor:Number(form.valor)||0}]);
    else setLista(p=>p.map(o=>o.id===form.id?{...form,valor:Number(form.valor)||0}:o));
    setModal(null);
  };

  // F global definido fora do componente

  const counts = k => lista.filter(o=>o.status===k).length;

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Ordens de Serviço</div><button className="btn-p" onClick={nova}>+ Nova OS</button></div>
      <div className="stat-grid">
        <StatCard label="Abertas"       value={counts("aberta")}       accent="#2563eb"/>
        <StatCard label="Em Andamento"  value={counts("em_andamento")} accent="#d97706"/>
        <StatCard label="Concluídas"    value={counts("concluida")}    accent="#16a34a"/>
        <StatCard label="Canceladas"    value={counts("cancelada")}    accent="#dc2626"/>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"14px 14px 0"}}>
          <div className="ftabs">
            {[["todas","Todas"],["aberta","Abertas"],["em_andamento","Em Andamento"],["concluida","Concluídas"],["cancelada","Canceladas"]].map(([v,l])=>(
              <button key={v} className={`ftab${filtro===v?" active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="sbar"><input placeholder="Buscar cliente, aparelho, #OS…" value={busca} onChange={e=>setBusca(e.target.value)}/></div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>#OS</th><th>Data</th><th>Cliente</th><th>Fone</th><th>Aparelho</th><th>Defeito</th><th>Técnico</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={10} style={{textAlign:"center",padding:28,color:"#94a3b8"}}>Nenhuma OS encontrada</td></tr>}
              {filtered.map(os=>(
                <tr key={os.id}>
                  <td><span className="os-num">{os.numero}</span></td>
                  <td style={{color:"#64748b"}}>{os.data}</td>
                  <td style={{fontWeight:700}}>{os.cliente}</td>
                  <td style={{color:"#94a3b8",fontSize:12}}>{os.telefone||"—"}</td>
                  <td>{os.aparelho}</td>
                  <td style={{color:"#64748b",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{os.defeito}</td>
                  <td>{os.tecnico}</td>
                  <td><StatusTag status={os.status}/></td>
                  <td style={{fontWeight:700,color:"#16a34a"}}>{fmt(os.valor)}</td>
                  <td><div style={{display:"flex",gap:4}}>
                    <button className="btn-i" onClick={()=>{setForm({...os});setModal("editar");}}>✏️</button>
                    <button className="btn-i" onClick={()=>gerarPDF(os,cfg)} title="Imprimir OS">🖨️</button>
                    <button className="btn-d" onClick={()=>setLista(p=>p.filter(o=>o.id!==os.id))}>✕</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div className="modal-hdr"><h2>{modal==="novo"?"Nova OS":`Editar ${form.numero}`}</h2><button className="btn-s" style={{padding:"5px 10px"}} onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="frow frow-2"><F label="Número OS" field="numero" form={form} setForm={setForm}/><F label="Data" field="data" type="date" form={form} setForm={setForm}/></div>
            <div className="frow frow-2"><F label="Cliente *" field="cliente" form={form} setForm={setForm}/><F label="Telefone" field="telefone" form={form} setForm={setForm}/></div>
            <div className="frow frow-2"><F label="Aparelho *" field="aparelho" form={form} setForm={setForm}/><F label="Técnico" field="tecnico" form={form} setForm={setForm}/></div>
            <F label="Defeito Relatado *" field="defeito" form={form} setForm={setForm}/>
            <div className="frow frow-3">
              <F label="Status" field="status" as="select" opts={Object.entries(STATUS_CFG).map(([v,c])=>({v,l:c.label}))} form={form} setForm={setForm}/>
              <F label="Valor (R$)" field="valor" type="number" form={form} setForm={setForm}/>
              <F label="Pagamento" field="pagamento" as="select" opts={["Pix","Dinheiro","Cartão Débito","Cartão Crédito"].map(v=>({v,l:v}))} form={form} setForm={setForm}/>
            </div>
            <div className="frow frow-2"><F label="Garantia" field="garantia" form={form} setForm={setForm}/><div/></div>
            <F label="Observações" field="obs" as="textarea" form={form} setForm={setForm}/>
          </div>
          <div className="modal-ftr"><button className="btn-s" onClick={()=>setModal(null)}>Cancelar</button><button className="btn-p" onClick={salvar}>Salvar OS</button></div>
        </Modal>
      )}
    </div>
  );
}

// ── MÓDULO FINANCEIRO ─────────────────────────────────────────────
function ModuloFinanceiro() {
  const [movs, setMovs] = useState(initMovs);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo:"receita", categoria:"Serviço", descricao:"", valor:"", pagamento:"Pix", data:today() });

  const filtered = movs.filter(m => (filtro==="todos"||m.tipo===filtro)&&(!busca||m.descricao.toLowerCase().includes(busca.toLowerCase())));
  const rec = movs.filter(m=>m.tipo==="receita").reduce((s,m)=>s+m.valor,0);
  const des = movs.filter(m=>m.tipo==="despesa").reduce((s,m)=>s+m.valor,0);
  const cats = { receita:["Serviço","Venda","Outros"], despesa:["Peças","Fornecedor","Marketing","Aluguel","Outros"] };

  const salvar = () => {
    if(!form.descricao||!form.valor)return;
    setMovs(p=>[...p,{...form,id:uid(),valor:Number(form.valor)}]);
    setModal(false);
    setForm({tipo:"receita",categoria:"Serviço",descricao:"",valor:"",pagamento:"Pix",data:today()});
  };

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Financeiro</div><button className="btn-p" onClick={()=>setModal(true)}>+ Lançamento</button></div>
      <div className="stat-grid">
        <StatCard label="Receita (período)" value={fmt(rec)} accent="#16a34a"/>
        <StatCard label="Despesas (período)" value={fmt(des)} accent="#dc2626"/>
        <StatCard label="Saldo" value={fmt(rec-des)} accent={rec-des>=0?"#16a34a":"#dc2626"}/>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"14px 14px 0"}}>
          <div className="ftabs">
            {[["todos","Todos"],["receita","Receitas"],["despesa","Despesas"]].map(([v,l])=>(
              <button key={v} className={`ftab${filtro===v?" active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
            ))}
          </div>
          <div className="sbar"><input placeholder="Buscar descrição…" value={busca} onChange={e=>setBusca(e.target.value)}/></div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Pgto</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            {[...filtered].reverse().map(m=>(
              <tr key={m.id}>
                <td style={{color:"#64748b"}}>{m.data}</td>
                <td><span className="tag" style={{background:m.tipo==="receita"?"#f0fdf4":"#fef2f2",color:m.tipo==="receita"?"#16a34a":"#dc2626"}}>{m.tipo==="receita"?"Receita":"Despesa"}</span></td>
                <td style={{color:"#64748b"}}>{m.categoria}</td>
                <td style={{color:"#64748b"}}>{m.pagamento}</td>
                <td>{m.descricao}</td>
                <td style={{fontWeight:700,color:m.tipo==="receita"?"#16a34a":"#dc2626"}}>{m.tipo==="despesa"?"− ":"+ "}{fmt(m.valor)}</td>
                <td><button className="btn-d" onClick={()=>setMovs(p=>p.filter(x=>x.id!==m.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(false)}>
          <div className="modal-hdr"><h2>Novo Lançamento</h2><button className="btn-s" style={{padding:"5px 10px"}} onClick={()=>setModal(false)}>✕</button></div>
          <div className="modal-body">
            <div className="field"><label>Tipo</label>
              <div style={{display:"flex",gap:8}}>
                {["receita","despesa"].map(t=>(
                  <button key={t} onClick={()=>setForm(p=>({...p,tipo:t,categoria:t==="receita"?"Serviço":"Peças"}))}
                    style={{flex:1,padding:"9px",border:"1px solid",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Nunito",transition:"all 0.15s",
                      borderColor:form.tipo===t?(t==="receita"?"#16a34a":"#dc2626"):"#e2e8f0",
                      background:form.tipo===t?(t==="receita"?"#f0fdf4":"#fef2f2"):"#fff",
                      color:form.tipo===t?(t==="receita"?"#16a34a":"#dc2626"):"#64748b"}}>
                    {t==="receita"?"↑ Receita":"↓ Despesa"}
                  </button>
                ))}
              </div>
            </div>
            <div className="frow frow-2">
              <div className="field"><label>Categoria</label><select value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}>{(cats[form.tipo]||[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div className="field"><label>Pagamento</label><select value={form.pagamento} onChange={e=>setForm(p=>({...p,pagamento:e.target.value}))}>{["Pix","Dinheiro","Cartão Débito","Cartão Crédito"].map(v=><option key={v} value={v}>{v}</option>)}</select></div>
            </div>
            <div className="field"><label>Descrição *</label><input value={form.descricao} onChange={e=>setForm(p=>({...p,descricao:e.target.value}))} placeholder="Ex: Serviço OS OS-0001"/></div>
            <div className="frow frow-2">
              <div className="field"><label>Valor (R$) *</label><input type="number" value={form.valor} onChange={e=>setForm(p=>({...p,valor:e.target.value}))}/></div>
              <div className="field"><label>Data</label><input type="date" value={form.data} onChange={e=>setForm(p=>({...p,data:e.target.value}))}/></div>
            </div>
          </div>
          <div className="modal-ftr"><button className="btn-s" onClick={()=>setModal(false)}>Cancelar</button><button className="btn-p" onClick={salvar}>Salvar</button></div>
        </Modal>
      )}
    </div>
  );
}

// ── MÓDULO CLIENTES ───────────────────────────────────────────────
function ModuloClientes() {
  const [clientes, setClientes] = useState(initClientes);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const filtered = clientes.filter(c=>!busca||c.nome.toLowerCase().includes(busca.toLowerCase())||c.telefone.includes(busca));
  const salvar = () => {
    if(!form.nome)return;
    if(modal==="novo") setClientes(p=>[...p,{...form,id:uid(),totalOS:0,ultimaOS:"—"}]);
    else setClientes(p=>p.map(c=>c.id===form.id?form:c));
    setModal(null);
  };
  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Clientes</div><button className="btn-p" onClick={()=>{setForm({nome:"",telefone:"",email:"",cidade:""});setModal("novo");}}>+ Novo Cliente</button></div>
      <div className="stat-grid"><StatCard label="Total de Clientes" value={clientes.length}/></div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"14px 14px 0"}}><div className="sbar"><input placeholder="Buscar cliente ou telefone…" value={busca} onChange={e=>setBusca(e.target.value)}/></div></div>
        <table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th>OS</th><th>Última OS</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map(c=>(
              <tr key={c.id}>
                <td style={{fontWeight:700}}>{c.nome}</td>
                <td>{c.telefone}</td>
                <td style={{color:"#64748b"}}>{c.email||"—"}</td>
                <td style={{color:"#64748b"}}>{c.cidade||"—"}</td>
                <td><span style={{background:"#eff6ff",color:"#2563eb",borderRadius:999,padding:"2px 9px",fontWeight:700,fontSize:12}}>{c.totalOS}</span></td>
                <td style={{color:"#64748b"}}>{c.ultimaOS}</td>
                <td><div style={{display:"flex",gap:4}}><button className="btn-i" onClick={()=>{setForm({...c});setModal("editar");}}>✏️</button><button className="btn-d" onClick={()=>setClientes(p=>p.filter(x=>x.id!==c.id))}>✕</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div className="modal-hdr"><h2>{modal==="novo"?"Novo Cliente":"Editar Cliente"}</h2><button className="btn-s" style={{padding:"5px 10px"}} onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="field"><label>Nome *</label><input value={form.nome||""} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/></div>
            <div className="frow frow-2">
              <div className="field"><label>Telefone</label><input value={form.telefone||""} onChange={e=>setForm(p=>({...p,telefone:e.target.value}))}/></div>
              <div className="field"><label>E-mail</label><input type="email" value={form.email||""} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Cidade</label><input value={form.cidade||""} onChange={e=>setForm(p=>({...p,cidade:e.target.value}))}/></div>
          </div>
          <div className="modal-ftr"><button className="btn-s" onClick={()=>setModal(null)}>Cancelar</button><button className="btn-p" onClick={salvar}>Salvar</button></div>
        </Modal>
      )}
    </div>
  );
}

// ── MÓDULO CATÁLOGO ───────────────────────────────────────────────
function ModuloCatalogo() {
  const [pecas, setPecas] = useState(initPecas);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const filtered = pecas.filter(p=>!busca||p.nome.toLowerCase().includes(busca.toLowerCase())||p.categoria.toLowerCase().includes(busca.toLowerCase()));
  const salvar = () => {
    if(!form.nome)return;
    const item={...form,custo:Number(form.custo)||0,venda:Number(form.venda)||0,estoque:Number(form.estoque)||0};
    if(modal==="novo") setPecas(p=>[...p,{...item,id:uid()}]);
    else setPecas(p=>p.map(x=>x.id===item.id?item:x));
    setModal(null);
  };
  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Catálogo de Peças</div><button className="btn-p" onClick={()=>{setForm({nome:"",categoria:"",custo:"",venda:"",estoque:""});setModal("novo");}}>+ Nova Peça</button></div>
      <div className="stat-grid">
        <StatCard label="Total de Itens" value={pecas.length}/>
        <StatCard label="Valor em Estoque" value={fmt(pecas.reduce((s,p)=>s+p.custo*p.estoque,0))} accent="#d97706"/>
        <StatCard label="Sem Estoque" value={pecas.filter(p=>p.estoque===0).length} accent="#dc2626"/>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"14px 14px 0"}}><div className="sbar"><input placeholder="Buscar peça…" value={busca} onChange={e=>setBusca(e.target.value)}/></div></div>
        <table>
          <thead><tr><th>Peça</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Margem</th><th>Estoque</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map(p=>{
              const m=p.custo>0?Math.round(((p.venda-p.custo)/p.custo)*100):0;
              return (
                <tr key={p.id}>
                  <td style={{fontWeight:700}}>{p.nome}</td>
                  <td><span style={{background:"#eff6ff",color:"#2563eb",borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:700}}>{p.categoria}</span></td>
                  <td style={{color:"#64748b"}}>{fmt(p.custo)}</td>
                  <td style={{fontWeight:700,color:"#16a34a"}}>{fmt(p.venda)}</td>
                  <td><span style={{fontWeight:700,color:m>=50?"#16a34a":m>=20?"#d97706":"#dc2626"}}>{m}%</span></td>
                  <td><span style={{fontWeight:700,color:p.estoque===0?"#dc2626":p.estoque<=2?"#d97706":"#1e293b"}}>{p.estoque===0?"⚠ Sem estoque":p.estoque+" un."}</span></td>
                  <td><div style={{display:"flex",gap:4}}><button className="btn-i" onClick={()=>{setForm({...p});setModal("editar");}}>✏️</button><button className="btn-d" onClick={()=>setPecas(x=>x.filter(i=>i.id!==p.id))}>✕</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div className="modal-hdr"><h2>{modal==="novo"?"Nova Peça":"Editar Peça"}</h2><button className="btn-s" style={{padding:"5px 10px"}} onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="field"><label>Nome *</label><input value={form.nome||""} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/></div>
            <div className="field"><label>Categoria</label><select value={form.categoria||""} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}><option value="">Selecionar…</option>{["Display","Bateria","Conector","Acessório","Outro"].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="frow frow-3">
              <div className="field"><label>Custo (R$)</label><input type="number" value={form.custo||""} onChange={e=>setForm(p=>({...p,custo:e.target.value}))}/></div>
              <div className="field"><label>Venda (R$)</label><input type="number" value={form.venda||""} onChange={e=>setForm(p=>({...p,venda:e.target.value}))}/></div>
              <div className="field"><label>Estoque</label><input type="number" value={form.estoque||""} onChange={e=>setForm(p=>({...p,estoque:e.target.value}))}/></div>
            </div>
          </div>
          <div className="modal-ftr"><button className="btn-s" onClick={()=>setModal(null)}>Cancelar</button><button className="btn-p" onClick={salvar}>Salvar</button></div>
        </Modal>
      )}
    </div>
  );
}

// ── MÓDULO CONFIG ─────────────────────────────────────────────────
function ModuloConfig({ cfg, setCfg }) {
  const [form, setForm] = useState(cfg);
  const [saved, setSaved] = useState(false);
  const salvar = () => { setCfg(form); setSaved(true); setTimeout(()=>setSaved(false),2000); };
  // F global definido fora do componente
  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Configurações da Empresa</div><button className="btn-p" onClick={salvar}>{saved?"✓ Salvo!":"Salvar Configurações"}</button></div>
      <div className="card" style={{padding:22,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:14,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Identidade Visual</div>
        <div className="frow frow-2"><F label="Nome da Empresa" field="nome" form={form} setForm={setForm}/><F label="Técnico Padrão" field="tecnico" form={form} setForm={setForm}/></div>
      </div>
      <div className="card" style={{padding:22,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:14,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Dados Fiscais e Contato</div>
        <div className="frow frow-2"><F label="CNPJ" field="cnpj" form={form} setForm={setForm}/><F label="Telefone" field="telefone" form={form} setForm={setForm}/></div>
        <div className="frow frow-2"><F label="E-mail" field="email" form={form} setForm={setForm}/><F label="CEP" field="cep" form={form} setForm={setForm}/></div>
        <F label="Endereço Completo" field="endereco" form={form} setForm={setForm}/>
        <div className="frow frow-2"><F label="Cidade / Estado" field="cidade" form={form} setForm={setForm}/><div/></div>
      </div>
      <div className="card" style={{padding:22}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:4,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em"}}>Termos de Garantia (aparece no PDF)</div>
        <p style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>Este texto aparece no rodapé da OS impressa.</p>
        <F label="" field="garantia" as="textarea" form={form} setForm={setForm}/>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function Dashboard() {
  const rec = initMovs.filter(m=>m.tipo==="receita").reduce((s,m)=>s+m.valor,0);
  const des = initMovs.filter(m=>m.tipo==="despesa").reduce((s,m)=>s+m.valor,0);
  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Dashboard</div></div>
      <div className="stat-grid">
        <StatCard label="OS Abertas"     value={initOS.filter(o=>o.status==="aberta").length}       accent="#2563eb"/>
        <StatCard label="Em Andamento"   value={initOS.filter(o=>o.status==="em_andamento").length}  accent="#d97706"/>
        <StatCard label="Receita (mês)"  value={fmt(rec)}   accent="#16a34a"/>
        <StatCard label="Despesas (mês)" value={fmt(des)}   accent="#dc2626"/>
        <StatCard label="Lucro (mês)"    value={fmt(rec-des)} accent={rec-des>=0?"#16a34a":"#dc2626"}/>
        <StatCard label="Clientes"       value={initClientes.length} accent="#7c3aed"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:"1px solid #f1f5f9",fontWeight:800,fontSize:14}}>OS Abertas & Em Andamento</div>
          {initOS.filter(o=>o.status!=="concluida"&&o.status!=="cancelada").map(os=>(
            <div key={os.id} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:700}}>{os.cliente}</div><div style={{fontSize:12,color:"#94a3b8"}}>{os.aparelho} · <span className="os-num">{os.numero}</span></div></div>
              <StatusTag status={os.status}/>
            </div>
          ))}
          {initOS.filter(o=>o.status!=="concluida"&&o.status!=="cancelada").length===0&&<div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:13}}>Nenhuma OS aberta ✓</div>}
        </div>
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:"1px solid #f1f5f9",fontWeight:800,fontSize:14}}>Últimos Lançamentos</div>
          {[...initMovs].reverse().slice(0,5).map(m=>(
            <div key={m.id} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>{m.tipo==="receita"?"↑":"↓"}</span>
              <div style={{flex:1}}><div style={{fontSize:13}}>{m.descricao}</div><div style={{fontSize:11,color:"#94a3b8"}}>{m.data}</div></div>
              <span style={{fontWeight:800,color:m.tipo==="receita"?"#16a34a":"#dc2626"}}>{m.tipo==="despesa"?"− ":"+ "}{fmt(m.valor)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AUTH SCREENS ──────────────────────────────────────────────────
function Login({ onSwitch }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false); const [loading, setLoading] = useState(false); const [erro, setErro] = useState("");
  const submit = async () => {
    setErro(""); if(!email||!senha){setErro("Preencha todos os campos.");return;}
    setLoading(true); try{await signIn(email,senha);}catch(e){setErro(e.message);} setLoading(false);
  };
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="auth-logo-t"><span>Gestão</span>Bancada</div><div className="auth-logo-s">Assistência Técnica</div></div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Entrar</div>
      <div style={{color:"#64748b",fontSize:13,marginBottom:20}}>Acesse sua conta.</div>
      {erro&&<div className="auth-err">{erro}</div>}
      <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <div className="field"><label>Senha</label><div style={{position:"relative"}}><input type={show?"text":"password"} placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{paddingRight:38}}/><button className="eye-btn" onClick={()=>setShow(p=>!p)}>{show?"🙈":"👁️"}</button></div></div>
      <div style={{textAlign:"right",marginBottom:14,marginTop:-6}}><button className="auth-lnk" onClick={()=>onSwitch("recover")}>Esqueci a senha</button></div>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={submit} disabled={loading}>
        {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Entrando…</span>:"Entrar"}
      </button>
      <p style={{textAlign:"center",marginTop:18,fontSize:13,color:"#64748b"}}>Não tem conta? <button className="auth-lnk" onClick={()=>onSwitch("register")}>Criar conta grátis</button></p>
    </div></div>
  );
}

function Register({ onSwitch }) {
  const { signUp } = useAuth();
  const [nome,setNome]=useState(""); const [email,setEmail]=useState(""); const [senha,setSenha]=useState(""); const [conf,setConf]=useState("");
  const [show,setShow]=useState(false); const [loading,setLoading]=useState(false); const [erro,setErro]=useState(""); const [ok,setOk]=useState(false);
  const submit = async () => {
    setErro(""); if(!nome||!email||!senha||!conf){setErro("Preencha todos os campos.");return;}
    if(senha!==conf){setErro("As senhas não coincidem.");return;} if(senha.length<6){setErro("Senha deve ter ao menos 6 caracteres.");return;}
    setLoading(true); try{await signUp(email,senha,nome);setOk(true);}catch(e){setErro(e.message.includes("already registered")?"E-mail já cadastrado.":e.message);} setLoading(false);
  };
  if(ok) return (
    <div className="auth-wrap"><div className="auth-card" style={{textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:12}}>🎉</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>Conta criada!</div>
      <p style={{color:"#64748b",fontSize:13,marginBottom:22}}>Faça login para começar seus 7 dias grátis.</p>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={()=>onSwitch("login")}>Ir para o login →</button>
    </div></div>
  );
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="auth-logo-t"><span>Gestão</span>Bancada</div></div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Criar conta grátis</div>
      <div className="auth-ok" style={{fontSize:12}}>✅ 7 dias grátis · Sem cartão · R$37/mês depois</div>
      {erro&&<div className="auth-err">{erro}</div>}
      <div className="field"><label>Nome da Assistência</label><input placeholder="Ex: TechFix Vacaria" value={nome} onChange={e=>setNome(e.target.value)}/></div>
      <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="field"><label>Senha</label><div style={{position:"relative"}}><input type={show?"text":"password"} placeholder="Mínimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} style={{paddingRight:38}}/><button className="eye-btn" onClick={()=>setShow(p=>!p)}>{show?"🙈":"👁️"}</button></div></div>
      <div className="field"><label>Confirmar Senha</label><input type={show?"text":"password"} placeholder="Repita a senha" value={conf} onChange={e=>setConf(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px",marginTop:4}} onClick={submit} disabled={loading}>
        {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Criando…</span>:"Criar conta →"}
      </button>
      <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#64748b"}}>Já tem conta? <button className="auth-lnk" onClick={()=>onSwitch("login")}>Entrar</button></p>
    </div></div>
  );
}

function Recover({ onSwitch }) {
  const { resetPassword } = useAuth();
  const [email,setEmail]=useState(""); const [loading,setLoading]=useState(false); const [ok,setOk]=useState(false); const [erro,setErro]=useState("");
  const submit = async () => { if(!email){setErro("Digite seu e-mail.");return;} setLoading(true); try{await resetPassword(email);setOk(true);}catch(e){setErro(e.message);} setLoading(false); };
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="auth-logo-t"><span>Gestão</span>Bancada</div></div>
      {!ok?<>
        <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Recuperar senha</div>
        <div style={{color:"#64748b",fontSize:13,marginBottom:18}}>Enviaremos um link para redefinir.</div>
        {erro&&<div className="auth-err">{erro}</div>}
        <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={submit} disabled={loading}>
          {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Enviando…</span>:"Enviar link"}
        </button>
      </>:<div style={{textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:12}}>✉️</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Link enviado!</div>
        <p style={{color:"#64748b",fontSize:13}}>Verifique sua caixa de entrada.</p>
      </div>}
      <p style={{textAlign:"center",marginTop:20,fontSize:13,color:"#64748b"}}><button className="auth-lnk" onClick={()=>onSwitch("login")}>← Voltar ao login</button></p>
    </div></div>
  );
}

function Paywall({ onSignOut, onRefresh }) {
  const { user, profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const nome = profile?.nome || user?.email;
  return (
    <div className="pw-wrap"><div style={{width:"100%",maxWidth:420}}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:20,fontWeight:800}}><span style={{color:"#2563eb"}}>Gestão</span>Bancada</div></div>
      <div className="pw-card">
        <div style={{fontSize:42,marginBottom:10}}>🔒</div>
        <div style={{fontSize:20,fontWeight:800,marginBottom:6}}>Trial encerrado</div>
        <p style={{color:"#64748b",fontSize:13,marginBottom:22,lineHeight:1.6}}>Seus 7 dias gratuitos acabaram, <strong style={{color:"#1e293b"}}>{nome}</strong>.<br/>Assine para continuar.</p>
        <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"14px 18px",marginBottom:18,textAlign:"left"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontWeight:800,fontSize:14}}>Plano GestãoBancada</div><div style={{color:"#64748b",fontSize:12}}>Cancele quando quiser</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:"#16a34a"}}>R$37</div><div style={{color:"#94a3b8",fontSize:11}}>/mês</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {["OS ilimitadas","Controle de caixa","Catálogo de peças","Suporte WhatsApp"].map(i=>(
              <div key={i} style={{fontSize:12,color:"#374151",display:"flex",alignItems:"center",gap:5}}><span style={{color:"#16a34a",fontWeight:700}}>✓</span>{i}</div>
            ))}
          </div>
        </div>
        <button className="btn-g" onClick={()=>window.open(`${CAKTO_LINK}?email=${encodeURIComponent(user.email)}`,"_blank")} style={{marginBottom:8}}>Assinar agora por R$37/mês →</button>
        <button className="btn-gh" onClick={async()=>{setChecking(true);await onRefresh();setTimeout(()=>setChecking(false),1500);}} disabled={checking}>
          {checking?"Verificando…":"Já paguei — verificar acesso"}
        </button>
        <p style={{marginTop:14,fontSize:12,color:"#94a3b8"}}>{user?.email} · <button className="auth-lnk" style={{fontSize:12,color:"#94a3b8"}} onClick={onSignOut}>Sair</button></p>
      </div>
    </div></div>
  );
}

// ── APP MAIN ──────────────────────────────────────────────────────
const MENU = [
  {key:"dashboard",label:"Dashboard",icon:"📊"},
  {key:"os",label:"O.S.",icon:"🔧"},
  {key:"clientes",label:"Clientes",icon:"👥"},
  {key:"financeiro",label:"Financeiro",icon:"💰"},
  {key:"catalogo",label:"Catálogo",icon:"📦"},
  {key:"config",label:"Config",icon:"⚙️"},
];

function AppMain({ accessStatus }) {
  const { user, profile, signOut } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [cfg, setCfg] = useState(initCfg);
  const nome = profile?.nome || user?.email;
  const isTrial = accessStatus?.status === "trial";
  return (
    <>
      <nav className="nav-top no-print">
        <div className="nav-inner">
          <div className="nav-logo"><span>Gestão</span>Bancada</div>
          {MENU.map(m=>(
            <button key={m.key} className={`nav-tab${page===m.key?" active":""}`} onClick={()=>setPage(m.key)}>{m.icon} {m.label}</button>
          ))}
          <div className="nav-right">
            {isTrial&&<span style={{fontSize:12,fontWeight:700,color:accessStatus.diasRestantes<=2?"#dc2626":"#92400e",background:accessStatus.diasRestantes<=2?"#fef2f2":"#fffbeb",border:`1px solid ${accessStatus.diasRestantes<=2?"#fecaca":"#fde68a"}`,borderRadius:999,padding:"3px 10px"}}>⏳ {accessStatus.diasRestantes}d</span>}
            <div className="avatar">{(nome||"U")[0].toUpperCase()}</div>
            <button className="btn-s" style={{padding:"5px 12px",fontSize:13}} onClick={signOut}>Sair</button>
          </div>
        </div>
      </nav>
      {isTrial&&(
        <div className={`trial-bar no-print${accessStatus.diasRestantes<=2?" urgent":""}`}>
          <span style={{fontSize:13,fontWeight:700,color:accessStatus.diasRestantes<=2?"#dc2626":"#92400e"}}>
            {accessStatus.diasRestantes<=2?"⚠️":"⏳"} {accessStatus.diasRestantes} {accessStatus.diasRestantes===1?"dia":"dias"} restantes no trial.
          </span>
          <a href={CAKTO_LINK} target="_blank" rel="noreferrer" style={{background:"#16a34a",color:"#fff",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,textDecoration:"none"}}>Assinar R$37/mês</a>
        </div>
      )}
      {page==="dashboard"  && <Dashboard/>}
      {page==="os"         && <ModuloOS cfg={cfg}/>}
      {page==="clientes"   && <ModuloClientes/>}
      {page==="financeiro" && <ModuloFinanceiro/>}
      {page==="catalogo"   && <ModuloCatalogo/>}
      {page==="config"     && <ModuloConfig cfg={cfg} setCfg={setCfg}/>}
    </>
  );
}

function Router() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [screen, setScreen] = useState("login");
  if (!user) return (
    <>
      {screen==="login"    && <Login    onSwitch={setScreen}/>}
      {screen==="register" && <Register onSwitch={setScreen}/>}
      {screen==="recover"  && <Recover  onSwitch={setScreen}/>}
    </>
  );
  const access = getAccessStatus(profile);
  if (access==="expired"||access==="blocked") return <Paywall onSignOut={signOut} onRefresh={refreshProfile}/>;
  return <AppMain accessStatus={access}/>;
}

export default function App() {
  return <><style>{CSS}</style><AuthProvider><Router/></AuthProvider></>;
}
