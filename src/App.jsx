import './App.css'
import { useState, useEffect, createContext, useContext } from "react";

// ── META PIXEL ────────────────────────────────────────────────────
(function() {
  if (typeof window === 'undefined') return;
  const f = window; const b = document; const e = 'script';
  const v = 'https://connect.facebook.net/en_US/fbevents.js';
  if (f.fbq) return;
  const n = f.fbq = function() { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  const t = b.createElement(e); t.async = true; t.src = v;
  const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  window.fbq('init', '1496783104686899');
  window.fbq('track', 'PageView');
})();



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
      const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
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

const fmt = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_CFG = {
  aberta:       { label: "Aberta",        color: "#2563eb", bg: "#eff6ff" },
  em_andamento: { label: "Em Andamento",  color: "#d97706", bg: "#fffbeb" },
  concluida:    { label: "Concluída",     color: "#16a34a", bg: "#f0fdf4" },
  cancelada:    { label: "Cancelada",     color: "#dc2626", bg: "#fef2f2" },
};


// ══════════════════════════════════════════════════════════════════
// DB API — CRUD no Supabase
// ══════════════════════════════════════════════════════════════════
function getToken() {
  try { return JSON.parse(localStorage.getItem("gb_session"))?.access_token; } catch { return null; }
}

const db = {
  async list(table, userId) {
    const token = getToken();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}&order=created_at.desc`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    });
    return res.json();
  },
  async insert(table, data) {
    const token = getToken();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    const r = await res.json();
    return Array.isArray(r) ? r[0] : r;
  },
  async update(table, id, data) {
    const token = getToken();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    const r = await res.json();
    return Array.isArray(r) ? r[0] : r;
  },
  async delete(table, id) {
    const token = getToken();
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    });
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;}
  body{background:#0a0e1a;color:#e2e8f0;font-family:'Nunito',sans-serif;font-size:14px;}
  ::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px;}
  input,select,textarea{background:#1a2236;border:1px solid #2d3748;border-radius:8px;color:#e2e8f0;padding:8px 12px;font-family:'Nunito',sans-serif;font-size:14px;width:100%;outline:none;transition:border-color 0.2s;}
  input:focus,select:focus,textarea:focus{border-color:#1A6BFF;box-shadow:0 0 0 3px #1A6BFF18;}
  input::placeholder,textarea::placeholder{color:#94a3b8;}
  select option{background:#1a2236;color:#e2e8f0;}
  button{font-family:'Nunito',sans-serif;cursor:pointer;}
  label{font-size:11px;color:#94a3b8;display:block;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}
  .btn-p{background:#1A6BFF;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s;}
  .btn-p:hover{background:#155ee0;}
  .btn-s{background:#1a2236;color:#e2e8f0;border:1px solid #2d3748;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;}
  .btn-s:hover{border-color:#1A6BFF;color:#1A6BFF;}
  .btn-d{background:#1a2236;color:#f87171;border:1px solid #3d1515;border-radius:6px;padding:5px 9px;font-size:13px;transition:background 0.15s;}
  .btn-d:hover{background:#2d1515;}
  .btn-i{background:#1a2236;border:1px solid #2d3748;border-radius:6px;padding:5px 9px;font-size:13px;color:#94a3b8;transition:all 0.15s;}
  .btn-i:hover{border-color:#1A6BFF;color:#1A6BFF;}
  .btn-g{background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:700;width:100%;transition:background 0.15s;}
  .btn-g:hover{background:#15803d;}
  .btn-gh{background:transparent;color:#1A6BFF;border:1px solid #1A6BFF44;border-radius:8px;padding:11px;font-size:14px;font-weight:600;width:100%;transition:all 0.15s;}
  .btn-gh:hover{background:#1A6BFF11;}
  .card{background:#111827;border:1px solid #1e2738;border-radius:12px;}
  .modal-bg{position:fixed;inset:0;background:#00000099;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
  .modal{background:#111827;border:1px solid #1e2738;border-radius:16px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px #00000066;}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #1e2738;}
  .modal-hdr h2{font-size:17px;font-weight:800;color:#e2e8f0;}
  .modal-body{padding:20px 24px;}
  .modal-ftr{padding:16px 24px;border-top:1px solid #1e2738;display:flex;gap:10px;justify-content:flex-end;}
  .tag{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;}
  .tag::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .nav-top{background:#0d1117;border-bottom:1px solid #1e2738;position:sticky;top:0;z-index:100;}
  .nav-inner{display:flex;align-items:center;padding:0 20px;height:54px;gap:0;overflow-x:auto;}
  .nav-logo{font-size:17px;font-weight:800;color:#e2e8f0;margin-right:24px;white-space:nowrap;flex-shrink:0;}
  .nav-logo span{color:#1A6BFF;}
  .nav-tab{padding:0 14px;height:54px;display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:#94a3b8;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;background:none;border-top:none;border-left:none;border-right:none;transition:all 0.15s;flex-shrink:0;}
  .nav-tab:hover{color:#1A6BFF;}
  .nav-tab.active{color:#1A6BFF;border-bottom-color:#1A6BFF;}
  .nav-right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-shrink:0;}
  .avatar{width:30px;height:30px;border-radius:50%;background:#1a2236;color:#1A6BFF;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;}
  .page{padding:20px 24px;max-width:1400px;margin:0 auto;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
  .page-title{font-size:13px;font-weight:800;color:#94a3b8;letter-spacing:0.07em;text-transform:uppercase;}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px;}
  .stat-card{background:#111827;border:1px solid #1e2738;border-radius:10px;padding:14px 18px;border-top:3px solid var(--ac,#1A6BFF);}
  .stat-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;}
  .stat-val{font-size:22px;font-weight:800;color:#e2e8f0;}
  table{width:100%;border-collapse:collapse;}
  thead tr{border-bottom:1px solid #1e2738;}
  thead th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;}
  tbody tr{border-bottom:1px solid #0d1117;transition:background 0.1s;}
  tbody tr:last-child{border-bottom:none;}
  tbody tr:hover{background:#1a2236;}
  tbody td{padding:11px 14px;font-size:13px;color:#e2e8f0;}
  .ftabs{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap;}
  .ftab{padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #2d3748;background:#1a2236;color:#94a3b8;cursor:pointer;transition:all 0.15s;}
  .ftab.active{background:#1A6BFF;color:#fff;border-color:#1A6BFF;}
  .ftab:hover:not(.active){border-color:#1A6BFF;color:#1A6BFF;}
  .sbar{position:relative;margin-bottom:14px;}
  .sbar input{padding-left:34px;}
  .sbar::before{content:'🔍';position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;}
  .frow{display:grid;gap:12px;}
  .frow-2{grid-template-columns:1fr 1fr;}
  .frow-3{grid-template-columns:1fr 1fr 1fr;}
  .field{margin-bottom:12px;}
  .os-num{color:#1A6BFF;font-weight:800;font-size:12px;}
  .auth-wrap{min-height:100vh;background:#0a0e1a;display:flex;align-items:center;justify-content:center;padding:24px;}
  .auth-card{background:#111827;border:1px solid #1e2738;border-radius:20px;padding:36px 32px;width:100%;max-width:400px;box-shadow:0 4px 24px #00000044;}
  .auth-logo{text-align:center;margin-bottom:24px;}
  .auth-logo-t{font-size:26px;font-weight:800;color:#e2e8f0;}
  .auth-logo-t span{color:#1A6BFF;}
  .auth-logo-s{font-size:11px;color:#94a3b8;margin-top:2px;letter-spacing:0.08em;text-transform:uppercase;}
  .auth-err{background:#2d1515;border:1px solid #3d1515;color:#f87171;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;}
  .auth-ok{background:#0d2d1a;border:1px solid #16a34a44;color:#4ade80;border-radius:8px;padding:9px 13px;font-size:13px;margin-bottom:14px;}
  .auth-lnk{color:#1A6BFF;background:none;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:'Nunito',sans-serif;}
  .auth-lnk:hover{text-decoration:underline;}
  .eye-btn{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .spinner{width:15px;height:15px;border:2px solid #ffffff33;border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;}
  .trial-bar{background:#1a1a0d;border:1px solid #fde68a44;border-radius:10px;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 24px 0;flex-wrap:wrap;}
  .trial-bar.urgent{background:#1a0d0d;border-color:#fecaca44;}
  .pw-wrap{min-height:100vh;background:#0a0e1a;display:flex;align-items:center;justify-content:center;padding:24px;}
  .pw-card{background:#111827;border:2px solid #22c55e;border-radius:20px;padding:36px;width:100%;max-width:420px;text-align:center;box-shadow:0 8px 32px #22c55e15;}
  .kanban-col{background:#111827;border:1px solid #1e2738;border-radius:12px;overflow:hidden;min-height:300px;display:flex;flex-direction:column;}
  .kanban-col.drag-over{border-color:#1A6BFF;background:#111827ee;}
  .kanban-card{background:#1a2236;border:1px solid #2d3748;border-radius:8px;padding:10px 12px;cursor:grab;user-select:none;transition:opacity 0.15s,box-shadow 0.15s;}
  .kanban-card:active{cursor:grabbing;}
  .kanban-card.dragging{opacity:0.4;}
  .dash-panels{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .kanban-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .kanban-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start;}
  .produtos-top{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
  @media(max-width:640px){
    .nav-tab-label{display:none;}
    .nav-tab{padding:0 10px;font-size:17px;}
    .nav-logo{font-size:14px;margin-right:12px;}
    .page{padding:14px 14px;}
    .frow-2,.frow-3{grid-template-columns:1fr;}
    .auth-card{padding:24px 18px;}
    .modal{border-radius:12px 12px 0 0;position:fixed;bottom:0;left:0;right:0;max-width:100%;max-height:92vh;margin:0;}
    .modal-bg{align-items:flex-end;padding:0;}
    .modal-hdr,.modal-ftr{padding:14px 16px;}
    .modal-body{padding:14px 16px;}
    .stat-grid{grid-template-columns:1fr 1fr;}
    .dash-panels{grid-template-columns:1fr!important;}
    .kanban-grid{grid-template-columns:repeat(4,minmax(220px,1fr))!important;}
    .produtos-top{grid-template-columns:1fr!important;}
    .trial-bar{margin:8px 14px 0;}
  }
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

function StatCard({ label, value, accent = "#1A6BFF" }) {
  return <div className="stat-card" style={{ "--ac": accent }}><div className="stat-label">{label}</div><div className="stat-val">{value}</div></div>;
}

// ── PDF ──────────────────────────────────────────────────────────
function gerarPDF(os, cfg) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${os.numero}</title><style>
    *{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:28px;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1A6BFF;padding-bottom:14px;margin-bottom:18px;}
    .emp-nome{font-size:20px;font-weight:800;color:#1A6BFF;}.emp-info{font-size:11px;color:#64748b;margin-top:3px;line-height:1.6;}
    .os-box{background:#eff6ff;border:2px solid #1A6BFF;border-radius:8px;padding:8px 14px;text-align:center;}
    .os-n{font-size:18px;font-weight:800;color:#1A6BFF;}.os-d{font-size:11px;color:#64748b;}
    .sec{margin-bottom:14px;}.sec-t{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;border-bottom:1px solid #f1f5f9;padding-bottom:3px;}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.fl{font-size:11px;color:#64748b;margin-bottom:2px;}.fv{font-weight:700;}
    .vbox{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;}
    .vn{font-size:22px;font-weight:800;color:#1A6BFF;}.ass{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:36px;}
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
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [prevStatus, setPrevStatus] = useState(null);

  useEffect(() => {
    if (!user) return;
    db.list("ordens_servico", user.id).then(data => {
      setLista(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [user]);

  const filtered = lista.filter(o => (filtro==="todas"||o.status===filtro) && (!busca||o.cliente.toLowerCase().includes(busca.toLowerCase())||o.aparelho.toLowerCase().includes(busca.toLowerCase())||(o.numero||"").includes(busca)));

  const nova = () => {
    setPrevStatus(null);
    setForm({ numero:"OS-"+String(lista.length+1).padStart(4,"0"), cliente:"", telefone:"", aparelho:"", defeito:"", tecnico:cfg.tecnico||"", status:"aberta", valor:"", pagamento:"Pix", data:today(), garantia:"90 dias", obs:"" });
    setModal("novo");
  };

  const lancarFinanceiro = async (f) => {
    await db.insert("financeiro", {
      user_id: user.id,
      tipo: "receita",
      categoria: "Serviço",
      descricao: `Serviço ${f.numero} — ${f.cliente}`,
      valor: Number(f.valor) || 0,
      pagamento: f.pagamento,
      data: f.data,
    });
  };

  const salvar = async () => {
    if(!form.cliente||!form.aparelho)return;
    const payload = { ...form, valor: Number(form.valor)||0, user_id: user.id };
    delete payload.id;
    if(modal==="novo") {
      const novo = await db.insert("ordens_servico", payload);
      setLista(p=>[novo, ...p]);
      if(form.status === "concluida") await lancarFinanceiro(form);
    } else {
      const updated = await db.update("ordens_servico", form.id, payload);
      setLista(p=>p.map(o=>o.id===form.id ? updated : o));
      if(form.status === "concluida" && prevStatus !== "concluida") await lancarFinanceiro(form);
    }
    setModal(null);
  };

  const counts = k => lista.filter(o=>o.status===k).length;

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Ordens de Serviço</div><button className="btn-p" onClick={nova}>+ Nova OS</button></div>
      <div className="stat-grid">
        <StatCard label="Abertas"       value={counts("aberta")}       accent="#1A6BFF"/>
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
                  <td style={{color:"#94a3b8"}}>{os.data}</td>
                  <td style={{fontWeight:700}}>{os.cliente}</td>
                  <td style={{color:"#94a3b8",fontSize:12}}>{os.telefone||"—"}</td>
                  <td>{os.aparelho}</td>
                  <td style={{color:"#94a3b8",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{os.defeito}</td>
                  <td>{os.tecnico}</td>
                  <td><StatusTag status={os.status}/></td>
                  <td style={{fontWeight:700,color:"#4ade80"}}>{fmt(os.valor)}</td>
                  <td><div style={{display:"flex",gap:4}}>
                    <button className="btn-i" onClick={()=>{setPrevStatus(os.status);setForm({...os});setModal("editar");}}>✏️</button>
                    <button className="btn-i" onClick={()=>gerarPDF(os,cfg)} title="Imprimir OS">🖨️</button>
                    <button className="btn-d" onClick={async()=>{await db.delete("ordens_servico",os.id);setLista(p=>p.filter(o=>o.id!==os.id));}}>✕</button>
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
  const { user } = useAuth();
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo:"receita", categoria:"Serviço", descricao:"", valor:"", pagamento:"Pix", data:today() });

  useEffect(() => {
    if (!user) return;
    db.list("financeiro", user.id).then(data => {
      setMovs(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [user]);

  const filtered = movs.filter(m => (filtro==="todos"||m.tipo===filtro)&&(!busca||m.descricao.toLowerCase().includes(busca.toLowerCase())));
  const rec = movs.filter(m=>m.tipo==="receita").reduce((s,m)=>s+Number(m.valor),0);
  const des = movs.filter(m=>m.tipo==="despesa").reduce((s,m)=>s+Number(m.valor),0);
  const cats = { receita:["Serviço","Venda","Outros"], despesa:["Peças","Fornecedor","Marketing","Aluguel","Outros"] };

  const salvar = async () => {
    if(!form.descricao||!form.valor)return;
    const payload = { ...form, valor: Number(form.valor), user_id: user.id };
    const novo = await db.insert("financeiro", payload);
    setMovs(p=>[novo, ...p]);
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
                <td style={{color:"#94a3b8"}}>{m.data}</td>
                <td><span className="tag" style={{background:m.tipo==="receita"?"#0d2d1a":"#2d1515",color:m.tipo==="receita"?"#4ade80":"#f87171"}}>{m.tipo==="receita"?"Receita":"Despesa"}</span></td>
                <td style={{color:"#94a3b8"}}>{m.categoria}</td>
                <td style={{color:"#94a3b8"}}>{m.pagamento}</td>
                <td>{m.descricao}</td>
                <td style={{fontWeight:700,color:m.tipo==="receita"?"#4ade80":"#f87171"}}>{m.tipo==="despesa"?"− ":"+ "}{fmt(m.valor)}</td>
                <td><button className="btn-d" onClick={async()=>{await db.delete("financeiro",m.id);setMovs(p=>p.filter(x=>x.id!==m.id));}}>✕</button></td>
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
                      borderColor:form.tipo===t?(t==="receita"?"#16a34a":"#dc2626"):"#2d3748",
                      background:form.tipo===t?(t==="receita"?"#0d2d1a":"#2d1515"):"#1a2236",
                      color:form.tipo===t?(t==="receita"?"#4ade80":"#f87171"):"#94a3b8"}}>
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
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!user) return;
    db.list("clientes", user.id).then(data => {
      setClientes(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [user]);

  const filtered = clientes.filter(c=>!busca||c.nome.toLowerCase().includes(busca.toLowerCase())||(c.telefone||"").includes(busca));
  const salvar = async () => {
    if(!form.nome)return;
    const payload = { nome: form.nome, telefone: form.telefone, email: form.email, cidade: form.cidade, user_id: user.id };
    if(modal==="novo") {
      const novo = await db.insert("clientes", payload);
      setClientes(p=>[novo, ...p]);
    } else {
      const updated = await db.update("clientes", form.id, payload);
      setClientes(p=>p.map(c=>c.id===form.id ? updated : c));
    }
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
                <td style={{color:"#94a3b8"}}>{c.email||"—"}</td>
                <td style={{color:"#94a3b8"}}>{c.cidade||"—"}</td>
                <td><span style={{background:"#1a2236",color:"#1A6BFF",borderRadius:999,padding:"2px 9px",fontWeight:700,fontSize:12}}>{c.totalOS}</span></td>
                <td style={{color:"#94a3b8"}}>{c.ultimaOS}</td>
                <td><div style={{display:"flex",gap:4}}><button className="btn-i" onClick={()=>{setForm({...c});setModal("editar");}}>✏️</button><button className="btn-d" onClick={async()=>{await db.delete("clientes",c.id);setClientes(p=>p.filter(x=>x.id!==c.id));}}>✕</button></div></td>
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
  const { user } = useAuth();
  const [pecas, setPecas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!user) return;
    db.list("pecas", user.id).then(data => {
      setPecas(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [user]);

  const filtered = pecas.filter(p=>!busca||p.nome.toLowerCase().includes(busca.toLowerCase())||(p.categoria||"").toLowerCase().includes(busca.toLowerCase()));
  const salvar = async () => {
    if(!form.nome)return;
    const payload = { nome: form.nome, categoria: form.categoria, custo: Number(form.custo)||0, venda: Number(form.venda)||0, estoque: Number(form.estoque)||0, user_id: user.id };
    if(modal==="novo") {
      const novo = await db.insert("pecas", payload);
      setPecas(p=>[novo, ...p]);
    } else {
      const updated = await db.update("pecas", form.id, payload);
      setPecas(p=>p.map(x=>x.id===form.id ? updated : x));
    }
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
                  <td><span style={{background:"#1a2236",color:"#1A6BFF",borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:700}}>{p.categoria}</span></td>
                  <td style={{color:"#94a3b8"}}>{fmt(p.custo)}</td>
                  <td style={{fontWeight:700,color:"#4ade80"}}>{fmt(p.venda)}</td>
                  <td><span style={{fontWeight:700,color:m>=50?"#4ade80":m>=20?"#d97706":"#f87171"}}>{m}%</span></td>
                  <td><span style={{fontWeight:700,color:p.estoque===0?"#f87171":p.estoque<=2?"#d97706":"#e2e8f0"}}>{p.estoque===0?"⚠ Sem estoque":p.estoque+" un."}</span></td>
                  <td><div style={{display:"flex",gap:4}}><button className="btn-i" onClick={()=>{setForm({...p});setModal("editar");}}>✏️</button><button className="btn-d" onClick={async()=>{await db.delete("pecas",p.id);setPecas(x=>x.filter(i=>i.id!==p.id));}}>✕</button></div></td>
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
  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Configurações da Empresa</div><button className="btn-p" onClick={salvar}>{saved?"✓ Salvo!":"Salvar Configurações"}</button></div>
      <div className="card" style={{padding:22,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:14,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Identidade Visual</div>
        <div className="frow frow-2"><F label="Nome da Empresa" field="nome" form={form} setForm={setForm}/><F label="Técnico Padrão" field="tecnico" form={form} setForm={setForm}/></div>
      </div>
      <div className="card" style={{padding:22,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:14,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Dados Fiscais e Contato</div>
        <div className="frow frow-2"><F label="CNPJ" field="cnpj" form={form} setForm={setForm}/><F label="Telefone" field="telefone" form={form} setForm={setForm}/></div>
        <div className="frow frow-2"><F label="E-mail" field="email" form={form} setForm={setForm}/><F label="CEP" field="cep" form={form} setForm={setForm}/></div>
        <F label="Endereço Completo" field="endereco" form={form} setForm={setForm}/>
        <div className="frow frow-2"><F label="Cidade / Estado" field="cidade" form={form} setForm={setForm}/><div/></div>
      </div>
      <div className="card" style={{padding:22}}>
        <div style={{fontWeight:800,fontSize:13,marginBottom:4,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Termos de Garantia (aparece no PDF)</div>
        <p style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>Este texto aparece no rodapé da OS impressa.</p>
        <F label="" field="garantia" as="textarea" form={form} setForm={setForm}/>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function Dashboard() {
  const { user } = useAuth();
  const [os, setOs] = useState([]);
  const [movs, setMovs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      db.list("ordens_servico", user.id),
      db.list("financeiro", user.id),
      db.list("clientes", user.id),
    ]).then(([o, m, c]) => {
      setOs(Array.isArray(o) ? o : []);
      setMovs(Array.isArray(m) ? m : []);
      setClientes(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, [user]);

  if (loading) return (
    <div className="page" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
      <span className="spinner" style={{width:28,height:28,borderWidth:3}}/>
    </div>
  );

  const rec = movs.filter(m=>m.tipo==="receita").reduce((s,m)=>s+Number(m.valor),0);
  const des = movs.filter(m=>m.tipo==="despesa").reduce((s,m)=>s+Number(m.valor),0);
  const osAtivas = os.filter(o=>o.status!=="concluida"&&o.status!=="cancelada");

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Dashboard</div></div>
      <div className="stat-grid">
        <StatCard label="OS Abertas"     value={os.filter(o=>o.status==="aberta").length}      accent="#1A6BFF"/>
        <StatCard label="Em Andamento"   value={os.filter(o=>o.status==="em_andamento").length} accent="#d97706"/>
        <StatCard label="Receita (mês)"  value={fmt(rec)}                                       accent="#16a34a"/>
        <StatCard label="Despesas (mês)" value={fmt(des)}                                       accent="#dc2626"/>
        <StatCard label="Lucro (mês)"    value={fmt(rec-des)} accent={rec-des>=0?"#16a34a":"#dc2626"}/>
        <StatCard label="Clientes"       value={clientes.length}                                accent="#7c3aed"/>
      </div>
      <div className="dash-panels">
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:"1px solid #1e2738",fontWeight:800,fontSize:14}}>OS Abertas & Em Andamento</div>
          {osAtivas.map(o=>(
            <div key={o.id} style={{padding:"10px 16px",borderBottom:"1px solid #0d1117",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:700}}>{o.cliente}</div><div style={{fontSize:12,color:"#94a3b8"}}>{o.aparelho} · <span className="os-num">{o.numero}</span></div></div>
              <StatusTag status={o.status}/>
            </div>
          ))}
          {osAtivas.length===0&&<div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:13}}>Nenhuma OS aberta ✓</div>}
        </div>
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:"1px solid #1e2738",fontWeight:800,fontSize:14}}>Últimos Lançamentos</div>
          {movs.slice(0,5).map(m=>(
            <div key={m.id} style={{padding:"10px 16px",borderBottom:"1px solid #0d1117",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>{m.tipo==="receita"?"↑":"↓"}</span>
              <div style={{flex:1}}><div style={{fontSize:13}}>{m.descricao}</div><div style={{fontSize:11,color:"#94a3b8"}}>{m.data}</div></div>
              <span style={{fontWeight:800,color:m.tipo==="receita"?"#4ade80":"#f87171"}}>{m.tipo==="despesa"?"− ":"+ "}{fmt(m.valor)}</span>
            </div>
          ))}
          {movs.length===0&&<div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:13}}>Nenhum lançamento registrado</div>}
        </div>
      </div>
    </div>
  );
}

// ── MÓDULO AGENDA (KANBAN) ────────────────────────────────────────
const KANBAN_COLS = [
  { key: "aberta",       label: "Aberta",        color: "#1A6BFF" },
  { key: "em_andamento", label: "Em Andamento",  color: "#d97706" },
  { key: "concluida",    label: "Concluída",      color: "#16a34a" },
  { key: "cancelada",    label: "Cancelada",      color: "#dc2626" },
];

function ModuloAgenda() {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (!user) return;
    db.list("ordens_servico", user.id).then(data => {
      setLista(Array.isArray(data) ? data : []);
    });
  }, [user]);

  const handleDrop = async (colKey) => {
    if (!dragId) return;
    const os = lista.find(o => o.id === dragId);
    if (!os || os.status === colKey) { setDragId(null); setDragOver(null); return; }
    await db.update("ordens_servico", dragId, { status: colKey });
    setLista(p => p.map(o => o.id === dragId ? { ...o, status: colKey } : o));
    setDragId(null);
    setDragOver(null);
  };

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Agenda Kanban</div></div>
      <div className="kanban-wrap"><div className="kanban-grid">
        {KANBAN_COLS.map(col => {
          const cards = lista.filter(o => o.status === col.key);
          return (
            <div key={col.key}
              className={`kanban-col${dragOver===col.key?" drag-over":""}`}
              onDragOver={e=>{e.preventDefault();setDragOver(col.key);}}
              onDragLeave={()=>setDragOver(null)}
              onDrop={()=>handleDrop(col.key)}>
              <div style={{background:col.color+"22",borderBottom:`2px solid ${col.color}`,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontWeight:800,fontSize:13,color:col.color}}>{col.label}</span>
                <span style={{background:col.color+"33",color:col.color,borderRadius:999,padding:"2px 8px",fontSize:12,fontWeight:700}}>{cards.length}</span>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:8,flex:1}}>
                {cards.map(os=>(
                  <div key={os.id}
                    className={`kanban-card${dragId===os.id?" dragging":""}`}
                    draggable
                    onDragStart={()=>setDragId(os.id)}
                    onDragEnd={()=>{setDragId(null);setDragOver(null);}}>
                    <div style={{color:"#1A6BFF",fontWeight:800,fontSize:11,marginBottom:3}}>{os.numero}</div>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{os.cliente}</div>
                    <div style={{color:"#94a3b8",fontSize:12,marginBottom:4}}>{os.aparelho}</div>
                    <div style={{color:"#4ade80",fontWeight:700,fontSize:12}}>{fmt(os.valor)}</div>
                  </div>
                ))}
                {cards.length===0&&(
                  <div style={{textAlign:"center",color:"#94a3b8",fontSize:12,padding:20,flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    Nenhuma OS
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div></div>
    </div>
  );
}

// ── MÓDULO PRODUTOS / CAIXA ───────────────────────────────────────
function ModuloProdutos() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [osAbertas, setOsAbertas] = useState([]);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const [formProd, setFormProd] = useState({});
  const [buscaProd, setBuscaProd] = useState("");
  const [prodSelecionado, setProdSelecionado] = useState(null);
  const [formVenda, setFormVenda] = useState({ cliente:"", os_numero:"", quantidade:1, preco_unit:"", desconto:0, pagamento:"Pix", data:today(), observacoes:"" });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      db.list("produtos", user.id),
      db.list("vendas", user.id),
      db.list("ordens_servico", user.id),
    ]).then(([p, v, os]) => {
      setProdutos(Array.isArray(p) ? p : []);
      setVendas(Array.isArray(v) ? v : []);
      setOsAbertas(Array.isArray(os) ? os.filter(o=>o.status==="aberta"||o.status==="em_andamento") : []);
    });
  }, [user]);

  const totalVenda = Math.max(0, ((Number(formVenda.quantidade)||1) * (Number(formVenda.preco_unit)||0)) - (Number(formVenda.desconto)||0));
  const prodsFiltrados = buscaProd && !prodSelecionado ? produtos.filter(p=>p.nome.toLowerCase().includes(buscaProd.toLowerCase())) : [];
  const filteredProdutos = produtos.filter(p=>!busca||p.nome.toLowerCase().includes(busca.toLowerCase())||(p.categoria||"").toLowerCase().includes(busca.toLowerCase()));

  const ajustarEstoque = async (prod, delta) => {
    const novoEstoque = Math.max(0, prod.estoque + delta);
    await db.update("produtos", prod.id, { estoque: novoEstoque });
    setProdutos(p=>p.map(x=>x.id===prod.id?{...x,estoque:novoEstoque}:x));
  };

  const salvarProduto = async () => {
    if(!formProd.nome)return;
    const payload = { nome:formProd.nome, categoria:formProd.categoria||"Peça", custo:Number(formProd.custo)||0, venda:Number(formProd.venda)||0, estoque:Number(formProd.estoque)||0, user_id:user.id };
    if(modal==="novo_prod") {
      const novo = await db.insert("produtos", payload);
      setProdutos(p=>[novo,...p]);
    } else {
      const updated = await db.update("produtos", formProd.id, payload);
      setProdutos(p=>p.map(x=>x.id===formProd.id?updated:x));
    }
    setModal(null);
  };

  const registrarVenda = async () => {
    if(!prodSelecionado||!formVenda.quantidade||!formVenda.preco_unit)return;
    const vendaPayload = {
      user_id: user.id,
      produto_id: prodSelecionado.id,
      produto_nome: prodSelecionado.nome,
      cliente: formVenda.cliente,
      os_numero: formVenda.os_numero,
      quantidade: Number(formVenda.quantidade),
      preco_unit: Number(formVenda.preco_unit),
      desconto: Number(formVenda.desconto)||0,
      total: totalVenda,
      pagamento: formVenda.pagamento,
      observacoes: formVenda.observacoes,
      data: formVenda.data,
    };
    const novaVenda = await db.insert("vendas", vendaPayload);
    setVendas(p=>[novaVenda,...p]);

    await db.insert("financeiro", {
      user_id: user.id,
      tipo: "receita",
      categoria: "Venda",
      descricao: `Venda: ${prodSelecionado.nome} — ${formVenda.cliente||"Cliente"}`,
      valor: totalVenda,
      pagamento: formVenda.pagamento,
      data: formVenda.data,
    });

    const novoEstoque = Math.max(0, prodSelecionado.estoque - Number(formVenda.quantidade));
    await db.update("produtos", prodSelecionado.id, { estoque: novoEstoque });
    setProdutos(p=>p.map(x=>x.id===prodSelecionado.id?{...x,estoque:novoEstoque}:x));

    setBuscaProd(""); setProdSelecionado(null);
    setFormVenda({ cliente:"", os_numero:"", quantidade:1, preco_unit:"", desconto:0, pagamento:"Pix", data:today(), observacoes:"" });
  };

  return (
    <div className="page">
      <div className="page-hdr"><div className="page-title">Produtos & Caixa</div></div>

      {/* Duas colunas no topo */}
      <div className="produtos-top">

        {/* Esquerda: Estoque */}
        <div className="card" style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:"1px solid #1e2738",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:800,fontSize:13}}>Estoque de Produtos</span>
            <button className="btn-p" style={{padding:"5px 12px",fontSize:12}} onClick={()=>{setFormProd({nome:"",categoria:"Peça",custo:"",venda:"",estoque:""});setModal("novo_prod");}}>+ Produto</button>
          </div>
          <div style={{padding:"10px 14px 0"}}>
            <div className="sbar"><input placeholder="Buscar produto…" value={busca} onChange={e=>setBusca(e.target.value)}/></div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table>
              <thead><tr><th>Nome</th><th>Cat.</th><th>Custo</th><th>Venda</th><th>Estoque</th><th></th></tr></thead>
              <tbody>
                {filteredProdutos.map(p=>(
                  <tr key={p.id}>
                    <td style={{fontWeight:700}}>{p.nome}</td>
                    <td><span style={{background:"#1a2236",color:"#1A6BFF",borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:700}}>{p.categoria}</span></td>
                    <td style={{color:"#94a3b8"}}>{fmt(p.custo)}</td>
                    <td style={{color:"#4ade80",fontWeight:700}}>{fmt(p.venda)}</td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <button className="btn-i" style={{padding:"2px 8px",fontSize:14,lineHeight:1}} onClick={()=>ajustarEstoque(p,-1)}>−</button>
                        <span style={{fontWeight:800,minWidth:24,textAlign:"center",color:p.estoque===0?"#f87171":p.estoque<=2?"#d97706":"#e2e8f0"}}>{p.estoque}</span>
                        <button className="btn-i" style={{padding:"2px 8px",fontSize:14,lineHeight:1}} onClick={()=>ajustarEstoque(p,1)}>+</button>
                      </div>
                    </td>
                    <td><div style={{display:"flex",gap:4}}>
                      <button className="btn-i" onClick={()=>{setFormProd({...p});setModal("editar_prod");}}>✏️</button>
                      <button className="btn-d" onClick={async()=>{await db.delete("produtos",p.id);setProdutos(x=>x.filter(i=>i.id!==p.id));}}>✕</button>
                    </div></td>
                  </tr>
                ))}
                {filteredProdutos.length===0&&<tr><td colSpan={6} style={{textAlign:"center",padding:20,color:"#94a3b8"}}>Nenhum produto cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Direita: Registrar Venda */}
        <div className="card" style={{padding:18}}>
          <div style={{fontWeight:800,fontSize:13,marginBottom:14,borderBottom:"1px solid #1e2738",paddingBottom:10}}>Registrar Venda</div>

          <div className="field"><label>Produto</label>
            <div style={{position:"relative"}}>
              <input
                placeholder="Digite para buscar produto…"
                value={prodSelecionado ? prodSelecionado.nome : buscaProd}
                onChange={e=>{setBuscaProd(e.target.value);setProdSelecionado(null);setFormVenda(p=>({...p,preco_unit:""}));}}
              />
              {prodsFiltrados.length>0&&(
                <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,right:0,background:"#1a2236",border:"1px solid #2d3748",borderRadius:8,zIndex:50,maxHeight:180,overflowY:"auto",boxShadow:"0 8px 24px #00000066"}}>
                  {prodsFiltrados.map(p=>(
                    <div key={p.id}
                      style={{padding:"9px 12px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #2d3748",transition:"background 0.1s"}}
                      onMouseDown={()=>{setProdSelecionado(p);setBuscaProd("");setFormVenda(f=>({...f,preco_unit:p.venda}));}}>
                      <span style={{fontWeight:700}}>{p.nome}</span>
                      <span style={{color:"#94a3b8",fontSize:12,marginLeft:8}}>{fmt(p.venda)} · {p.estoque} un.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="frow frow-2">
            <div className="field"><label>Cliente</label><input value={formVenda.cliente} onChange={e=>setFormVenda(p=>({...p,cliente:e.target.value}))} placeholder="Nome do cliente"/></div>
            <div className="field"><label>Vincular OS</label>
              <select value={formVenda.os_numero} onChange={e=>setFormVenda(p=>({...p,os_numero:e.target.value}))}>
                <option value="">— Nenhuma —</option>
                {osAbertas.map(o=><option key={o.id} value={o.numero}>{o.numero} · {o.cliente}</option>)}
              </select>
            </div>
          </div>

          <div className="frow frow-3">
            <div className="field"><label>Qtd</label><input type="number" min="1" value={formVenda.quantidade} onChange={e=>setFormVenda(p=>({...p,quantidade:e.target.value}))}/></div>
            <div className="field"><label>Preço Unit (R$)</label><input type="number" value={formVenda.preco_unit} onChange={e=>setFormVenda(p=>({...p,preco_unit:e.target.value}))}/></div>
            <div className="field"><label>Desconto (R$)</label><input type="number" value={formVenda.desconto} onChange={e=>setFormVenda(p=>({...p,desconto:e.target.value}))}/></div>
          </div>

          <div style={{background:"#1a2236",border:"1px solid #2d3748",borderRadius:8,padding:"10px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#94a3b8",fontSize:11,fontWeight:700,letterSpacing:"0.06em"}}>TOTAL</span>
            <span style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{fmt(totalVenda)}</span>
          </div>

          <div className="frow frow-2">
            <div className="field"><label>Pagamento</label>
              <select value={formVenda.pagamento} onChange={e=>setFormVenda(p=>({...p,pagamento:e.target.value}))}>
                {["Pix","Dinheiro","Cartão Débito","Cartão Crédito"].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>Data</label><input type="date" value={formVenda.data} onChange={e=>setFormVenda(p=>({...p,data:e.target.value}))}/></div>
          </div>

          <div className="field"><label>Observações</label><textarea rows={2} value={formVenda.observacoes} onChange={e=>setFormVenda(p=>({...p,observacoes:e.target.value}))} placeholder="(opcional)"/></div>

          <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={registrarVenda}>
            Registrar Venda
          </button>
        </div>
      </div>

      {/* Histórico de Vendas */}
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"13px 16px",borderBottom:"1px solid #1e2738",fontWeight:800,fontSize:13}}>Histórico de Vendas</div>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>Data</th><th>Produto</th><th>Cliente</th><th>OS</th><th>Qtd</th><th>Unit</th><th>Desc.</th><th>Total</th><th>Pgto</th><th></th></tr></thead>
            <tbody>
              {vendas.map(v=>(
                <tr key={v.id}>
                  <td style={{color:"#94a3b8"}}>{v.data}</td>
                  <td style={{fontWeight:700}}>{v.produto_nome}</td>
                  <td>{v.cliente||"—"}</td>
                  <td><span className="os-num">{v.os_numero||"—"}</span></td>
                  <td style={{textAlign:"center"}}>{v.quantidade}</td>
                  <td style={{color:"#94a3b8"}}>{fmt(v.preco_unit)}</td>
                  <td style={{color:"#f87171"}}>{Number(v.desconto)>0?`− ${fmt(v.desconto)}`:"—"}</td>
                  <td style={{fontWeight:700,color:"#4ade80"}}>{fmt(v.total)}</td>
                  <td style={{color:"#94a3b8"}}>{v.pagamento}</td>
                  <td><button className="btn-d" onClick={async()=>{await db.delete("vendas",v.id);setVendas(p=>p.filter(x=>x.id!==v.id));}}>✕</button></td>
                </tr>
              ))}
              {vendas.length===0&&<tr><td colSpan={10} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Nenhuma venda registrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Produto */}
      {modal&&(
        <Modal onClose={()=>setModal(null)}>
          <div className="modal-hdr"><h2>{modal==="novo_prod"?"Novo Produto":"Editar Produto"}</h2><button className="btn-s" style={{padding:"5px 10px"}} onClick={()=>setModal(null)}>✕</button></div>
          <div className="modal-body">
            <div className="field"><label>Nome *</label><input value={formProd.nome||""} onChange={e=>setFormProd(p=>({...p,nome:e.target.value}))}/></div>
            <div className="field"><label>Categoria</label>
              <select value={formProd.categoria||"Peça"} onChange={e=>setFormProd(p=>({...p,categoria:e.target.value}))}>
                {["Peça","Smartphone","Seminovo","Acessório","Outro"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="frow frow-3">
              <div className="field"><label>Custo (R$)</label><input type="number" value={formProd.custo||""} onChange={e=>setFormProd(p=>({...p,custo:e.target.value}))}/></div>
              <div className="field"><label>Venda (R$)</label><input type="number" value={formProd.venda||""} onChange={e=>setFormProd(p=>({...p,venda:e.target.value}))}/></div>
              <div className="field"><label>Estoque inicial</label><input type="number" value={formProd.estoque||""} onChange={e=>setFormProd(p=>({...p,estoque:e.target.value}))}/></div>
            </div>
          </div>
          <div className="modal-ftr"><button className="btn-s" onClick={()=>setModal(null)}>Cancelar</button><button className="btn-p" onClick={salvarProduto}>Salvar</button></div>
        </Modal>
      )}
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
      <div className="auth-logo"><div className="auth-logo-t">Core<span>Ops</span></div><div className="auth-logo-s">Assistência Técnica</div></div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Entrar</div>
      <div style={{color:"#94a3b8",fontSize:13,marginBottom:20}}>Acesse sua conta.</div>
      {erro&&<div className="auth-err">{erro}</div>}
      <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <div className="field"><label>Senha</label><div style={{position:"relative"}}><input type={show?"text":"password"} placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{paddingRight:38}}/><button className="eye-btn" onClick={()=>setShow(p=>!p)}>{show?"🙈":"👁️"}</button></div></div>
      <div style={{textAlign:"right",marginBottom:14,marginTop:-6}}><button className="auth-lnk" onClick={()=>onSwitch("recover")}>Esqueci a senha</button></div>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={submit} disabled={loading}>
        {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Entrando…</span>:"Entrar"}
      </button>
      <p style={{textAlign:"center",marginTop:18,fontSize:13,color:"#94a3b8"}}>Não tem conta? <button className="auth-lnk" onClick={()=>onSwitch("register")}>Criar conta grátis</button></p>
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
    setLoading(true); try{await signUp(email,senha,nome); if(window.fbq) window.fbq('track','CompleteRegistration'); setOk(true);}catch(e){setErro(e.message.includes("already registered")?"E-mail já cadastrado.":e.message);} setLoading(false);
  };
  if(ok) return (
    <div className="auth-wrap"><div className="auth-card" style={{textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:12}}>🎉</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>Conta criada!</div>
      <p style={{color:"#94a3b8",fontSize:13,marginBottom:22}}>Faça login para começar seus 3 dias grátis.</p>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={()=>onSwitch("login")}>Ir para o login →</button>
    </div></div>
  );
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="auth-logo-t">Core<span>Ops</span></div></div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Criar conta grátis</div>
      <div className="auth-ok" style={{fontSize:12}}>✅ 3 dias grátis · Sem cartão · R$37/mês depois</div>
      {erro&&<div className="auth-err">{erro}</div>}
      <div className="field"><label>Nome da Assistência</label><input placeholder="Ex: TechFix Vacaria" value={nome} onChange={e=>setNome(e.target.value)}/></div>
      <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="field"><label>Senha</label><div style={{position:"relative"}}><input type={show?"text":"password"} placeholder="Mínimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} style={{paddingRight:38}}/><button className="eye-btn" onClick={()=>setShow(p=>!p)}>{show?"🙈":"👁️"}</button></div></div>
      <div className="field"><label>Confirmar Senha</label><input type={show?"text":"password"} placeholder="Repita a senha" value={conf} onChange={e=>setConf(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
      <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px",marginTop:4}} onClick={submit} disabled={loading}>
        {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Criando…</span>:"Criar conta →"}
      </button>
      <p style={{textAlign:"center",marginTop:16,fontSize:13,color:"#94a3b8"}}>Já tem conta? <button className="auth-lnk" onClick={()=>onSwitch("login")}>Entrar</button></p>
    </div></div>
  );
}

function Recover({ onSwitch }) {
  const { resetPassword } = useAuth();
  const [email,setEmail]=useState(""); const [loading,setLoading]=useState(false); const [ok,setOk]=useState(false); const [erro,setErro]=useState("");
  const submit = async () => { if(!email){setErro("Digite seu e-mail.");return;} setLoading(true); try{await resetPassword(email);setOk(true);}catch(e){setErro(e.message);} setLoading(false); };
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="auth-logo"><div className="auth-logo-t">Core<span>Ops</span></div></div>
      {!ok?<>
        <div style={{fontSize:20,fontWeight:800,marginBottom:3}}>Recuperar senha</div>
        <div style={{color:"#94a3b8",fontSize:13,marginBottom:18}}>Enviaremos um link para redefinir.</div>
        {erro&&<div className="auth-err">{erro}</div>}
        <div className="field"><label>E-mail</label><input type="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
        <button className="btn-p" style={{width:"100%",justifyContent:"center",padding:"11px"}} onClick={submit} disabled={loading}>
          {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="spinner"/>Enviando…</span>:"Enviar link"}
        </button>
      </>:<div style={{textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:12}}>✉️</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Link enviado!</div>
        <p style={{color:"#94a3b8",fontSize:13}}>Verifique sua caixa de entrada.</p>
      </div>}
      <p style={{textAlign:"center",marginTop:20,fontSize:13,color:"#94a3b8"}}><button className="auth-lnk" onClick={()=>onSwitch("login")}>← Voltar ao login</button></p>
    </div></div>
  );
}

function Paywall({ onSignOut, onRefresh }) {
  const { user, profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const nome = profile?.nome || user?.email;
  return (
    <div className="pw-wrap"><div style={{width:"100%",maxWidth:420}}>
      <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:20,fontWeight:800,color:"#e2e8f0"}}>Core<span style={{color:"#1A6BFF"}}>Ops</span></div></div>
      <div className="pw-card">
        <div style={{fontSize:42,marginBottom:10}}>🔒</div>
        <div style={{fontSize:20,fontWeight:800,marginBottom:6}}>Trial encerrado</div>
        <p style={{color:"#94a3b8",fontSize:13,marginBottom:22,lineHeight:1.6}}>Seus 3 dias gratuitos acabaram, <strong style={{color:"#e2e8f0"}}>{nome}</strong>.<br/>Assine para continuar.</p>
        <div style={{background:"#1a2236",border:"1px solid #2d3748",borderRadius:10,padding:"14px 18px",marginBottom:18,textAlign:"left"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontWeight:800,fontSize:14}}>Plano CoreOps</div><div style={{color:"#94a3b8",fontSize:12}}>Cancele quando quiser</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:24,fontWeight:800,color:"#4ade80"}}>R$37</div><div style={{color:"#94a3b8",fontSize:11}}>/mês</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {["OS ilimitadas","Controle de caixa","Catálogo de peças","Suporte WhatsApp"].map(i=>(
              <div key={i} style={{fontSize:12,color:"#e2e8f0",display:"flex",alignItems:"center",gap:5}}><span style={{color:"#4ade80",fontWeight:700}}>✓</span>{i}</div>
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
  {key:"dashboard", label:"Dashboard", icon:"📊"},
  {key:"os",        label:"O.S.",      icon:"🔧"},
  {key:"agenda",    label:"Agenda",    icon:"📅"},
  {key:"clientes",  label:"Clientes",  icon:"👥"},
  {key:"financeiro",label:"Financeiro",icon:"💰"},
  {key:"catalogo",  label:"Catálogo",  icon:"📦"},
  {key:"produtos",  label:"Produtos",  icon:"🛍️"},
  {key:"config",    label:"Config",    icon:"⚙️"},
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
          <div className="nav-logo">Core<span>Ops</span></div>
          {MENU.map(m=>(
            <button key={m.key} className={`nav-tab${page===m.key?" active":""}`} onClick={()=>setPage(m.key)}>{m.icon}<span className="nav-tab-label"> {m.label}</span></button>
          ))}
          <div className="nav-right">
            {isTrial&&<span style={{fontSize:12,fontWeight:700,color:accessStatus.diasRestantes<=2?"#f87171":"#fbbf24",background:accessStatus.diasRestantes<=2?"#2d1515":"#1a1a0d",border:`1px solid ${accessStatus.diasRestantes<=2?"#3d1515":"#fde68a44"}`,borderRadius:999,padding:"3px 10px"}}>⏳ {accessStatus.diasRestantes}d</span>}
            <div className="avatar">{(nome||"U")[0].toUpperCase()}</div>
            <button className="btn-s" style={{padding:"5px 12px",fontSize:13}} onClick={signOut}>Sair</button>
          </div>
        </div>
      </nav>
      {isTrial&&(
        <div className={`trial-bar no-print${accessStatus.diasRestantes<=2?" urgent":""}`}>
          <span style={{fontSize:13,fontWeight:700,color:accessStatus.diasRestantes<=2?"#f87171":"#fbbf24"}}>
            {accessStatus.diasRestantes<=2?"⚠️":"⏳"} {accessStatus.diasRestantes} {accessStatus.diasRestantes===1?"dia":"dias"} restantes no trial.
          </span>
          <a href={CAKTO_LINK} target="_blank" rel="noreferrer" style={{background:"#16a34a",color:"#fff",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,textDecoration:"none"}}>Assinar R$37/mês</a>
        </div>
      )}
      {page==="dashboard"  && <Dashboard/>}
      {page==="os"         && <ModuloOS cfg={cfg}/>}
      {page==="agenda"     && <ModuloAgenda/>}
      {page==="clientes"   && <ModuloClientes/>}
      {page==="financeiro" && <ModuloFinanceiro/>}
      {page==="catalogo"   && <ModuloCatalogo/>}
      {page==="produtos"   && <ModuloProdutos/>}
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
