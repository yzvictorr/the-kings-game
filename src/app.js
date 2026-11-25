/* ===== UI + rede (v2) ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CROWN = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#f5c542" d="M6 22l14 12 12-20 12 20 14-12-6 30H12z"/><rect x="12" y="54" width="40" height="5" rx="2" fill="#f5c542"/><circle cx="6" cy="20" r="4" fill="#f5c542"/><circle cx="32" cy="11" r="4" fill="#f5c542"/><circle cx="58" cy="20" r="4" fill="#f5c542"/></svg>`;
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
let MYPID = store("kl_pid"); if (!MYPID) { MYPID = "u" + Math.random().toString(36).slice(2, 10); store("kl_pid", MYPID); }
const ANON_PID = MYPID; // identidade deste aparelho sem login
// ---- conta (login com Google, opcional) ----
const ACC = { user: null, prof: null, saveT: null, last: "" };
function accountInit() {
  let n = 0; const t = setInterval(() => { if (window.klAuth) { clearInterval(t); window.klAuth.onChange(onUser); } else if (++n > 60) clearInterval(t); }, 250);
}
async function onUser(u) {
  ACC.user = u;
  if (PLAYERS_ORIG) applyOvr(); // o administrador vê os ajustes secretos; os outros, não
  if (!S) MYPID = u ? "g" + u.uid : ANON_PID; // com login, você é o mesmo presidente em qualquer aparelho
  ACC.prof = null;
  if (u) {
    try { const db = await window.claude.use("db"); const d = db ? await db.doc("users/" + u.uid).get() : null; ACC.prof = d && d.exists ? d.data() : null; } catch (e) { }
    const P0 = ACC.prof = Object.assign({ name: (u.name || "").split(" ")[0].slice(0, 18), team: "", crest: null, kit: null, kit2: null, rooms: [], titles: [], seasons: [] }, ACC.prof || {});
    if (P0.name) store("kl_name", P0.name); if (P0.team) store("kl_team", P0.team);
    try { const l = JSON.parse(store("kl_rooms") || "[]"); (P0.rooms || []).forEach(r => { if (!l.some(x => x.c === r.c)) l.push(r); }); l.sort((a, b) => b.at - a.at); store("kl_rooms", JSON.stringify(l.slice(0, 5))); } catch (e) { }
    ACC.last = JSON.stringify(P0);
  }
  render();
}
const PROF_MI = -9; // editor do perfil usa este "time" fictício
function localProf() { try { return Object.assign({ name: store("kl_name") || "", team: store("kl_team") || "", crest: null, kit: null, kit2: null, titles: [], seasons: [], looks: [] }, JSON.parse(store("kl_prof") || "{}")); } catch (e) { return { name: store("kl_name") || "", team: store("kl_team") || "" }; } }
function getProf() { if (ACC.user) return ACC.prof || (ACC.prof = { name: "", team: "", titles: [], seasons: [], rooms: [] }); return UI.lprof || (UI.lprof = localProf()); }
function putProf(patch) {
  const P0 = getProf(); Object.assign(P0, patch);
  if (patch.name != null) store("kl_name", P0.name); if (patch.team != null) store("kl_team", P0.team);
  if (ACC.user) profSave(); else { try { store("kl_prof", JSON.stringify(P0)); } catch (e) { } }
}
function mgrOf(mi) { if (mi === PROF_MI) { const P0 = getProf(); if (!P0.crest || !P0.kit) { const p = {}; if (!P0.crest) p.crest = randCrest("#f5c542", P0.team || "Meu Time"); if (!P0.kit) p.kit = randKit((p.crest || P0.crest).c1 || "#f5c542"); putProf(p); } return P0; } return S.managers[mi]; }
function profSave(now) {
  if (!ACC.user || !ACC.prof) return;
  clearTimeout(ACC.saveT);
  ACC.saveT = setTimeout(async () => { try { const j = JSON.stringify(ACC.prof); if (j === ACC.last) return; const db = await window.claude.use("db"); if (db) { await db.doc("users/" + ACC.user.uid).set(Object.assign({}, ACC.prof, { at: Date.now() })); ACC.last = j; } } catch (e) { } }, now ? 0 : 2500);
}
// acompanha a sala: aplica o escudo/uniformes do perfil ao entrar e guarda o que você muda, títulos e temporadas
function profSync() {
  if (!S) return;
  if (NET.mode === "local") { // offline: o jogador 1 é você; o que mudar nele vai pro perfil
    const m = S.managers && S.managers[0], P0 = getProf(); if (!m || m.cpu) return; let ch = false;
    ["team", "crest", "kit", "kit2"].forEach(k => { if (m[k] == null) return; const v = JSON.parse(JSON.stringify(m[k])); if (JSON.stringify(P0[k]) !== JSON.stringify(v)) { P0[k] = v; ch = true; } });
    if (ch) { if (P0.team) store("kl_team", P0.team); if (ACC.user) profSave(); else { try { store("kl_prof", JSON.stringify(P0)); } catch (e) { } } }
    return;
  }
  const mi = myMi(); if (mi < 0) return; const m = S.managers[mi], P0 = getProf();
  UI.profApplied = UI.profApplied || {};
  if (!UI.profApplied[S.code]) {
    UI.profApplied[S.code] = true;
    if (S.phase === "lobby" && (P0.crest || P0.kit)) { const patch = { mi }; if (P0.crest) patch.crest = P0.crest; if (P0.kit) patch.kit = P0.kit; if (P0.kit2) patch.kit2 = P0.kit2; UI.profHold = Date.now() + 9000; act(Object.assign({ t: "editme" }, patch)); return; }
  }
  let ch = false;
  const hold = UI.profHold && Date.now() < UI.profHold && JSON.stringify(m.crest) !== JSON.stringify(P0.crest);
  (hold ? ["name", "team"] : ["name", "team", "crest", "kit", "kit2"]).forEach(k => { const v = m[k] == null ? null : JSON.parse(JSON.stringify(m[k])); if (JSON.stringify(P0[k]) !== JSON.stringify(v)) { P0[k] = v; ch = true; } });
  P0.rooms = P0.rooms || []; if (!P0.rooms.length || P0.rooms[0].c !== S.code) { P0.rooms = [{ c: S.code, at: Date.now(), t: m.team }].concat(P0.rooms.filter(r => r.c !== S.code)).slice(0, 5); ch = true; }
  ((S.hall && S.hall.titles) || []).forEach(t => { if (t.pid !== MYPID) return; const key = S.code + "-" + t.at; P0.titles = P0.titles || []; if (!P0.titles.some(x => x.k === key)) { P0.titles.push({ k: key, comp: t.comp, team: t.team, season: t.season || null, code: S.code, at: t.at }); ch = true; } });
  if (S.phase === "done" && S.season) { const key = S.code + "-" + (S.games || 0) + "-" + (S.career ? S.career.year : 0) + "-" + S.season.fmt; P0.seasons = P0.seasons || []; if (!P0.seasons.some(x => x.k === key)) { P0.seasons.push({ k: key, team: m.team, comp: S.season.fmt === "cup" ? "Kings Cup" : "Split", champ: S.season.champion === mi, at: Date.now() }); if (P0.seasons.length > 60) P0.seasons.shift(); ch = true; } }
  if (ch) { if (ACC.user) profSave(); else { try { store("kl_prof", JSON.stringify(P0)); } catch (e) { } } }
}
function accountChip() {
  const P0 = getProf(), me = S && S.managers ? S.managers[myMi()] : null;
  const pbtn = `<button class="btn sm ghost" data-a="profile" title="Seu escudo, uniformes, nome e conta">${ACC.user && ACC.user.photo ? `<img class="avatar" src="${esc(ACC.user.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="mcrest">${crestSVG(mgrOf(PROF_MI).crest, 16)}</span>`} Perfil</button>`;
  const adm = isAdmin() ? `<button class="btn sm ghost" data-a="adminpage" title="Colocar fotos dos jogadores e presidentes">📷 Fotos</button>` : "";
  if (!window.klAuth || ACC.user || S) return adm + pbtn;
  return pbtn + `<button class="btn sm" data-a="login">Entrar</button>`;
}
const AUTH_ERR = { "auth/invalid-email": "E-mail inválido.", "auth/missing-password": "Digite a senha.", "auth/weak-password": "A senha precisa de pelo menos 6 caracteres.", "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Use Entrar.", "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/wrong-password": "E-mail ou senha incorretos.", "auth/user-not-found": "Não achei conta com esse e-mail. Use Criar conta.", "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.", "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.", "auth/cancelled-popup-request": "A janela do Google foi fechada antes de terminar.", "auth/unauthorized-domain": "Este endereço do site ainda não está liberado para login.", "auth/network-request-failed": "Sem conexão. Confira a internet.", "auth/operation-not-allowed": "Esse tipo de login ainda não está ativado no Firebase.", "auth/web-storage-unsupported": "Seu navegador está bloqueando o login (modo privado ou navegador de app). Tente pelo Safari/Chrome normal ou use e-mail e senha." };
function authErr(e) { return AUTH_ERR[e && e.code] || "Não deu certo (" + ((e && e.code) || "erro") + "). Tente de novo ou use e-mail e senha."; }
function inAppBrowser() { return /Instagram|FBAN|FBAV|WhatsApp|Line\/|Twitter|TikTok|Snapchat/i.test(navigator.userAgent || ""); }
function loginModal() {
  if (!UI.loginOpen || !window.klAuth || ACC.user) return "";
  const L = UI.lg = UI.lg || { mode: "in", msg: "", busy: false };
  const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return `<div class="modal-bg" data-a="loginclose"></div><div class="modal login" role="dialog" aria-modal="true" aria-label="Entrar">
    <button class="btn sm ghost mclose" data-a="loginclose" aria-label="Fechar">✕</button>
    <div class="login-hd">${CROWN}<div><h2>The Kings Game</h2><span class="muted">Entre para guardar seu escudo, uniformes, salas e títulos em qualquer aparelho.</span></div></div>
    ${inAppBrowser() ? `<div class="unhbox">Você abriu pelo navegador de um app (Instagram, WhatsApp...). O Google não deixa entrar por aqui: abra o link no Safari ou no Chrome, ou use e-mail e senha.</div>` : ""}
    <button class="btn gbtn big" data-a="logingoogle" ${L.busy ? "disabled" : ""}><span class="g-ico">G</span> Continuar com Google</button>
    <div class="orline"><span>ou com e-mail</span></div>
    <div class="tabs2"><button class="${L.mode === "in" ? "on" : ""}" data-a="lgmode" data-v="in">Entrar</button><button class="${L.mode === "up" ? "on" : ""}" data-a="lgmode" data-v="up">Criar conta</button></div>
    <form id="lgform" class="lgform" autocomplete="on">
      ${L.mode === "up" ? `<label class="f" for="lg-name">Nome de presidente<input id="lg-name" type="text" maxlength="18" autocomplete="nickname" value="${esc(getProf().name || "")}"></label>` : ""}
      <label class="f" for="lg-email">E-mail<input id="lg-email" type="email" autocomplete="email" inputmode="email" value="${esc(L.email || "")}"></label>
      <label class="f" for="lg-pass">Senha${L.mode === "up" ? " (mínimo 6 caracteres)" : ""}<input id="lg-pass" type="password" autocomplete="${L.mode === "up" ? "new-password" : "current-password"}"></label>
      <button class="btn gold big" type="submit" ${L.busy ? "disabled" : ""}>${L.busy ? "Aguarde…" : L.mode === "up" ? "Criar conta" : "Entrar"}</button>
      ${L.mode === "in" ? `<button class="btn sm ghost" type="button" data-a="lgreset">Esqueci a senha</button>` : ""}
    </form>
    ${L.msg ? `<p class="${L.ok ? "okmsg" : "err"}" role="status" style="margin:0">${esc(L.msg)}</p>` : ""}
    ${iOS ? `<p class="muted" style="font-size:12px;margin:0">No iPhone: se a janela do Google não abrir ou voltar sem entrar, use e-mail e senha, que funciona em qualquer aparelho.</p>` : ""}
    <button class="btn ghost" data-a="loginclose">Continuar sem conta</button>
  </div>`;
}
async function emailSubmit() {
  const L = UI.lg = UI.lg || { mode: "in" }; const email = ($("#lg-email") || {}).value || "", pass = ($("#lg-pass") || {}).value || "", name = (($("#lg-name") || {}).value || "").trim();
  L.email = email.trim(); L.busy = true; L.msg = ""; L.ok = false; render(true);
  try { if (L.mode === "up") { await window.klAuth.emailUp(L.email, pass, name); if (name) putProf({ name }); } else await window.klAuth.emailIn(L.email, pass); UI.loginOpen = false; toast("Bem-vindo, " + (name || getProf().name || "presidente") + "!"); }
  catch (e) { L.msg = authErr(e); }
  L.busy = false; render(true);
}
function viewProfile() {
  const P0 = getProf(), mp = mgrOf(PROF_MI), me = S && S.managers ? myMi() : -1;
  const t = (P0.titles || []), se = (P0.seasons || []);
  const acc = !window.klAuth ? `<p class="muted" style="margin:0">Neste modo o perfil fica salvo só neste aparelho.</p>`
    : ACC.user ? `<div class="muted" style="font-size:12px">ID da conta: <code>${esc(ACC.user.uid)}</code> <button class="btn sm ghost" data-a="copyuid">Copiar</button></div><div class="row" style="gap:10px">${ACC.user.photo ? `<img class="avatar lg" src="${esc(ACC.user.photo)}" alt="" referrerpolicy="no-referrer">` : ""}<div style="flex:1"><b>${esc(ACC.user.name || P0.name || "Conta")}</b><div class="muted" style="font-size:13px">${esc(ACC.user.email || "")} · tudo salvo na sua conta</div></div>${S ? "" : `<button class="btn sm ghost" data-a="logout">Sair da conta</button>`}</div>`
    : `<div class="row" style="gap:10px"><div style="flex:1"><b>Você está sem conta</b><div class="muted" style="font-size:13px">O perfil fica salvo só neste navegador. Entre para levar para qualquer aparelho.</div></div><button class="btn gold" data-a="login">Entrar ou criar conta</button></div>`;
  return `<div class="sec-title"><h2>Meu perfil</h2><button class="btn sm ghost" data-a="profileclose">← Voltar ${S ? "para o jogo" : ""}</button></div>
  <div class="card" style="display:grid;gap:12px">${acc}
    <div class="grid2" style="gap:10px">
      <label class="f" for="pf-name">Nome de presidente<input id="pf-name" type="text" maxlength="18" value="${esc(P0.name || "")}"></label>
      <label class="f" for="pf-team">Nome do time<input id="pf-team" type="text" maxlength="24" value="${esc(P0.team || "")}"></label>
    </div>
    <div class="row" style="gap:8px;font-size:13px"><span class="pill ${t.length ? "you" : ""}">🏆 ${t.length} título${t.length === 1 ? "" : "s"}</span><span class="pill">${se.length} competiç${se.length === 1 ? "ão" : "ões"} jogada${se.length === 1 ? "" : "s"}</span>${t.slice(-4).reverse().map(x => `<span class="pill">${esc(x.comp)} · ${esc(x.team)}</span>`).join("")}</div>
    ${S && me >= 0 && NET.mode !== "local" ? `<div class="row" style="gap:8px"><button class="btn sm gold" data-a="profapply">Usar este escudo e uniformes no meu time desta sala</button><span class="muted" style="font-size:12.5px">${S.phase === "lobby" ? "O nome do time também muda." : "O nome do time só muda no vestiário."}</span></div>` : ""}
    <p class="muted" style="font-size:12.5px;margin:0">O escudo e os uniformes do perfil entram sozinhos quando você cria ou entra numa sala nova.</p>
  </div>
  ${crestEditor(PROF_MI)}`;
}
function profileCard() {
  if (!window.klAuth || ACC.user) return "";
  return `<div class="card acccard"><div style="flex:1"><b>Entre para guardar seu perfil</b><div class="muted" style="font-size:13px">Escudo, uniformes, nome do time, salas e títulos salvos na sua conta, em qualquer aparelho. Sem conta também dá pra jogar normalmente.</div></div><button class="btn gold" data-a="login">Entrar ou criar conta</button></div>`;
}

const NET = { mode: "none", code: null, db: null, rjoin: null, docRef: null, liveRef: null, unsub: [], busy: false, pending: false, lastWrite: 0, lbusy: false, lpending: false, llast: 0, seq: Date.now(), queue: [], clockOff: 0, canWriteIn: true };
let S = null;      // estado do jogo
let LIVE = null;   // partida que este aparelho está assistindo
let LIVES = {};    // todas as partidas ao vivo da rodada (fid -> partida)
const EVS = {};    // eventos das partidas (modo local / cache)
const UI = { tab: "time", editMi: null, err: "", homeErr: "", busy: false, gate: null, speed: 1, paused: false };

function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("on"), 2600); }
function myMi() { return S ? S.managers.findIndex(m => m.pid === MYPID) : -1; }
function runsGame() { return NET.mode === "local" || (NET.mode === "host" && !NET.handing); }
function isHost() { return runsGame() || (!!NET.srv && NET.mode === "client" && !!S && S.hostPid === MYPID); } // botões de anfitrião (no servidor: quem criou a sala)
function now() { return Date.now(); }
function hostClock() { return Date.now() + (NET.mode === "client" ? NET.clockOff : 0); }
function humansIdx() { return S.managers.map((m, i) => i).filter(i => !S.managers[i].cpu); }

/* ---------- ações ---------- */
function act(a) {
  if (!S) return;
  if (a.t === "m" && a.a && a.a.fid == null && LIVE) a.a.fid = LIVE.fid;
  if (a.t === "lff" && a.fid == null && LIVE) a.fid = LIVE.fid;
  if (NET.mode === "local" || NET.mode === "host") {
    const mi = a.mi != null && NET.mode === "local" ? a.mi : myMi();
    NET.urgent = true; NET.lurgent = true;
    if (a.t === "m") return liveAct(a.a, mi);
    if (hostOnly(a)) return hostAction(a);
    if (applyAction(S, a, mi, true, now())) commit(); else if (a.t === "bid") toast("Lance não aceito: confira saldo e vagas.");
  } else if (NET.mode === "client") sendIntent(a);
}
function hostOnly(a) { return ["quickround", "simstage", "lspeed", "lpause", "lff"].includes(a.t); }
function commit() {
  if (S.phase === "lobby" && Object.keys(LIVES).length) { LIVES = {}; UI.watch = null; LIVE = null; if (NET.mode === "host") writeLive(); try { renderLive(); } catch (e) { } }
  S.rev = (S.rev || 0) + 1; S.hostNow = now();
  render();
  if (NET.mode === "host") scheduleWrite();
  if (NET.mode === "local") saveLocal();
}
function saveLocal() { try { const j = JSON.stringify(S); sessionStorage.setItem("kl_local2", j); localStorage.setItem("kl_save", j); localStorage.setItem("kl_save_at", String(Date.now())); } catch (e) { } }
function savedLocal() { try { const raw = JSON.parse(localStorage.getItem("kl_save") || "null"); return raw && raw.mode === "local" && raw.v === 2 ? raw : null; } catch (e) { return null; } }
function loadLocal(raw) { S = raw; setPov(S.pov); NET.mode = "local"; NET.code = "LOCL"; LIVES = {}; UI.watch = null; startLoop(); commit(); renderLive(true); }
async function exportSave() {
  const name = `the-kings-game-${(S.code || "jogo").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, data = JSON.stringify({ kl: 1, at: Date.now(), S });
  try { const dl = window.claude && window.claude.use ? await window.claude.use("downloads").catch(() => null) : null; if (dl) { await dl.save({ filename: name, data }); toast("Progresso salvo no arquivo."); return; } } catch (e) { toast("O arquivo não foi salvo."); return; }
  try { const blob = new Blob([JSON.stringify({ kl: 1, at: Date.now(), S })], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `the-kings-game-${(S.code || "jogo").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500); toast("Progresso salvo no arquivo."); } catch (e) { toast("Não consegui gerar o arquivo aqui."); }
}
function importSave(file) {
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result), raw = d && d.S ? d.S : d; if (!raw || raw.v !== 2 || !Array.isArray(raw.managers)) throw 0; raw.mode = "local"; raw.code = "LOCL"; raw.managers.forEach((m, i) => { if (!m.cpu && !/^local/.test(m.pid)) m.pid = "local" + i; }); delete raw.away; loadLocal(raw); toast("Jogo carregado!"); } catch (e) { UI.homeErr = "Esse arquivo não é um jogo salvo do The Kings Game."; render(); } };
  r.readAsText(file);
}
// ---- relógio que não para com a aba em segundo plano ----
// O navegador desacelera (até 1x por minuto) os timers de abas escondidas. Um Worker continua batendo,
// então o anfitrião segue rodando o jogo mesmo minimizado. Sem Worker, cai no setInterval normal.
const WTICK = { list: [], started: false, lastW: 0 };
function tickEvery(fn, ms) {
  WTICK.list.push({ fn, ms, last: 0 });
  if (!WTICK.started) {
    WTICK.started = true;
    const run = () => { const t = Date.now(); WTICK.list.forEach(x => { if (t - x.last >= x.ms) { x.last = t; try { x.fn(); } catch (e) { } } }); };
    try { const b = new Blob(["setInterval(function(){postMessage(0)},50)"], { type: "text/javascript" }); const w = new Worker(URL.createObjectURL(b)); w.onmessage = () => { WTICK.lastW = Date.now(); run(); }; WTICK.w = w; } catch (e) { }
    setInterval(() => { if (Date.now() - WTICK.lastW > 400) run(); }, 50);
  }
}
// ---- só um anfitrião por vez ----
// Antes de gravar, o anfitrião confere se a sala ainda é dele. Se outro aparelho assumiu enquanto este
// estava parado (celular bloqueado, aba minimizada), este vira convidado e NÃO sobrescreve o jogo novo.
async function hostStillMine() {
  if (NET.mode !== "host" || !NET.docRef) return false;
  if (Date.now() - (NET.hostOk || 0) < 2500 && !NET.wasHidden) return true;
  if (NET.docRef.setIfHost && !NET.wasHidden && Date.now() - (NET.hostOk || 0) < 20000) return true; // a gravação com transação já confere no servidor
  if (Date.now() - (NET.hostChkAt || 0) < 1000) return false; NET.hostChkAt = Date.now();
  try {
    const d = await NET.docRef.get(); const x = d.exists ? d.data() : null;
    if (NET.mode !== "host") return false;
    if (x && x.hostPid && x.hostPid !== MYPID && (x.rev || 0) >= 0) { demoteToClient(); return false; }
    NET.hostOk = Date.now(); NET.wasHidden = false; return true;
  } catch (e) { return false; } // sem conseguir confirmar, não grava agora (tenta de novo no próximo tique)
}
// o anfitrião saiu da tela: passa a sala NA HORA para um amigo que está com o jogo aberto,
// assim o jogo continua rolando sem esperar (o celular/navegador pode pausar este aparelho)
async function handoffHost() {
  if (NET.mode !== "host" || !S || !NET.docRef || NET.handing) return;
  const t = Date.now(), seen0 = NET.seen || {}, vis = NET.visOf || {};
  const cand = S.managers.filter((m, i) => !m.cpu && m.pid !== MYPID && !(S.away && S.away[i]) && seen0[m.pid] && t - seen0[m.pid] < 15000 && vis[m.pid] !== false).map(m => m.pid)[0];
  if (!cand) return; // ninguém com o jogo aberto: continua aqui (o assumir automático cobre)
  NET.handing = true;
  try {
    const st = JSON.parse(JSON.stringify(S)); st.hostPid = cand; st.prevHost = MYPID; st.rev = (st.rev || 0) + 1; st.hostNow = now();
    await dbSetHost(NET.docRef, st);
    try { await dbSetHost(NET.liveRef, { ms: JSON.parse(JSON.stringify(LIVES)), hostNow: now(), hostPid: cand }); } catch (e) { }
    S = st; NET.handing = false; demoteToClient(true);
  } catch (e) { NET.handing = false; lostHost(e); }
}
document.addEventListener("visibilitychange", () => { if (NET.srv && !document.hidden && !NET.ws && NET.code) srvConnect(NET.code, {}, null); if (NET.mode === "client" && (NET.db || NET.srv)) { NET.hbAt = Date.now(); heartbeat(); } if (document.hidden) { NET.hiddenAt = Date.now(); if (NET.mode === "host" && S && S.phase !== "lobby") handoffHost(); return; } if (UI.hiddenRender) { UI.hiddenRender = false; try { render(true); renderLive(true); } catch (e) { } } if (NET.hiddenAt && Date.now() - NET.hiddenAt > 8000) NET.wasHidden = true; if (NET.mode === "host") hostStillMine(); });
// grava conferindo, no próprio servidor e no mesmo instante, que a sala ainda é deste anfitrião
// (uma gravação que ficou "na fila" enquanto o celular dormia é recusada se outro já assumiu)
async function dbSetHost(ref, data) {
  if (ref.setIfHost) { await ref.setIfHost(data, MYPID, NET.claimFrom || null); NET.hostOk = Date.now(); return; }
  await ref.set(data);
}
function lostHost(e) { if (e && e.code === "not-host" && NET.mode === "host") { demoteToClient(); return true; } return false; }
function scheduleWrite() { NET.dirty = true; }
async function flushWrite() {
  if (NET.mode !== "host" || !NET.dirty || NET.busy || !S) return;
  // ação de alguém: grava logo; mudança de rotina (relógio, bots): no máximo 1x por segundo
  if (Date.now() - (NET.lastWrite || 0) < (NET.urgent ? (window.KL_STATE_MS || 220) : 1500)) return;
  NET.urgent = false;
  NET.busy = true; NET.dirty = false;
  try {
    if (await hostStillMine()) { S.hostNow = now(); await dbSetHost(NET.docRef, JSON.parse(JSON.stringify(S))); } else if (NET.mode === "host") NET.dirty = true;
  } catch (e) { if (lostHost(e)) { NET.busy = false; return; } NET.dirty = true; if (e && e.code === "quota_exceeded") toast("Limite de armazenamento atingido."); }
  NET.lastWrite = Date.now(); NET.busy = false;
}
tickEvery(flushWrite, 50);
const LIVE_URGENT = { goal: 1, card: 1, pp: 1, penres: 1, dice: 1, so: 1, sores: 1, inj: 1, red: 1 };
function writeLive() { if (NET.mode === "host") NET.ldirty = true; }
async function flushLive() {
  if (NET.mode !== "host" || !NET.ldirty || NET.lbusy || !NET.liveRef) return;
  // lance importante (gol, carta, pênalti, dado…) vai na hora; o resto da partida, 1x por segundo
  if (!NET.lurgent) { NET.levSeen = NET.levSeen || {}; for (const M of Object.values(LIVES)) { const e = M.ev && M.ev[M.ev.length - 1]; if (e && e.i > (NET.levSeen[M.fid] || 0) && LIVE_URGENT[e.type]) { NET.lurgent = true; } if (e) NET.levSeen[M.fid] = e.i; } }
  if (Date.now() - (NET.llast || 0) < (NET.lurgent ? (window.KL_LIVE_MS || 250) : 1500)) return;
  NET.lurgent = false;
  NET.lbusy = true; NET.ldirty = false;
  try { if (await hostStillMine()) { const d = { ms: JSON.parse(JSON.stringify(LIVES)), hostNow: now(), hostPid: MYPID }; await dbSetHost(NET.liveRef, d); } else if (NET.mode === "host") NET.ldirty = true; } catch (e) { if (!lostHost(e)) NET.ldirty = true; }
  NET.llast = Date.now(); NET.lbusy = false;
}
tickEvery(flushLive, 50);

/* ---------- intenções dos convidados ---------- */
function sendIntent(a) {
  NET.seq++;
  NET.queue.push({ s: NET.seq, a });
  if (NET.queue.length > 8) NET.queue.shift();
  if (NET.srv) { srvSend({ t: "in", q: [{ s: NET.seq, a }] }); return; }
  const pres = { kl: { pid: MYPID, q: NET.queue } };
  [NET.rjoin, NET.lobby].forEach(r => { try { r && r.presence && r.presence(pres); } catch (e) { } });
  if (NET.db) { try { NET.db.doc(`games/${NET.code}/in/${MYPID}`).set({ pid: MYPID, q: NET.queue, hb: Date.now(), vis: !document.hidden }).then(() => { NET.writeOk = true; }).catch(e => { NET.writeOk = false; NET.writeErr = (e && e.code) || "erro"; }); } catch (e) { NET.writeOk = false; NET.writeErr = "erro"; } }
}
// marca quem está vivo pela hora em que o anfitrião RECEBE um batimento novo (não depende do relógio de cada aparelho)
function seen(pid, hb) { if (!pid || pid === MYPID) return; NET.seen = NET.seen || {}; NET.hbv = NET.hbv || {}; if (hb) { if (NET.hbv[pid] === hb) return; const first = NET.hbv[pid] == null; NET.hbv[pid] = hb; if (first && Date.now() - hb > AWAY_MS && Math.abs(Date.now() - hb) < 3600000) return; } NET.seen[pid] = Date.now(); }
function handleIntents(pid, q, hb, vis, bye) {
  if (NET.mode !== "host" || !S || !pid) return;
  if (bye && pid !== MYPID) { NET.seen = NET.seen || {}; NET.seen[pid] = 1; NET.hbv = NET.hbv || {}; NET.hbv[pid] = hb; NET.awayChk = 0; return; }
  if (vis != null) { NET.visOf = NET.visOf || {}; NET.visOf[pid] = vis; }
  if (hb) seen(pid, hb);
  if (!Array.isArray(q)) return;
  S.seqs = S.seqs || {};
  let changed = false, touched = false;
  q.slice().sort((x, y) => x.s - y.s).forEach(it => {
    if (!it || typeof it.s !== "number" || it.s <= (S.seqs[pid] || 0)) return;
    S.seqs[pid] = it.s; touched = true;
    const a = Object.assign({}, it.a || {});
    if (a.t === "join" || a.t === "takebot") a.pid = pid;
    if (hostOnly(a) || ["settings", "start", "pause", "autofill", "kick", "wcclose", "tclose", "keepclose", "relobby"].includes(a.t)) return;
    const mi = S.managers.findIndex(m => m.pid === pid);
    if (a.t === "m") { NET.lurgent = true; liveAct(a.a || {}, mi); touched = true; return; }
    if (applyAction(S, a, mi, false, now())) { changed = true; if (a.t === "takebot") Object.values(LIVES).forEach(M => M.t.forEach(T => { if (T.mi === a.mi) { T.cpu = false; T.bot = false; } })); }
  });
  if (changed) { NET.urgent = true; commit(); } else if (touched) scheduleWrite();
}
function peersList(p) { if (!p) return []; if (Array.isArray(p)) return p; if (p instanceof Map) return [...p.values()]; if (typeof p === "object") return Object.values(p); return []; }
function findKl(o, d) { if (!o || typeof o !== "object" || d > 4) return null; if (o.kl && o.kl.pid) return o.kl; for (const v of Object.values(o)) { const r = findKl(v, d + 1); if (r) return r; } return null; }
function onPeers(peers) {
  NET.peers = peersList(peers).length;
  peersList(peers).forEach(pr => { const k = findKl(pr, 0); if (k && k.pid !== MYPID) { NET.gotPresence = true; if (NET.mode === "host") seen(k.pid); handleIntents(k.pid, k.q); } });
}
function applyRemote(data) {
  if (!data || NET.mode !== "client") return;
  if (data.hostPid === MYPID && data.prevHost && !NET.promoting) { // o anfitrião passou a sala para este aparelho
    NET.promoting = true; S = JSON.parse(JSON.stringify(data)); setPov(S.pov); NET.claimFrom = data.prevHost; delete S.prevHost;
    NET.unsub.forEach(u => { try { u(); } catch (e) { } }); NET.unsub = [];
    addLog(S, `${(S.managers.find(m => m.pid === MYPID) || {}).name || "Outro jogador"} assumiu a sala para o jogo não parar.`);
    toast("O anfitrião saiu da tela: a sala está rodando no seu aparelho agora.");
    becomeHost(NET.lobby).finally(() => { NET.promoting = false; }); return;
  }
  NET.lastSync = Date.now();
  if (S && data.code === S.code && (data.rev || 0) <= (S.rev || 0) && S.phase === data.phase) { if (data.rev === S.rev) return; if ((data.rev || 0) < (S.rev || 0)) return; }
  const before = S && S.season ? S.season.fixtures.filter(f => f.res).length : 0;
  S = JSON.parse(JSON.stringify(data));
  setPov(S.pov);
  applyLocalOverrides(); applyOptimistic();
  if (S.hostNow && S.hostNow > (NET.lastHostNow || 0)) { NET.lastHostNow = S.hostNow; NET.clockOff = S.hostNow - Date.now(); }
  NET.lastSync = Date.now();
  render(); renderChat();
}
function applyRemoteLive(d) {
  if (NET.mode !== "client") return;
  if (d && d.hostNow && NET.liveNow && d.hostNow <= NET.liveNow) return;
  if (d && d.hostNow) { NET.liveNow = d.hostNow; NET.clockOff = d.hostNow - Date.now(); }
  LIVES = d && d.ms && typeof d.ms === "object" ? d.ms : {};
  syncLive(); renderLive(); updateRoundBoard();
}
/* qual partida este aparelho mostra */
function myLiveTeams(M) { return NET.mode === "local" ? M.t.filter(T => !T.cpu).length > 0 : M.t.some(T => T.mi === myMi() && !T.cpu); }
function syncLive() {
  UI.dismiss = UI.dismiss || {};
  if (UI.watch && !LIVES[UI.watch]) UI.watch = null;
  if (!UI.watch) {
    const ms = Object.values(LIVES);
    const mine = ms.find(M => M.status === "playing" && myLiveTeams(M) && !UI.dismiss[M.fid] && !(M.pending && false));
    if (mine) { UI.watch = mine.fid; UI.hideLive = false; }
  }
  if (NET.mode === "local") {
    const cur = UI.watch ? LIVES[UI.watch] : null;
    const needs = M => M.status === "playing" && M.pending && chooser(M).some(n => !M.t[n.team].cpu);
    if (!cur || !needs(cur)) { const o = Object.values(LIVES).find(needs); if (o && (!cur || cur.status === "done" || !UI.dismiss[o.fid])) { UI.watch = o.fid; UI.hideLive = false; } }
  }
  LIVE = UI.watch ? LIVES[UI.watch] : null;
}
function setWatch(fid) { UI.watch = fid; UI.dismiss = UI.dismiss || {}; delete UI.dismiss[fid]; UI.hideLive = false; syncLive(); renderLive(true); }
function anyLive() { return Object.values(LIVES).some(M => M.status === "playing"); }
let pollT = null;
function startPoll() {
  if (pollT) return;
  pollT = true; tickEvery(async () => {
    if (!NET.db || !NET.code) return;
    try {
      const t = Date.now();
      if (NET.mode === "host") {
        // conferência de segurança: o aviso automático (listener) já entrega tudo; aqui só a cada 30s, ou mais rápido se ele falhar
        if (!(NET.inSnapErr || !NET.inSnapAt || t - (NET.lastHPoll || 0) > 30000)) return;
        if (t - (NET.lastHPoll || 0) < (NET.inSnapErr ? 3000 : 30000)) return;
        NET.lastHPoll = t;
        const snap = await NET.db.collection(`games/${NET.code}/in`).get();
        snap.docs.forEach(d => { const x = d.data(); if (x) handleIntents(x.pid || d.id, x.q, x.hb, x.vis, x.bye); });
        // outro aparelho virou anfitrião enquanto este estava parado? então este vira convidado
        const md = await NET.docRef.get(); const mdd = md.exists ? md.data() : null;
        if (mdd && mdd.hostPid && mdd.hostPid !== MYPID) { demoteToClient(); return; }
        if (mdd) NET.hostOk = Date.now();
      } else if (NET.mode === "client") {
        // só consulta direto se o aviso automático falhou ou ficou muito tempo calado
        const quiet = t - Math.max(NET.lastSync || 0, NET.liveNowAt || 0) > 15000, need = NET.snapErr || quiet;
        if (need && t - (NET.lastCPoll || 0) > (NET.snapErr ? 2500 : 15000)) {
          NET.lastCPoll = t;
          const d = await NET.docRef.get(); if (d.exists) applyRemote(d.data());
          const l = await NET.liveRef.get(); applyRemoteLive(l.exists ? l.data() : null);
        }
        if (myMi() < 0 && S && NET.joinInfo && Date.now() - (NET.lastJoin || 0) > (S.phase === "lobby" ? 4000 : 8000)) { NET.lastJoin = Date.now(); sendIntent({ t: "join", name: NET.joinInfo.name, team: NET.joinInfo.team, prev: ANON_PID }); }
      }
    } catch (e) { NET.pollErr = (e && e.code) || "erro"; }
  }, window.KL_POLL_MS || 700);
}

/* ---------- conexão ---------- */
async function getCaps() {
  if (!window.claude || !window.claude.use) return { db: null, room: null };
  const [db, room] = await Promise.all([window.claude.use("db").catch(() => null), window.claude.use("room").catch(() => null)]);
  return { db, room };
}
async function joinRoom(room, code) {
  if (!room) return null;
  try { let r = room.join ? room.join("kl-" + code) : room; if (r && r.then) r = await r; return r || null; } catch (e) { return null; }
}
function inviteCode() { try { const c = new URLSearchParams(location.search).get("sala"); return c && /^[A-Za-z]{4}$/.test(c) ? c.toUpperCase() : ""; } catch (e) { return ""; } }
function genCode() { const L = "ABCDEFGHJKLMNPQRSTUVWXYZ"; let c = ""; for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)]; return c; }
async function createOnline() {
  const name = $("#h-name").value.trim(), team = $("#h-team").value.trim();
  if (!name || !team) { UI.homeErr = "Escreva seu nome e o nome do seu time."; return render(); }
  store("kl_name", name); store("kl_team", team);
  UI.busy = true; UI.homeErr = "Criando a sala…"; render();
  if (window.KL_SERVER) return srvCreate(name, team);
  const { db, room } = await getCaps();
  if (!db) { UI.busy = false; UI.homeErr = (window.KL_SITE ? "Não consegui conectar ao banco da sala (Firebase). Confira o arquivo firebase-config.js e sua internet. Enquanto isso, dá pra jogar no modo 'um aparelho só'." : "Não consegui abrir o banco de dados da sala. Abra esta página pelo claude.ai com sua conta. Enquanto isso, dá pra jogar no modo 'um aparelho só'."); return render(); }
  const code = genCode();
  S = newGame(code, MYPID, name, team, "online");
  if (ADMIN_CFG.defaults) { try { applyAction(S, { t: "settings", v: ADMIN_CFG.defaults }, 0, true, Date.now()); } catch (e) { } }
  NET.db = db; NET.code = code; NET.docRef = db.doc("games/" + code); NET.liveRef = db.doc("live/" + code);
  try { await NET.docRef.set(JSON.parse(JSON.stringify(S))); await NET.liveRef.set({ status: "none" }); }
  catch (e) { UI.busy = false; S = null; UI.homeErr = "Sua conta só pode assistir salas aqui (sem permissão de gravar). Peça para o dono do artefato criar a sala, ou jogue no modo 'um aparelho só'."; return render(); }
  becomeHost(room);
}
async function becomeHost(room) {
  try { if (navigator.locks && !NET.lockHeld) { NET.lockHeld = true; navigator.locks.request("kl-host", () => new Promise(r => { NET.lockRelease = r; })); } } catch (e) { }
  NET.mode = "host"; NET.hostOk = Date.now(); NET.wasHidden = false; store("kl_last", NET.code); rememberRoom(NET.code);
  if (S) { S.hostPid = MYPID; S.away = S.away || {}; const me = S.managers.findIndex(m => m.pid === MYPID); if (me >= 0) delete S.away[me]; }
  NET.seen = {}; NET.hbv = {}; NET.hostSince = Date.now();
  NET.liveRef = NET.db.doc("live/" + NET.code);
  try { const l = await NET.liveRef.get(); const d = l.exists ? l.data() : null; if (d && d.ms) { LIVES = d.ms; syncLive(); } } catch (e) { }
  const lobby = room || (await getCaps()).room;
  NET.rjoin = await joinRoom(lobby, NET.code);
  [NET.rjoin, lobby].forEach(r => { if (r && r.onPeers) { try { r.presence && r.presence({ kl: { pid: MYPID, host: true, q: [] } }); r.onPeers(onPeers); } catch (e) { } } });
  NET.lobby = lobby; startPoll();
  NET.inSnapErr = false; NET.inSnapAt = 0;
  try { NET.unsub.push(NET.db.collection(`games/${NET.code}/in`).onSnapshot(snap => { NET.inSnapAt = Date.now(); NET.inSnapErr = false; snap.docs.forEach(d => { const x = d.data(); if (x) handleIntents(x.pid || d.id, x.q, x.hb, x.vis, x.bye); }); }, e => { NET.inSnapErr = true; })); } catch (e) { NET.inSnapErr = true; }
  startLoop(); UI.busy = false; UI.homeErr = "";
  commit(); renderLive();
}
function rememberRoom(code) { try { const l = JSON.parse(store("kl_rooms") || "[]").filter(x => x.c !== code); l.unshift({ c: code, at: Date.now(), t: store("kl_team") || "" }); store("kl_rooms", JSON.stringify(l.slice(0, 5))); } catch (e) { } }
function demoteToClient(quiet) {
  const code = NET.code; NET.unsub.forEach(u => { try { u(); } catch (e) { } }); NET.unsub = [];
  NET.mode = "none"; NET.claimFrom = null; NET.dirty = false; NET.ldirty = false;
  if (NET.lockRelease) { try { NET.lockRelease(); } catch (e) { } NET.lockRelease = null; NET.lockHeld = false; } if (!quiet) toast("Outro aparelho assumiu como anfitrião. Reconectando como convidado…");
  joinOnline(code, store("kl_name") || "Presidente", store("kl_team") || "Meu Time FC");
}
async function joinOnline(c0, n0, t0) {
  const code = (c0 || $("#j-code").value).trim().toUpperCase(), name = (n0 || $("#j-name").value).trim(), team = (t0 || $("#j-team").value).trim();
  if (code.length !== 4) { UI.homeErr = "O código da sala tem 4 letras."; return render(); }
  if (!name || !team) { UI.homeErr = "Escreva seu nome e o nome do seu time."; return render(); }
  store("kl_name", name); store("kl_team", team);
  UI.busy = true; UI.homeErr = "Entrando…"; render();
  if (window.KL_SERVER) return srvJoin(code, name, team);
  const { db, room } = await getCaps();
  if (!db) { UI.busy = false; UI.homeErr = (window.KL_SITE ? "Não consegui conectar ao banco da sala. Confira sua internet e tente de novo." : "Não consegui conectar. Abra esta página logado no claude.ai pelo link que o dono compartilhou."); return render(); }
  NET.db = db; NET.code = code; NET.docRef = db.doc("games/" + code); NET.liveRef = db.doc("live/" + code);
  let first = true;
  const timer = setTimeout(() => { if (first) { UI.homeErr = "A sala está demorando para responder. Confira o código e sua conexão."; render(); } }, 10000);
  NET.snapErr = false;
  NET.unsub.push(NET.docRef.onSnapshot(snap => {
    NET.snapErr = false;
    if (!snap.exists) {
      if (!snap.metadata.fromCache && first) { clearTimeout(timer); first = false; UI.busy = false; UI.homeErr = `Não achei a sala ${code}. Confira o código com o anfitrião.`; NET.unsub.forEach(u => u()); NET.unsub = []; render(); }
      return;
    }
    const data = snap.data();
    if (first) {
      clearTimeout(timer); first = false;
      if (MYPID !== ANON_PID && !data.managers.some(m => m.pid === MYPID) && data.managers.some(m => m.pid === ANON_PID) && (data.hostPid === ANON_PID)) { data.managers.forEach(m => { if (m.pid === ANON_PID) m.pid = MYPID; }); data.hostPid = MYPID; }
      if (data.hostPid === MYPID) { S = JSON.parse(JSON.stringify(data)); setPov(S.pov); NET.unsub.forEach(u => u()); NET.unsub = []; becomeHost(room); return; }
      NET.mode = "client"; store("kl_last", code); rememberRoom(code); UI.busy = false; UI.homeErr = "";
      NET.joinInfo = { name, team };
      (async () => {
        NET.lobby = room; NET.rjoin = await joinRoom(room, code);
        if (!data.managers.some(m => m.pid === MYPID)) { NET.lastJoin = Date.now(); sendIntent({ t: "join", name, team, prev: ANON_PID }); }
        startLoop(); startPoll(); render();
      })();
      NET.unsub.push(NET.liveRef.onSnapshot(ls => { NET.liveNowAt = Date.now(); applyRemoteLive(ls.exists ? ls.data() : null); }, () => { NET.snapErr = true; }));
    }
    if (NET.mode === "client") applyRemote(data);
  }, e => { NET.snapErr = true; if (first) { UI.busy = false; UI.homeErr = "Não consegui ler a sala (" + (e && e.code || "erro") + ")."; render(); } }));
}

/* ---------- servidor na nuvem (Cloudflare) ----------
   Com window.KL_SERVER definido, a sala roda no servidor: este aparelho só manda ações e mostra o jogo.
   Ninguém é "anfitrião técnico"; se qualquer um fechar o site, o jogo segue e o bot assume o time dele. */
function srvUrl(code) { return String(window.KL_SERVER).replace(/^http/, "ws").replace(/\/+$/, "") + "/room/" + code; }
function srvSend(o) { const ws = NET.ws; if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); return true; } catch (e) { } } return false; }
function srvConnect(code, hello, onS) {
  NET.srv = true; NET.code = code; NET.srvOnS = onS || NET.srvOnS || null;
  let ws; try { ws = new WebSocket(srvUrl(code)); } catch (e) { return srvRetry(); }
  NET.ws = ws;
  ws.onopen = () => {
    NET.wsOk = true; NET.wsTry = 0; NET.wsLost = 0;
    ws.send(JSON.stringify(Object.assign({ t: "hello", pid: MYPID, vis: !document.hidden }, hello || {})));
    if (NET.queue.length) srvSend({ t: "in", q: NET.queue }); // reenvia o que pode ter ficado no caminho (o servidor ignora repetidos)
    render();
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } try { srvMsg(m); } catch (x) { console.error(x); } };
  ws.onclose = () => { if (NET.ws !== ws) return; NET.ws = null; NET.wsOk = false; NET.wsLost = NET.wsLost || Date.now(); if (NET.srv) srvRetry(); };
}
function srvRetry() { const d = Math.min(6000, 400 * Math.pow(2, NET.wsTry = (NET.wsTry || 0) + 1)); setTimeout(() => { if (NET.srv && !NET.ws && NET.code) srvConnect(NET.code, {}, null); }, d); }
function srvClose() { NET.srv = false; NET.wsOk = false; const ws = NET.ws; NET.ws = null; NET.srvOnS = null; NET.lcache = {}; try { ws && ws.close(); } catch (e) { } }
function srvMsg(m) {
  if (m.t === "S") { NET.scache = m.S; if (NET.srvOnS) { const f = NET.srvOnS; NET.srvOnS = null; f(m.S); } applyRemote(JSON.parse(JSON.stringify(m.S))); return; }
  if (m.t === "Sd") {
    const b = NET.scache; if (!b || b.rev !== m.base) { if (b) srvSend({ t: "fullS" }); return; }
    const nS = NET.scache = srvPatch(b, m); applyRemote(JSON.parse(JSON.stringify(nS))); return;
  }
  if (m.t === "L") {
    const c = NET.lcache = m.full ? {} : (NET.lcache || {}), ms = {}; let need = false;
    Object.entries(m.ms || {}).forEach(([fid, x]) => {
      let M;
      if (x.M) M = x.M;
      else { const p = c[fid]; if (!p) { need = true; return; } M = srvPatch(p, x); const from = x.evFrom || 0, pe = p.ev || []; if (pe.length < from) need = true; M.ev = pe.slice(0, from).concat(x.ev || []); }
      ms[fid] = c[fid] = M;
    });
    Object.keys(c).forEach(f => { if (!ms[f]) delete c[f]; });
    if (need) srvSend({ t: "full" });
    applyRemoteLive({ ms: JSON.parse(JSON.stringify(ms)), hostNow: m.hostNow });
    return;
  }
  if (m.t === "cfg") { ADMIN_CFG = Object.assign({}, ADMIN_CFG, { ovr: m.ovr || {}, msg: m.msg }); applyOvr(); render(); try { renderLive(true); } catch (e) { } return; }
  if (m.t === "ev") { EVS[m.fid] = m.ev; const w = (NET.evWait || {})[m.fid]; if (w) { delete NET.evWait[m.fid]; w(m.ev); } return; }
  if (m.t === "nf") { if (NET.srvOnS) { srvClose(); NET.mode = "none"; NET.code = null; UI.busy = false; UI.homeErr = `Não achei a sala ${NET.tryCode || ""}. Confira o código com quem criou.`; render(); } return; }
  if (m.t === "taken") { srvClose(); srvCreate(store("kl_name") || "Presidente", store("kl_team") || "Meu Time FC"); return; }
}
// aplica a diferença que o servidor mandou (só o que mudou) em cima da última versão completa
function srvPatch(base, m) {
  const o = Object.assign({}, base);
  Object.entries(m.d || {}).forEach(([k, v]) => {
    if (v && typeof v === "object" && v.__i && Array.isArray(o[k])) { const a = o[k].slice(); Object.entries(v.__i).forEach(([i, x]) => { a[+i] = x; }); o[k] = a; }
    else if (v && typeof v === "object" && v.__s && o[k] && typeof o[k] === "object") o[k] = srvPatch(o[k], { d: v.__s, del: v.__del });
    else o[k] = v;
  });
  (m.del || []).forEach(k => { delete o[k]; });
  return o;
}
function srvEv(fid) { return new Promise(r => { NET.evWait = NET.evWait || {}; NET.evWait[fid] = r; if (!srvSend({ t: "ev", fid })) r(null); setTimeout(() => { if (NET.evWait[fid]) { delete NET.evWait[fid]; r(null); } }, 5000); }); }
function srvEnter(code) {
  NET.mode = "client"; store("kl_last", code); rememberRoom(code); UI.busy = false; UI.homeErr = ""; clearTimeout(NET.srvT);
  startLoop();
}
function srvWait(code) { clearTimeout(NET.srvT); NET.srvT = setTimeout(() => { if (NET.srvOnS) { UI.homeErr = "O servidor da sala está demorando para responder. Confira sua internet e tente de novo."; render(); } }, 10000); }
function srvCreate(name, team) {
  const code = genCode(); S = null; LIVES = {}; NET.lcache = {}; NET.queue = []; NET.joinInfo = null; NET.tryCode = code;
  srvConnect(code, { code, create: { name, team, defaults: ADMIN_CFG.defaults || null } }, () => srvEnter(code)); srvWait(code);
}
function srvJoin(code, name, team) {
  S = null; LIVES = {}; NET.lcache = {}; NET.queue = []; NET.tryCode = code; NET.joinInfo = { name, team };
  srvConnect(code, {}, data => { srvEnter(code); if (!data.managers.some(m => m.pid === MYPID)) { NET.lastJoin = Date.now(); setTimeout(() => sendIntent({ t: "join", name, team, prev: ANON_PID }), 0); } });
  srvWait(code);
}
function startLocal() {
  const names = [...document.querySelectorAll(".lp-name")].map(i => i.value.trim()).filter(Boolean);
  if (names.length < 1) { UI.homeErr = "Coloque pelo menos um jogador."; return render(); }
  S = newGame("LOCL", MYPID, null, null, "local");
  const P0 = getProf(), pv = mgrOf(PROF_MI);
  names.forEach((n, i) => S.managers.push(mkMgr("local" + i, n, (i === 0 && P0.team ? P0.team : n + " FC").slice(0, 24), i, false)));
  const m0 = S.managers[0]; // o jogador 1 usa o seu perfil
  if (pv.crest) { const c = validCrest(pv.crest); if (c) m0.crest = c; }
  if (pv.kit) { const k = validKit(pv.kit); if (k) m0.kit = k; }
  if (pv.kit2) { const k = validKit(pv.kit2); if (k) m0.kit2 = k; }
  if (names[0] && names[0] !== P0.name) putProf({ name: names[0] });
  S.settings.total = Math.max(names.length, 4);
  if (ADMIN_CFG.defaults) { try { const d = Object.assign({}, ADMIN_CFG.defaults); d.total = Math.max(names.length, d.total || 4); applyAction(S, { t: "settings", v: d }, 0, true, Date.now()); } catch (e) { } }
  NET.mode = "local"; NET.code = "LOCL";
  startLoop(); commit();
}
// ---- quem caiu da sala: um bot assume até a pessoa voltar ----
const AWAY_MS = 30000, HOST_GONE_MS = 18000; // quem fecha o site ou clica em Sair avisa na hora (bot entra em ~1s); 30s é só para quem cai sem avisar // anfitrião sem sinal por ~18s: outro jogador assume (antes eram 45s)
function awayCheck() {
  if (!S || !S.managers) return;
  const t = Date.now(), A = S.away = S.away || {}; let ch = false;
  S.managers.forEach((m, i) => {
    if (m.cpu || m.pid === MYPID) { if (A[i]) { delete A[i]; ch = true; } return; }
    const sn = (NET.seen || {})[m.pid], last = sn || NET.hostSince || t, off = t - last > AWAY_MS;
    if (A[i] && !sn) return; // já estava fora e ainda não deu sinal de vida
    if (off && !A[i] && S.phase !== "lobby") { A[i] = true; ch = true; addLog(S, `${m.name} saiu da sala. Um bot assume o ${m.team} até ele voltar.`); }
    if (!off && A[i]) { delete A[i]; ch = true; addLog(S, `${m.name} voltou e reassumiu o ${m.team}!`); }
  });
  Object.values(LIVES).forEach(M => M.t.forEach(T => { const b = isBot(S, T.mi); if (T.cpu !== b) { T.cpu = b; if (b) T.autoSub = true; ch = true; } }));
  if (ch) { commit(); writeLive(); }
}
function heartbeat() {
  if (NET.srv) { srvSend({ t: "hb", vis: !document.hidden }); return; }
  try { NET.db.doc(`games/${NET.code}/in/${MYPID}`).set({ pid: MYPID, q: NET.queue || [], hb: Date.now(), host: NET.mode === "host", vis: !document.hidden }).catch(() => { }); } catch (e) { }
  if (NET.mode === "client" && S && S.hostPid && S.hostPid !== MYPID && (Date.now() - Math.max(NET.lastSync || 0, NET.liveNowAt || 0) > 7000 || NET.hostGone)) hostWatch();
}
async function hostWatch() {
  try {
    const d = await NET.db.doc(`games/${NET.code}/in/${S.hostPid}`).get(); const x = d.exists ? d.data() : null;
    const hb = x && x.hb ? x.hb : (S.hostNow || 0), gone = Date.now() + (NET.clockOff || 0) - hb; NET.hostHb = hb;
    // ordem de quem assume: os humanos na ordem da sala (sem o anfitrião); cada um espera um pouco mais
    const order = S.managers.filter((m, i) => !m.cpu && m.pid !== S.hostPid && !(S.away && S.away[i])).map(m => m.pid), k = order.indexOf(MYPID);
    if (k < 0 || gone < HOST_GONE_MS + k * 8000) { NET.hostGone = gone > 9000 ? gone : 0; return; }
    const fresh = await NET.docRef.get(); const data = fresh.exists ? fresh.data() : null;
    if (!data || data.hostPid !== S.hostPid) return;
    const oldMi = data.managers.findIndex(m => m.pid === data.hostPid);
    S = JSON.parse(JSON.stringify(data)); setPov(S.pov);
    NET.claimFrom = data.hostPid; // a primeira gravação pode trocar o anfitrião só se ainda for o antigo
    S.hostPid = MYPID; S.away = S.away || {}; if (oldMi >= 0) S.away[oldMi] = true;
    addLog(S, `O anfitrião caiu. ${(S.managers.find(m => m.pid === MYPID) || {}).name || "Outro jogador"} assumiu a sala.`);
    NET.unsub.forEach(u => { try { u(); } catch (e) { } }); NET.unsub = [];
    toast("O anfitrião caiu: você assumiu a sala. O jogo continua daqui.");
    becomeHost(NET.lobby);
  } catch (e) { }
}
// aviso para os convidados quando o anfitrião some (celular bloqueado, aba congelada…)
function hostGoneBanner() {
  let el = document.getElementById("hostgone");
  if (NET.srv) { const off = NET.mode === "client" && S && !NET.wsOk && NET.wsLost && Date.now() - NET.wsLost > 2500; if (!off) { if (el) el.remove(); return; } if (!el) { el = document.createElement("div"); el.id = "hostgone"; document.body.appendChild(el); } el.textContent = "📶 Sem conexão com o servidor da sala. Reconectando… (o jogo continua rodando lá; seu time fica com o bot até você voltar)"; return; }
  const g0 = NET.mode === "client" && S && S.phase !== "lobby" && NET.hostGone && NET.hostHb ? Date.now() + (NET.clockOff || 0) - NET.hostHb : 0, g = g0 > 9000 ? g0 : 0;
  if (!g) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "hostgone"; document.body.appendChild(el); }
  const left = Math.max(0, Math.ceil((HOST_GONE_MS - g) / 1000));
  el.textContent = `⏳ O anfitrião está sem sinal há ${Math.round(g / 1000)}s. ${left > 0 ? `Se ele não voltar em ~${left}s, outro jogador assume a sala.` : "Passando a sala para outro jogador…"}`;
}
let loopT = null, lastAuc = 0, nextTick = 0;
function startLoop() {
  if (loopT) return;
  loopT = true; tickEvery(() => {
    const t = now();
    if (S && runsGame() && ["auction", "wc", "lottery", "draft", "staff", "trade", "keep"].includes(S.phase) && t - lastAuc > 450) { lastAuc = t; if (marketTick(S, t)) commit(); }
    if (S && runsGame() && S.phase === "season") roundTick(t);
    if (runsGame()) Object.values(LIVES).forEach(M => { if (M.status === "playing") liveLoop(M, t); });
    if (NET.mode === "host" && t - (NET.awayChk || 0) > 2000) { NET.awayChk = t; awayCheck(); }
    if ((NET.mode === "host" || NET.mode === "client") && (NET.db || NET.srv) && t - (NET.hbAt || 0) > (NET.mode === "host" ? 5000 : NET.srv ? 10000 : 12000)) { NET.hbAt = t; heartbeat(); }
    if (NET.srv && NET.mode === "client" && S && myMi() < 0 && NET.joinInfo && NET.wsOk && t - (NET.lastJoin || 0) > (S.phase === "lobby" ? 4000 : 8000)) { NET.lastJoin = t; sendIntent({ t: "join", name: NET.joinInfo.name, team: NET.joinInfo.team, prev: ANON_PID }); }
    tickClocks(); hostGoneBanner();
  }, 100);
}
// avisa a sala que saiu (fechou a aba ou clicou em Sair): um bot assume o time na hora, sem travar ninguém
function sayBye() {
  if (NET.srv) { srvSend({ t: "bye" }); return; }
  try { if (NET.mode === "client" && NET.db && NET.code) NET.db.doc(`games/${NET.code}/in/${MYPID}`).set({ pid: MYPID, q: NET.queue || [], hb: Date.now(), vis: false, bye: true }).catch(() => { }); } catch (e) { }
}
window.addEventListener("pagehide", () => { if (NET.mode === "client") sayBye(); else if (NET.mode === "host") handoffHost(); });
async function leave() {
  if (NET.mode === "host" && S && S.phase !== "lobby") { await handoffHost(); }
  if (NET.mode === "client") sayBye();
  if (NET.srv) srvClose();
  NET.unsub.forEach(u => { try { u(); } catch (e) { } }); NET.unsub = [];
  try { NET.rjoin && NET.rjoin.leave && NET.rjoin.leave(); } catch (e) { }
  NET.mode = "none"; S = null; LIVE = null; LIVES = {}; UI.watch = null; NET.code = null; try { sessionStorage.removeItem("kl_local2"); } catch (e) { }
  render(); renderLive();
}

/* ---------- campeonato: rodadas simultâneas (anfitrião) ---------- */
const READY_MS = 60000;
function hostAction(a) {
  if (!S || !S.season) return;
  if (["quickround", "simstage"].includes(a.t)) {
    if (S.phase !== "season") return;
    Object.values(LIVES).forEach(M => { let g = 0; while (M.status === "playing" && g++ < 6000) stepMatch(M, now(), true); const f = S.season.fixtures.find(x => x.id === M.fid); if (f && !f.res) finishFixture(f, M); });
    LIVES = {}; syncLive(); writeLive();
    if (a.t === "quickround") { roundFixtures(S).filter(f => !f.res).forEach(f => finishFixture(f, simMatchInstant(S, f))); advanceRound(S); }
    else { const st0 = S.season.stage; let g = 0; while (S.phase === "season" && S.season.stage === st0 && g++ < 60) { roundFixtures(S).filter(f => !f.res).forEach(f => finishFixture(f, simMatchInstant(S, f))); advanceRound(S); } }
    commit(); renderLive(); return;
  }
  if (a.t === "lspeed") { UI.speed = a.v; Object.values(LIVES).forEach(M => M.speed = a.v); writeLive(); renderLive(true); return; }
  if (a.t === "lpause") { const p = !Object.values(LIVES).some(M => M.paused); Object.values(LIVES).forEach(M => M.paused = p); UI.paused = p; writeLive(); renderLive(true); return; }
  if (a.t === "lff" && LIVE && LIVE.status === "playing") {
    const M = LIVES[LIVE.fid]; if (!M) return;
    let g = 0; while (M.status === "playing" && g++ < 5000) stepMatch(M, now(), true);
    onLiveDone(M); return;
  }
}
function roundKey(se) { return se.stage + "-" + se.round; }
function roundTick(t) {
  const se = S.season; if (!se || se.stage === "done") return;
  let ch = false;
  if (!se.rs || se.rs.key !== roundKey(se)) { se.rs = { key: roundKey(se), ready: {}, av: {} }; ch = true; }
  const rs = se.rs, fx = roundFixtures(S);
  const busy = new Set(); Object.values(LIVES).forEach(M => { if (M.status === "playing") M.t.forEach(T => busy.add(T.mi)); });
  fx.forEach(f => {
    if (f.res || LIVES[f.id] || busy.has(f.h) || busy.has(f.a)) return;
    if (!rs.av[f.id]) { rs.av[f.id] = t + READY_MS; ch = true; }
    const rd = mi => isBot(S, mi) || rs.ready[f.id + ":" + mi] || (NET.mode === "host" && (NET.visOf || {})[S.managers[mi].pid] === false && S.managers[mi].pid !== MYPID);
    if ((rd(f.h) && rd(f.a)) || t > rs.av[f.id]) { startLive(f, t); busy.add(f.h); busy.add(f.a); ch = true; }
  });
  if (fx.length && fx.every(f => f.res) && !anyLive()) {
    if (!rs.doneAt) { rs.doneAt = t; ch = true; }
    else if (t - rs.doneAt > 9000) { LIVES = {}; syncLive(); writeLive(); renderLive(); advanceRound(S); ch = true; }
  }
  if (ch) commit();
}
function finishFixture(f, M) {
  f.res = matchResult(M);
  const evs = M.ev;
  EVS[f.id] = evs;
  if (NET.mode === "host") NET.db.doc(`mev/${NET.code}-${f.id}`).set({ ev: evs }).catch(() => { });
}
function startLive(f, t) {
  const M = newMatch(S, f); attachRosters(S, M);
  M.speed = UI.speed || 1; M.paused = !!UI.paused; M.holdUntil = (t || now()) + 2500; M._next = 0;
  LIVES[f.id] = M;
  syncLive(); writeLive(); renderLive(); updateRoundBoard();
}
function liveLoop(M, t) {
  if (M.paused) return;
  if (M.pending) { // espera escolhas
    const before = M.seq; stepMatch(M, hostClock(), false);
    if (M.seq !== before || !M.pending) afterStep(M, t);
    return;
  }
  if (t < (M.holdUntil || 0) || t < (M._next || 0)) return;
  const per = { 1: 900, 2: 450, 4: 170 }[M.speed || 1];
  M._next = t + per;
  stepMatch(M, t, false);
  afterStep(M, t);
}
function afterStep(M, t) {
  if (M.hold) { M.holdUntil = t + M.hold * (M.speed === 4 ? 0.5 : M.speed === 2 ? 0.75 : 1); M.hold = 0; }
  if (M.status === "done") return onLiveDone(M);
  writeLive(); if (M === LIVE) renderLive(); updateRoundBoard();
}
function onLiveDone(M) {
  const f = S.season.fixtures.find(x => x.id === M.fid);
  if (f && !f.res) finishFixture(f, M);
  writeLive(); commit(); if (M === LIVE) renderLive(true); updateRoundBoard();
}
function liveAct(a, mi) {
  let M = a.fid != null ? LIVES[a.fid] : null;
  if (!M) M = Object.values(LIVES).find(x => x.status === "playing" && x.t.some(T => T.mi === mi));
  if (M && a.t === "mreact" && REACTS.includes(a.e)) { // reação de qualquer um que esteja assistindo
    const t = now(); M.rlast = M.rlast || {}; if (t - (M.rlast[mi] || 0) < 900) return; M.rlast[mi] = t;
    M.rseq = (M.rseq || 0) + 1; M.reacts = (M.reacts || []).concat({ i: M.rseq, e: a.e, n: S.managers[mi] ? S.managers[mi].name : "", c: S.managers[mi] ? S.managers[mi].color : "#fff" }).slice(-8);
    writeLive(); if (M === LIVE) renderLive(); return;
  }
  if (!M || M.status !== "playing") return;
  let ti;
  if (NET.mode === "local" && a.ti != null) ti = a.ti; else ti = M.t.findIndex(T => T.mi === mi);
  if (ti < 0 || M.t[ti].cpu) return;
  if (matchAction(M, ti, a, hostClock())) { afterStep(M, now()); }
}

const REACTS = ["🔥", "😂", "😱", "👏", "😡", "👑"];
/* ---------- placar da rodada (jogos simultâneos) ---------- */
function fmtClock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function minLabel(M) { if (M.status === "done") return "FIM"; if (M.phase === "so") return "SO"; const m = Math.floor(M.min); return m >= 36 ? "36'+" : m + "'"; }
function roundBoard() {
  if (!S || !S.season || S.phase !== "season") return "";
  const se = S.season, fx = roundFixtures(S); if (!fx.length) return "";
  const rs = se.rs && se.rs.key === roundKey(se) ? se.rs : { ready: {}, av: {} };
  const mis = editableMis();
  const busy = new Set(); Object.values(LIVES).forEach(M => { if (M.status === "playing") M.t.forEach(T => busy.add(T.mi)); });
  return fx.map(f => {
    const M = LIVES[f.id];
    const side = (mi, sc) => `<div class="rb-t">${crestSVG(tcrest(S.managers[mi]), 22)}<span>${esc(S.managers[mi].team)}</span>${sc != null ? `<b class="num">${sc}</b>` : ""}</div>`;
    let status, extra = "";
    if (M) {
      status = M.status === "done" ? `<span class="pill">FIM${M.so ? ` · SO ${M.so[0]}-${M.so[1]}` : ""}</span>` : `<span class="pill live">● ${minLabel(M)}</span>${M.pending ? ' <span class="pill">pênalti/escolha</span>' : ""}`;
      extra = `<button class="btn sm ${M.status === "playing" ? "gold" : ""}" data-a="watch2" data-fid="${f.id}">${M.status === "playing" ? "Assistir" : "Ver"}</button>`;
      return `<div class="rb-row ${UI.watch === f.id ? "on" : ""}"><div class="rb-teams">${side(f.h, M.score[0])}${side(f.a, M.score[1])}</div><div class="rb-st">${f.stage === "Desafio" ? '<span class="pill">Desafio</span>' : ""}${status}${extra}</div></div>`;
    }
    if (f.res) return `<div class="rb-row"><div class="rb-teams">${side(f.h, f.res.s[0])}${side(f.a, f.res.s[1])}</div><div class="rb-st">${f.stage === "Desafio" ? '<span class="pill">Desafio</span>' : ""}<span class="pill">FIM${f.res.so ? ` · SO ${f.res.so[0]}-${f.res.so[1]}` : ""}</span><button class="btn sm" data-a="watch" data-id="${f.id}">Lances</button></div></div>`;
    const waitOther = busy.has(f.h) || busy.has(f.a);
    const rdy = mi => S.managers[mi].cpu || rs.ready[f.id + ":" + mi];
    const mine = mis.filter(mi => mi === f.h || mi === f.a);
    const btns = waitOther ? "" : mine.map(mi => rdy(mi) ? `<span class="pill you">${mis.length > 1 ? esc(S.managers[mi].team) + " " : ""}pronto ✓</span>` : `<button class="btn sm gold" data-a="ready" data-fid="${f.id}" data-mi="${mi}">${mis.length > 1 ? esc(S.managers[mi].team) + ": " : ""}Pronto!</button>`).join("");
    status = waitOther ? `<span class="muted" style="font-size:12.5px">espera o outro jogo do time acabar</span>`
      : `<span class="muted" style="font-size:12.5px">${[f.h, f.a].map(mi => `${rdy(mi) ? "✓" : "…"} ${esc(S.managers[mi].team.split(" ")[0])}`).join(" · ")}</span>${rs.av[f.id] ? ` <span class="pill num" data-dl="${rs.av[f.id]}">1:00</span>` : ""}`;
    return `<div class="rb-row ${mine.length ? "mine" : ""}"><div class="rb-teams">${side(f.h)}${side(f.a)}</div><div class="rb-st">${f.stage === "Desafio" ? '<span class="pill">Desafio</span>' : ""}${status}${btns}${mine.length && !waitOther ? `<button class="btn sm ghost" data-a="tab" data-tab="time">Táticas</button>` : ""}</div></div>`;
  }).join("");
}
let _rbT = 0;
function updateRoundBoard() {
  const t = Date.now(); if (t - _rbT < 400) { clearTimeout(updateRoundBoard._p); updateRoundBoard._p = setTimeout(updateRoundBoard, 420); return; }
  _rbT = t;
  const el = document.getElementById("roundboard"); if (el && !editing(el)) el.innerHTML = roundBoard();
  const sb = document.getElementById("l-sb"); if (sb) sb.innerHTML = liveStrip();
  const hb = document.getElementById("hdr-live"); if (hb) hb.style.display = anyLive() ? "" : "none";
}
function liveStrip() {
  const ms = Object.values(LIVES); if (ms.length < 2) return "";
  return ms.map(M => `<button class="sbm ${LIVE && LIVE.fid === M.fid ? "on" : ""}" data-a="watch2" data-fid="${M.fid}"><span style="color:${M.t[0].color}">${esc(M.t[0].name.slice(0, 12))}</span> <b class="num">${M.score[0]}-${M.score[1]}</b> <span style="color:${M.t[1].color}">${esc(M.t[1].name.slice(0, 12))}</span> <small class="num">${minLabel(M)}</small></button>`).join("");
}

/* ---------- resposta imediata no aparelho de quem clicou ---------- */
function lotOf() { if (!S) return null; if (S.phase === "staff") return S.staffA && S.staffA.lot; return S.auction && S.auction.lot; }
function lotKey(l) { return l ? l.n + "-" + (l.pid != null ? l.pid : l.sid) : ""; }
function optimistic(kind, mi, amt) {
  const l = lotOf(); if (!l) return;
  if (kind === "pass") { UI.passFx = { key: lotKey(l), at: Date.now(), mi }; clearTimeout(UI._pfx); UI._pfx = setTimeout(() => render(), 1750); }
  if (NET.mode !== "client") return;
  UI.opt = { key: lotKey(l), kind, mi, amt, until: Date.now() + 5000 };
  applyOptimistic(); render(true);
}
function applyOptimistic() {
  if (UI.optReady && S && S.season && S.season.rs) { if (Date.now() < UI.optReady.until) S.season.rs.ready[UI.optReady.k] = true; else UI.optReady = null; }
  const o = UI.opt; if (!o) return;
  if (Date.now() > o.until) { UI.opt = null; return; }
  const l = lotOf(); if (!l || lotKey(l) !== o.key) { UI.opt = null; return; }
  if (o.kind === "bid") { if (l.bid < o.amt && !(l.passed || []).includes(o.mi)) { l.bid = o.amt; l.bidder = o.mi; l.passed = (l.passed || []).filter(x => x !== o.mi); l.optimistic = true; } else UI.opt = null; }
  else { l.passed = l.passed || []; if (!l.passed.includes(o.mi)) { l.passed.push(o.mi); l.optimistic = true; } else UI.opt = null; }
}
function passStamp(lot) { const f = UI.passFx; return f && f.key === lotKey(lot) && Date.now() - f.at < 1700 ? `<div class="stampfx" aria-hidden="true">${NET.mode === "local" ? esc(S.managers[f.mi].team) + "<br>" : ""}PASSOU</div>` : ""; }
function bidPop(lot) { const k = lotKey(lot) + ":" + lot.bid; const pop = UI.lastBk && UI.lastBk !== k && lot.bid > 0; UI.lastBk = k; return pop ? "pop" : ""; }

/* ---------- relógio do leilão ---------- */
function tickClocks() {
  const sc = $("#sclock");
  if (sc && S && S.staffA && S.staffA.lot) { const left = Math.max(0, (S.staffA.lot.deadline - hostClock()) / 1000); sc.textContent = Math.ceil(left); sc.classList.toggle("hot", left <= 4); const sb = $("#sclockbar"); if (sb) sb.style.width = Math.min(100, left / S.settings.timer * 100) + "%"; }
  const dc = $("#dclock");
  if (dc && S && S.draft && S.phase === "draft") { const left = Math.max(0, (S.draft.deadline - hostClock()) / 1000); dc.textContent = Math.ceil(left); dc.classList.toggle("hot", left <= 6); }
  const wcl = $("#wcclock");
  if (wcl && S && S.wc && S.phase === "wc") { const left = Math.max(0, (S.wc.deadline - hostClock()) / 1000); wcl.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`; }
  if (S && S.auction && (S.phase === "auction" || S.phase === "wc")) {
    const a = S.auction, el = $("#clock"), bar = $("#clockbar");
    if (el && a.lot) {
      const left = a.paused ? (a.pausedLeft || 0) / 1000 : Math.max(0, (a.lot.deadline - hostClock()) / 1000);
      el.textContent = Math.ceil(left); el.classList.toggle("hot", left <= 4 && !a.paused);
      if (bar) bar.style.width = Math.min(100, left / S.settings.timer * 100) + "%";
    }
  }
  document.querySelectorAll("[data-dl]").forEach(el => { el.textContent = fmtClock(+el.dataset.dl - hostClock()); });
  const pc = $("#pcount");
  if (pc && LIVE && LIVE.pending) pc.textContent = Math.max(0, Math.ceil((LIVE.pending.until - hostClock()) / 1000)) + "s";
}

/* ---------- componentes ---------- */
function hid() { return !!S && (S.settings.hide === "sempre" || (S.settings.hide === "leilao" && ["auction", "wc", "lottery", "draft", "staff"].includes(S.phase))); }
function O(p) { return hid() ? "?" : p.o; }
let CREST_N = 0;
function starPts(cx, cy, R, r, n) { const a = []; for (let i = 0; i < n * 2; i++) { const g = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; a.push((cx + Math.cos(g) * q).toFixed(1) + "," + (cy + Math.sin(g) * q).toFixed(1)); } return a.join(" "); }
const FONT_FAM = { display: "Big Shoulders Display, Arial Narrow, sans-serif", serif: "Georgia, 'Times New Roman', serif", sans: "Arial Black, Arial, sans-serif", script: "'Brush Script MT', 'Segoe Script', cursive" };
const CREST_SHAPE_D = {
  escudo: `<path d="M50 4 L94 16 V58 C94 88 72 106 50 116 C28 106 6 88 6 58 V16 Z"/>`,
  redondo: `<circle cx="50" cy="60" r="46"/>`,
  hexagono: `<polygon points="50,6 94,32 94,88 50,114 6,88 6,32"/>`,
  diamante: `<polygon points="50,4 96,60 50,116 4,60"/>`,
  flamula: `<path d="M8 8 H92 V70 L50 116 L8 70 Z"/>`,
  brasao: `<path d="M10 6 H36 L50 14 L64 6 H90 V60 C90 90 70 106 50 116 C30 106 10 90 10 60 Z"/>`,
  oval: `<ellipse cx="50" cy="60" rx="40" ry="54"/>`,
  quadrado: `<rect x="8" y="10" width="84" height="100" rx="14"/>`,
  classico: `<path d="M8 8 Q50 18 92 8 V62 C92 90 70 106 50 116 C30 106 8 90 8 62 Z"/>`,
  angular: `<polygon points="10,6 90,6 96,40 82,92 50,116 18,92 4,40"/>`,
  coroado: `<path d="M8 22 L22 8 L36 20 L50 4 L64 20 L78 8 L92 22 V62 C92 90 70 106 50 116 C30 106 8 90 8 62 Z"/>`,
  losango: `<path d="M50 6 C60 6 92 48 92 60 C92 72 60 114 50 114 C40 114 8 72 8 60 C8 48 40 6 50 6 Z"/>`,
  pentagono: `<polygon points="50,4 96,40 80,114 20,114 4,40"/>`,
  octogono: `<polygon points="32,6 68,6 94,32 94,88 68,114 32,114 6,88 6,32"/>`,
  gota: `<path d="M50 4 C70 30 92 52 92 76 C92 100 72 116 50 116 C28 116 8 100 8 76 C8 52 30 30 50 4 Z"/>`,
  arco: `<path d="M8 50 C8 24 28 6 50 6 C72 6 92 24 92 50 V112 H8 Z"/>`,
  seta: `<path d="M6 6 H94 V44 L50 116 L6 44 Z"/>`,
  medieval: `<path d="M50 4 C64 14 80 16 94 14 V60 C94 88 72 106 50 116 C28 106 6 88 6 60 V14 C20 16 36 14 50 4 Z"/>`,
  estrela: `<polygon points="${starPts(50, 64, 58, 28, 5)}"/>`,
  triangulo: `<polygon points="4,8 96,8 50,116"/>`,
  coracao: `<path d="M50 114 C20 92 4 70 4 44 C4 22 20 8 36 8 C44 8 48 12 50 18 C52 12 56 8 64 8 C80 8 96 22 96 44 C96 70 80 92 50 114 Z"/>`,
  retro: `<polygon points="18,6 82,6 94,18 94,80 50,116 6,80 6,18"/>`,
  ingles: `<path d="M6 6 H94 V64 C94 92 74 112 50 112 C26 112 6 92 6 64 Z"/>`,
  bandeira: `<path d="M6 6 H94 V114 L50 92 L6 114 Z"/>`,
  pontudo: `<path d="M6 12 L50 4 L94 12 V50 C94 80 74 100 50 116 C26 100 6 80 6 50 Z"/>`,
  selo: `<polygon points="${Array.from({ length: 48 }, (_, i) => { const g = i * Math.PI / 24, q = i % 2 ? 42 : 47; return (50 + Math.cos(g) * q).toFixed(1) + "," + (60 + Math.sin(g) * q).toFixed(1); }).join(" ")}"/>`,
  capsula: `<rect x="14" y="4" width="72" height="112" rx="36"/>`
};
const CREST_PAT_D = (() => {
  const zz = (y, h) => { const t = [], b = []; for (let i = 0; i <= 8; i++) { const x = i * 12.5, d = i % 2 ? -9 : 0; t.push(x + "," + (y + d)); b.unshift(x + "," + (y + d + h)); } return `<polygon points="${t.concat(b).join(" ")}"/>`; };
  return {
    liso: "",
    listras: [10, 30, 50, 70, 90].map(x => `<rect x="${x - 5}" y="0" width="10" height="120"/>`).join(""),
    diagonal: `<polygon points="0,30 30,0 100,70 100,100 70,120"/>`,
    metade: `<rect x="50" y="0" width="50" height="120"/>`,
    faixa: `<rect x="0" y="46" width="100" height="26"/>`,
    xadrez: Array.from({ length: 30 }, (_, k) => { const x = k % 5, y = Math.floor(k / 5); return (x + y) % 2 ? `<rect x="${x * 20}" y="${y * 20}" width="20" height="20"/>` : ""; }).join(""),
    horizontais: [14, 38, 62, 86, 110].map(y => `<rect x="0" y="${y - 6}" width="100" height="12"/>`).join(""),
    cruz: `<rect x="40" y="0" width="20" height="120"/><rect x="0" y="40" width="100" height="20"/>`,
    chevron: `<polygon points="0,30 50,70 100,30 100,52 50,92 0,52"/>`,
    quartos: `<rect x="50" y="0" width="50" height="60"/><rect x="0" y="60" width="50" height="60"/>`,
    aro: `<circle cx="50" cy="60" r="34" fill="none" stroke="currentColor" stroke-width="8"/>`,
    diagonal2: `<polygon points="0,10 10,0 100,90 100,100 90,110 0,20"/><polygon points="0,50 10,40 100,130 100,140 90,150 0,60" transform="translate(0 -12)"/>`,
    triangulo: `<polygon points="0,120 50,40 100,120"/>`,
    pontos: Array.from({ length: 64 }, (_, k) => { const r = Math.floor(k / 8), c = k % 8; return `<circle cx="${c * 15 + (r % 2 ? 7.5 : 0) - 2}" cy="${r * 15 + 6}" r="3.6"/>`; }).join(""),
    ondas: [18, 48, 78, 108].map(y => `<path d="M0 ${y} C17 ${y - 9} 33 ${y - 9} 50 ${y} S83 ${y + 9} 100 ${y} V${y + 11} C83 ${y + 20} 67 ${y + 20} 50 ${y + 11} S17 ${y + 2} 0 ${y + 11} Z"/>`).join(""),
    raios: Array.from({ length: 12 }, (_, k) => { const a1 = k * 30 * Math.PI / 180, a2 = (k * 30 + 15) * Math.PI / 180; return `<polygon points="50,60 ${(50 + Math.cos(a1) * 130).toFixed(1)},${(60 + Math.sin(a1) * 130).toFixed(1)} ${(50 + Math.cos(a2) * 130).toFixed(1)},${(60 + Math.sin(a2) * 130).toFixed(1)}"/>`; }).join(""),
    losangos: Array.from({ length: 20 }, (_, k) => { const r = Math.floor(k / 4), c = k % 4; return (r + c) % 2 ? "" : `<polygon points="${c * 25 + 12.5},${r * 30} ${c * 25 + 25},${r * 30 + 15} ${c * 25 + 12.5},${r * 30 + 30} ${c * 25},${r * 30 + 15}"/>`; }).join(""),
    faixav: `<rect x="36" y="0" width="28" height="120"/>`,
    xis: `<polygon points="0,0 14,0 100,106 100,120 86,120 0,14"/><polygon points="100,0 100,14 14,120 0,120 0,106 86,0"/>`,
    moldura: "MOLDURA",
    metadeh: `<rect x="0" y="60" width="100" height="60"/>`,
    canto: `<polygon points="0,0 62,0 0,62"/>`,
    zigzag: zz(56, 16),
    tracos: Array.from({ length: 16 }, (_, k) => { const x = -120 + k * 14; return `<polygon points="${x},0 ${x + 5},0 ${x + 125},120 ${x + 120},120"/>`; }).join(""),
    estrelas: [[20, 22], [78, 28], [30, 94], [74, 90], [50, 12], [14, 62], [86, 62], [50, 106]].map(([x, y]) => `<polygon points="${starPts(x, y, 6, 2.6, 5)}"/>`).join(""),
    grade: [14, 28, 42, 56, 70, 84].map(x => `<rect x="${x - 1}" y="0" width="2" height="120"/>`).join("") + [15, 30, 45, 60, 75, 90, 105].map(y => `<rect x="0" y="${y - 1}" width="100" height="2"/>`).join(""),
    meialua: `<circle cx="50" cy="124" r="50"/>`,
    faixas2: `<rect x="0" y="36" width="100" height="11"/><rect x="0" y="72" width="100" height="11"/>`,
    finas: [6, 16, 26, 36, 46, 56, 66, 76, 86, 96].map(x => `<rect x="${x - 1.5}" y="0" width="3" height="120"/>`).join(""),
    diagonalinv: `<polygon points="100,30 70,0 0,70 0,100 30,120"/>`,
    topo: `<rect x="0" y="0" width="100" height="36"/>`,
    base: `<rect x="0" y="84" width="100" height="36"/>`,
    terco: `<rect x="66" y="0" width="34" height="120"/>`
  };
})();
function crestIcons(c1) {
  return {
    coroa: `<path d="M34 64 L36 48 L43 55 L50 44 L57 55 L64 48 L66 64 Z"/><rect x="34" y="65" width="32" height="4" rx="1"/>`,
    raio: `<polygon points="54,40 40,62 50,62 46,80 60,56 50,56"/>`,
    estrela: `<polygon points="50,40 55,54 70,54 58,63 62,77 50,68 38,77 42,63 30,54 45,54"/>`,
    bola: `<circle cx="50" cy="60" r="17" fill="none" stroke-width="3"/><polygon points="50,52 57,57 54,65 46,65 43,57"/>`,
    chama: `<path d="M50 40 C58 50 66 56 62 68 C60 75 54 80 50 80 C44 80 38 74 38 66 C38 58 44 56 46 48 C48 54 50 56 52 56 C54 52 52 46 50 40 Z"/>`,
    olho: `<path d="M30 60 C40 46 60 46 70 60 C60 74 40 74 30 60 Z" fill="none" stroke-width="3"/><circle cx="50" cy="60" r="7"/>`,
    leao: `<circle cx="50" cy="66" r="9"/><circle cx="38" cy="54" r="5"/><circle cx="46" cy="47" r="5"/><circle cx="55" cy="47" r="5"/><circle cx="63" cy="54" r="5"/>`,
    foguete: `<path d="M50 38 C58 46 60 58 58 70 H42 C40 58 42 46 50 38 Z"/><polygon points="42,66 34,76 42,74"/><polygon points="58,66 66,76 58,74"/><circle cx="50" cy="54" r="4" fill="${c1}" stroke="none"/>`,
    trofeu: `<path d="M40 44 H60 V56 C60 64 55 68 50 68 C45 68 40 64 40 56 Z"/><path d="M40 47 H34 C34 55 38 58 41 58" fill="none" stroke-width="3"/><path d="M60 47 H66 C66 55 62 58 59 58" fill="none" stroke-width="3"/><rect x="47" y="67" width="6" height="7"/><rect x="41" y="74" width="18" height="4" rx="1"/>`,
    ancora: `<circle cx="50" cy="44" r="4" fill="none" stroke-width="3"/><rect x="48" y="47" width="4" height="30"/><rect x="40" y="53" width="20" height="3"/><path d="M36 64 C38 76 62 76 64 64" fill="none" stroke-width="4"/>`,
    espadas: `<path d="M38 42 L62 76 M62 42 L38 76" stroke-width="5" fill="none"/><path d="M34 70 L44 80 M66 70 L56 80" stroke-width="4" fill="none"/>`,
    coracao: `<path d="M50 78 C40 70 32 62 32 54 C32 47 37 43 42 43 C46 43 49 46 50 49 C51 46 54 43 58 43 C63 43 68 47 68 54 C68 62 60 70 50 78 Z"/>`,
    lua: `<path d="M56 42 C44 44 38 54 40 64 C42 74 52 80 62 76 C52 74 46 66 47 58 C48 50 52 45 56 42 Z"/>`,
    sol: `<circle cx="50" cy="60" r="8"/>${Array.from({ length: 8 }, (_, k) => `<rect x="48.5" y="40" width="3" height="8" rx="1.5" transform="rotate(${k * 45} 50 60)"/>`).join("")}`,
    montanha: `<polygon points="32,74 44,52 50,61 57,48 70,74"/><polygon points="54,53 57,48 60,53" fill="${c1}" stroke="none"/>`,
    onda: `<path d="M32 58 C38 50 44 50 50 58 C56 66 62 66 68 58" fill="none" stroke-width="4"/><path d="M32 68 C38 60 44 60 50 68 C56 76 62 76 68 68" fill="none" stroke-width="4"/>`,
    gema: `<polygon points="40,48 60,48 68,58 50,78 32,58"/><polyline points="32,58 68,58" fill="none" stroke="${c1}" stroke-width="2"/>`,
    asas: `<path d="M50 62 C42 52 34 48 28 50 C32 54 34 58 38 60 C34 60 31 62 30 64 C36 66 44 66 50 62 Z"/><path d="M50 62 C58 52 66 48 72 50 C68 54 66 58 62 60 C66 60 69 62 70 64 C64 66 56 66 50 62 Z"/>`,
    caveira: `<path d="M50 42 C40 42 34 49 34 57 C34 63 37 66 40 68 V74 H60 V68 C63 66 66 63 66 57 C66 49 60 42 50 42 Z"/><circle cx="44" cy="58" r="4" fill="${c1}" stroke="none"/><circle cx="56" cy="58" r="4" fill="${c1}" stroke="none"/>`,
    touro: `<path d="M40 52 C40 64 44 74 50 74 C56 74 60 64 60 52 Z"/><path d="M40 54 C34 52 30 46 30 40 C34 46 38 48 42 48" fill="none" stroke-width="3"/><path d="M60 54 C66 52 70 46 70 40 C66 46 62 48 58 48" fill="none" stroke-width="3"/>`,
    trevo: `<circle cx="50" cy="50" r="8"/><circle cx="41" cy="62" r="8"/><circle cx="59" cy="62" r="8"/><rect x="48.5" y="62" width="3" height="18" rx="1"/>`,
    flor: `${Array.from({ length: 5 }, (_, k) => { const g = (-90 + k * 72) * Math.PI / 180; return `<circle cx="${(50 + Math.cos(g) * 10).toFixed(1)}" cy="${(60 + Math.sin(g) * 10).toFixed(1)}" r="7.5"/>`; }).join("")}<circle cx="50" cy="60" r="5" fill="${c1}" stroke="none"/>`,
    arvore: `<polygon points="50,38 64,56 56,56 68,70 32,70 44,56 36,56"/><rect x="46" y="70" width="8" height="10"/>`,
    castelo: `<path d="M32 80 V44 H37 V49 H42 V44 H47 V49 H53 V44 H58 V49 H63 V44 H68 V80 H56 V68 C56 63 44 63 44 68 V80 Z"/>`,
    torre: `<path d="M42 80 V46 H39 V38 H44 V42 H48 V38 H52 V42 H56 V38 H61 V46 H58 V80 Z"/><rect x="47" y="52" width="6" height="9" rx="3" fill="${c1}" stroke="none"/>`,
    martelo: `<rect x="34" y="42" width="32" height="12" rx="2"/><rect x="47" y="54" width="6" height="26" rx="2"/>`,
    tridente: `<rect x="48.5" y="46" width="3" height="34"/><path d="M38 42 V52 C38 59 62 59 62 52 V42" fill="none" stroke-width="3"/><polygon points="50,34 46.5,44 53.5,44"/><polygon points="38,36 35,44 41,44"/><polygon points="62,36 59,44 65,44"/>`,
    flecha: `<polygon points="50,38 65,55 55,55 55,80 45,80 45,55 35,55"/>`,
    alvo: `<circle cx="50" cy="60" r="18" fill="none" stroke-width="3.5"/><circle cx="50" cy="60" r="10" fill="none" stroke-width="3.5"/><circle cx="50" cy="60" r="3.5"/>`,
    chave: `<circle cx="50" cy="46" r="7" fill="none" stroke-width="4"/><rect x="48" y="52" width="4" height="28"/><rect x="52" y="70" width="7" height="3.5"/><rect x="52" y="76" width="5" height="3.5"/>`,
    cometa: `<circle cx="58" cy="52" r="8"/><path d="M52 57 L30 80 L44 62 L30 70 L50 51 Z"/>`,
    planeta: `<circle cx="50" cy="60" r="11"/><ellipse cx="50" cy="60" rx="22" ry="7" fill="none" stroke-width="3" transform="rotate(-20 50 60)"/>`,
    ouros: `<polygon points="50,38 66,60 50,82 34,60"/>`,
    paus: `<circle cx="50" cy="48" r="8"/><circle cx="40" cy="62" r="8"/><circle cx="60" cy="62" r="8"/><polygon points="50,58 44,80 56,80"/>`,
    naipe: `<path d="M50 38 C58 50 68 54 68 64 C68 71 61 74 55 70 L58 80 H42 L45 70 C39 74 32 71 32 64 C32 54 42 50 50 38 Z"/>`,
    infinito: `<path d="M50 60 C44 50 32 50 32 60 C32 70 44 70 50 60 C56 50 68 50 68 60 C68 70 56 70 50 60 Z" fill="none" stroke-width="4"/>`,
    passaro: `<path d="M28 52 C38 48 44 52 50 60 C56 52 62 48 72 52 C62 54 56 58 52 68 H48 C44 58 38 54 28 52 Z"/>`,
    peixe: `<ellipse cx="46" cy="60" rx="14" ry="9"/><polygon points="58,60 70,49 70,71"/><circle cx="40" cy="58" r="2" fill="${c1}" stroke="none"/>`,
    folha: `<path d="M34 78 C34 54 48 40 68 40 C68 64 56 78 34 78 Z"/><path d="M37 75 L60 48" fill="none" stroke="${c1}" stroke-width="2"/>`,
    pena: `<path d="M66 38 C46 42 34 58 38 78 L42 74 C44 62 52 50 66 38 Z"/><path d="M38 78 L34 82" fill="none" stroke-width="2.5"/>`,
    viking: `<path d="M36 64 C36 52 42 46 50 46 C58 46 64 52 64 64 Z"/><rect x="34" y="64" width="32" height="5" rx="2"/><path d="M37 56 C30 52 28 44 30 38 C33 46 36 48 40 50 Z"/><path d="M63 56 C70 52 72 44 70 38 C67 46 64 48 60 50 Z"/>`,
    dado: `<rect x="34" y="44" width="32" height="32" rx="6"/>${[[42, 52], [58, 52], [50, 60], [42, 68], [58, 68]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c1}" stroke="none"/>`).join("")}`,
    gol: `<path d="M30 78 V46 H70 V78" fill="none" stroke-width="4"/>${[38, 46, 54, 62].map(x => `<line x1="${x}" y1="46" x2="${x}" y2="78" stroke-width="1.2"/>`).join("")}${[54, 62, 70].map(y => `<line x1="30" y1="${y}" x2="70" y2="${y}" stroke-width="1.2"/>`).join("")}`,
    campo: `<rect x="30" y="42" width="40" height="36" rx="2" fill="none" stroke-width="3"/><line x1="30" y1="60" x2="70" y2="60" stroke-width="2.5"/><circle cx="50" cy="60" r="7" fill="none" stroke-width="2.5"/>`,
    medalha: `<polygon points="41,38 47,38 51,48 49,52 45,52"/><polygon points="59,38 53,38 49,48 51,52 55,52"/><circle cx="50" cy="65" r="13"/><polygon points="${starPts(50, 65, 7, 3, 5)}" fill="${c1}" stroke="none"/>`,
    cruz: `<polygon points="43,40 57,40 54,54 68,51 68,65 54,62 57,80 43,80 46,62 32,65 32,51 46,54"/>`,
    floco: `${[0, 60, 120].map(r => `<rect x="48.3" y="40" width="3.4" height="40" rx="1.5" transform="rotate(${r} 50 60)"/>`).join("")}<circle cx="50" cy="60" r="5"/>`,
    nota: `<ellipse cx="44" cy="74" rx="7" ry="5" transform="rotate(-20 44 74)"/><rect x="49" y="40" width="3.5" height="34"/><path d="M52.5 40 C60 44 64 48 62 57 C60 51 56 49 52.5 49 Z"/>`,
    lobo: `<polygon points="34,40 44,52 56,52 66,40 64,62 50,80 36,62"/><polygon points="42,62 47,57 47,64" fill="${c1}" stroke="none"/><polygon points="58,62 53,57 53,64" fill="${c1}" stroke="none"/>`,
    aguia: `<path d="M50 58 C40 46 28 42 22 44 C28 48 30 52 34 54 C28 54 26 58 26 60 C32 60 36 60 40 62 C36 64 34 66 34 68 C40 68 46 66 50 64 Z"/><path d="M50 58 C40 46 28 42 22 44 C28 48 30 52 34 54 C28 54 26 58 26 60 C32 60 36 60 40 62 C36 64 34 66 34 68 C40 68 46 66 50 64 Z" transform="translate(100 0) scale(-1 1)"/><circle cx="50" cy="50" r="5.5"/><polygon points="45,62 55,62 50,78"/>`,
    cobra: `<path d="M60 42 C44 40 38 50 48 56 C58 62 56 74 40 76" fill="none" stroke-width="5" stroke-linecap="round"/><circle cx="62" cy="42" r="5.5"/>`,
    raio2: `<polygon points="46,40 34,60 42,60 38,80 50,56 42,56"/><polygon points="62,40 50,60 58,60 54,80 66,56 58,56"/>`,
    piramide: `<polygon points="50,40 72,78 28,78"/><polyline points="50,40 56,78" fill="none" stroke="${c1}" stroke-width="2"/>`,
    letra: "LETRA",
    nenhum: ""
  };
}
const CREST_ISZ_V = { p: 0.8, m: 1, g: 1.3, xg: 1.6 };
function gradDef(id, type, a, b) {
  if (!type || type === "nenhum" || !b) return "";
  if (type === "radial") return `<radialGradient id="${id}" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const v = { vertical: 'x1="0" y1="0" x2="0" y2="1"', horizontal: 'x1="0" y1="0" x2="1" y2="0"', diagonal: 'x1="0" y1="0" x2="1" y2="1"' }[type];
  return `<linearGradient id="${id}" ${v}><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
}
function ribbonSVG(ry, w, fill, label, color, fam, fs) {
  const x1 = 50 - w, x2 = 50 + w;
  return `<g stroke="rgba(0,0,0,.4)" stroke-width="1" stroke-linejoin="round"><polygon points="${x1 - 9},${ry + 4} ${x1 + 2},${ry + 4} ${x1 + 2},${ry + 16} ${x1 - 9},${ry + 16} ${x1 - 5},${ry + 10}" fill="${fill}"/><polygon points="${x2 + 9},${ry + 4} ${x2 - 2},${ry + 4} ${x2 - 2},${ry + 16} ${x2 + 9},${ry + 16} ${x2 + 5},${ry + 10}" fill="${fill}"/><polygon points="${x1 + 2},${ry + 12} ${x1 + 6},${ry + 16} ${x1 + 2},${ry + 16}" fill="rgba(0,0,0,.45)"/><polygon points="${x2 - 2},${ry + 12} ${x2 - 6},${ry + 16} ${x2 - 2},${ry + 16}" fill="rgba(0,0,0,.45)"/><rect x="${x1 + 2}" y="${ry}" width="${2 * w - 4}" height="12" rx="1" fill="${fill}"/></g><text x="50" y="${ry + 9.6}" text-anchor="middle" font-family="${fam}" font-weight="900" font-size="${fs || 10.5}" letter-spacing=".6" fill="${color}">${esc(label)}</text>`;
}
// escudo/uniforme de um time da sala com o selo de campeão (só neste save)
function tcrest(m) { if (!m) return null; return m.champ && !(m.crest && m.crest.nch) ? Object.assign({}, m.crest || {}, { __ch: m.champ }) : m.crest; }
function tkit(m, k) { k = k || (m && m.kit); return m && m.champ && !(m.crest && m.crest.nch) ? Object.assign({}, k || {}, { __ch: m.champ }) : k; }
function crestSVG(c, size) {
  c = c || {}; const id = "cr" + (CREST_N++);
  const sh = CREST_SHAPE_D[c.shape] || CREST_SHAPE_D.escudo, c1 = c.c1 || "#f5c542", c2 = c.c2 || "#111";
  const pat = k => { const d = CREST_PAT_D[k] || ""; return d === "MOLDURA" ? `<g fill="none" stroke="currentColor" stroke-width="22">${sh}</g>` : d; };
  const icons = crestIcons(c1), icc = c.ic || c2, fam = FONT_FAM[c.fnt] || FONT_FAM.display;
  let ic = icons[c.icon] != null ? icons[c.icon] : icons.coroa;
  if (ic === "LETRA") { const L = c.txt || "K"; ic = `<text x="50" y="60" dominant-baseline="central" text-anchor="middle" font-family="${fam}" font-weight="900" font-size="${L.length > 2 ? 19 : L.length > 1 ? 25 : 34}" stroke="none">${esc(L)}</text>`; }
  const c3 = c.c3 || c2, tc = c.tc || c2, sz = CREST_ISZ_V[c.isz] || 1, small = size < 34;
  const tp = c.tpos || "baixo", ns = Math.max(0, Math.min(7, c.stars | 0)), out = ns && c.spos !== "dentro", sc = c.sc || (out ? "#f5c542" : c3);
  const lowY = { diamante: 96, triangulo: 90, seta: 92, estrela: 98, coracao: 94, gota: 104 }[c.shape] || 101;
  let txt = "";
  if (c.txt && c.icon !== "letra") {
    if (tp === "faixa") { const rc = c.c4 || c3; txt = ribbonSVG(lowY - 15, c.txt.length > 2 ? 30 : 25, rc, c.txt, tc, fam); }
    else { const y = tp === "cima" ? (c.shape === "diamante" || c.shape === "triangulo" ? 30 : 34) : lowY; txt = `<text x="50" y="${y}" text-anchor="middle" font-family="${fam}" font-weight="900" font-size="17" fill="${tc}" stroke="${c1}" stroke-width="3" paint-order="stroke">${esc(c.txt)}</text>`; }
  }
  const CH = c.__ch;
  if (CH) txt = ribbonSVG(lowY - 15, 34, `url(#${id}gold)`, "CAMPEÃO", "#2b1d00", "Arial Black, Arial, sans-serif", 8.5);
  const ano = CH && !small ? `<text x="50" y="113" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="6.5" letter-spacing=".5" fill="#f5c542" stroke="#2b1d00" stroke-width="1.6" paint-order="stroke">${CH.comp === "Split" ? "SPLIT" : "KINGS CUP"}${CH.n > 1 ? " · " + CH.n + "x" : ""}</text>` : c.ano && !small ? `<text x="50" y="${tp === "cima" ? 20 : 113}" text-anchor="middle" font-family="${fam}" font-weight="800" font-size="7.5" letter-spacing=".5" fill="${tc}" stroke="${c1}" stroke-width="2" paint-order="stroke">${esc(c.ano)}</text>` : "";
  const sIn = tp === "cima" ? 100 : c.shape === "diamante" ? 30 : 24;
  const stars = ns ? Array.from({ length: ns }, (_, k) => { const gap = out ? 13 : 11, cx = 50 + (k - (ns - 1) / 2) * gap, cy = out ? -10 - (Math.abs(k - (ns - 1) / 2) < 0.6 ? 2 : 0) : sIn; const silver = c.sa === "auto" && k >= ns - (c.scup | 0); return `<polygon transform="translate(${cx} ${cy}) scale(${out ? 0.27 : 0.22})" points="0,-20 6,-6 21,-6 9,3 13,18 0,9 -13,18 -9,3 -21,-6 -6,-6" fill="${silver ? "#d9dde3" : sc}" stroke="${out ? "rgba(0,0,0,.45)" : c1}" stroke-width="4"/>`; }).join("") : "";
  const R = 22 * sz, mf = c.mf || c1;
  const meds = {
    nenhum: "", circulo: `<circle cx="50" cy="60" r="${R}" fill="${mf}" stroke="${c3}" stroke-width="3"/>`, anel: `<circle cx="50" cy="60" r="${R}" fill="none" stroke="${c3}" stroke-width="3"/>`,
    losango: `<polygon points="50,${60 - R * 1.2} ${50 + R * 1.2},60 50,${60 + R * 1.2} ${50 - R * 1.2},60" fill="${mf}" stroke="${c3}" stroke-width="3"/>`,
    escudo: `<path d="M50 ${60 - R} L${50 + R} ${60 - R * 0.7} V${60 + R * 0.1} C${50 + R} ${60 + R * 0.75} ${50 + R * 0.45} ${60 + R * 1.05} 50 ${60 + R * 1.25} C${50 - R * 0.45} ${60 + R * 1.05} ${50 - R} ${60 + R * 0.75} ${50 - R} ${60 + R * 0.1} V${60 - R * 0.7} Z" fill="${mf}" stroke="${c3}" stroke-width="3"/>`,
    hexagono: `<polygon points="${Array.from({ length: 6 }, (_, i) => { const g = (-90 + i * 60) * Math.PI / 180; return (50 + Math.cos(g) * R * 1.1).toFixed(1) + "," + (60 + Math.sin(g) * R * 1.1).toFixed(1); }).join(" ")}" fill="${mf}" stroke="${c3}" stroke-width="3"/>`
  };
  const med = meds[c.med] || "", halo = !c.hn && !small;
  const bw = { normal: 6, fina: 3, grossa: 10, dupla: 5, nenhuma: 0 }[c.bw] != null ? { normal: 6, fina: 3, grossa: 10, dupla: 5, nenhuma: 0 }[c.bw] : 6;
  const border = (CH ? `<g fill="none" stroke="url(#${id}gold)" stroke-width="${Math.max(bw, 6) + 3}">${sh}</g>` : "") + (bw ? `<g fill="none" stroke="${c3}" stroke-width="${bw}">${sh}</g>` : "") + (c.bw === "dupla" ? `<g fill="none" stroke="${c3}" stroke-width="2.2" transform="translate(50 60) scale(.84) translate(-50 -60)">${sh}</g>` : "");
  const icg = ic ? `<g ${halo ? `filter="url(#${id}h)"` : ""}><g fill="${icc}" stroke="${icc}" ${sz !== 1 ? `transform="translate(50 60) scale(${sz}) translate(-50 -60)"` : ""}>${ic}</g></g>` : "";
  return `<svg class="crest" viewBox="0 ${out ? -22 : 0} 100 ${out ? 142 : 120}" width="${size}" height="${size * (out ? 1.42 : 1.2)}" aria-hidden="true"><defs><clipPath id="${id}">${sh}</clipPath>${gradDef(id + "g", c.gr, c1, c.g2 || c2)}${CH ? `<linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f5c542"/><stop offset="1" stop-color="#a8720c"/></linearGradient>` : ""}${halo && ic ? `<filter id="${id}h" x="-30%" y="-30%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="d"/><feFlood flood-color="${c.med && c.med !== "nenhum" && c.med !== "anel" ? mf : c1}"/><feComposite in2="d" operator="in" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ""}</defs>
    <g clip-path="url(#${id})"><rect width="100" height="120" fill="${c.gr && c.gr !== "nenhum" ? `url(#${id}g)` : c1}"/><g fill="${c2}" color="${c2}">${pat(c.pat)}</g>${c.c4 && c.pat2 && c.pat2 !== "liso" ? `<g fill="${c.c4}" color="${c.c4}">${pat(c.pat2)}</g>` : ""}</g>
    ${border}${med}${icg}${stars}${txt}${ano}</svg>`;
}
const KIT_PAT_D = {
  liso: "", listras: [34, 46, 58, 70].map(x => `<rect x="${x - 4}" y="0" width="8" height="100"/>`).join(""),
  horizontais: [24, 44, 64, 84].map(y => `<rect x="0" y="${y - 5}" width="100" height="10"/>`).join(""),
  faixa: `<polygon points="20,10 36,10 84,92 68,92"/>`, metade: `<rect x="50" y="0" width="50" height="100"/>`,
  xadrez: Array.from({ length: 50 }, (_, q) => { const x = q % 10, y = Math.floor(q / 10); return (x + y) % 2 ? `<rect x="${x * 10}" y="${y * 20}" width="10" height="20"/>` : ""; }).join(""),
  gola: `<path d="M40 4 C45 14 55 14 60 4 L58 12 C54 18 46 18 42 12 Z"/><rect x="0" y="86" width="100" height="6"/><rect x="8" y="22" width="12" height="4" transform="rotate(30 14 24)"/><rect x="80" y="22" width="12" height="4" transform="rotate(-30 86 24)"/>`,
  centro: `<rect x="42" y="0" width="16" height="100"/>`,
  ombros: `<rect x="0" y="0" width="100" height="22"/>`,
  v: `<polygon points="20,20 50,52 80,20 80,32 50,64 20,32"/>`,
  finas: [30, 38, 46, 54, 62, 70].map(x => `<rect x="${x - 1.2}" y="0" width="2.4" height="100"/>`).join(""),
  degrade: Array.from({ length: 10 }, (_, q) => `<rect x="0" y="${40 + q * 6}" width="100" height="6.2" opacity="${(q + 1) / 10}"/>`).join(""),
  laterais: `<rect x="28" y="0" width="9" height="100"/><rect x="63" y="0" width="9" height="100"/>`,
  peito: `<rect x="0" y="34" width="100" height="16"/>`,
  bicolor: `<polygon points="100,0 100,100 0,100"/>`,
  chevron: `<polygon points="20,26 50,46 80,26 80,38 50,58 20,38"/><polygon points="20,46 50,66 80,46 80,54 50,74 20,54"/>`,
  quadros: Array.from({ length: 12 }, (_, q) => { const x = q % 4, y = Math.floor(q / 4); return (x + y) % 2 ? `<rect x="${x * 25}" y="${y * 33}" width="25" height="33"/>` : ""; }).join(""),
  mangas: `<polygon points="0,0 30,8 30,40 0,40"/><polygon points="100,0 70,8 70,40 100,40"/>`,
  pontos: Array.from({ length: 100 }, (_, q) => { const r = Math.floor(q / 10), c = q % 10; return `<circle cx="${c * 10 + (r % 2 ? 5 : 0)}" cy="${r * 10 + 4}" r="2.4"/>`; }).join(""),
  zigzag: (() => { const t = [], b = []; for (let i = 0; i <= 10; i++) { const x = i * 10, d = i % 2 ? -7 : 0; t.push(x + "," + (44 + d)); b.unshift(x + "," + (56 + d)); } return `<polygon points="${t.concat(b).join(" ")}"/>`; })(),
  ondas: [26, 50, 74].map(y => `<path d="M0 ${y} C17 ${y - 7} 33 ${y - 7} 50 ${y} S83 ${y + 7} 100 ${y} V${y + 8} C83 ${y + 15} 67 ${y + 15} 50 ${y + 8} S17 ${y + 1} 0 ${y + 8} Z"/>`).join(""),
  faixadupla: `<polygon points="16,10 28,10 76,92 64,92"/><polygon points="34,10 46,10 94,92 82,92"/>`,
  xis: `<polygon points="20,10 34,10 84,92 70,92"/><polygon points="80,10 66,10 16,92 30,92"/>`,
  faixabaixo: `<rect x="0" y="70" width="100" height="22"/>`,
  colete: `<rect x="0" y="30" width="37" height="70"/><rect x="63" y="30" width="37" height="70"/>`,
  listrasgrossas: `<rect x="28" y="0" width="15" height="100"/><rect x="57" y="0" width="15" height="100"/>`,
  horizfinas: Array.from({ length: 12 }, (_, q) => `<rect x="0" y="${q * 8 + 3}" width="100" height="2.2"/>`).join(""),
  estrela: `<polygon points="${starPts(60, 24, 7.5, 3.2, 5)}"/>`,
  diagonalinv: `<polygon points="80,10 64,10 16,92 32,92"/>`,
  metadeh: `<rect x="0" y="52" width="100" height="48"/>`,
  quadriculado: Array.from({ length: 289 }, (_, q) => { const x = q % 17, y = Math.floor(q / 17); return (x + y) % 2 ? `<rect x="${x * 6}" y="${y * 6}" width="6" height="6"/>` : ""; }).join(""),
  camuflado: [[34, 24, 10, 6, 20], [60, 40, 12, 7, -30], [40, 62, 11, 6, 40], [66, 78, 10, 6, 10], [30, 84, 8, 5, -20], [54, 16, 8, 5, 60], [72, 58, 7, 5, 0]].map(([x, y, a, b, r]) => `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" transform="rotate(${r} ${x} ${y})"/>`).join(""),
  tracos: Array.from({ length: 14 }, (_, q) => { const x = -100 + q * 14; return `<polygon points="${x},0 ${x + 4},0 ${x + 104},100 ${x + 100},100"/>`; }).join(""),
  cruz: `<rect x="44" y="0" width="12" height="100"/><rect x="0" y="34" width="100" height="12"/>`,
  grade: [36, 50, 64].map(x => `<rect x="${x - 0.9}" y="0" width="1.8" height="100"/>`).join("") + [30, 50, 70].map(y => `<rect x="0" y="${y - 0.9}" width="100" height="1.8"/>`).join("")
};
function kitLayers(k, id) {
  const c1 = k.c1 || "#f5c542", c2 = k.c2 || "#111", c3 = k.c3 || null, gc = k.gc || c2;
  const p2 = c3 && k.pat2 && k.pat2 !== "liso" ? `<g fill="${c3}">${KIT_PAT_D[k.pat2] || ""}</g>` : "";
  const sleeves = k.cm ? `<g fill="${k.cm}"><polygon points="30,6 6,24 18,42 30,34"/><polygon points="70,6 94,24 82,42 70,34"/></g>` : "";
  const pc = k.pu ? (k.pc || c3 || c2) : null;
  const trim = (k.gc && (!k.gl || k.gl === "padrao") ? `<path d="M42 4 C45 10 55 10 58 4 L60 6 C56 14 44 14 40 6 Z" fill="${k.gc}"/>` : "") + (pc ? `<g fill="${pc}"><polygon points="8,24 18,40 21,38 11,22"/><polygon points="92,24 82,40 79,38 89,22"/><rect x="28" y="88" width="44" height="4"/></g>` : "");
  const gola = { padrao: "", redonda: `<path d="M41 3 C45 11 55 11 59 3 L62 6 C56 16 44 16 38 6 Z" fill="${gc}"/>`, v: `<polygon points="40,4 50,22 60,4 56.5,4 50,16 43.5,4" fill="${gc}"/>`, polo: `<g fill="${gc}"><polygon points="40,3 50,13 46,21 35,10"/><polygon points="60,3 50,13 54,21 65,10"/></g><rect x="49.2" y="13" width="1.6" height="14" fill="${gc}"/><circle cx="50" cy="18" r="1.1" fill="${c1}"/><circle cx="50" cy="23" r="1.1" fill="${c1}"/>` }[k.gl] || "";
  const grd = k.gr && k.gr !== "nenhum";
  return { defs: grd ? gradDef(id + "g", k.gr, c1, k.g2 || c2) : "", layers: `<rect width="100" height="100" fill="${grd ? `url(#${id}g)` : c1}"/><g fill="${c2}">${KIT_PAT_D[k.pat] || ""}</g>${p2}${sleeves}${trim}${gola}` };
}
function kitSVG(k, size, num, crest) {
  k = k || {}; const id = "kt" + (CREST_N++);
  const body = `<path d="M30 8 L42 4 C45 10 55 10 58 4 L70 8 L92 24 L82 40 L72 34 V92 H28 V34 L18 40 L8 24 Z"/>`;
  const L = kitLayers(k, id), fam = FONT_FAM[k.nf] || FONT_FAM.display;
  const sp = k.sp && size >= 50 ? `<text x="50" y="40" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${k.sp.length > 8 ? 7 : 8.5}" fill="${k.num || "#fff"}" opacity=".92">${esc(k.sp)}</text>` : "";
  const bd = k.bd && crest && size >= 34 ? crestSVG(Object.assign({}, crest, { stars: 0, txt: "", ano: "" }), 12).replace("<svg ", '<svg x="56" y="15" ') : "";
  const ch = k.__ch && size >= 34 ? `<g transform="translate(86 29) rotate(-28)"><circle r="5.2" fill="#f5c542" stroke="#7a5300" stroke-width="1"/><polygon points="${starPts(0, 0.3, 3.4, 1.4, 5)}" fill="#7a5300"/></g>` : "";
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><clipPath id="${id}">${body}</clipPath>${L.defs}</defs>
    <g clip-path="url(#${id})">${L.layers}</g>
    <g fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2.5">${body}</g>${bd}${ch}${sp}
    <text x="50" y="${sp ? 72 : 68}" text-anchor="middle" font-family="${fam}" font-weight="900" font-size="${sp ? 27 : 30}" fill="${k.num || "#fff"}" stroke="${k.nc || "rgba(0,0,0,.45)"}" stroke-width="${k.nc ? 2.6 : 2}" paint-order="stroke">${num || 10}</text></svg>`;
}
// textura da camisa para as bolinhas da simulação (mesmo desenho do editor)
const KIT_TEX = {};
function kitTex(k) {
  const key = JSON.stringify(k); const ex = KIT_TEX[key]; if (ex) return ex.ok ? ex.img : null;
  const o = KIT_TEX[key] = { ok: false, img: new Image() }; const L = kitLayers(k, "tx");
  o.img.onload = () => { o.ok = true; }; o.img.onerror = () => { o.bad = true; };
  o.img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 2 64 64" width="96" height="96"><defs>${L.defs}</defs>${L.layers}</svg>`);
  return null;
}
function mascotSVG(c, size) {
  c = c || {}; if (!c.masc || c.masc === "nenhum") return ""; const c1 = c.c1 || "#f5c542", mc = c.mc || c.c2 || "#111";
  const ic = crestIcons(c1)[c.masc]; if (!ic || ic === "LETRA") return "";
  return `<svg viewBox="22 32 56 56" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="60" r="27" fill="${c1}" stroke="${c.c3 || mc}" stroke-width="2.5"/><g fill="${mc}" stroke="${mc}" transform="translate(50 60) scale(1.15) translate(-50 -60)">${ic}</g></svg>`;
}
// retrato ilustrado gerado pelo jogo (sem foto): camisa do clube, cor por posição, variações de cabelo/barba/pele
function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const PT_SKIN = ["#f3cfb1", "#e6b48e", "#cf9a6f", "#b07a52", "#8a5a39", "#64402a"];
const PT_HAIR = ["#16110d", "#2a1c12", "#3d2a1b", "#5e4128", "#8a6136", "#c9a063", "#1c1c1f", "#4b4b52"];
const PT_CLUB = ["#f5c542", "#e63946", "#1d3fbf", "#2a9d8f", "#111318", "#7b2cbf", "#f77f00", "#06d6a0", "#ef476f", "#118ab2", "#ffffff", "#8d0801"];
const PT_POS = { ATA: ["#ff4d61", "#5a0f1a"], MEI: ["#f5c542", "#4a3a0a"], DEF: ["#2fd47e", "#0b3b24"], GOL: ["#4cc9f0", "#0b2a3a"] };
function clubKit(team) { const h = hashStr(team || "x"); const c1 = PT_CLUB[h % PT_CLUB.length]; let c2 = PT_CLUB[(h >> 5) % PT_CLUB.length]; if (c2 === c1) c2 = c1 === "#111318" ? "#ffffff" : "#111318"; return { c1, c2, pat: ["liso", "listras", "faixa", "metade", "ombros"][(h >> 9) % 5] }; }
function portraitSVG(o, size) {
  // o: { seed, kind: "jogador"|"presidente"|"tecnico", pos, c1, c2, pat, num }
  const h = hashStr(o.seed), r = k => (h >> k) & 0xff, id = "pt" + (h % 100000) + "_" + (CREST_N++);
  const skin = PT_SKIN[r(1) % PT_SKIN.length], hair = PT_HAIR[r(4) % PT_HAIR.length], style = r(7) % 8, beard = r(11) % 4 === 0, stubble = r(13) % 3 === 0;
  const pc = PT_POS[o.pos] || ["#f5c542", "#2a2412"], c1 = o.c1 || "#f5c542", c2 = o.c2 || "#111318";
  const shade = "rgba(0,0,0,.18)";
  // corpo
  const torso = `M8 104 C10 82 26 72 40 69 L60 69 C74 72 90 82 92 104 Z`;
  let body = "";
  if (o.kind === "presidente") {
    body = `<path d="${torso}" fill="#1a1d26"/><path d="M40 69 L50 92 L60 69 Z" fill="#f4f4f6"/><path d="M47.5 72 L52.5 72 L54 88 L50 94 L46 88 Z" fill="${c1}"/><path d="M40 69 L46 100 L36 84 L32 74 Z" fill="#232733"/><path d="M60 69 L54 100 L64 84 L68 74 Z" fill="#232733"/><circle cx="68" cy="84" r="2.6" fill="#f5c542"/>`;
  } else if (o.kind === "tecnico") {
    body = `<path d="${torso}" fill="${c1}"/><path d="M8 104 C10 90 18 84 26 80 L30 104 Z M92 104 C90 90 82 84 74 80 L70 104 Z" fill="${c2}" opacity=".9"/><rect x="49" y="70" width="2" height="34" fill="${c2}"/><path d="M42 69 L50 74 L58 69 L57 66 L43 66 Z" fill="${c2}"/>`;
  } else {
    const gk = o.pos === "GOL", j1 = gk ? ["#ff9f1c", "#9bf6ff", "#caffbf", "#ffd6a5"][r(17) % 4] : c1, j2 = gk ? "#111318" : c2;
    const pats = { listras: [26, 42, 58, 74].map(x => `<rect x="${x - 4}" y="60" width="8" height="50"/>`).join(""), faixa: `<polygon points="20,66 34,66 84,110 70,110"/>`, metade: `<rect x="50" y="60" width="50" height="50"/>`, ombros: `<rect x="0" y="60" width="100" height="18"/>`, liso: "" };
    body = `<clipPath id="${id}t"><path d="${torso}"/></clipPath><path d="${torso}" fill="${j1}"/><g clip-path="url(#${id}t)" fill="${j2}" opacity=".95">${gk ? "" : (pats[o.pat] || "")}</g>
      <path d="M41 69 C45 76 55 76 59 69 L57 67 C54 72 46 72 43 67 Z" fill="${j2}"/>
      ${o.num ? `<text x="50" y="86" text-anchor="middle" font-family="Big Shoulders Display, Arial Narrow, sans-serif" font-weight="900" font-size="15" fill="${j2}" opacity=".9">${o.num}</text>` : ""}`;
  }
  // cabelo (atrás da cabeça e por cima)
  const back = { 3: `<circle cx="50" cy="20" r="7" fill="${hair}"/>`, 6: `<circle cx="50" cy="36" r="23" fill="${hair}"/>`, 7: `<path d="M33 40 C30 58 36 66 40 64 L40 40 Z M67 40 C70 58 64 66 60 64 L60 40 Z" fill="${hair}"/>` }[style] || "";
  const top = {
    0: `<path d="M34 40 C33 22 67 22 66 40 C63 31 37 31 34 40 Z" fill="${hair}"/>`,
    1: `<path d="M35 38 C35 25 65 25 65 38 C61 31 39 31 35 38 Z" fill="${hair}" opacity=".55"/>`,
    2: `<g fill="${hair}">${[[38, 30], [44, 25], [51, 24], [58, 26], [63, 31], [36, 36], [64, 37]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5"/>`).join("")}</g>`,
    3: `<path d="M34 40 C33 23 67 23 66 40 C62 30 38 30 34 40 Z" fill="${hair}"/>`,
    4: "",
    5: `<path d="M46 40 C45 26 55 26 54 40 Z" fill="${hair}"/><path d="M35 38 C35 27 65 27 65 38" fill="none" stroke="${hair}" stroke-width="1.2" opacity=".35"/>`,
    6: `<path d="M33 38 C33 24 67 24 67 38 C60 30 40 30 33 38 Z" fill="${hair}"/>`,
    7: `<path d="M33 42 C32 21 68 21 67 42 C64 30 36 30 33 42 Z" fill="${hair}"/>`
  }[style];
  const face = `<ellipse cx="44" cy="43" rx="1.7" ry="2" fill="#1b1410"/><ellipse cx="56" cy="43" rx="1.7" ry="2" fill="#1b1410"/>
    <path d="M40.5 38.5 L46.5 37.8 M53.5 37.8 L59.5 38.5" stroke="${hair}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M50 44 L48.6 50 L51 50.4" fill="none" stroke="${shade}" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M45.5 54 C48 55.6 52 55.6 54.5 54" fill="none" stroke="#5a2e22" stroke-width="1.3" stroke-linecap="round"/>
    ${beard ? `<path d="M36 46 C37 60 44 64 50 64 C56 64 63 60 64 46 C61 54 56 57 50 57 C44 57 39 54 36 46 Z" fill="${hair}"/>` : stubble ? `<path d="M37 48 C39 60 45 63 50 63 C55 63 61 60 63 48 C60 55 55 58 50 58 C45 58 40 55 37 48 Z" fill="${hair}" opacity=".28"/>` : ""}`;
  return `<svg viewBox="-16 19 132 81" width="100%" height="${size}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><radialGradient id="${id}b" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="${pc[0]}" stop-opacity=".55"/><stop offset="1" stop-color="${pc[1]}" stop-opacity=".0"/></radialGradient></defs>
    <rect x="-60" y="-20" width="220" height="140" fill="url(#${id}b)"/>${back}
    <rect x="43" y="56" width="14" height="16" rx="5" fill="${skin}"/><rect x="43" y="56" width="14" height="6" fill="${shade}"/>
    ${body}
    <ellipse cx="34.5" cy="44" rx="2.6" ry="4" fill="${skin}"/><ellipse cx="65.5" cy="44" rx="2.6" ry="4" fill="${skin}"/>
    <ellipse cx="50" cy="42" rx="15.5" ry="18.5" fill="${skin}"/>${top}${face}</svg>`;
}

// ---- fotos colocadas pelo administrador (só a conta dele grava; todo mundo vê) ----
let PHOTOS = {}; const PHOTO_SHARDS = 8;
function photoShard(key) { return "s" + (hashStr(key) % PHOTO_SHARDS); }
function isAdmin() { return !!(ACC.user && (window.KL_ADMINS || []).includes(ACC.user.uid)); }
async function loadPhotos() {
  try { const { db } = await getCaps(); if (!db) return; const out = {};
    await Promise.all(Array.from({ length: PHOTO_SHARDS }, async (_, k) => { try { const d = await db.doc("photos/s" + k).get(); const x = d.exists ? d.data() : null; if (x) Object.assign(out, x); } catch (e) { } }));
    PHOTOS = out;
    try { const d = await db.doc("admin/cfg").get(); ADMIN_CFG = (d.exists ? d.data() : null) || {}; applyOvr(); } catch (e) { }
    render(); } catch (e) { }
}
// ---- configurações do administrador: overall ajustado, aviso para todos, padrões das salas novas ----
let ADMIN_CFG = {}, PLAYERS_ORIG = null;
function valueOf(o) { return Math.max(1, Math.round(1.25 * Math.exp((o - 64) * 0.13))); }
function applyOvr() {
  if (!PLAYERS_ORIG) { PLAYERS_ORIG = {}; PLAYERS.forEach(p => { PLAYERS_ORIG[p.id] = { o: p.o, at: p.at, df: p.df, pot: p.pot, v: p.v }; }); }
  PLAYERS.forEach(p => { const b = PLAYERS_ORIG[p.id]; let x = (ADMIN_CFG.ovr || {})[p.id]; if (x && x.sec && !isAdmin()) x = null; Object.assign(p, b); if (x) { ["o", "at", "df", "pot"].forEach(k => { if (x[k] != null) p[k] = x[k]; }); if (x.o != null) { const d = x.o - b.o; if (x.at == null) p.at = Math.max(20, Math.min(99, b.at + d)); if (x.df == null) p.df = Math.max(20, Math.min(99, b.df + d)); } p.v = valueOf(p.o); if (p.pot < p.o) p.pot = p.o; } });
  try { setPov(S && S.pov); } catch (e) { }
}
async function saveAdminCfg(patch) {
  const { db } = await getCaps(); if (!db || !isAdmin()) throw new Error("sem permissão");
  const ref = db.doc("admin/cfg"); const d = await ref.get(); const cur = (d.exists ? d.data() : null) || {};
  const nx = Object.assign({}, cur, patch); await ref.set(nx); ADMIN_CFG = nx; applyOvr();
  if (NET.srv) srvSend({ t: "cfg" }); // sala na nuvem: o servidor e todo mundo da sala recebem na hora
}
function adminNotice() { const m = ADMIN_CFG.msg; return m && m.on && m.txt ? `<div class="card notice">📣 ${esc(m.txt)}</div>` : ""; }
function shrinkImage(file) { // recorta no centro e reduz para 160x160 JPEG (uns 8 KB)
  return new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const S2 = 160, c = document.createElement("canvas"); c.width = c.height = S2; const x = c.getContext("2d"), m = Math.min(im.width, im.height), sx = (im.width - m) / 2, sy = Math.max(0, (im.height - m) * 0.2); x.drawImage(im, sx, sy, m, m, 0, 0, S2, S2); res(c.toDataURL("image/jpeg", 0.74)); }; im.src = r.result; }; r.readAsDataURL(file); });
}
async function savePhoto(key, url) {
  const { db } = await getCaps(); if (!db || !isAdmin()) throw new Error("sem permissão");
  const ref = db.doc("photos/" + photoShard(key)); const d = await ref.get(); const map = (d.exists ? d.data() : null) || {};
  if (url) map[key] = url; else delete map[key];
  await ref.set(map); if (url) PHOTOS[key] = url; else delete PHOTOS[key];
}
// retrato da carta: foto (se o administrador colocou) ou o desenho do jogo
function portraitBox(key, o) { const ph = PHOTOS[key]; return `<div class="portrait">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy">` : portraitSVG(o, 128)}</div>`; }
function playerPortrait(p) { const ow = S ? ownerOf(S, p.id) : -1, m = ow >= 0 ? S.managers[ow] : null, k = m && m.kit ? m.kit : clubKit(p.t); return portraitBox("p" + p.id, { seed: p.n, kind: "jogador", pos: p.p, c1: k.c1, c2: k.c2, pat: m && m.kit ? (["listras", "faixa", "metade", "ombros"].includes(m.kit.pat) ? m.kit.pat : "liso") : k.pat, num: (p.id % 30) + 1 }); }
function staffPortrait(x) { const ow = S && S.managers ? S.managers.findIndex(m => m.coach === x.id || m.pres === x.id) : -1, m = ow >= 0 ? S.managers[ow] : null, k = m && m.kit ? m.kit : clubKit(x.club || x.n); return portraitBox("s" + x.id, { seed: x.n, kind: x.k === "tec" ? "tecnico" : "presidente", c1: k.c1, c2: k.c2 }); }
function viewAdmin() {
  if (!isAdmin()) return `<div class="card"><p>Só a conta do administrador pode abrir esta tela.</p><button class="btn sm" data-a="profileclose">Voltar</button></div>`;
  const sec = UI.adsec || "fotos";
  const nav = `<div class="row" style="gap:6px;margin-bottom:12px">${[["fotos", "📷 Fotos"], ["over", "📊 Overall"], ["aviso", "📣 Aviso para todos"], ["padrao", "⚙️ Padrões das salas"]].map(([k, t]) => `<button class="btn sm ${sec === k ? "gold" : ""}" data-a="adsec" data-v="${k}">${t}</button>`).join("")}</div>`;
  if (sec === "over") return nav + viewAdminOver();
  if (sec === "aviso") return nav + viewAdminMsg();
  if (sec === "padrao") return nav + viewAdminDefaults();
  return nav + viewAdminPhotos();
}
function viewAdminOver() {
  const q = (UI.adq || "").toLowerCase(), tm = UI.adteam || "", ov = ADMIN_CFG.ovr || {}, ed = UI.ovrEd || {};
  const clubs = [...new Set(PLAYERS.map(p => p.t))].sort((a, b) => a.localeCompare(b));
  const list = PLAYERS.filter(p => (!q || (p.n + " " + p.t).toLowerCase().includes(q)) && (!tm || p.t === tm) && (UI.adch !== "1" || ov[p.id])).sort((a, b) => a.t.localeCompare(b.t) || POS_ORDER[a.p] - POS_ORDER[b.p] || b.o - a.o);
  const nEd = Object.keys(ed).length;
  const cell = (p, k) => { const v = ed[p.id] && ed[p.id][k] != null ? ed[p.id][k] : p[k], orig = PLAYERS_ORIG ? PLAYERS_ORIG[p.id][k] : p[k]; return `<td><input type="number" min="${k === "at" || k === "df" ? 30 : 50}" max="99" class="ovin ${v !== orig ? "chg" : ""}" data-id="${p.id}" data-k="${k}" value="${v}" title="original: ${orig}"></td>`; };
  return `<div class="sec-title"><h2>Ajustar overall</h2><button class="btn sm ghost" data-a="profileclose">← Voltar</button></div>
  <div class="card" style="display:grid;gap:10px">
    <p class="muted" style="margin:0;font-size:13px">O valor ajustado vale para todo mundo. Marque 🤫 para um ajuste secreto: o jogo usa, mas os outros jogadores continuam vendo o over normal. Salas novas já começam com ele; em salas que já estão rolando passa a valer quando a página for recarregada. O valor de leilão acompanha o overall. Passe o mouse no número para ver o original. ${Object.keys(ov).length} jogador${Object.keys(ov).length === 1 ? "" : "es"} ajustado${Object.keys(ov).length === 1 ? "" : "s"}.</p>
    <div class="row"><input id="ad-q" type="text" placeholder="Buscar jogador" value="${esc(UI.adq || "")}" style="max-width:220px">
      <select id="ad-team" style="max-width:220px"><option value="">Todos os times</option>${clubs.map(c => `<option value="${esc(c)}" ${c === tm ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select id="ad-ch" style="max-width:200px"><option value="0" ${UI.adch !== "1" ? "selected" : ""}>Todos</option><option value="1" ${UI.adch === "1" ? "selected" : ""}>Só os ajustados</option></select>
      <span class="spacer"></span><button class="btn sm gold" data-a="ovrsave" ${nEd ? "" : "disabled"}>Salvar ${nEd ? nEd + " alteraç" + (nEd === 1 ? "ão" : "ões") : "alterações"}</button></div>
    <div class="scroll" id="ad-ovlist" style="max-height:560px"><table class="tbl"><thead><tr><th>Jogador</th><th>Pos</th><th>Time</th><th>OVR</th><th>ATQ</th><th>DEF</th><th>POT</th><th title="Secreto: só o jogo usa; os outros jogadores continuam vendo o over normal">🤫</th><th></th></tr></thead><tbody>
    ${list.slice(0, 250).map(p => `<tr><td><b>${esc(p.n)}</b></td><td>${posb(p.p, p.p2)}</td><td class="muted">${esc(p.t)}</td>${cell(p, "o")}${cell(p, "at")}${cell(p, "df")}${cell(p, "pot")}<td><input type="checkbox" class="ovsec" data-id="${p.id}" ${(ed[p.id] && ed[p.id].sec != null ? ed[p.id].sec : ov[p.id] && ov[p.id].sec) ? "checked" : ""} title="Secreto: só o jogo usa; os outros jogadores continuam vendo o over normal"></td><td>${ov[p.id] ? `<button class="btn sm ghost" data-a="ovrreset" data-id="${p.id}" title="Voltar ao original">↺</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}
function viewAdminMsg() {
  const m = ADMIN_CFG.msg || {};
  return `<div class="sec-title"><h2>Aviso para todos</h2><button class="btn sm ghost" data-a="profileclose">← Voltar</button></div>
  <div class="card" style="display:grid;gap:10px">
    <p class="muted" style="margin:0;font-size:13px">Aparece no topo da página inicial e das salas para quem abrir o site. Bom para avisar de novidades, manutenção ou um campeonato marcado.</p>
    <textarea id="ad-msg" maxlength="240" rows="3" placeholder="Ex.: Sábado às 20h tem campeonato na sala da comunidade!">${esc(m.txt || "")}</textarea>
    <div class="row"><button class="btn sm gold" data-a="msgsave" data-on="1">Publicar aviso</button><button class="btn sm ghost" data-a="msgsave" data-on="0">Tirar do ar</button><span class="muted" style="font-size:13px">${m.on && m.txt ? "No ar agora." : "Nenhum aviso no ar."}</span></div>
    ${m.on && m.txt ? `<div><div class="muted" style="font-size:12px;margin-bottom:4px">Como aparece:</div>${adminNotice()}</div>` : ""}
  </div>`;
}
function viewAdminDefaults() {
  const d = ADMIN_CFG.defaults || {}, num = (id, label, v, mn, mx) => `<label class="f" for="${id}">${label}<input id="${id}" type="number" min="${mn}" max="${mx}" value="${v}"></label>`;
  const sel = (id, label, v, opts) => `<label class="f" for="${id}">${label}<select id="${id}">${opts.map(([k, t]) => `<option value="${k}" ${v === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  return `<div class="sec-title"><h2>Padrões das salas novas</h2><button class="btn sm ghost" data-a="profileclose">← Voltar</button></div>
  <div class="card" style="display:grid;gap:12px">
    <p class="muted" style="margin:0;font-size:13px">Toda sala criada no site começa com estas configurações. O anfitrião ainda pode mudar no lobby.</p>
    <div class="grid3">
      ${sel("df-mode", "Formato do mercado", d.mode || "leilao", [["leilao", "Leilão"], ["draft", "Draft"]])}
      ${sel("df-fmt", "Competição", d.fmt || "split", [["split", "Split"], ["cup", "Kings Cup"]])}
      ${sel("df-inj", "Lesões", d.inj || "normal", [["normal", "Normais"], ["poucas", "Poucas"], ["nao", "Sem lesões"]])}
      ${num("df-budget", "Orçamento por time (K$)", d.budget || 150, 30, 600)}
      ${num("df-squad", "Jogadores por elenco", d.squad || 10, 7, 12)}
      ${num("df-timer", "Segundos por lance", d.timer || 10, 5, 30)}
      ${num("df-total", "Times no campeonato", d.total || 6, 2, 12)}
      ${sel("df-hide", "Overall dos jogadores", d.hide || "nao", [["nao", "Visível"], ["leilao", "Escondido no leilão"], ["sempre", "Escondido o jogo todo"]])}
      ${sel("df-career", "Modo carreira", d.career ? "1" : "0", [["0", "Desligado"], ["1", "Ligado"]])}
    </div>
    <div class="row"><button class="btn sm gold" data-a="defsave">Salvar padrões</button>${ADMIN_CFG.defaults ? `<button class="btn sm ghost" data-a="defclear">Voltar aos padrões do jogo</button>` : ""}</div>
  </div>`;
}
function viewAdminPhotos() {
  const q = (UI.adq || "").toLowerCase(), tab = UI.adtab || "j", tm = UI.adteam || "", sf = UI.adsem === "1";
  const clubs = [...new Set((tab === "j" ? PLAYERS.map(p => p.t) : STAFF.map(x => x.club)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const items = tab === "j" ? PLAYERS.filter(p => (!q || (p.n + " " + p.t).toLowerCase().includes(q)) && (!tm || p.t === tm) && (!sf || !PHOTOS["p" + p.id])).sort((a, b) => a.t.localeCompare(b.t) || POS_ORDER[a.p] - POS_ORDER[b.p] || a.n.localeCompare(b.n)).map(p => ({ key: "p" + p.id, n: p.n, sub: p.p + " · " + p.t, html: playerPortrait(p) }))
    : STAFF.filter(x => (!q || x.n.toLowerCase().includes(q)) && (!tm || x.club === tm) && (!sf || !PHOTOS["s" + x.id])).map(x => ({ key: "s" + x.id, n: x.n, sub: (x.k === "tec" ? "Técnico" : "Presidente") + (x.club ? " · " + x.club : ""), html: staffPortrait(x) }));
  const have = Object.keys(PHOTOS).length;
  return `<div class="sec-title"><h2>Fotos (administrador)</h2><button class="btn sm ghost" data-a="profileclose">← Voltar</button></div>
  <div class="card" style="display:grid;gap:10px">
    <p class="muted" style="margin:0;font-size:13px">A foto que você colocar aparece na carta para todo mundo, em todas as salas. O jogo recorta no centro e reduz sozinho. ${have} com foto até agora.</p>
    <div class="row"><button class="btn sm ${tab === "j" ? "gold" : ""}" data-a="adtab" data-v="j">Jogadores</button><button class="btn sm ${tab === "s" ? "gold" : ""}" data-a="adtab" data-v="s">Presidentes e técnicos</button><input id="ad-q" type="text" placeholder="Buscar" value="${esc(UI.adq || "")}" style="max-width:220px">
      <select id="ad-team" style="max-width:220px"><option value="">Todos os times</option>${clubs.map(c => `<option value="${esc(c)}" ${c === tm ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select id="ad-sem" style="max-width:190px"><option value="0" ${!sf ? "selected" : ""}>Com e sem foto</option><option value="1" ${sf ? "selected" : ""}>Só quem não tem foto</option></select>
      <span class="muted" style="font-size:13px">${items.length} na lista</span></div>
    <div class="adgrid">${items.slice(0, 120).map(it => `<div class="aditem">${it.html}<b>${esc(it.n)}</b><span class="muted">${esc(it.sub)}</span><div class="row" style="gap:4px;justify-content:center"><label class="btn sm ${PHOTOS[it.key] ? "" : "gold"}">${PHOTOS[it.key] ? "Trocar" : "Enviar foto"}<input type="file" accept="image/*" class="ad-file" data-key="${it.key}" hidden></label>${PHOTOS[it.key] ? `<button class="btn sm ghost" data-a="addel" data-key="${it.key}">Remover</button>` : ""}</div></div>`).join("")}</div>
    ${items.length > 120 ? `<p class="muted" style="font-size:12.5px;margin:0">Mostrando 120 de ${items.length}. Use a busca.</p>` : ""}
  </div>`;
}
function pcard(p) {
  const owner = S ? ownerOf(S, p.id) : -1;
  return `<div class="pcard ${p.p === "GOL" ? "gk" : ""}">
    <div class="crown">${CROWN}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="ovr">${O(p)}</div><div class="pos">${p.p}</div></div>
    <div class="num muted" style="text-align:right;font-size:13px">VALOR REF.<br><b style="font-size:24px;color:var(--ink)">${hid() ? "?" : p.v}</b></div></div>
    ${playerPortrait(p)}
    <div class="nm">${esc(p.n)}</div>
    <div class="pmeta">${ageOf(p) != null ? `<span>${ageOf(p)} anos</span>` : ""}${bdTxt(p) ? `<span>nasc. ${bdTxt(p)}</span>` : ""}${p.p !== "GOL" ? `<span>carreira: ${p.g} G · ${p.a} A</span><span>${p.pm ? ((p.g + p.a) / p.pm).toFixed(1) : "0"} G+A/jogo</span>` : ""}</div>
    ${pinfo(p)}
    <div class="club">${esc(p.t)}${owner >= 0 ? ` · <b style="color:${S.managers[owner].color}">${esc(S.managers[owner].team)}</b>` : ""}</div>
    ${p.tags.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="st"><div><b>${ageTxt(p)}</b>idade</div><div><b>${hid() ? "?" : p.at}</b>ATQ</div><div><b>${hid() ? "?" : p.df}</b>DEF</div>${S && S.settings && S.settings.career ? `<div><b>${hid() ? "?" : (p.pot || p.o)}</b>POT</div>` : `<div><b>${p.pm}</b>jogos</div>`}</div>
    ${hid() ? `<div class="muted" style="font-size:11px">Modo overall escondido: use as conquistas e o clube como pista.</div>` : ""}
  </div>`;
}
// ficha do jogador: altura, pé, nacionalidade e números na Kings League Brasil (dados do Kings League Scout)
const FLAG = { "Brasil": "🇧🇷", "Espanha": "🇪🇸", "Itália": "🇮🇹", "Portugal": "🇵🇹", "Estados Unidos": "🇺🇸", "Catar": "🇶🇦" };
function pinfo(p) {
  const a = [];
  if (p.nat && p.nat.length) a.push(p.nat.map(n => `${FLAG[n] || ""} ${esc(n)}`).join(" / "));
  if (p.h) a.push((p.h / 100).toFixed(2).replace(".", ",") + " m");
  if (p.ft) a.push(esc(p.ft));
  const k = p.kb;
  const kb = k && k[0] ? `<div class="pmeta kb"><span title="Números na Kings League Brasil">Kings Brasil: <b>${k[0]}</b> jogos · <b>${k[1]}</b> gols · <b>${k[2]}</b> assist. · <b>${k[3]}</b> MVP${k[3] === 1 ? "" : "s"}</span></div>` : "";
  return (a.length ? `<div class="pmeta">${a.map(x => `<span>${x}</span>`).join("")}</div>` : "") + kb;
}
// idade: data de nascimento do site oficial (nov/2026); no modo carreira envelhece a cada temporada
function ageOf(p) { if (!p || p.age == null) return null; return p.age + (S && S.career && S.career.year ? S.career.year - 1 : 0); }
function ageTxt(p) { const a = ageOf(p); return a == null ? "–" : a; }
function bdTxt(p) { return p && p.bd ? p.bd.split("-").reverse().join("/") : null; }
function posb(p, p2) { return `<span class="posb ${p}">${p}${p2 ? `<small>/${p2}</small>` : ""}</span>`; }
function mgrName(i) { const m = S.managers[i]; return `<span class="mcrest">${crestSVG(tcrest(m), 16)}</span> ${esc(m.team)}${S.away && S.away[i] ? ' <span class="pill away" title="Saiu da sala: um bot está jogando por ele até ele voltar">🔌 bot no comando</span>' : ""}`; }
function connStatus() {
  if (NET.srv) return `servidor na nuvem: ${NET.wsOk ? "conectado" : "reconectando…"} · ${NET.lastSync ? `última atualização há ${Math.round((Date.now() - NET.lastSync) / 1000)}s` : "sem sincronizar"}`;
  const w = NET.writeOk === true ? "envio por banco OK" : NET.writeOk === false ? `envio por banco bloqueado (${NET.writeErr})` : "envio por banco testando";
  const r = NET.rjoin || NET.lobby ? "canal ao vivo OK" : "canal ao vivo indisponível";
  const s = NET.lastSync ? `última sincronização há ${Math.round((Date.now() - NET.lastSync) / 1000)}s` : "sem sincronizar";
  return `${w} · ${r} · ${s}${NET.pollErr ? " · leitura: " + NET.pollErr : ""}`;
}
function header() {
  const me = S ? S.managers[myMi()] : null;
  return `<div class="top"><div class="wrap">
    <div class="brand">${CROWN}<div>The Kings Game<small>KINGS LEAGUE BRASIL · FUT 7</small></div></div>
    <div class="spacer"></div>
    ${S && NET.mode !== "local" ? `<span class="chip">Sala <b>${esc(S.code)}</b></span>` : ""}
    ${S && NET.mode === "local" ? `<span class="chip">Um aparelho só</span>` : ""}
    ${me ? `<span class="chip"><span class="dot" style="--c:${me.color}"></span>${esc(me.team)}</span>` : ""}
    ${NET.mode === "host" || (NET.srv && isHost()) ? `<span class="chip">Anfitrião</span>` : ""}${NET.srv ? `<span class="chip" title="A sala roda no servidor: ninguém precisa ficar com o site aberto para o jogo continuar">☁️ na nuvem</span>` : ""}
    ${S && S.phase === "season" ? `<button class="btn sm gold" id="hdr-live" data-a="showlive" style="${anyLive() ? "" : "display:none"}">Ao vivo</button>` : ""}
    ${S && NET.mode === "local" ? `<button class="btn sm ghost" data-a="exportsave" title="Baixa um arquivo com o jogo inteiro">Salvar arquivo</button>` : ""}
    ${accountChip()}
    ${S ? `<button class="btn sm ghost" data-a="leave">Sair</button>` : ""}
  </div></div>`;
}
const RULES = [
  ["Escalonado", "Começa 1x1 e entra um por minuto, na ordem que você escolher, até o 7x7 no 5'.", "#4cc9f0"],
  ["Cartas secretas", "Uma por time, por jogo, do baralho oficial de 10. Liberadas do 5' ao 17' e do 23' ao 36'.", "#b392f0"],
  ["Pênalti presidente", "Você cobra e escolhe o canto; sempre vale 1 gol. Mesmas janelas das cartas.", "#f5c542"],
  ["Gol dobro", "Do 17' ao 20' todo gol vale 2.", "#ff8c42"],
  ["Dado", "Do 20' ao 23': 3x3, 2x2 ou 1x1 com goleiro. Cartões ficam pausados.", "#2fd47e"],
  ["Match ball", "Após o 36', quem chegar ao placar do líder +1 vence: 5x5, 4x4, 3x3, 1x1 e 2x2. Empate: shootouts (5 + alternadas).", "#ff4d61"]
];
// ---- novidades da última atualização (aparece na tela inicial até a pessoa fechar; volta quando sair outra) ----
const NEWS_V = "2026-11-18";
const NEWS = [
  ["☁️", "Salas na nuvem", "A sala roda no servidor: ninguém precisa ficar com o site aberto. Quem criou a sala pode sair, trocar de tela ou bloquear o celular que o jogo continua, e quem sai vira bot até voltar."],
  ["📊", "Overs com dados reais", "Ataque e defesa de cada jogador seguem o perfil dele no Kings League Scout, e 55 jogadores subiram um pouco de over."],
  ["⏱️", "Gols na hora certa", "Os gols saem nos momentos em que saem na Kings de verdade: mais no escalonado e no dado, 1º tempo do 7x7 mais travado e quem está perdendo pressiona no fim."],
  ["🧤", "Goleiro também faz gol", "Principalmente no dado e de longe. E os artilheiros da vida real têm mais chance de marcar."],
  ["🎯", "Pênalti com o aproveitamento de cada um", "Batedores e goleiros usam os números reais de pênalti e shootout."],
  ["🃏", "Coringa rouba depois", "Quando o rival ativa uma carta e você tem o Coringa guardado, aparece um aviso para roubar a carta dele ou guardar o seu Coringa."],
  ["🪪", "Ficha completa nas cartas", "Nacionalidade, altura, pé e os jogos, gols, assistências e MVPs de cada um na Kings League Brasil."],
  ["🔗", "Endereço novo", "O site agora é thekingsgame.vercel.app."],
];
function newsBox() {
  if (store("kl_news") === NEWS_V) return "";
  return `<div class="card news"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">🆕 Novidades da última atualização</h3><button class="btn sm ghost" data-a="newsok">Entendi</button></div>
    <div class="newsl">${NEWS.map(n => `<div><span class="ni">${n[0]}</span><div><b>${esc(n[1])}</b><span class="muted">${esc(n[2])}</span></div></div>`).join("")}</div></div>`;
}
function viewHome() {
  const nm = esc(store("kl_name") || ""), tm = esc(store("kl_team") || "");
  return `<div class="hero"><div class="hero-txt">
    <span class="eyebrow">Kings League Brasil · Fut 7</span>
    <h1>The Kings Game<br><em>Monte, jogue e ganhe</em> a Kings League.</h1>
    <p>Leilão ou draft com os jogadores da Kings League Brasil, campeonato com as regras oficiais jogado ao vivo com os amigos, mercado de trocas e modo carreira com evolução de cada jogador. Você escolhe formação, estilo, ordem do escalonado, cobrador e a hora de usar a carta secreta e o pênalti do presidente.</p></div>
    <div class="hero-stats"><div><b class="num">${PLAYERS.length}</b><span>jogadores reais</span></div><div><b class="num">12</b><span>presidentes por sala</span></div><div><b class="num">10</b><span>cartas secretas</span></div></div>
  </div>
  ${newsBox()}
  ${profileCard()}
  ${resumeBox()}
  <div class="rules">${RULES.map(r => `<div style="--c:${r[2]}"><b>${r[0]}</b>${r[1]}</div>`).join("")}</div>
  <div class="grid3">
    <div class="card" style="display:grid;gap:10px;align-content:start">
      <h2 style="font-size:24px">Criar sala</h2>
      <p class="muted" style="margin:0;font-size:14px">Você vira o anfitrião. Seus amigos entram com o código, cada um no próprio celular.</p>
      <label class="f" for="h-name">Seu nome (presidente)<input id="h-name" type="text" maxlength="18" value="${nm}"></label>
      <label class="f" for="h-team">Nome do seu time<input id="h-team" type="text" maxlength="24" value="${tm}"></label>
      <button class="btn gold" data-a="create" ${UI.busy ? "disabled" : ""}>Criar sala</button>
    </div>
    <div class="card" style="display:grid;gap:10px;align-content:start">
      <h2 style="font-size:24px">Entrar numa sala</h2>
      <p class="muted" style="margin:0;font-size:14px">Peça o código para quem criou a sala.</p>
      <label class="f" for="j-code">Código da sala<input id="j-code" type="text" maxlength="4" style="text-transform:uppercase;font-family:var(--display);font-size:22px;letter-spacing:.2em" value="${esc(inviteCode() || store("kl_last") || "")}"></label>
      <label class="f" for="j-name">Seu nome<input id="j-name" type="text" maxlength="18" value="${nm}"></label>
      <label class="f" for="j-team">Nome do seu time<input id="j-team" type="text" maxlength="24" value="${tm}"></label>
      <button class="btn gold" data-a="join" ${UI.busy ? "disabled" : ""}>Entrar</button>
    </div>
    <div class="card" style="display:grid;gap:10px;align-content:start">
      <h2 style="font-size:24px">Um aparelho só</h2>
      <p class="muted" style="margin:0;font-size:14px">Todo mundo no mesmo computador ou celular. Bom para testar sozinho também.</p>
      <div id="lp" style="display:grid;gap:6px">${[0, 1, 2].map(i => `<input class="lp-name" id="lp${i}" type="text" maxlength="18" placeholder="Jogador ${i + 1}" value="${i === 0 ? nm : ""}">`).join("")}</div>
      <div class="row"><button class="btn sm" data-a="lpadd">+ jogador</button></div>
      <button class="btn" data-a="local">Jogar aqui</button>
    </div>
  </div>
  <p class="err" role="status">${esc(UI.homeErr)}</p>
  ${howOvr()}`;
}
function resumeBox() {
  let rooms = []; try { rooms = JSON.parse(store("kl_rooms") || "[]"); } catch (e) { }
  const sv = savedLocal(), at = +(store("kl_save_at") || 0);
  if (!rooms.length && !sv) return "";
  const when = t => { const d = Math.round((Date.now() - t) / 60000); return d < 60 ? `há ${Math.max(1, d)} min` : d < 1440 ? `há ${Math.round(d / 60)} h` : `há ${Math.round(d / 1440)} dia${d >= 2880 ? "s" : ""}`; };
  const ph = { lobby: "vestiário", staff: "leilão de staff", auction: "leilão", wc: "wild cards", lottery: "sorteio do draft", draft: "draft", trade: "mercado", keep: "mantidos", season: "campeonato", done: "fim de temporada" };
  return `<div class="card resume" style="display:grid;gap:10px;margin-bottom:14px"><h2 style="font-size:22px;margin:0">Continuar de onde parou</h2>
    ${rooms.length ? `<div class="row" style="gap:8px">${rooms.map(r => `<button class="btn ${r === rooms[0] ? "gold" : ""}" data-a="rejoin" data-code="${esc(r.c)}">Voltar para a sala <b>${esc(r.c)}</b> <span class="muted" style="font-size:12px">${when(r.at)}</span></button>`).join("")}</div>
    <p class="muted" style="margin:0;font-size:13px">As salas online ficam salvas: dá para voltar outro dia com os mesmos elencos. Entrando de outro celular, use o mesmo nome de presidente que você usou na sala.</p>` : ""}
    ${sv ? `<div class="row" style="gap:8px"><button class="btn ${rooms.length ? "" : "gold"}" data-a="resumelocal">Continuar o jogo salvo neste aparelho</button><span class="muted" style="font-size:13px">${esc(sv.managers.filter(m => !m.cpu).map(m => m.team).join(", "))} · ${ph[sv.phase] || sv.phase}${sv.career ? ` · carreira, temporada ${sv.career.year}` : ""}${at ? " · " + when(at) : ""}</span><button class="btn sm ghost" data-a="dellocal">Apagar</button></div>` : ""}
    <div class="row" style="gap:8px"><label class="btn sm ghost" style="cursor:pointer">Carregar arquivo salvo<input type="file" id="loadsave" accept=".json,application/json" style="display:none"></label><span class="muted" style="font-size:12.5px">No modo "um aparelho só", use "Salvar arquivo" no topo para guardar o jogo e continuar em qualquer computador.</span></div>
  </div>`;
}
function howOvr() {
  return `<details class="card" style="margin-top:14px"><summary>Como o overall foi calculado</summary><div class="howto" style="margin-top:10px">
  <p>Base: estatísticas oficiais da Kings League Brasil 2025/26 (Split 2) no kingsleague.pro: jogos, finalizações no alvo, assistências, dribles e, para goleiros, defesas e gols sofridos. Tudo por jogo, com peso menor para quem jogou pouco.</p>
  <p>Bônus pelo Split 1 2025 (artilharia, assistências, MVPs), títulos e campanhas na Kings Cup 2025, Kings World Cup Nations 2025/2026 e Mundial de Clubes 2025/2026. Defensores ganham pontos pela defesa do time e pela regularidade.</p>
  <p>Resultado espalhado de 62 a 96 (linha) e 64 a 90 (goleiros). Fora do Split 2, os gols dos 3 artilheiros são oficiais; os demais são estimados pelas finalizações no alvo.</p></div></details>`;
}
function poolTable(list) {
  return `<table class="tbl"><thead><tr><th>OVR</th><th>Pos</th><th>Jogador</th><th>Idade</th><th>Clube 25/26</th><th>ATQ</th><th>DEF</th><th>Valor</th><th>Dono</th></tr></thead><tbody>
  ${list.map(p => { const ow = S ? ownerOf(S, p.id) : -1; return `<tr class="${ow >= 0 ? "gone" : ""}"><td class="o ${p.p === "GOL" ? "g" : ""}">${p.o}</td><td>${posb(p.p, p.p2)}</td>
      <td><b>${esc(p.n)}</b>${p.tags.length ? `<div class="muted" style="font-size:11.5px">${esc(p.tags.slice(0, 3).join(" · "))}</div>` : ""}</td>
      <td class="num">${ageTxt(p)}</td><td class="muted">${esc(p.t)}</td><td class="num">${p.at}</td><td class="num">${p.df}</td><td class="num">${p.v}</td><td>${ow >= 0 ? mgrName(ow) : ""}</td></tr>`; }).join("")}</tbody></table>`;
}

function viewLobby() {
  const host = isHost(), mi = myMi(), st = S.settings;
  const total = Math.max(2, st.total), cpus = Math.max(0, total - S.managers.length);
  const pool = Math.min(PLAYERS.length, Math.ceil(st.squad * 1.5) * Math.max(total, S.managers.length));
  const crestBox = crestEditor();
  return `<div class="sec-title"><h2>Vestiário</h2><span class="muted">${NET.mode === "local" ? "todos no mesmo aparelho" : "esperando a galera entrar"}</span></div>
  <div class="grid2">
    <div class="card" style="display:grid;gap:12px;align-content:start">
      ${NET.mode !== "local" ? `<div><div class="muted" style="font-size:13px">CÓDIGO DA SALA</div><div class="num" style="font-size:72px;font-weight:900;color:var(--gold);letter-spacing:.12em;line-height:1">${esc(S.code)}</div>
      ${window.KL_SITE ? `<div class="row" style="margin-top:6px"><button class="btn sm gold" data-a="copyinvite">Copiar link de convite</button></div><p class="muted" style="margin:6px 0 0;font-size:14px">Mande o link pros seus amigos: o código ${esc(S.code)} já vem preenchido, é só pôr o nome e entrar.</p>` : `<p class="muted" style="margin:6px 0 0;font-size:14px">Compartilhe esta página com seus amigos pelo botão Compartilhar do Claude e mande o código. Cada um abre o link, toca em "Entrar numa sala" e digita ${esc(S.code)}.</p>`}</div>` : ""}
      <div style="display:grid;gap:8px">
        ${S.managers.map((m, i) => `<div class="row" style="justify-content:space-between;border:1px solid var(--line);border-left:4px solid ${m.color};border-radius:10px;padding:8px 10px">
          <div class="row" style="gap:8px">${crestSVG(tcrest(m), 26)}<b>${esc(m.team)}</b> <span class="muted">· ${esc(m.name)}</span> ${m.pid === MYPID ? '<span class="pill you">você</span>' : ""}</div>
          ${host && m.pid !== MYPID && NET.mode !== "local" ? `<button class="btn sm ghost" data-a="kick" data-mi="${i}">Remover</button>` : ""}</div>`).join("")}
        ${NET.mode === "host" ? `<div class="muted" style="font-size:12px">Conexão: ${NET.rjoin || NET.lobby ? "canal ao vivo OK" : "canal ao vivo indisponível"} · pedidos recebidos: ${Object.keys(S.seqs || {}).length}</div>` : ""}
        ${cpus ? `<div class="muted" style="font-size:14px">+ ${cpus} time${cpus > 1 ? "s" : ""} do computador (bots) para completar ${total} times.</div>` : ""}
      </div>
      ${mi >= 0 ? `<div class="row" style="align-items:flex-end">
        <label class="f" for="me-team" style="flex:1">Nome do seu time<input id="me-team" type="text" maxlength="24" value="${esc(S.managers[mi].team)}"></label>
        <button class="btn sm" data-a="editme">Salvar</button></div>` : NET.mode === "client" ? `<div class="flash" style="border-color:var(--gold);background:rgba(245,197,66,.06)"><b>Pedindo para entrar…</b><div class="muted" style="font-size:13px;margin-top:4px">O pedido é reenviado sozinho a cada 4 segundos. A página do anfitrião precisa estar aberta.</div><div class="muted num" style="font-size:12px;margin-top:6px">${connStatus()}</div><button class="btn sm" style="margin-top:8px" data-a="rejoin">Tentar de novo</button></div>` : ""}
    </div>
    <div class="card" style="display:grid;gap:12px;align-content:start">
      <h3 style="font-size:22px">Modo de jogo</h3>
      <div class="modes">
        <button class="mode ${st.mode !== "draft" ? "on" : ""}" data-a="setmode" data-v="leilao" ${host ? "" : "disabled"}><b>Leilão</b><span>Jogadores sorteados um a um. Quem der mais leva.</span></button>
        <button class="mode ${st.mode === "draft" ? "on" : ""}" data-a="setmode" data-v="draft" ${host ? "" : "disabled"}><b>Draft Kings League</b><span>Wild cards com propostas secretas, sorteio da ordem e draft em cobra.</span></button>
      </div>
      <div class="grid2" style="gap:10px">
        <label class="f" for="s-fmt">Formato do campeonato<select id="s-fmt" ${host && !st.year ? "" : "disabled"}><option value="split" ${st.fmt !== "cup" ? "selected" : ""}>Split: grupo único, top 7 no mata-mata</option><option value="cup" ${st.fmt === "cup" ? "selected" : ""}>Kings Cup: 2 grupos + jogo desafio</option></select></label>
        <label class="f" for="s-career">Modo carreira<select id="s-career" ${host ? "" : "disabled"}><option value="0" ${!st.career ? "selected" : ""}>Não</option><option value="1" ${st.career ? "selected" : ""}>Sim: várias temporadas com o mesmo time</option></select></label>
        <label class="f" for="s-year">Temporada completa<select id="s-year" ${host ? "" : "disabled"}><option value="0" ${!st.year ? "selected" : ""}>Não, só um campeonato</option><option value="1" ${st.year ? "selected" : ""}>Sim: Split e depois Kings Cup</option></select></label>
        <label class="f" for="s-staff">Mercado de staff<select id="s-staff" ${host ? "" : "disabled"}>${[["nenhum", "Sem técnicos e presidentes"], ["tecnicos", "Só técnicos"], ["presidentes", "Só presidentes"], ["ambos", "Técnicos e presidentes"]].map(([k, v]) => `<option value="${k}" ${st.staff === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f" for="s-trades">Mercado de trocas<select id="s-trades" ${host ? "" : "disabled"}>${[["nenhum", "Sem trocas"], ["antes", "Antes do campeonato"], ["mata", "Antes do mata-mata"], ["ambos", "Antes do campeonato e do mata-mata"]].map(([k, v]) => `<option value="${k}" ${st.trades === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <p class="muted" style="font-size:13px;margin:0">${st.year ? "Temporada completa: Split com o modo escolhido abaixo. Depois cada time mantém até 6 wild cards e até 3 jogadores, o resto volta para um draft, e começa a Kings Cup. Como a Cup tem dois grupos iguais, a temporada usa número par de times (mínimo 8): bots completam o que faltar." : st.fmt === "cup" ? "Kings Cup: dois grupos iguais. Todo time joga em toda rodada: contra o próprio grupo ou, uma única vez, o jogo desafio contra alguém do outro grupo. O desafio não vale ponto na tabela, só ponto para o grupo e uma carta secreta extra no mata-mata para quem vencer. O grupo com mais vitórias nos desafios leva 4 vagas e o 1º dele vai direto à semi; o outro grupo leva 3 vagas e o 1º joga as quartas. Precisa de número par de times (mínimo 8): bots completam o que faltar." : "Split: todos contra todos uma vez. O 1º vai direto para a semifinal e do 2º ao 7º jogam as quartas."}${st.staff !== "nenhum" ? " Antes dos jogadores tem o leilão de staff: técnicos dão bônus se o time usar a formação e o estilo favoritos deles, e o presidente é quem cobra o pênalti presidente." : ""}</p>
      <div class="grid2" style="gap:10px">
        ${stepper("budget", st.mode === "draft" ? "Moedas para wild cards (K$)" : "Orçamento por time (K$)", st.budget, 30, 600, 10, host)}
        ${st.mode === "draft" ? `${stepper("wc", "Wild cards por time (máx. 6)", st.wc, 0, 6, 1, host)}
        <div class="f"><span>Escolhas no draft</span><div class="stepper"><b class="num">${st.picks}</b><span class="muted" style="font-size:12px">sempre completa 12</span></div></div>
        ${stepper("dtimer", "Segundos por escolha", st.dtimer, 10, 90, 5, host)}` : stepper("squad", "Jogadores por elenco (com reservas)", st.squad, 7, 12, 1, host)}
        ${stepper("timer", "Segundos por lance", st.timer, 5, 30, 1, host)}
        ${stepper("total", "Times no campeonato", st.total, 2, 12, 1, host)}
        ${st.trades !== "nenhum" ? stepper("tmin", "Tempo do mercado de trocas (min)", st.tmin || 1, 1, 5, 1, host) : ""}
      </div>
      <label class="f" for="s-inj">Lesões durante os jogos<select id="s-inj" ${host ? "" : "disabled"}>${[["normal", "Normais"], ["poucas", "Poucas"], ["nao", "Sem lesões"]].map(([k, v]) => `<option value="${k}" ${(st.inj || "normal") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="f" for="s-hide">Overall dos jogadores<select id="s-hide" ${host ? "" : "disabled"}>${[["nao", "Visível"], ["leilao", "Escondido no leilão (revela no campeonato)"], ["sempre", "Escondido o jogo todo"]].map(([k, v]) => `<option value="${k}" ${st.hide === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      ${st.mode === "draft" ? `<p class="muted" style="font-size:13.5px;margin:0">Elenco de <b style="color:var(--ink)">${st.wc + st.picks}</b> jogadores: <b style="color:var(--ink)">${st.wc}</b> wild cards + <b style="color:var(--ink)">${st.picks}</b> do draft. 1) Cada um manda propostas secretas pelos wild cards que quer. Se só você pediu, leva pelo valor da proposta. Se dois ou mais pediram o mesmo, vira leilão entre eles. 2) Sorteio da ordem. 3) Draft em cobra (1→${Math.max(2, st.total)}, depois ${Math.max(2, st.total)}→1) com todos os jogadores que sobraram. Wild card que não fechar vira escolha extra no draft.</p>` : `<p class="muted" style="font-size:13.5px;margin:0">Vão a leilão <b class="num" style="color:var(--ink)">${pool}</b> jogadores sorteados (1,5 por vaga de cada time), aparecendo um de cada vez em ordem aleatória. Quem não quiser toca em <b>Passar</b>. Se ninguém quiser, o jogador vai para a repescagem no fim. Cada elenco precisa de pelo menos 1 goleiro.</p>`}
      ${host && NET.mode === "host" ? `<p class="muted" style="font-size:12.5px;margin:0">Você é o anfitrião: o jogo roda no seu aparelho. Pode minimizar a aba, mas se fechar o site ou bloquear o celular por mais de 1 minuto, outro jogador assume a sala automaticamente e você volta como jogador normal.</p>` : ""}
      ${host ? `<div class="row"><span class="spacer"></span><button class="btn gold big" data-a="start">${st.mode === "draft" ? "Começar wild cards" : "Começar leilão"}</button></div>` : `<p class="muted" style="margin:0">Só o anfitrião muda as regras e começa o leilão.</p>`}
    </div>
  </div>
  ${hallView()}
  ${crestBox}`;
}

const CREST_LBL = {
  shape: ["Escudo", "Redondo", "Hexágono", "Diamante", "Flâmula", "Brasão", "Oval", "Quadrado", "Clássico", "Angular", "Coroado", "Losango arredondado", "Pentágono", "Octógono", "Gota", "Arco", "Seta", "Medieval", "Estrela", "Triângulo", "Coração", "Retrô", "Inglês", "Bandeira", "Pontudo", "Selo", "Cápsula"],
  pat: ["Liso", "Listras", "Diagonal", "Metade", "Faixa", "Xadrez", "Listras horizontais", "Cruz", "Chevron", "Quartos", "Aro", "Diagonal dupla", "Triângulo", "Bolinhas", "Ondas", "Raios de sol", "Losangos", "Faixa vertical", "Xis", "Moldura interna", "Metade horizontal", "Canto", "Zigue-zague", "Traços finos", "Estrelas", "Grade", "Meia-lua", "Faixas duplas", "Listras finas", "Diagonal invertida", "Topo", "Base", "Terço lateral"],
  icon: ["Coroa", "Raio", "Estrela", "Bola", "Chama", "Olho", "Garra", "Foguete", "Troféu", "Âncora", "Espadas", "Coração", "Lua", "Sol", "Montanha", "Onda", "Gema", "Asas", "Caveira", "Touro", "Trevo", "Flor", "Árvore", "Castelo", "Torre", "Martelo", "Tridente", "Flecha", "Alvo", "Chave", "Cometa", "Planeta", "Ouros", "Paus", "Espada (naipe)", "Infinito", "Pássaro", "Peixe", "Folha", "Pena", "Capacete viking", "Dado", "Gol", "Campo", "Medalha", "Cruz", "Floco de neve", "Nota musical", "Lobo", "Águia", "Cobra", "Raio duplo", "Pirâmide", "Monograma (a sigla no centro)", "Nenhum"],
  med: ["Nenhum (só o símbolo)", "Círculo", "Anel", "Losango", "Mini escudo", "Hexágono"],
  isz: ["Médio", "Pequeno", "Grande", "Gigante"],
  tpos: ["Embaixo", "Em cima", "Numa faixa"],
  fnt: ["Condensada", "Clássica (serifa)", "Pesada", "Manuscrita"],
  bw: ["Normal", "Fina", "Grossa", "Dupla", "Sem borda"],
  gr: ["Sem gradiente", "De cima para baixo", "De lado", "Diagonal", "Do centro para fora"],
  tor: ["Mosaico com o escudo", "Listras", "Xadrez", "Ola (onda)", "Bandeiras", "Sinalizadores"]
};
const KIT_NAMES = ["Lisa", "Listras verticais", "Listras horizontais", "Faixa diagonal", "Metade", "Xadrez", "Gola e punhos", "Faixa central", "Ombros", "V no peito", "Listras finas", "Degradê", "Faixas laterais", "Faixa no peito", "Bicolor diagonal", "Chevron duplo", "Quadros grandes", "Mangas", "Bolinhas", "Zigue-zague", "Ondas", "Faixa diagonal dupla", "Xis", "Barra inferior", "Colete", "Listras grossas", "Listras horizontais finas", "Estrela no peito", "Faixa diagonal invertida", "Metade horizontal", "Quadriculado fino", "Camuflado", "Traços finos", "Cruz", "Grade"];
const KIT_GOLA_LBL = ["Padrão", "Redonda", "Gola V", "Polo"], KIT_FONT_LBL = ["Condensada", "Clássica (serifa)", "Pesada"];
const PAL = ["#f5c542", "#111318", "#ffffff", "#c81e3a", "#1d3fbf", "#0f5132", "#ff7b00", "#5b2a86", "#00a6a6", "#ff3d8b", "#bde0fe", "#7a0019", "#03045e", "#2a9d8f", "#e9c46a", "#432818", "#9d0208", "#3a0ca3", "#ffba08", "#adb5bd"];
function crestEditor(force) {
  const mis = force != null ? [force] : editableMis(); if (!mis.length) return "";
  if (force == null && (UI.crestMi == null || !mis.includes(UI.crestMi))) UI.crestMi = mis[0];
  const mi = force != null ? force : UI.crestMi, m = mgrOf(mi), c = m.crest || {};
  const sel = (f, list, val, labels) => `<select id="c-${f}" data-mi="${mi}">${list.map((k, i) => `<option value="${k}" ${k === val ? "selected" : ""}>${labels ? labels[i] : k}</option>`).join("")}</select>`;
  const col = (f, label, v) => `<label class="f" for="c-${f}">${label}<input id="c-${f}" type="color" data-mi="${mi}" value="${v}"></label>`;
  const tog = (f, label, def, on) => `<label class="f" for="c-${f}">${label}<span class="row" style="gap:6px;flex-wrap:nowrap"><input id="c-${f}" type="color" data-mi="${mi}" value="${c[f] || def}" ${on ? "" : 'style="opacity:.45"'}><button class="btn sm ${on ? "gold" : "ghost"}" data-a="ctog" data-f="${f}" data-def="${def}" data-mi="${mi}">${on ? "Ligada" : "Desligada"}</button></span></label>`;
  return `${looksBox(mi, m)}<div class="sec-title"><h2>Escudo</h2><span class="muted">escolha um pronto ou monte o seu</span></div>
  <div class="card crested">
    ${mis.length > 1 ? `<div class="row" style="margin-bottom:10px"><span class="muted">Editando:</span>${mis.map(i => `<button class="btn sm ${i === mi ? "gold" : ""}" data-a="crestmi" data-mi="${i}">${esc(S.managers[i].team)}</button>`).join("")}</div>` : ""}
    <div class="crestgrid">
      <div class="crestprev">${crestSVG(c, 130)}<b>${esc(m.team)}</b><div class="row" style="gap:6px;justify-content:center;margin-top:6px">${crestSVG(c, 34)}${crestSVG(c, 22)}</div><button class="btn sm" style="margin-top:8px" data-a="crestrand" data-mi="${mi}">🎲 Escudo aleatório</button></div>
      <div style="display:grid;gap:12px">
        <div class="presets">${CREST_PRESETS.map((p, k) => `<button class="preset" data-a="crestpre" data-k="${k}" data-mi="${mi}" title="${esc(p.n)}">${crestSVG(Object.assign({}, p, { txt: c.txt }), 40)}<span>${esc(p.n)}</span></button>`).join("")}</div>
        <div class="edsec"><b>Formato e desenho</b><div class="grid3">
          <label class="f" for="c-shape">Formato${sel("shape", CREST_SHAPES, c.shape, CREST_LBL.shape)}</label>
          <label class="f" for="c-pat">Desenho${sel("pat", CREST_PATS, c.pat, CREST_LBL.pat)}</label>
          <label class="f" for="c-bw">Borda${sel("bw", CREST_BW, c.bw || "normal", CREST_LBL.bw)}</label>
          ${col("c1", "Cor principal", c.c1 || "#f5c542")}${col("c2", "Cor secundária (desenho)", c.c2 || "#111111")}${col("c3", "Cor da borda", c.c3 || c.c2 || "#ffffff")}
          ${tog("c4", "Cor terciária (opcional)", "#ffffff", !!c.c4)}
          <label class="f" for="c-pat2">Desenho da cor terciária${sel("pat2", CREST_PATS, c.pat2 || "liso", ["Nenhum"].concat(CREST_LBL.pat.slice(1)))}</label>
          <label class="f" for="c-gr">Gradiente no fundo${sel("gr", CREST_GR, c.gr || "nenhum", CREST_LBL.gr)}</label>
          ${col("g2", "Cor final do gradiente", c.g2 || c.c2 || "#111111")}
        </div></div>
        <div class="edsec"><b>Símbolo</b><div class="grid3">
          <label class="f" for="c-icon">Símbolo${sel("icon", CREST_ICONS, c.icon, CREST_LBL.icon)}</label>
          <label class="f" for="c-isz">Tamanho do símbolo${sel("isz", CREST_ISZ, c.isz || "m", CREST_LBL.isz)}</label>
          ${col("ic", "Cor do símbolo", c.ic || c.c2 || "#111111")}
          <label class="f" for="c-med">Fundo do símbolo${sel("med", CREST_MEDS, c.med || "nenhum", CREST_LBL.med)}</label>
          ${col("mf", "Cor do fundo do símbolo", c.mf || c.c1 || "#f5c542")}
          <label class="f" for="c-hn">Contorno do símbolo<select id="c-hn" data-mi="${mi}"><option value="0" ${!c.hn ? "selected" : ""}>Com contorno</option><option value="1" ${c.hn ? "selected" : ""}>Sem contorno</option></select></label>
        </div></div>
        <div class="edsec"><b>Texto e estrelas</b><div class="grid3">
          <label class="f" for="c-txt">Sigla (até 3)<input id="c-txt" type="text" maxlength="3" data-mi="${mi}" value="${esc(c.txt || "")}" style="text-transform:uppercase"></label>
          <label class="f" for="c-tpos">Posição da sigla${sel("tpos", CREST_TPOS, c.tpos || "baixo", CREST_LBL.tpos)}</label>
          <label class="f" for="c-fnt">Fonte${sel("fnt", CREST_FONTS, c.fnt || "display", CREST_LBL.fnt)}</label>
          ${col("tc", "Cor da sigla", c.tc || c.c2 || "#111111")}
          <label class="f" for="c-ano">Ano de fundação<input id="c-ano" type="text" inputmode="numeric" maxlength="4" placeholder="ex.: 2026" data-mi="${mi}" value="${esc(c.ano || "")}"></label>
          <label class="f" for="c-sa">Estrelas<select id="c-sa" data-mi="${mi}"><option value="manual" ${c.sa !== "auto" ? "selected" : ""}>Manuais (eu escolho)</option><option value="auto" ${c.sa === "auto" ? "selected" : ""}>Automáticas: títulos deste save</option></select></label>
          ${c.sa === "auto" ? `<label class="f" for="c-sac">Contam como estrela<select id="c-sac" data-mi="${mi}"><option value="todos" ${(c.sac || "todos") === "todos" ? "selected" : ""}>Split (dourada) e Cup (prateada)</option><option value="split" ${c.sac === "split" ? "selected" : ""}>Só Split</option><option value="cup" ${c.sac === "cup" ? "selected" : ""}>Só Kings Cup</option></select></label>` : ""}
          <label class="f" for="c-stars">${c.sa === "auto" ? "Estrelas agora" : "Quantas estrelas"}<select id="c-stars" data-mi="${mi}" ${c.sa === "auto" ? "disabled" : ""}>${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${(c.stars | 0) === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="f" for="c-spos">Posição das estrelas<select id="c-spos" data-mi="${mi}"><option value="fora" ${c.spos !== "dentro" ? "selected" : ""}>Em cima, fora do escudo</option><option value="dentro" ${c.spos === "dentro" ? "selected" : ""}>Dentro do escudo</option></select></label>
          ${col("sc", "Cor das estrelas", c.sc || "#f5c542")}
          <label class="f" for="c-nch">Selo de campeão<select id="c-nch" data-mi="${mi}"><option value="0" ${!c.nch ? "selected" : ""}>Mostrar quando for campeão</option><option value="1" ${c.nch ? "selected" : ""}>Não mostrar</option></select></label>
        </div><p class="muted" style="font-size:12px;margin:0">Campeão ganha borda dourada e a fita "CAMPEÃO" no escudo e um selo na manga, só neste save, até outro time vencer a mesma competição.</p></div>
        <div class="edsec"><b>Mascote e torcida</b><div class="grid3">
          <label class="f" for="c-masc">Mascote (aparece no gol)${sel("masc", ["nenhum"].concat(CREST_ICONS.filter(x => x !== "letra" && x !== "nenhum")), c.masc || "nenhum", ["Nenhum"].concat(CREST_LBL.icon.filter((x, i) => CREST_ICONS[i] !== "letra" && CREST_ICONS[i] !== "nenhum")))}</label>
          ${col("mc", "Cor do mascote", c.mc || c.c2 || "#111111")}
          <div class="crestprev" style="min-height:0">${mascotSVG(c, 56) || '<span class="muted" style="font-size:12px">sem mascote</span>'}</div>
          <label class="f" for="c-tor">Estilo da torcida${sel("tor", TOR_STYLES, c.tor || "mosaico", CREST_LBL.tor)}</label>
          ${tog("t1", "Cor 1 da torcida (opcional)", c.c1 || "#f5c542", !!c.t1)}
          ${tog("t2", "Cor 2 da torcida (opcional)", c.c2 || "#111111", !!c.t2)}
          <label class="f" for="c-fx" style="grid-column:span 2">Faixa da torcida<input id="c-fx" type="text" maxlength="28" placeholder="${esc((m.team || "").toUpperCase())}" data-mi="${mi}" value="${esc(c.fx || "")}"></label>
        </div></div>
      </div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">Os escudos oficiais dos times da Kings League são marcas registradas, então os prontos aqui são originais. Dá pra recriar as cores do seu time do coração no editor.</p>
  </div>
  <div class="sec-title"><h2>Uniformes</h2><span class="muted">principal no campo e na torcida; o reserva entra quando as cores batem com o do rival</span></div>
  ${kitEditor(mi, m)}`;
}
// visuais salvos: vários conjuntos de escudo + uniformes guardados no perfil
function looksBox(mi, m) {
  const L = getProf().looks || [];
  return `<div class="sec-title"><h2>Meus visuais</h2><span class="muted">guarde vários escudos e uniformes e troque quando quiser, por exemplo antes de uma temporada nova</span></div>
  <div class="card crested"><div class="looks">${L.map((x, k) => `<div class="look"><div class="row" style="gap:4px;justify-content:center">${crestSVG(x.crest, 34)}${kitSVG(x.kit, 38, 10, x.crest)}${x.kit2 ? kitSVG(x.kit2, 30, 10, x.crest) : ""}</div><b>${esc(x.n)}</b><div class="row" style="gap:4px;justify-content:center"><button class="btn sm gold" data-a="lookuse" data-k="${k}" data-mi="${mi}">Usar</button><button class="btn sm ghost" data-a="lookdel" data-k="${k}" title="Apagar">✕</button></div></div>`).join("") || `<p class="muted" style="margin:0;font-size:13px">Nenhum visual salvo ainda. Monte o escudo e os uniformes abaixo e salve aqui.</p>`}</div>
  <div class="row" style="gap:6px;margin-top:10px"><input id="look-n" type="text" maxlength="20" placeholder="Nome do visual (ex.: Temporada 2)" style="flex:1;min-width:160px"><button class="btn sm" data-a="looksave" data-mi="${mi}" ${L.length >= 12 ? "disabled" : ""}>Salvar o visual atual</button></div>
  ${L.length >= 12 ? `<p class="muted" style="font-size:12px;margin:6px 0 0">Limite de 12 visuais. Apague um para salvar outro.</p>` : ""}</div>`;
}
function useLook(mi, x) {
  const cp = v => v ? JSON.parse(JSON.stringify(v)) : null, crest = cp(x.crest), kit = cp(x.kit), kit2 = cp(x.kit2);
  if (mi === PROF_MI) { putProf({ crest, kit, kit2 }); return render(true); }
  const m = S.managers[mi], a = { t: "editme", mi, crest, kit }; if (kit2) a.kit2 = kit2;
  if (NET.mode === "client") { m.crest = crest; m.kit = kit; setLocal(mi, "crest", crest); setLocal(mi, "kit", kit); if (kit2) { m.kit2 = kit2; setLocal(mi, "kit2", kit2); } render(true); }
  act(a);
}
function kitEditor(mi, m) {
  const which = UI.kitTab === 2 ? 2 : 1, key = which === 2 ? "kit2" : "kit";
  const k = m[key] || (which === 2 ? awayKit(m.kit) : {}) || {};
  const sel = (f, list, val, labels) => `<select id="k-${f}" data-mi="${mi}">${list.map((v, i) => `<option value="${v}" ${v === val ? "selected" : ""}>${labels ? labels[i] : v}</option>`).join("")}</select>`;
  const tog = (f, label, def, flag) => { const on = !!k[flag || f]; return `<label class="f" for="k-${f}">${label}<span class="row" style="gap:6px;flex-wrap:nowrap"><input id="k-${f}" type="color" data-mi="${mi}" value="${k[f] || def}" ${on ? "" : 'style="opacity:.45"'}><button class="btn sm ${on ? "gold" : "ghost"}" data-a="ktog" data-f="${f}" data-flag="${flag || ""}" data-def="${def}" data-mi="${mi}">${on ? "Ligada" : "Desligada"}</button></span></label>`; };
  return `<div class="card crested"><div class="row" style="margin-bottom:10px;gap:6px"><button class="btn sm ${which === 1 ? "gold" : ""}" data-a="kittab" data-v="1">Principal</button><button class="btn sm ${which === 2 ? "gold" : ""}" data-a="kittab" data-v="2">Reserva</button></div>
  <div class="crestgrid">
    <div class="crestprev"><div class="row" style="gap:6px;justify-content:center">${kitSVG(tkit(m, m.kit), which === 1 ? 120 : 70, 10, m.crest)}${kitSVG(tkit(m, m.kit2 || awayKit(m.kit)), which === 2 ? 120 : 70, 10, m.crest)}</div><b>${esc(m.team)}</b><span class="muted" style="font-size:12px">${which === 1 ? "Principal (casa)" : "Reserva (fora, se as cores baterem)"}</span><button class="btn sm" style="margin-top:8px" data-a="kitrand" data-mi="${mi}">🎲 Camisa aleatória</button></div>
    <div style="display:grid;gap:12px;align-content:start">
      <div class="edsec"><b>Modelo e cores</b><div class="grid3">
        <label class="f" for="k-pat">Modelo${sel("pat", KIT_PATS, k.pat, KIT_NAMES)}</label>
        <label class="f" for="k-c1">Cor da camisa<input id="k-c1" type="color" data-mi="${mi}" value="${k.c1 || "#f5c542"}"></label>
        <label class="f" for="k-gr">Degradê da camisa${sel("gr", CREST_GR, k.gr || "nenhum", CREST_LBL.gr)}</label>
        <label class="f" for="k-g2">Cor final do degradê<input id="k-g2" type="color" data-mi="${mi}" value="${k.g2 || k.c2 || "#111111"}"></label>
        <label class="f" for="k-c2">Cor do detalhe<input id="k-c2" type="color" data-mi="${mi}" value="${k.c2 || "#111111"}"></label>
        ${tog("c3", "Cor terciária (opcional)", "#ffffff")}
        <label class="f" for="k-pat2">Desenho da cor terciária${sel("pat2", KIT_PATS, k.pat2 || "liso", ["Nenhum"].concat(KIT_NAMES.slice(1)))}</label>
        ${tog("pc", "Punhos e barra (opcional)", "#ffffff", "pu")}
      </div></div>
      <div class="edsec"><b>Gola, mangas e número</b><div class="grid3">
        <label class="f" for="k-gl">Gola${sel("gl", KIT_GOLAS, k.gl || "padrao", KIT_GOLA_LBL)}</label>
        ${tog("gc", "Cor da gola (opcional)", "#ffffff")}
        ${tog("cm", "Cor das mangas (opcional)", "#ffffff")}
        <label class="f" for="k-num">Cor do número<input id="k-num" type="color" data-mi="${mi}" value="${k.num || "#ffffff"}"></label>
        ${tog("nc", "Contorno do número (opcional)", "#000000")}
        <label class="f" for="k-nf">Fonte do número${sel("nf", KIT_FONTS, k.nf || "display", KIT_FONT_LBL)}</label>
        <label class="f" for="k-bd">Escudo no peito<select id="k-bd" data-mi="${mi}"><option value="0" ${!k.bd ? "selected" : ""}>Não</option><option value="1" ${k.bd ? "selected" : ""}>Sim</option></select></label>
        <label class="f" for="k-sp">Patrocínio (até 12)<input id="k-sp" type="text" maxlength="12" placeholder="ex.: KINGS BET" data-mi="${mi}" value="${esc(k.sp || "")}"></label>
      </div></div>
      <div class="row" style="gap:6px"><button class="btn sm" data-a="kitfromcrest" data-mi="${mi}">Usar cores do escudo</button>${which === 2 ? `<button class="btn sm ghost" data-a="kitinvert" data-mi="${mi}">Inverter o principal</button>` : ""}</div>
    </div></div></div>`;
}
function rndOf(a) { return a[Math.floor(Math.random() * a.length)]; }
function randCrestFull(txt) {
  const c1 = rndOf(PAL); let c2 = rndOf(PAL); while (c2 === c1) c2 = rndOf(PAL);
  const third = Math.random() < 0.45;
  return { shape: rndOf(CREST_SHAPES), pat: rndOf(CREST_PATS), icon: rndOf(CREST_ICONS.filter(i => i !== "nenhum")), c1, c2, c3: Math.random() < 0.5 ? c2 : rndOf(PAL), ic: Math.random() < 0.6 ? c2 : rndOf(PAL), tc: c2, c4: third ? rndOf(PAL) : null, pat2: third ? rndOf(CREST_PATS.slice(1)) : "liso", med: Math.random() < 0.7 ? "nenhum" : rndOf(CREST_MEDS), isz: rndOf(CREST_ISZ), tpos: rndOf(CREST_TPOS), fnt: rndOf(CREST_FONTS), bw: rndOf(["normal", "normal", "fina", "grossa", "dupla"]), txt };
}
function randKitFull() {
  const c1 = rndOf(PAL); let c2 = rndOf(PAL); while (c2 === c1) c2 = rndOf(PAL); const third = Math.random() < 0.4;
  return { c1, c2, pat: rndOf(KIT_PATS), num: rndOf(["#ffffff", "#111111", c2]), c3: third ? rndOf(PAL) : null, pat2: third && Math.random() < 0.6 ? rndOf(KIT_PATS.slice(1)) : "liso", gc: Math.random() < 0.4 ? rndOf(PAL) : null, pu: Math.random() < 0.3, pc: rndOf(PAL), gl: rndOf(KIT_GOLAS), cm: Math.random() < 0.2 ? rndOf(PAL) : null, nf: rndOf(KIT_FONTS) };
}
function setKit(mi, patch) { if (mi === PROF_MI) { const m = mgrOf(mi), key = UI.kitTab === 2 ? "kit2" : "kit"; putProf({ [key]: Object.assign({}, m[key] || (key === "kit2" ? awayKit(m.kit) : {}), patch) }); return render(true); } const m = S.managers[mi], key = UI.kitTab === 2 ? "kit2" : "kit"; const k = Object.assign({}, m[key] || (key === "kit2" ? awayKit(m.kit) : {}), patch); if (NET.mode === "client") { m[key] = k; setLocal(mi, key, k); render(true); } act({ t: "editme", [key]: k, mi }); }
function setCrest(mi, patch) { if (mi === PROF_MI) { putProf({ crest: Object.assign({}, mgrOf(mi).crest || {}, patch) }); return render(true); } const m = S.managers[mi]; const c = Object.assign({}, m.crest || {}, patch); if (NET.mode === "client") { m.crest = c; setLocal(mi, "crest", c); render(true); } act({ t: "editme", crest: c, mi }); }
function viewAuction() {
  const a = S.auction, mi = myMi();
  const lot = a.lot, pl = lot ? P(lot.pid) : null;
  const host = isHost();
  let stage;
  if (lot) {
    let bidders = NET.mode === "local" ? humansIdx() : (mi >= 0 ? [mi] : []);
    if (lot.only) bidders = bidders.filter(i => lot.only.includes(i));
    stage = `<div class="stage">${passStamp(lot)}${pcard(pl)}
      <div class="bidbox">
        <div class="row" style="justify-content:space-between"><span class="phase">${a.wc ? `Disputa ${lot.n} de ${a.total}` : `${a.repesc ? "Repescagem · " : ""}Lote ${lot.n} de ${a.total}`}</span>${a.paused ? '<span class="phase mb">Pausado</span>' : ""}</div>
        <div class="bidnow"><div class="amt num ${bidPop(lot)}">${lot.bid || "–"}</div><div class="who"><div class="muted" style="font-size:12px">${lot.bidder >= 0 ? "LANCE ATUAL" : "SEM LANCES · comece com 1"}</div>${lot.bidder >= 0 ? mgrName(lot.bidder) : ""}${lot.bidder === mi && mi >= 0 ? ' <span class="pill you">você lidera</span>' : ""}</div><div class="spacer"></div><div class="clock num" id="clock">–</div></div>
        <div class="bar"><i id="clockbar" style="width:100%"></i></div>
        ${lot.passed.length ? `<div class="muted" style="font-size:13px">Passaram: ${lot.passed.map(i => esc(S.managers[i].team)).join(", ")}</div>` : ""}
        ${bidders.map(bi => bidControls(bi, lot, pl)).join("")}
        ${mi < 0 && NET.mode === "client" ? `<p class="muted">Você está assistindo.</p>` : ""}
      </div></div>`;
  } else {
    const ls = a.lastSale;
    stage = `<div style="display:grid;place-items:center;min-height:240px;gap:10px;text-align:center">
      ${ls ? (ls.mi >= 0 ? `<div class="sold-anim"><div class="muted">VENDIDO</div><h2 style="font-size:44px">${esc(P(ls.pid).n)}</h2><div>${mgrName(ls.mi)} · <b class="num" style="font-size:24px;color:var(--gold)">${ls.price} K$</b></div></div>` : `<div class="sold-anim"><div class="muted">SEM INTERESSADOS</div><h2 style="font-size:36px">${esc(P(ls.pid).n)}</h2></div>`) : `<h2 style="font-size:36px">Sorteando o primeiro jogador…</h2>`}
      <div class="muted">Próximo jogador saindo do pote…</div></div>`;
  }
  const sq = S.settings.squad;
  if (a.wc) return `<div class="sec-title"><h2>Disputa de wild card</h2><span class="muted">${lot ? `só ${lot.only.map(i => esc(S.managers[i].team)).join(" e ")} podem dar lance` : "preparando a próxima disputa"}</span></div><div class="card">${stage}</div>
    <div class="sec-title"><h2>Presidentes</h2></div><div class="mgrs">${S.managers.map((m, i) => mgrBox(m, i)).join("")}</div>
    <div class="sec-title"><h2>Últimos lances</h2></div><div class="card log">${S.log.slice(0, 12).map(l => `<div>${esc(l)}</div>`).join("")}</div>`;
  return `<div class="sec-title"><h2>Leilão</h2><span class="muted">${a.sold.length} vendidos · ${S.managers.reduce((s, m) => s + Math.max(0, sq - m.roster.length), 0)} vagas abertas</span></div>
  <div class="card">${stage}</div>
  ${myBoards()}
  ${host ? `<div class="row" style="margin-top:10px"><span class="muted" style="font-size:13px">Anfitrião:</span>
    <button class="btn sm" data-a="pause">${a.paused ? "Retomar leilão" : "Pausar leilão"}</button>
    <button class="btn sm" data-a="autofill">Completar elencos automaticamente</button></div>` : ""}
  <div class="sec-title"><h2>Presidentes</h2></div>
  <div class="mgrs">${S.managers.map((m, i) => mgrBox(m, i)).join("")}</div>
  <div class="sec-title"><h2>Últimos lances</h2></div><div class="card log">${S.log.slice(0, 12).map(l => `<div>${esc(l)}</div>`).join("")}</div>`;
}
/* ---------- mercado de staff ---------- */
function staffCard(x) {
  return `<div class="pcard" style="background:linear-gradient(160deg,#16243a,#0b1220);border-color:#2c4a73"><div class="crown">${CROWN}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="pos" style="font-size:16px;color:var(--blue)">${x.k === "tec" ? "TÉCNICO" : "PRESIDENTE"}</div></div><div class="num muted" style="text-align:right;font-size:13px">VALOR REF.<br><b style="font-size:24px;color:var(--ink)">${hid() ? "?" : x.v}</b></div></div>
    ${staffPortrait(x)}
    <div class="nm">${esc(x.n)}</div><div class="club">${esc(x.club)}</div>
    <div class="st">${x.k === "tec" ? `<div><b>${x.form}</b>formação</div><div><b style="font-size:14px">${STYLES[x.style].n}</b>estilo</div><div><b>${hid() ? "?" : "+" + x.r}</b>nível</div>` : `<div><b>${hid() ? "?" : x.pen}</b>pênalti</div><div></div><div></div>`}</div>${hid() ? `<div class="muted" style="font-size:11px">Modo overall escondido: use o histórico de pênaltis e o clube como pista.</div>` : ""}</div>`;
}
function viewStaff() {
  const a = S.staffA, lot = a.lot, mi = myMi();
  let stage;
  if (lot) {
    const x = STAFF_BY_ID[lot.sid];
    const bidders = (NET.mode === "local" ? humansIdx() : mi >= 0 ? [mi] : []).filter(i => staffNeed(S, S.managers[i], x));
    stage = `<div class="stage">${passStamp(lot)}${staffCard(x)}<div class="bidbox">
      <div class="row" style="justify-content:space-between"><span class="phase">Staff ${lot.n} de ${a.total}</span></div>
      <div class="bidnow"><div class="amt num ${bidPop(lot)}">${lot.bid || "–"}</div><div class="who"><div class="muted" style="font-size:12px">${lot.bidder >= 0 ? "LANCE ATUAL" : "SEM LANCES · comece com 1"}</div>${lot.bidder >= 0 ? mgrName(lot.bidder) : ""}</div><div class="spacer"></div><div class="clock num" id="sclock">–</div></div>
      <div class="bar"><i id="sclockbar" style="width:100%"></i></div>
      <p class="muted" style="margin:0;font-size:13px">${x.k === "tec" ? `Bônus quando o time joga no ${x.form} e/ou no estilo ${STYLES[x.style].n}.` : `Ele cobra o pênalti presidente do seu time. ${penHist(x)}${hid() ? "" : ` Nota de pênalti <b>${x.pen}</b>: ${penInfo(x.pen)}`}`}</p>
      ${bidders.map(bi => { const m = S.managers[bi], mx = staffMax(S, m), lead = lot.bidder === bi, ps = lot.passed.includes(bi); return `<div style="display:grid;gap:6px;border-top:1px solid var(--line);padding-top:10px"><div>${mgrName(bi)} <span class="muted">· saldo ${m.budget} · máx ${mx}</span></div>
        <div class="bidbtns">${[1, 2, 5].filter(s => lot.bid + s <= mx).map(s => `<button class="btn ${s === 1 ? "gold" : ""}" data-a="bid" data-mi="${bi}" data-amt="${lot.bid + s}" ${lead || ps ? "disabled" : ""}>+${s} <span class="num">(${lot.bid + s})</span></button>`).join("")}<button class="btn ghost" data-a="pass" data-mi="${bi}" ${lead || ps ? "disabled" : ""}>Passar</button></div></div>`; }).join("")}
    </div></div>`;
  } else stage = `<div style="display:grid;place-items:center;min-height:200px;text-align:center">${a.last && a.last.mi >= 0 ? `<div class="sold-anim"><div class="muted">CONTRATADO</div><h2 style="font-size:40px">${esc(STAFF_BY_ID[a.last.sid].n)}</h2><div>${mgrName(a.last.mi)} · <b class="num" style="color:var(--gold)">${a.last.price} K$</b></div></div>` : `<h2 style="font-size:32px">Próximo nome saindo do pote…</h2>`}</div>`;
  return `<div class="sec-title"><h2>Mercado de staff</h2><span class="muted">técnicos e presidentes da Kings League Brasil</span></div><div class="card">${stage}</div>
  ${isHost() ? `<div class="row" style="margin-top:10px"><span class="muted" style="font-size:13px">Anfitrião:</span><button class="btn sm" data-a="autofill">Completar o staff automaticamente</button></div>` : ""}
  <div class="sec-title"><h2>Presidentes</h2></div><div class="mgrs">${S.managers.map((m, i) => `<div class="mgr" style="--c:${m.color}"><div class="t"><span class="row" style="gap:6px;flex-wrap:nowrap">${crestSVG(tcrest(m), 22)}<span>${esc(m.team)}</span></span>${m.cpu ? '<span class="pill cpu">bot</span>' : ""}</div><div class="money num">${m.budget} K$</div><div class="muted" style="font-size:13px">Técnico: <b style="color:var(--ink)">${m.coach ? esc(STAFF_BY_ID[m.coach].n) : "—"}</b><br>Presidente: <b style="color:var(--ink)">${m.pres ? esc(STAFF_BY_ID[m.pres].n) : "—"}</b></div></div>`).join("")}</div>`;
}
/* ---------- mercado de trocas ---------- */
function viewTrade() {
  const tr = S.trade, mis = NET.mode === "local" ? humansIdx() : myMi() >= 0 ? [myMi()] : [];
  UI.tr = UI.tr || {};
  if (UI.tr.from == null || !mis.includes(UI.tr.from)) UI.tr = { from: mis[0], to: null, give: [], get: [], cf: 0, ct: 0 };
  const me = UI.tr.from, others = S.managers.map((m, i) => i).filter(i => i !== me);
  if (UI.tr.to == null || UI.tr.to === me) UI.tr.to = others[0];
  const F = me != null ? S.managers[me] : null, T = S.managers[UI.tr.to];
  const prow = (id, list, side) => { const p = P(id), on = UI.tr[side].includes(id); return `<button class="trow ${on ? "on" : ""}" data-a="ttog" data-side="${side}" data-id="${id}">${posb(p.p, p.p2)} <span style="flex:1;text-align:left">${esc(p.n)}</span><b class="num">${O(p)}</b></button>`; };
  const [mn, mx] = sqLimits(S);
  const builder = F ? `<div class="card" style="display:grid;gap:10px">
    ${mis.length > 1 ? `<div class="row"><span class="muted">Propondo como:</span>${mis.map(i => `<button class="btn sm ${i === me ? "gold" : ""}" data-a="tfrom" data-mi="${i}">${esc(S.managers[i].team)}</button>`).join("")}</div>` : ""}
    <div class="row"><span class="muted">Trocar com:</span>${others.map(i => `<button class="btn sm ${i === UI.tr.to ? "gold" : ""}" data-a="tto" data-mi="${i}">${esc(S.managers[i].team)}${S.managers[i].cpu ? " (bot)" : ""}</button>`).join("")}</div>
    <div class="grid2">
      <div><div class="muted" style="font-size:12px;margin-bottom:6px">VOCÊ ENTREGA (${esc(F.team)} · saldo ${F.budget} K$)</div><div class="tlist">${F.roster.map(id => prow(id, F.roster, "give")).join("")}</div>
        <label class="f" for="t-cf" style="margin-top:8px">+ moedas que você paga<input id="t-cf" type="number" min="0" max="${F.budget}" value="${UI.tr.cf || 0}"></label></div>
      <div><div class="muted" style="font-size:12px;margin-bottom:6px">VOCÊ RECEBE (${esc(T.team)} · saldo ${T.budget} K$)</div><div class="tlist">${T.roster.map(id => prow(id, T.roster, "get")).join("")}</div>
        <label class="f" for="t-ct" style="margin-top:8px">+ moedas que você pede<input id="t-ct" type="number" min="0" max="${T.budget}" value="${UI.tr.ct || 0}"></label></div>
    </div>
    <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:13px">Cada elenco fica entre ${mn} e ${mx} jogadores e com pelo menos 1 goleiro. Bots aceitam se a troca for boa pra eles.</span><button class="btn gold" data-a="tsend">Propor troca</button></div>
    ${tr.lastErr && tr.lastErr.mi === me && Date.now() - tr.lastErr.at < 8000 ? `<p class="err">${esc(tr.lastErr.err)}</p>` : ""}
  </div>` : "";
  const pn = id => `${esc(P(id).n)} <span class="num muted">${O(P(id))}</span>`;
  const desc = o => `${o.bot ? '<span class="pill cpu">proposta do bot</span> ' : ""}<b>${esc(S.managers[o.from].team)}</b> entrega ${o.give.map(pn).join(", ") || "—"}${o.cf ? ` + ${o.cf} K$` : ""} · recebe ${o.get.map(pn).join(", ") || "—"}${o.ct ? ` + ${o.ct} K$` : ""} <span class="muted">(com ${esc(S.managers[o.to].team)})</span>`;
  const stl = { pend: "pendente", ok: "aceita", no: "recusada", cancel: "cancelada", fail: "inválida" };
  const inc = tr.offers.filter(o => o.st === "pend" && mis.includes(o.to)).length;
  const offers = tr.offers.slice().sort((a, b) => (b.st === "pend" && mis.includes(b.to)) - (a.st === "pend" && mis.includes(a.to))).map(o => `<div class="row" style="justify-content:space-between;border-bottom:1px solid #1b212c;padding:8px 0;gap:8px"><div style="flex:1;min-width:240px">${desc(o)}${o.err ? ` <span class="err">${esc(o.err)}</span>` : ""}</div>
    <div class="row" style="gap:6px"><span class="pill ${o.st === "ok" ? "you" : ""}">${stl[o.st]}</span>${o.st === "pend" && mis.includes(o.to) ? `<button class="btn sm gold" data-a="tresp" data-id="${o.id}" data-ok="1" data-mi="${o.to}">Aceitar</button><button class="btn sm" data-a="tresp" data-id="${o.id}" data-ok="0" data-mi="${o.to}">Recusar</button>` : ""}${o.st === "pend" && mis.includes(o.from) ? `<button class="btn sm ghost" data-a="tcancel" data-id="${o.id}" data-mi="${o.from}">Cancelar</button>` : ""}</div></div>`).join("");
  return `${tr.when === "carreira" ? careerWindow(me) : ""}<div class="sec-title"><h2>Mercado de trocas</h2><span class="phase">${tr.when === "carreira" ? `temporada ${S.career.year}` : tr.when === "antes" ? "antes do campeonato" : "antes do mata-mata"}</span>${tr.deadline ? `<span class="pill">fecha em <b class="num" data-dl="${tr.deadline}">1:00</b></span>` : ""}</div>
  ${isHost() ? `<div class="row" style="margin-bottom:10px"><span class="muted" style="font-size:13px">Anfitrião:</span><button class="btn gold sm" data-a="tclose">Fechar mercado e seguir</button></div>` : `<p class="muted">O anfitrião fecha o mercado quando todo mundo terminar.</p>`}
  ${builder}
  <div class="sec-title"><h2>Propostas</h2>${inc ? `<span class="pill you">📩 ${inc} esperando sua resposta</span>` : ""}</div><div class="card">${offers || '<p class="muted" style="margin:0">Nenhuma proposta ainda.</p>'}</div>
  <div class="sec-title"><h2>Elencos</h2></div><div class="mgrs">${S.managers.map((m, i) => mgrBox(m, i)).join("")}</div>`;
}
// modo carreira: evolução, agentes livres e dispensas
function penInfo(pen) {
  const pct = x => Math.round(Math.min(0.98, Math.max(0.02, x)) * 100) + "%";
  const miss = (pen - 40) * 0.0045, sv = (pen - 65) * 0.007;
  const gLow = (1 - Math.max(0.02, 0.23 - miss)) * (1 - (0.75 - sv) / 3);
  return `chutando baixo erra o gol ${pct(0.23 - miss)} das vezes (no alto ${pct(0.34 - miss)}); se o goleiro acertar o canto baixo, defende ${pct(0.75 - sv)}. No geral, faz gol em uns ${pct(gLow)} das cobranças.`;
}
function penHist(x) { const [a, g] = x.ph || [0, 0]; return a ? `Na Kings: ${g} gols em ${a} cobranças (${Math.round(g / a * 100)}%).` : "Ainda sem cobranças oficiais."; }
const LV_TXT = { 5: "campeão", 4: "final", 3: "semifinal", 2: "quartas", 1: "mata-mata", 0: "fase de grupos" };
function goalsView() {
  const G = S.career && S.career.goals; if (!G || !S.season) return "";
  const rows = S.managers.map((m, i) => { const lv = G.lv[i]; if (lv == null) return ""; const r = G.res && G.res[i], got = r ? r.got : reachLvUI(i);
    const st = r ? (r.ok ? `<span class="pill you">cumprida · +${r.money} K$</span>` : `<span class="pill">não cumprida · ${r.money} K$</span>`) : got >= lv ? `<span class="pill you">cumprida</span>` : `<span class="pill">em andamento</span>`;
    return `<div class="trow"><span style="flex:1">${mgrName(i)}</span><span class="muted" style="font-size:13px">${META_TXT[lv]}</span>${st}</div>`; }).join("");
  return `<div class="card" style="display:grid;gap:8px;margin-bottom:14px"><h3 style="margin:0;font-size:20px">Metas da diretoria</h3><p class="muted" style="margin:0;font-size:13px">Cada time recebe uma meta pela força do elenco. Cumprir paga 20 K$ (mais 5 K$ por fase além da meta, até +15). Falhar tira 10 K$. Vale no fim da temporada.</p><div class="tlist">${rows}</div></div>`;
}
function reachLvUI(mi) { const se = S.season; if (se.champion === mi) return 5; let lv = 0; se.fixtures.forEach(f => { if (f.h === mi || f.a === mi) { const k = ["Play-in", "Quartas", "Semifinal", "Final"].indexOf(f.stage); if (k >= 0) lv = Math.max(lv, k + 1); } }); return lv; }
function lastGoalsView() {
  const L = S.career && S.career.lastGoals; if (!L) return "";
  return `<div><div class="muted" style="font-size:12px;margin-bottom:4px">METAS DA TEMPORADA ${L.year}</div><div class="row" style="gap:6px">${Object.entries(L.res).map(([i, r]) => S.managers[i] ? `<span class="pill ${r.ok ? "you" : ""}">${esc(S.managers[i].team)}: ${META_TXT[r.lv].toLowerCase()} → ${LV_TXT[r.got]} ${r.ok ? "✓" : "✗"} <b>${r.money > 0 ? "+" : ""}${r.money} K$</b></span>` : "").join("")}</div></div>`;
}
function fichaView(mi) {
  const C = S.career || {}, em = editableMis(), me = mi != null ? mi : UI.editMi != null && em.includes(UI.editMi) ? UI.editMi : em.length ? em[0] : -1;
  const ids = UI.fichaAll ? PLAYERS.map(p => p.id).filter(id => (C.log || {})[id]) : (me >= 0 ? S.managers[me].roster.slice() : []);
  const rows = ids.map(P).filter(Boolean).sort((a, b) => b.o - a.o).map(p => {
    const l = (C.log || {})[p.id] || [], T = l.reduce((t, x) => ({ j: t.j + x.j, g: t.g + x.g, a: t.a + x.a, ch: t.ch + (x.ch ? 1 : 0) }), { j: 0, g: 0, a: 0, ch: 0 });
    const open = UI.ficha === p.id;
    return `<div class="ficha ${open ? "on" : ""}"><button class="trow fbtn" data-a="ficha" data-id="${p.id}">${posb(p.p, p.p2)} <span style="flex:1;text-align:left">${esc(p.n)} <span class="muted">${esc(p.t)} · ${ageTxt(p)} anos · pot ${p.pot || p.o}</span></span><span class="muted num" style="font-size:12.5px">${T.j} J · ${T.g} G · ${T.a} A${T.ch ? ` · ${T.ch}🏆` : ""}</span><b class="num">${O(p)}</b></button>
      ${open ? (l.length ? `<table class="ftab"><thead><tr><th>Temp.</th><th>Comp.</th><th>Time</th><th>OVR</th><th>J</th><th>G</th><th>A</th><th>Nota</th></tr></thead><tbody>${l.map(x => `<tr><td class="num">${x.y}</td><td>${x.c}${x.ch ? " 🏆" : ""}</td><td>${esc(x.t)}</td><td class="num">${x.o}</td><td class="num">${x.j}</td><td class="num">${x.g}</td><td class="num">${x.a}</td><td class="num">${x.n != null ? x.n.toFixed(1) : "–"}</td></tr>`).join("")}</tbody></table>` : `<p class="muted" style="margin:6px 0 0;font-size:13px">Ainda sem jogos na carreira. A ficha enche no fim de cada temporada.</p>`) : ""}</div>`;
  }).join("");
  return `<div class="card" style="display:grid;gap:8px"><div class="row" style="justify-content:space-between"><h3 style="margin:0;font-size:20px">Ficha de carreira</h3><button class="btn sm ghost" data-a="fichaall">${UI.fichaAll ? "Só o meu elenco" : "Todos com histórico"}</button></div><p class="muted" style="margin:0;font-size:13px">Toque num jogador para ver jogos, gols, assistências e nota de cada temporada.</p><div class="tlist">${rows || '<p class="muted">Ninguém por aqui ainda.</p>'}</div></div>`;
}
function careerWindow(me) {
  const C = S.career, m = me != null ? S.managers[me] : null;
  const evo = (C.lastEvo || []).map(([id, a, b]) => `<span class="pill ${b > a ? "you" : ""}">${esc(shortName(P(id).n))} ${a}→<b>${b}</b></span>`).join("");
  const fa = freeAgents(S).map(P).sort((a, b) => b.o - a.o).slice(0, 24);
  const [mn, mx] = sqLimits(S);
  return `<div class="sec-title"><h2>Temporada ${C.year}</h2><span class="phase">janela de transferências</span></div>
  <div class="card" style="display:grid;gap:10px">
    ${lastGoalsView()}
    ${m && m.roster.some(id => isUnh(id)) ? `<div class="unhbox">😤 Insatisfeitos no seu elenco: ${m.roster.filter(id => isUnh(id)).map(id => esc(P(id).n)).join(", ")}. Craque que fica no banco perde rendimento (−3) até jogar 3 partidas.</div>` : ""}
    ${evo ? `<div><div class="muted" style="font-size:12px;margin-bottom:4px">QUEM EVOLUIU NA TEMPORADA PASSADA</div><div class="row" style="gap:6px">${evo}</div></div>` : ""}
    ${(C.lastPot || []).length ? `<div><div class="muted" style="font-size:12px;margin-bottom:4px">POTENCIAL SUBIU (TEMPORADA MUITO BOA)</div><div class="row" style="gap:6px">${C.lastPot.map(([id, a, b]) => `<span class="pill you">${esc(shortName(P(id).n))} pot ${a}→<b>${b}</b></span>`).join("")}</div></div>` : ""}
    ${m && S.career.log ? `<details><summary class="muted" style="cursor:pointer;font-size:13px">Ver ficha de carreira do elenco</summary>${fichaView(me)}</details>` : ""}
    ${S.trade.lastErr && m && S.trade.lastErr.mi === me && Date.now() - S.trade.lastErr.at < 8000 ? `<p class="err" style="margin:0">${esc(S.trade.lastErr.err)}</p>` : ""}
    ${m ? `<div class="muted" style="font-size:13px">Saldo do ${esc(m.team)}: <b style="color:var(--gold)">${m.budget} K$</b> · elenco ${m.roster.length} (entre ${mn} e ${mx}). Contratar custa o valor do jogador; dispensar devolve metade.</div>
    <div class="grid2"><div><div class="muted" style="font-size:12px;margin-bottom:6px">SEU ELENCO (dispensar)</div><div class="tlist">${m.roster.map(P).sort((a, b) => POS_ORDER[a.p] - POS_ORDER[b.p] || b.o - a.o).map(p => `<div class="trow">${posb(p.p, p.p2)} <span style="flex:1">${esc(p.n)} <span class="muted">pot ${p.pot || p.o}</span></span><b class="num">${O(p)}</b><button class="btn sm ghost" data-a="farel" data-id="${p.id}" data-mi="${me}">Dispensar +${Math.floor(p.v / 2)}</button></div>`).join("")}</div></div>
    <div><div class="muted" style="font-size:12px;margin-bottom:6px">AGENTES LIVRES (contratar)</div><div class="tlist">${fa.map(p => `<div class="trow">${posb(p.p, p.p2)} <span style="flex:1">${esc(p.n)} <span class="muted">${esc(p.t)} · pot ${p.pot || p.o}</span></span><b class="num">${O(p)}</b><button class="btn sm ${m.budget >= p.v ? "gold" : ""}" data-a="fasign" data-id="${p.id}" data-mi="${me}" ${m.budget >= p.v && m.roster.length < mx ? "" : "disabled"}>${p.v} K$</button></div>`).join("") || '<p class="muted">Nenhum agente livre.</p>'}</div></div></div>` : ""}
  </div>`;
}
/* ---------- Kings Cup: manter wild cards e jogadores ---------- */
function evoView() {
  const E = S.evoLast; if (!E || (!E.evo.length && !E.pot.length)) return "";
  return `<div class="card" style="display:grid;gap:8px;margin:12px 0"><h3 style="margin:0;font-size:20px">Evolução depois ${E.comp === "Split" ? "do Split" : "da Kings Cup"}</h3>
    ${E.evo.length ? `<div class="row" style="gap:6px">${E.evo.map(([id, a, b]) => `<span class="pill ${b > a ? "you" : ""}">${esc(shortName(P(id).n))} ${a}→<b>${b}</b></span>`).join("")}</div>` : ""}
    ${E.pot.length ? `<div class="muted" style="font-size:12px">POTENCIAL SUBIU (competição muito boa)</div><div class="row" style="gap:6px">${E.pot.map(([id, a, b]) => `<span class="pill you">${esc(shortName(P(id).n))} pot ${a}→<b>${b}</b></span>`).join("")}</div>` : ""}</div>`;
}
function viewKeep() {
  const k = S.keep, mis = NET.mode === "local" ? humansIdx() : myMi() >= 0 ? [myMi()] : [];
  UI.kp = UI.kp || {};
  if (UI.kpMi == null || !mis.includes(UI.kpMi)) UI.kpMi = mis[0];
  const mi = UI.kpMi, m = mi != null ? S.managers[mi] : null;
  let box = "";
  if (m) {
    const d = UI.kp[mi] = UI.kp[mi] || { wc: [], keep: [] };
    const sent = !!k.sub[mi];
    box = `<div class="card" style="display:grid;gap:10px">
      ${mis.length > 1 ? `<div class="row"><span class="muted">Escolhendo:</span>${mis.map(i => `<button class="btn sm ${i === mi ? "gold" : ""}" data-a="kpmi" data-mi="${i}">${esc(S.managers[i].team)}</button>`).join("")}</div>` : ""}
      <div class="row" style="justify-content:space-between"><h3 style="font-size:22px">${esc(m.team)}: quem fica para a Kings Cup</h3><span class="muted">wild cards ${d.wc.length}/${k.maxWC} · mantidos ${d.keep.length}/${k.maxKeep}</span></div>
      ${sent ? `<div class="flash">Escolhas enviadas! Esperando os outros presidentes.</div>` : `
      <div class="tlist">${m.roster.map(id => { const p = P(id), w = d.wc.includes(id), kk = d.keep.includes(id); return `<div class="row" style="gap:8px;border:1px solid var(--line);border-radius:10px;padding:6px 10px">${posb(p.p, p.p2)}<b style="flex:1">${esc(p.n)}</b><span class="num" style="color:var(--gold)">${O(p)}</span>
        <button class="btn sm ${w ? "gold" : ""}" data-a="kptog" data-kind="wc" data-id="${id}" data-mi="${mi}">Wild card</button><button class="btn sm ${kk ? "gold" : ""}" data-a="kptog" data-kind="keep" data-id="${id}" data-mi="${mi}">Manter</button></div>`; }).join("")}</div>
      <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:13px">Quem não for escolhido volta para o draft da Kings Cup.</span><button class="btn gold" data-a="kpsend" data-mi="${mi}">Confirmar elenco</button></div>`}
    </div>`;
  }
  return `${evoView()}<div class="sec-title"><h2>Kings Cup</h2><span class="phase">montagem dos elencos</span>${k.deadline ? `<span class="pill">fecha em <b class="num" data-dl="${k.deadline}">1:00</b> · quem não confirmar fica com os melhores</span>` : ""}</div>
  <p class="muted" style="max-width:75ch">Igual à vida real: cada presidente segura até ${k.maxWC} wild cards e até ${k.maxKeep} jogadores do draft. Os outros vão para o pote e o draft em cobra completa os elencos.</p>
  ${isHost() ? `<div class="row" style="margin-bottom:10px"><span class="muted" style="font-size:13px">Anfitrião:</span><button class="btn sm" data-a="keepclose">Fechar e ir para o sorteio</button></div>` : ""}
  ${box}
  <div class="sec-title"><h2>Presidentes</h2></div><div class="mgrs">${S.managers.map((x, i) => `<div class="mgr" style="--c:${x.color}"><div class="t"><span>${esc(x.team)}</span>${k.sub[i] ? '<span class="pill you">pronto</span>' : '<span class="pill">escolhendo…</span>'}</div></div>`).join("")}</div>`;
}
/* ---------- modo draft: wild cards, sorteio e draft ---------- */
function marketPool(clickA, selId, mi) {
  const t = taken(S), q = (UI.mq || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), pos = UI.mpos || "ALL";
  let list = PLAYERS.filter(p => !t.has(p.id) && (pos === "ALL" || p.p === pos) && (!q || (p.n + " " + p.t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)));
  if (hid()) list = list.slice().sort((x, y) => x.n.localeCompare(y.n));
  const h = hid();
  return `<div class="row" style="margin-bottom:10px">
    <input id="mq" type="text" placeholder="Buscar jogador ou clube" value="${esc(UI.mq || "")}" style="max-width:280px">
    <select id="mpos" style="max-width:150px">${["ALL", "GOL", "DEF", "MEI", "ATA"].map(p => `<option value="${p}" ${pos === p ? "selected" : ""}>${p === "ALL" ? "Todas posições" : p}</option>`).join("")}</select>
    <span class="muted" style="font-size:13px">${list.length} disponíveis</span></div>
  <div class="scroll"><table class="tbl"><thead><tr><th>OVR</th><th>Pos</th><th>Jogador</th><th>Idade</th><th>Clube 25/26</th>${h ? "" : "<th>ATQ</th><th>DEF</th><th>Valor</th>"}<th></th></tr></thead><tbody>
  ${list.map(p => `<tr class="${selId === p.id ? "sel" : ""}"><td class="o ${p.p === "GOL" ? "g" : ""}">${O(p)}</td><td>${posb(p.p, p.p2)}</td><td><b>${esc(p.n)}</b>${p.tags.length ? `<div class="muted" style="font-size:11.5px">${esc(p.tags.slice(0, 3).join(" · "))}</div>` : ""}</td><td class="num">${ageTxt(p)}</td><td class="muted">${esc(p.t)}</td>${h ? "" : `<td class="num">${p.at}</td><td class="num">${p.df}</td><td class="num">${p.v}</td>`}
    <td class="pickcell">${!clickA ? "" : clickA === "dsel" ? (() => { const ok = canBidOn(S, S.managers[mi], p); if (!ok) return `<button class="btn sm" disabled title="Sua última vaga precisa ser um goleiro">Escolher</button>`; return selId === p.id ? `<span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm gold pulse" data-a="dpick" data-id="${p.id}">Confirmar</button><button class="btn sm ghost" data-a="dsel" data-id="-1" title="Cancelar" aria-label="Cancelar">✕</button></span>` : `<button class="btn sm" data-a="dsel" data-id="${p.id}">Escolher</button>`; })() : `<button class="btn sm" data-a="${clickA}" data-id="${p.id}" data-mi="${mi}">${clickA === "wcadd" ? "Quero" : "Escolher"}</button>`}</td></tr>`).join("")}</tbody></table></div>`;
}
function viewWC() {
  const w = S.wc, st = S.settings;
  const mis = NET.mode === "local" ? humansIdx() : myMi() >= 0 ? [myMi()] : [];
  UI.wcd = UI.wcd || {}; UI.wcsent = UI.wcsent || {};
  if (UI.wcMi == null || !mis.includes(UI.wcMi)) UI.wcMi = mis[0];
  const mi = UI.wcMi, m = mi != null ? S.managers[mi] : null;
  const status = `<div class="mgrs">${S.managers.map((x, i) => `<div class="mgr" style="--c:${x.color}"><div class="t"><span class="row" style="gap:6px;flex-wrap:nowrap">${crestSVG(x.crest, 22)}<span>${esc(x.team)}</span></span>${wcLeft(S, x) <= 0 ? '<span class="pill">completo</span>' : w.sub.includes(i) ? '<span class="pill you">enviou</span>' : '<span class="pill">pensando…</span>'}</div>
    <div class="row" style="justify-content:space-between"><span class="money num">${x.budget} K$</span><span class="muted" style="font-size:13px">${x.wc.length}/${st.wc} wild cards</span></div>
    <div class="mini">${x.wc.map(id => `<span>${P(id).p} ${O(P(id))} ${esc(P(id).n.split(" ")[0].replace(/'/g, ""))}</span>`).join("")}</div></div>`).join("")}</div>`;
  let mine = "";
  if (m && wcLeft(S, m) > 0) {
    const d = UI.wcd[mi] = UI.wcd[mi] || {};
    Object.keys(d).forEach(id => { if (taken(S).has(+id)) delete d[id]; });
    const need = wcLeft(S, m), n = Object.keys(d).length, sum = Object.values(d).reduce((x, y) => x + (+y || 0), 0);
    const cap = m.budget - Math.max(0, need - n);
    const sent = UI.wcsent[w.round + "-" + mi] && w.sub.includes(mi);
    mine = `<div class="card" style="display:grid;gap:10px">
      ${mis.length > 1 ? `<div class="row"><span class="muted">Propostas de:</span>${mis.map(i => `<button class="btn sm ${i === mi ? "gold" : ""}" data-a="wcmi" data-mi="${i}">${esc(S.managers[i].team)}</button>`).join("")}<span class="muted" style="font-size:12.5px">(um de cada vez, sem olhar o do outro)</span></div>` : ""}
      <div class="row" style="justify-content:space-between"><h3 style="font-size:22px">Suas propostas · ${esc(m.team)}</h3><span class="muted">vagas: ${need} · saldo ${m.budget} K$</span></div>
      ${sent ? `<div class="flash">Propostas enviadas! Esperando os outros presidentes. <button class="btn sm" data-a="wcedit" data-mi="${mi}">Mudar</button></div>` : `
      ${n ? Object.entries(d).map(([id, v]) => `<div class="row" style="gap:8px;border:1px solid var(--line);border-radius:10px;padding:6px 10px">${posb(P(+id).p)}<b style="flex:1">${esc(P(+id).n)}</b><span class="muted">${hid() ? "" : "ref. " + P(+id).v}</span>
        <label class="row" for="wcv-${id}" style="gap:6px;font-size:13px">Proposta<input id="wcv-${id}" class="wcamt" data-mi="${mi}" data-id="${id}" type="number" min="1" max="${m.budget}" value="${v}" style="width:90px"></label><button class="btn sm ghost" data-a="wcdel" data-mi="${mi}" data-id="${id}" aria-label="Remover">✕</button></div>`).join("") : `<p class="muted" style="margin:0">Toque em "Quero" nos jogadores da lista abaixo (até ${need}).</p>`}
      <div class="row" style="justify-content:space-between"><span class="${sum > cap ? "err" : "muted"}">Total: <b class="num">${sum}</b> de ${cap} K$ possíveis${need - n > 0 ? ` (reserva 1 K$ por vaga sem proposta)` : ""}</span>
      <button class="btn gold" data-a="wcsend" data-mi="${mi}" ${sum > cap ? "disabled" : ""}>${n ? "Enviar propostas" : "Não quero nenhum agora"}</button></div>`}
    </div>`;
  } else if (m) mine = `<div class="flash">Seus wild cards estão completos. Agora é esperar o draft.</div>`;
  return `<div class="sec-title"><h2>Wild cards</h2><span class="phase">Rodada ${w.round} de ${w.maxRounds}</span><span class="muted">propostas fecham em <b id="wcclock" class="num">–</b></span></div>
  <p class="muted" style="margin:0 0 12px;max-width:75ch">Propostas secretas. Se só você pedir um jogador, ele é seu pelo valor que ofereceu. Se mais de um time pedir o mesmo, vira leilão só entre vocês, começando na maior proposta.</p>
  ${isHost() ? `<div class="row" style="margin-bottom:12px"><span class="muted" style="font-size:13px">Anfitrião:</span><button class="btn sm" data-a="wcclose">Fechar propostas agora</button><button class="btn sm" data-a="autofill">Pular para o draft automático</button></div>` : ""}
  ${mine}
  <div class="sec-title"><h2>Presidentes</h2></div>${status}
  ${S.wc.results.length ? `<div class="sec-title"><h2>Contratações</h2></div><div class="card log">${S.wc.results.slice(0, 20).map(r => `<div>${mgrName(r.mi)}: <b>${esc(P(r.pid).n)}</b> por <b class="num">${r.price}</b></div>`).join("")}</div>` : ""}
  ${m && wcLeft(S, m) > 0 && !(UI.wcsent[w.round + "-" + mi] && w.sub.includes(mi)) ? `<div class="sec-title"><h2>Todos os jogadores</h2></div>${marketPool("wcadd", null, mi)}` : ""}`;
}
function viewLottery() {
  const d = S.draft;
  return `<div class="sec-title"><h2>${d.byTable ? "Ordem do draft" : "Sorteio do draft"}</h2><span class="muted">${d.byTable ? "o pior da última temporada escolhe primeiro" : "a ordem das escolhas"}</span></div>
  <div class="card lottery">
    <div class="balls">${d.order.map((mi, k) => k < d.revealed ? `<div class="ball on" style="--c:${S.managers[mi].color}"><span class="num">${k + 1}º</span>${crestSVG(tcrest(S.managers[mi]), 44)}<b>${esc(S.managers[mi].team)}</b></div>` : `<div class="ball ${k === d.revealed ? "spin" : ""}"><span class="num">${k + 1}º</span><b>?</b></div>`).join("")}</div>
    ${d.byTable ? `<p style="margin:10px 0 0"><b>Regra da Kings:</b> a ordem segue a classificação final da competição anterior (${S.cupDraft ? "o Split" : "a última temporada nesta sala"}), do último colocado para o campeão.${S.cupDraft ? "" : " Quem ficou fora da última temporada entra no fim da fila."}</p>` : ""}
    <p class="muted" style="margin:10px 0 0">Ordem em cobra: na rodada 1 vai do 1º ao último, na rodada 2 volta do último ao 1º, e assim por diante.</p>
  </div>
  ${isHost() ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-a="autofill">Fazer o draft todo automático</button></div>` : ""}`;
}
function viewDraft() {
  const d = S.draft, st = S.settings, pk = draftPicker(S), pm = S.managers[pk];
  const mi = myMi();
  const myTurn = NET.mode === "local" ? !pm.cpu : pk === mi;
  const sel = UI.dsel != null && !taken(S).has(UI.dsel) ? P(UI.dsel) : null;
  const pickNo = d.n + 1;
  const rounds = Math.max(...S.managers.map(m => m.roster.length - m.wc.length), 0) + 1;
  const board = `<div class="scroll" style="max-height:none"><table class="tbl dboard"><thead><tr><th>Time</th><th>Wild cards</th>${Array.from({ length: Math.max(st.picks, rounds) }, (_, r) => `<th>R${r + 1}</th>`).join("")}</tr></thead><tbody>
    ${d.order.map(i => { const m = S.managers[i]; const picks = d.picks.filter(x => x.mi === i).slice().reverse(); return `<tr class="${i === pk ? "sel" : ""}"><td>${mgrName(i)}</td><td class="muted" style="font-size:12px">${m.wc.map(id => esc(P(id).n.split(" ")[0])).join(", ") || "—"}</td>${Array.from({ length: Math.max(st.picks, rounds) }, (_, r) => { const x = picks[r]; return `<td style="font-size:12.5px">${x ? `${posb(P(x.pid).p)} ${esc(P(x.pid).n)}` : ""}</td>`; }).join("")}</tr>`; }).join("")}
  </tbody></table></div>`;
  return `<div class="sec-title"><h2>Draft</h2><span class="phase">Pick ${pickNo} · rodada ${d.round + 1}</span></div>
  <div class="card stage" style="grid-template-columns:auto 1fr">
    <div class="pcard" style="align-items:center;justify-content:center;text-align:center">${crestSVG(tcrest(pm), 90)}<div class="nm" style="margin-top:10px">${esc(pm.team)}</div></div>
    <div class="bidbox">
      <div class="row" style="justify-content:space-between"><span class="muted">NO RELÓGIO</span><div class="clock num" id="dclock">–</div></div>
      <h2 style="font-size:38px;color:${pm.color}">${esc(pm.team)}</h2>
      <div class="muted">${pm.cpu ? "O bot está escolhendo…" : myTurn ? "É a sua vez! Na lista de disponíveis, toque em Escolher e depois em Confirmar." : `Esperando ${esc(pm.name)} escolher…`} Faltam ${slotsLeft(S, pm)} jogador${slotsLeft(S, pm) === 1 ? "" : "es"} no elenco.</div>
      ${myTurn ? `<a class="btn gold" href="#pool" style="text-decoration:none;width:max-content">Ver jogadores disponíveis ↓</a>` : ""}
      ${d.last && now() - d.last.at < 6000 ? `<div class="flash">Pick ${d.n}: <b>${esc(P(d.last.pid).n)}</b> para ${mgrName(d.last.mi)}</div>` : ""}
      <div class="muted" style="font-size:13px">Próximos: ${(() => { const out = []; let r = d.round, k = d.idx; for (let g = 0; g < 40 && out.length < 4; g++) { k++; if (k >= d.order.length) { k = 0; r++; } const x = (r % 2 === 0 ? d.order : d.order.slice().reverse())[k]; if (slotsLeft(S, S.managers[x]) > 0 && !(x === pk && out.length === 0 && false)) out.push(esc(S.managers[x].team)); } return out.join(" → "); })()}</div>
    </div>
  </div>
  ${isHost() ? `<div class="row" style="margin-top:10px"><span class="muted" style="font-size:13px">Anfitrião:</span><button class="btn sm" data-a="autofill">Completar o draft automaticamente</button></div>` : ""}
  ${myBoards()}
  <div class="sec-title"><h2>Quadro do draft</h2></div>${board}
  <div class="sec-title" id="pool"><h2>Disponíveis</h2>${myTurn ? `<span class="muted">toque em Escolher e confirme no mesmo lugar</span>` : ""}</div>${marketPool(myTurn ? "dsel" : null, UI.dsel, pk)}`;
}
// prancheta: como o seu time está ficando durante o leilão/draft
function myBoards() {
  const mis = (NET.mode === "local" ? humansIdx() : myMi() >= 0 ? [myMi()] : []).slice(0, 4); if (!mis.length) return "";
  return `<div class="sec-title"><h2>${mis.length > 1 ? "Os times até agora" : "Seu time até agora"}</h2><span class="muted">titulares na formação do seu técnico; vagas vazias mostram o que ainda falta</span></div><div class="mboards">${mis.map(miniBoard).join("")}</div>`;
}
function miniBoard(mi) {
  const m = S.managers[mi], c = m.coach && STAFF_BY_ID[m.coach], form = (m.tac && m.tac.form) || (!m.cpu && m.lastTac && m.lastTac.form) || (c ? c.form : "2-3-1");
  const ros = m.roster.map(P).filter(Boolean), cnt = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }; ros.forEach(p => cnt[p.p]++);
  // monta a escalação com quem já tem: goleiro + melhores por posição de cada vaga
  const slots = FORMS[form], xy = FORM_XY[form], used = new Set();
  const gk = ros.filter(p => p.p === "GOL").sort((a, b) => b.o - a.o)[0]; if (gk) used.add(gk.id);
  const fill = slots.map(() => null);
  [2, 5].forEach(lim => slots.forEach((sl, i) => { if (fill[i]) return; const c1 = ros.filter(p => !used.has(p.id) && p.p !== "GOL" && fitPen(p, sl) <= lim).sort((a, b) => b.o - a.o)[0]; if (c1) { used.add(c1.id); fill[i] = c1; } }));
  const bench = ros.filter(p => !used.has(p.id));
  const chip = (p, sl) => `<div class="mbchip ${p ? "" : "empty"}"><span class="mbpos">${sl}</span>${p ? `<b class="num">${O(p)}</b><span>${esc(shortName(p.n))}</span>` : "<span>vaga</span>"}</div>`;
  const need = slots.filter((sl, i) => !fill[i]); if (!gk) need.unshift("GOL");
  return `<div class="card mboard"><div class="row" style="justify-content:space-between;gap:6px"><span>${mgrName(mi)}</span><span class="muted" style="font-size:12px">${form} · ${m.roster.length}/${S.settings.squad}</span></div>
    <div class="mbpitch">${slots.map((sl, i) => { const [x, y] = xy[i]; return `<div class="mbslot" style="left:${8 + y * 84}%;top:${(1 - x) * 72 + 8}%">${chip(fill[i], sl)}</div>`; }).join("")}<div class="mbslot" style="left:50%;top:86%">${chip(gk, "GOL")}</div></div>
    <div class="row" style="gap:6px;font-size:12px">${["GOL", "DEF", "MEI", "ATA"].map(k => `<span class="pill">${k} <b>${cnt[k]}</b></span>`).join("")}${need.length ? `<span class="muted">falta: ${need.join(", ")}</span>` : '<span class="pill you">titulares completos</span>'}</div>
    ${bench.length ? `<div class="muted" style="font-size:12px">Reservas: ${bench.map(p => `${esc(shortName(p.n))} ${O(p)}`).join(" · ")}</div>` : ""}</div>`;
}
function bidControls(bi, lot, pl) {
  const m = S.managers[bi], mx = maxBid(S, m), can = canBidOn(S, m, pl);
  const leading = lot.bidder === bi, passed = lot.passed.includes(bi);
  let why = "";
  if (slotsLeft(S, m) <= 0) why = "Elenco completo.";
  else if (!can) why = "Sua última vaga tem que ser goleiro.";
  else if (mx <= lot.bid) why = `Seu lance máximo é ${mx}.`;
  const dis = leading || passed || !!why || S.auction.paused;
  const steps = [1, 2, 5, 10].filter(s => lot.bid + s <= mx);
  return `<div style="display:grid;gap:6px;border-top:1px solid var(--line);padding-top:10px">
    <div class="row" style="justify-content:space-between"><span>${mgrName(bi)} <span class="muted">· saldo ${m.budget} · máx ${Math.max(0, mx)} · ${m.roster.length}/${S.settings.squad}</span></span>${leading ? '<span class="pill you">na frente</span>' : passed ? '<span class="pill">passou</span>' : ""}</div>
    <div class="bidbtns">${steps.map(s => `<button class="btn ${s === 1 ? "gold" : ""}" data-a="bid" data-mi="${bi}" data-amt="${lot.bid + s}" ${dis ? "disabled" : ""}>+${s} <span class="num">(${lot.bid + s})</span></button>`).join("")}
      ${!dis && mx > lot.bid + 10 ? `<button class="btn ghost" data-a="bid" data-mi="${bi}" data-amt="${mx}">Tudo (${mx})</button>` : ""}
      <button class="btn ghost" data-a="pass" data-mi="${bi}" ${leading || passed || why ? "disabled" : ""}>Passar</button></div>
    ${why ? `<div class="muted" style="font-size:13px">${why}</div>` : passed && !leading ? `<div class="muted" style="font-size:13px">Você passou: está fora deste jogador.</div>` : ""}
  </div>`;
}
function mgrBox(m, i) {
  const sq = S.settings.squad;
  const ros = m.roster.map(P).sort((a, b) => POS_ORDER[a.p] - POS_ORDER[b.p] || b.o - a.o);
  const avg = hid() ? "?" : ros.length ? Math.round(ros.reduce((s, p) => s + p.o, 0) / ros.length) : 0;
  return `<div class="mgr ${m.pid === MYPID ? "me" : ""}" style="--c:${m.color}">
    <div class="t"><span class="row" style="gap:6px;flex-wrap:nowrap">${crestSVG(tcrest(m), 22)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(m.team)}</span></span>${m.cpu ? '<span class="pill cpu">bot</span>' : m.pid === MYPID ? '<span class="pill you">você</span>' : ""}</div>
    <div class="row" style="justify-content:space-between"><span class="money num">${m.budget} K$</span><span class="muted" style="font-size:13px">${m.roster.length}/${sq} · média ${avg || "–"}</span></div>
    <div class="mini">${ros.map(p => `<span title="${esc(p.n)}">${p.p} ${O(p)} ${esc(p.n.split(" ")[0].replace(/'/g, ""))}</span>`).join("")}${Array.from({ length: Math.max(0, sq - ros.length) }, () => `<span class="e">vaga</span>`).join("")}</div>
  </div>`;
}

/* ---------- temporada ---------- */
function viewSeason() {
  const se = S.season, host = isHost(), mi = myMi();
  const tb = standings(S);
  const champ = se.champion != null ? S.managers[se.champion] : null;
  const stageName = { league: se.fmt === "cup" ? "Fase de grupos" : "Fase de liga", playin: "Play-in", quarters: "Quartas de final", semis: "Semifinais", final: "Final", done: "Encerrado" }[se.stage];
  const next = roundFixtures(S).filter(f => !f.res);
  const tabs = [["time", "Meu time"], ["tabela", "Classificação"], ["jogos", "Jogos"], ["elencos", "Elencos"], ["artilharia", "Estatísticas"]].concat(S.settings.career ? [["carreira", "Carreira"]] : []);
  return `${gameOver(S) ? voteCard() + hallView() : ""}${champ ? evoView() : ""}${S.history && S.history.length ? yearView() : ""}${champ ? `<div class="champ" style="margin-top:20px">${crestSVG(tcrest(champ), 90)}<div><div class="muted">CAMPEÃO ${se.fmt === "cup" ? "DA KINGS CUP" : "DO SPLIT"}</div><h2>${esc(champ.team)}</h2><div>Presidente ${esc(champ.name)}</div></div>${CROWN.replace("<svg", '<svg style="width:70px;height:70px;margin-left:auto"')}</div>${awardsView()}` : ""}
  <div class="sec-title"><h2>${se.fmt === "cup" ? "Kings Cup" : "Split"}</h2>${S.career ? `<span class="pill you">Carreira · temporada ${S.career.year}</span>` : ""}<span class="phase">${stageName}</span>${se.koInfo ? `<span class="muted" style="font-size:13px">${esc(se.koInfo)}</span>` : ""}</div>
  ${se.fmt === "cup" ? `<div class="row" style="margin-bottom:10px;gap:8px"><span class="pill">Desafios: Grupo A <b class="num">${se.desafio[0]}</b> x <b class="num">${se.desafio[1]}</b> Grupo B</span>${Object.keys(se.dwin).length ? `<span class="muted" style="font-size:13px">Carta extra (vale para 1 jogo do mata-mata): ${Object.keys(se.dwin).map(i => { const left = se.dwin[i] - ((se.dfix && se.dfix[i]) || []).length; return esc(S.managers[+i].team) + (left > 0 ? "" : " (já usou)"); }).join(", ")}</span>` : ""}</div>` : ""}
  ${!champ ? `<div class="card" style="display:grid;gap:10px">
    <div class="row" style="justify-content:space-between"><div class="muted" style="font-size:13px">${se.stage === "league" ? `RODADA ${se.round + 1} DE ${se.leagueRounds}` : stageName.toUpperCase()} · JOGOS SIMULTÂNEOS</div>
    ${host ? `<div class="row" style="gap:6px"><span class="muted" style="font-size:12.5px">Anfitrião:</span><button class="btn sm" data-a="quickround">Simular rodada sem ver</button><button class="btn sm ghost" data-a="simstage">Simular a fase toda</button></div>` : ""}</div>
    <div id="roundboard" class="roundboard">${roundBoard() || '<span class="muted">Preparando a rodada…</span>'}</div>
    <p class="muted" style="margin:0;font-size:13px">Todos os jogos da rodada rolam ao mesmo tempo. Cada técnico ajusta as táticas e toca em <b>Pronto!</b>; quando os dois lados estão prontos, o jogo começa na hora. Se der 1 minuto, o jogo arruma o que faltar e começa sozinho. Jogos só de bots já começam direto.</p>
  </div>` : ""}
  <div class="tabs">${tabs.map(([k, l]) => `<button class="${UI.tab === k ? "on" : ""}" data-a="tab" data-tab="${k}">${l}</button>`).join("")}</div>
  ${UI.tab === "time" ? teamView() : UI.tab === "tabela" ? (se.fmt === "cup" ? `<div class="grid2">${[0, 1].map(g => `<div><h3 style="font-size:20px;margin-bottom:6px">Grupo ${"AB"[g]}</h3>${tableView(standings(S, g), g)}</div>`).join("")}</div>` : tableView(tb)) + bracketView() : UI.tab === "jogos" ? fixturesView() : UI.tab === "elencos" ? rostersView() : UI.tab === "carreira" ? goalsView() + fichaView() : statsView()}`;
}
function hallView() {
  const H = S.hall; if (!H || (!H.titles.length && !Object.keys(H.h2h).length && !H.rec)) return "";
  const Rc = H.rec || {}, recs = [["Maior goleada", Rc.win && Rc.win.txt], ["Jogo com mais gols", Rc.goals && `${Rc.goals.txt} (${Rc.goals.t} gols)`], ["Mais gols de um jogador num jogo", Rc.pg && `${Rc.pg.n} gols · ${Rc.pg.txt}`], ["Artilheiro de uma temporada", Rc.top && `${Rc.top.n} gols · ${Rc.top.txt}`], ["Mais títulos seguidos", Rc.streak && Rc.streak.n >= 2 && `${Rc.streak.n} · ${Rc.streak.txt}`]].filter(x => x[1]);
  const tot = {}; H.titles.forEach(t => { const k = t.pid ? t.name : t.team + " (bot)"; tot[k] = (tot[k] || 0) + 1; });
  const rk = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  const h2h = Object.values(H.h2h).sort((a, b) => (b.wa + b.wb) - (a.wa + a.wb));
  return `<div class="card" style="display:grid;gap:8px;margin-top:16px"><h3 style="font-size:22px">Histórico da sala</h3>
    <div class="row" style="gap:10px;flex-wrap:wrap">${rk.map(([n, c], k) => `<span class="pill ${k === 0 ? "you" : ""}">${k === 0 ? "👑 " : ""}${esc(n)}: <b>${c}</b> título${c > 1 ? "s" : ""}</span>`).join("")}</div>
    <div class="muted" style="font-size:13px">Últimos campeões: ${H.titles.slice(-6).reverse().map(t => `<b style="color:var(--ink)">${esc(t.team)}</b> (${t.comp}${t.season ? " " + t.season : ""}, ${t.pid ? esc(t.name) : "bot"})`).join(" · ")}</div>
    ${recs.length ? `<div style="display:grid;gap:4px"><div class="muted" style="font-size:12px">RECORDES DA SALA</div><div class="recs">${recs.map(([k, v]) => `<div class="rec"><span class="muted">${k}</span><b>${esc(v)}</b></div>`).join("")}</div></div>` : ""}
    ${h2h.length ? `<div style="display:grid;gap:4px"><div class="muted" style="font-size:12px">CONFRONTO DIRETO ENTRE AMIGOS</div>${h2h.slice(0, 8).map(r => `<div class="row" style="gap:8px"><b>${esc(r.na)}</b><span class="num" style="color:var(--gold);font-weight:800">${r.wa} x ${r.wb}</span><b>${esc(r.nb)}</b></div>`).join("")}</div>` : ""}
  </div>`;
}
function voteCard() {
  const hum = S.managers.map((m, i) => i).filter(i => !S.managers[i].cpu), v = S.votes || {};
  const yes = hum.filter(i => v[i] === true).length, no = hum.filter(i => v[i] === false).length, need = Math.floor(hum.length / 2) + 1;
  const mis = NET.mode === "local" ? hum : myMi() >= 0 ? [myMi()] : [];
  return `<div class="card votecard" style="margin-top:16px;display:grid;gap:10px">
    <div class="row" style="justify-content:space-between"><h3 style="font-size:24px">${S.settings.career ? `Fim da temporada ${S.career ? S.career.year : 1}: seguir para a próxima?` : "Revanche na mesma sala?"}</h3><span class="pill">${yes} sim · ${no} não · precisa de ${need}</span></div>
    <p class="muted" style="margin:0">${S.settings.career ? "Modo carreira: se a maioria votar sim, começa a próxima temporada com os mesmos elencos. Os jogadores evoluem rumo ao potencial (quem jogou bem evolui mais), cada time recebe premiação pela campanha e abre a janela de transferências." : "Se a maioria votar sim, todo mundo volta pro vestiário desta sala com os mesmos escudos e uniformes. Dá pra trocar o modo e as regras antes de começar."}</p>
    ${mis.map(mi => `<div class="row" style="gap:8px">${mis.length > 1 ? `<b>${esc(S.managers[mi].team)}:</b>` : ""}<button class="btn ${v[mi] === true ? "gold" : ""}" data-a="vote" data-v="1" data-mi="${mi}">${v[mi] === true ? "Votei sim ✓" : S.settings.career ? "Sim, próxima temporada" : "Sim, bora de novo"}</button><button class="btn ghost ${v[mi] === false ? "on" : ""}" data-a="vote" data-v="0" data-mi="${mi}">${v[mi] === false ? "Votei não" : "Não"}</button></div>`).join("")}
    ${isHost() ? `<div class="row"><span class="muted" style="font-size:13px">Anfitrião:</span>${S.settings.career ? `<button class="btn sm gold" data-a="nextseason">Próxima temporada agora</button>` : ""}<button class="btn sm" data-a="relobby">Voltar ao vestiário${S.settings.career ? " (encerra a carreira)" : ""}</button></div>` : ""}
  </div>`;
}
function cardNames(s) { return String(s || "").split("+").map(k => CARDS[k] ? CARDS[k].name : k).join(" + "); }
function yearView() {
  return `<div class="card" style="margin-top:16px;display:grid;gap:8px"><div class="muted" style="font-size:12px">TEMPORADA ${S.yearDone ? "COMPLETA" : "EM ANDAMENTO"}</div>
    <div class="row" style="gap:14px">${S.history.map(h => `<div class="row" style="gap:8px">${crestSVG(S.managers[h.champion].crest, 30)}<div><div class="muted" style="font-size:12px">${h.comp}</div><b>${esc(S.managers[h.champion].team)}</b></div></div>`).join("")}</div>
    ${S.yearDone ? (() => { const tot = {}; S.history.forEach(h => h.table.forEach(r => tot[r.i] = (tot[r.i] || 0) + r.pts)); const best = Object.entries(tot).sort((x, y) => y[1] - x[1])[0]; const both = S.history[0].champion === S.history[1].champion; return `<div>${both ? `<b style="color:var(--gold)">${esc(S.managers[S.history[0].champion].team)} ganhou o Split e a Kings Cup!</b> ` : ""}Melhor campanha do ano nas fases de grupo: <b>${esc(S.managers[+best[0]].team)}</b> (${best[1]} pts).</div>`; })() : ""}</div>`;
}
function bracketView() {
  const se = S.season; if (!se.bracket) return "";
  const lv = [0, 1, 2, 3].filter(l => se.bracket.some(x => x.lvl === l));
  const nm = o => { if (o.t != null) return mgrName(o.t); const f = se.fixtures.find(x => x.id === o.w); const w = f && f.res ? (f.res.w === 0 ? f.h : f.a) : null; return w != null ? mgrName(w) : `<span class="muted">vencedor ${o.w.toUpperCase()}</span>`; };
  return `<div class="sec-title"><h2>Mata-mata</h2></div><div class="bracket">${lv.map(l => `<div class="bcol"><div class="muted" style="font-size:12px;text-transform:uppercase">${KO_NAMES[l]}</div>${se.bracket.filter(x => x.lvl === l).map(x => { const f = se.fixtures.find(y => y.id === x.id); return `<div class="bmatch"><div>${nm(x.a)} ${f && f.res ? `<b class="num">${f.res.s[0]}</b>` : ""}</div><div>${nm(x.b)} ${f && f.res ? `<b class="num">${f.res.s[1]}</b>` : ""}</div>${f && f.res && f.res.so ? `<div class="muted" style="font-size:11px">shootouts ${f.res.so[0]}-${f.res.so[1]}</div>` : ""}</div>`; }).join("")}</div>`).join("")}</div>`;
}
// seleção do campeonato: goleiro da melhor defesa + 2 por posição (gols, MVPs e overall)
function teamOfTournament(gk, mv) {
  const goals = {}; topScorers(S).forEach(x => goals[x.id] = x.n);
  const owned = S.managers.flatMap((m, mi) => m.roster.map(id => ({ id, mi })));
  const score = id => (goals[id] || 0) + (mv[id] || 0) * 3 + P(id).o / 25;
  const pickPos = (pos, n) => owned.filter(x => P(x.id).p === pos).sort((a, b) => score(b.id) - score(a.id)).slice(0, n);
  const line = [...(gk ? [{ id: gk.id, mi: ownerOf(S, gk.id) }] : pickPos("GOL", 1)), ...pickPos("DEF", 2), ...pickPos("MEI", 2), ...pickPos("ATA", 2)];
  if (line.length < 4) return "";
  return `<div class="sec-title"><h2>Seleção do campeonato</h2></div><div class="toty">${line.map(x => { const p = P(x.id), m = S.managers[x.mi]; return `<div class="totyc" style="--c:${m ? m.color : "#888"}">${posb(p.p, p.p2)}<b>${esc(p.n)}</b><span class="muted">${m ? esc(m.team) : ""}${goals[x.id] ? ` · ${goals[x.id]} gols` : ""}${mv[x.id] ? ` · ${mv[x.id]} MVP` : ""}</span></div>`; }).join("")}</div>`;
}
function awardsView() {
  const ts = topScorers(S)[0];
  const mv = {}; S.season.fixtures.forEach(f => { if (f.res && f.res.mvp) mv[f.res.mvp] = (mv[f.res.mvp] || 0) + 1; });
  const mvp = Object.entries(mv).sort((a, b) => b[1] - a[1])[0];
  const tb = standings(S);
  const bestDef = tb.slice().sort((a, b) => a.gc / Math.max(1, a.pj) - b.gc / Math.max(1, b.pj))[0];
  const bestAtt = tb.slice().sort((a, b) => b.gf - a.gf)[0];
  const gk = bestDef ? S.managers[bestDef.i].tac && P(S.managers[bestDef.i].tac.gk) : null;
  const card = (t, big, sub) => `<div class="award"><div class="muted" style="font-size:12px">${t}</div><b>${big}</b><span class="muted">${sub}</span></div>`;
  return `<div class="awards">
    ${ts ? card("ARTILHEIRO", esc(P(ts.id).n), `${ts.n} gols · ${esc(S.managers[ownerOf(S, ts.id)].team)}`) : ""}
    ${mvp ? card("REI DOS MVPS", esc(P(+mvp[0]).n), `${mvp[1]} vezes melhor em campo`) : ""}
    ${gk ? card("LUVA DE OURO", esc(gk.n), `defesa do ${esc(S.managers[bestDef.i].team)}: ${(bestDef.gc / Math.max(1, bestDef.pj)).toFixed(1)} gols sofridos por jogo`) : ""}
    ${bestAtt ? card("ATAQUE MAIS FORTE", esc(S.managers[bestAtt.i].team), `${bestAtt.gf} gols na fase de liga`) : ""}
  </div>${teamOfTournament(gk, mv)}`;
}
function editableMis() { return NET.mode === "local" ? humansIdx() : myMi() >= 0 ? [myMi()] : []; }
/* ---------- escalação visual: toque num jogador e depois em outro para trocar ---------- */
function fitOf(p, slot) { if (!p) return ""; if (slot === "GOL") return p.p === "GOL" ? "ok" : "bad"; if (p.p === slot) return "ok"; if (p.p2 === slot) return "mid"; return "bad"; }
function luChip(mi, key, id, slot, extra) {
  const p = id != null ? P(id) : null, sel = UI.lsel && UI.lsel.mi === mi && UI.lsel.k === key;
  const fit = slot ? fitOf(p, slot) : "";
  return `<button class="luchip ${fit} ${sel ? "sel" : ""}" data-a="lu" data-mi="${mi}" data-k="${key}" ${extra || ""} aria-label="${p ? esc(p.n) : "vaga"}">
    ${slot ? `<span class="lupos">${slot}</span>` : ""}<span class="luo num">${p ? O(p) : "–"}</span><span class="lun">${p ? esc(shortName(p.n)) : "vaga"}${p && isInj(S, id) ? " 🩹" : ""}${p && isUnh(id) ? " 😤" : ""}</span>${p ? `<span class="lup">${p.p}${p.p2 ? "/" + p.p2 : ""}</span>` : ""}</button>`;
}
function isUnh(id) { const u = S.career && S.career.unhappy && S.career.unhappy[id]; return !!(u && u.left > 0); }
function lineupBoard(mi, m, tac) {
  const slots = FORMS[tac.form], xy = FORM_XY[tac.form];
  const used = new Set([tac.gk].concat(tac.slots));
  const bench = m.roster.filter(id => !used.has(id)).sort((a, b) => POS_ORDER[P(a).p] - POS_ORDER[P(b).p] || P(b).o - P(a).o);
  const ord = tac.order.filter(id => tac.slots.includes(id));
  const bad = slots.filter((sl, i) => tac.slots[i] != null && fitOf(P(tac.slots[i]), sl) === "bad").length + (P(tac.gk) && P(tac.gk).p !== "GOL" ? 1 : 0);
  const chem = chemistry({ field: tac.slots.filter(x => x != null).concat(tac.gk != null ? [tac.gk] : []) });
  const injd = [tac.gk].concat(tac.slots).filter(id => isInj(S, id));
  const unh = m.roster.filter(id => isUnh(id));
  return `<div class="lubox">
    <div class="lupitch">
      <div class="luline mid"></div><div class="luline box"></div><div class="luline box top"></div>
      ${slots.map((sl, i) => { const [x, y] = xy[i]; const n = ord.indexOf(tac.slots[i]); return `<div class="luslot" style="left:${y * 100}%;top:${(1 - x) * 82 + 4}%">${luChip(mi, "s" + i, tac.slots[i], sl, "")}${n >= 0 ? `<span class="luord" title="Ordem no escalonado">${n + 1}º</span>` : ""}</div>`; }).join("")}
      <div class="luslot" style="left:50%;top:91%">${luChip(mi, "gk", tac.gk, "GOL", "")}</div>
    </div>
    <div class="muted" style="font-size:12.5px">${UI.lsel && UI.lsel.mi === mi ? "<b style='color:var(--gold)'>Agora toque em quem vai trocar de lugar com ele.</b>" : "Toque num jogador e depois em outro (no campo ou no banco) para trocar."} Verde: posição dele · amarelo: posição secundária · vermelho: fora de posição.${bad ? ` <b style="color:var(--red)">${bad} fora de posição.</b>` : ""}</div>
    <div class="row" style="gap:6px"><span class="pill ${chem.pairs ? "you" : ""}">Química: ${chem.pairs} dupla${chem.pairs === 1 ? "" : "s"} do mesmo clube${chem.pairs ? ` (+${Math.round((chem.mult - 1) * 100)}%)` : ""}</span>${injd.length ? `<span class="pill" style="color:var(--red)">🩹 ${injd.map(id => esc(shortName(P(id).n)) + " fora " + S.season.inj[id] + " rod.").join(", ")} — o jogo troca na hora</span>` : ""}</div>
    ${unh.length ? `<div class="unhbox">😤 <b>Insatisfeito${unh.length > 1 ? "s" : ""}:</b> ${unh.map(id => `${esc(P(id).n)} (faltam ${S.career.unhappy[id].left} jogo${S.career.unhappy[id].left > 1 ? "s" : ""})`).join(", ")}. Quase não jogou na temporada passada e rende 3 pontos a menos até entrar em campo de novo. Escale, troque ou dispense.</div>` : ""}
    <div class="lubench"><span class="muted" style="font-size:12px">BANCO</span>${bench.map(id => luChip(mi, "b" + id, id, null, "")).join("") || '<span class="muted">sem reservas</span>'}</div>
  </div>`;
}
function luTap(mi, k) {
  const cur = UI.lsel;
  if (!cur || cur.mi !== mi) { UI.lsel = { mi, k }; return render(true); }
  if (cur.k === k) { UI.lsel = null; return render(true); }
  if (cur.k[0] === "b" && k[0] === "b") { UI.lsel = { mi, k }; return render(true); }
  const a = cur.k, b = k; UI.lsel = null;
  tacChange(mi, tac => {
    const get = key => key === "gk" ? tac.gk : key[0] === "s" ? tac.slots[+key.slice(1)] : +key.slice(1);
    const set = (key, id) => { if (key === "gk") tac.gk = id; else if (key[0] === "s") tac.slots[+key.slice(1)] = id; };
    const ia = get(a), ib = get(b);
    if (a[0] === "b") { set(b, ia); const oi = tac.order.indexOf(ib); if (oi >= 0 && b[0] === "s") tac.order[oi] = ia; }
    else if (b[0] === "b") { set(a, ib); const oi = tac.order.indexOf(ia); if (oi >= 0 && a[0] === "s") tac.order[oi] = ib; }
    else { set(a, ib); set(b, ia); }
  });
}
function teamView() {
  const mis = editableMis();
  if (!mis.length) return `<p class="muted">Você está assistindo esta sala.</p>`;
  if (UI.editMi == null || !mis.includes(UI.editMi)) UI.editMi = mis[0];
  const mi = UI.editMi, m = S.managers[mi], tac = m.tac || autoTac(S, mi, "2-3-1", "equilibrado");
  const slots = FORMS[tac.form];
  const used = new Set([tac.gk].concat(tac.slots));
  const bench = m.roster.filter(id => !used.has(id));
  const opt = (sel, list) => list.map(id => { const p = P(id); return `<option value="${id}" ${id === sel ? "selected" : ""}>${O(p)} ${p.p} · ${esc(p.n)}</option>`; }).join("");
  const order = tac.order.filter(id => tac.slots.includes(id));
  return `${mis.length > 1 ? `<div class="row" style="margin-bottom:10px"><span class="muted">Editando:</span>${mis.map(i => `<button class="btn sm ${i === mi ? "gold" : ""}" data-a="editmi" data-mi="${i}">${esc(S.managers[i].team)}</button>`).join("")}</div>` : ""}
  <div class="grid2">
    <div class="card" style="display:grid;gap:10px;align-content:start">
      <h3 style="font-size:22px">Escalação · ${esc(m.team)}</h3>
      ${m.coach ? (() => { const c = STAFF_BY_ID[m.coach]; const f1 = tac.form === c.form, f2 = tac.style === c.style; return `<div class="flash" style="border-color:${f1 && f2 ? "var(--pitch)" : "var(--line)"};background:transparent;font-size:13.5px">Técnico <b>${esc(c.n)}</b> prefere <b>${c.form}</b> ${f1 ? "✓" : "✗"} e <b>${STYLES[c.style].n}</b> ${f2 ? "✓" : "✗"}. ${f1 && f2 ? "Encaixe perfeito: bônus máximo!" : f1 || f2 ? "Encaixe parcial: bônus menor." : "Sem bônus de preleção."}</div>`; })() : ""}
      ${m.pres ? `<div class="muted" style="font-size:13px">Presidente: <b style="color:var(--ink)">${esc(STAFF_BY_ID[m.pres].n)}</b> ${hid() ? "" : `(pênalti ${STAFF_BY_ID[m.pres].pen})`} cobra o pênalti presidente.</div>` : ""}
      <div class="grid2" style="gap:10px">
        <label class="f" for="t-form">Formação<select id="t-form" data-mi="${mi}">${Object.keys(FORMS).map(f => `<option ${f === tac.form ? "selected" : ""}>${f}</option>`).join("")}</select></label>
        <label class="f" for="t-style">Estilo de jogo<select id="t-style" data-mi="${mi}">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${k === tac.style ? "selected" : ""}>${v.n}</option>`).join("")}</select></label>
      </div>
      ${lineupBoard(mi, m, tac)}
      <label class="row" for="t-auto" style="gap:8px;font-size:14px"><input id="t-auto" type="checkbox" data-mi="${mi}" ${tac.autoSub !== false ? "checked" : ""}> Substituições automáticas (ilimitadas: quem cansa sai e pode voltar)</label>
      <label class="f" for="t-pk">Cobrador oficial (pênaltis e shootouts)<select id="t-pk" data-mi="${mi}"><option value="">Automático (melhor finalizador em campo)</option>${m.roster.map(P).filter(p => p.p !== "GOL").sort((a, b) => b.at - a.at).map(p => `<option value="${p.id}" ${tac.pk === p.id ? "selected" : ""}>${esc(p.n)} · finalização ${p.at}</option>`).join("")}</select></label>
      <label class="f" for="t-gkm">Goleiro linha<select id="t-gkm" data-mi="${mi}">${[["auto", "Automático (escalonado até 3x3, dado às vezes, match ball 2x2/1x1)"], ["sempre", "Sempre que der"], ["nunca", "Nunca"]].map(([k, v]) => `<option value="${k}" ${(tac.gkMode || "auto") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    </div>
    <div style="display:grid;gap:16px;align-content:start">
      <div class="card" style="display:grid;gap:8px">
        <h3 style="font-size:20px">Ordem do escalonado</h3>
        <p class="muted" style="margin:0;font-size:13px">Quem entra primeiro joga o 1x1. Um por minuto até o 7x7.</p>
        ${order.map((id, k) => `<div class="row" style="gap:6px;border:1px solid var(--line);border-radius:10px;padding:6px 8px"><span class="num" style="width:22px;color:var(--gold)">${k + 1}º</span>${posb(P(id).p)}<span style="flex:1">${esc(P(id).n)} <span class="muted">${k}'</span></span>
          <button class="btn sm ghost" data-a="ord" data-mi="${mi}" data-k="${k}" data-d="-1" ${k === 0 ? "disabled" : ""} aria-label="Subir">▲</button><button class="btn sm ghost" data-a="ord" data-mi="${mi}" data-k="${k}" data-d="1" ${k === order.length - 1 ? "disabled" : ""} aria-label="Descer">▼</button></div>`).join("")}
      </div>
      <div class="card" style="display:grid;gap:8px">
        <h3 style="font-size:20px">Estilos</h3>
        <div class="muted" style="font-size:13px;display:grid;gap:4px">
          <div><b>Contra-ataque</b> castiga quem joga de Posse ou Pressão alta.</div>
          <div><b>Bola longa</b> passa por cima da Pressão alta.</div>
          <div><b>Pressão alta</b> rouba de quem tem Posse, mas abre espaço atrás.</div>
          <div><b>Retranca</b> defende muito e ataca pouco. <b>Posse</b> sofre contra Retranca.</div>
        </div>
      </div>
      <div class="card" style="display:grid;gap:8px">
        <h3 style="font-size:20px">Se o jogo for simulado</h3>
        <p class="muted" style="margin:0;font-size:13px">Nos jogos ao vivo você aperta os botões. Na simulação rápida, vale isto:</p>
        <label class="f" for="st-card-${mi}">Carta secreta<select id="st-card-${mi}" data-mi="${mi}" data-k="card">${Object.entries(STRATS).map(([k, v]) => `<option value="${k}" ${m.strat.card === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f" for="st-pp-${mi}">Pênalti do presidente<select id="st-pp-${mi}" data-mi="${mi}" data-k="pp">${Object.entries(STRATS).map(([k, v]) => `<option value="${k}" ${m.strat.pp === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
    </div>
  </div>
  ${crestEditor()}`;
}
function tacChange(mi, fn) {
  const m = S.managers[mi]; const tac = JSON.parse(JSON.stringify(m.tac || autoTac(S, mi, "2-3-1", "equilibrado")));
  fn(tac);
  tac.order = tac.order.filter(id => tac.slots.includes(id));
  tac.slots.forEach(id => { if (id != null && !tac.order.includes(id)) tac.order.push(id); });
  if (NET.mode === "client") { m.tac = tac; setLocal(mi, "tac", tac); render(true); }
  act({ t: "tac", tac, mi });
}
function tableView(tb, g) {
  const n = S.managers.length; const se = S.season;
  const cut = se.fmt === "cup" ? (se.bonusGroup == null ? 3 : se.bonusGroup === g ? 4 : 3) : n >= 5 ? Math.min(7, n) : n >= 4 ? 4 : 2;
  const top = se.fmt === "split" ? n >= 5 : se.bonusGroup === g;
  return `<div class="scroll" style="max-height:none"><table class="tbl"><thead><tr><th>#</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th title="Vitórias nos shootouts (já contadas em V)">V-SO</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th title="Cartões recebidos">🟨🟥</th></tr></thead><tbody>
  ${tb.map((r, k) => `<tr style="${k === cut - 1 || (k === 0 && top) ? "border-bottom:2px solid var(--gold)" : ""}"><td class="num">${k + 1}</td><td>${mgrName(r.i)} <span class="muted" style="font-size:12px">${esc(S.managers[r.i].name)}</span></td><td class="num" style="font-size:20px;color:var(--gold)">${r.pts}</td><td class="num">${r.pj}</td><td class="num">${r.v}</td><td class="num">${r.vso}</td><td class="num">${r.d}</td><td class="num">${r.gf}</td><td class="num">${r.gc}</td><td class="num">${r.gf - r.gc}</td><td class="num">${r.ca}</td></tr>`).join("")}
  </tbody></table><p class="muted" style="padding:0 12px;font-size:12px">Vitória vale 1 ponto, no tempo normal ou nos shootouts; derrota vale 0. Gols de shootout não entram no saldo. Desempate: confronto direto entre os empatados, saldo de gols, menos cartões, gols marcados. ${se.fmt === "cup" ? (se.bonusGroup == null ? "Jogos desafio não contam aqui. O grupo que vencer mais desafios leva 4 vagas (1º direto na semi); o outro leva 3." : se.bonusGroup === g ? "Este grupo venceu mais desafios: 4 vagas, 1º direto na semi." : "3 vagas: o 1º joga as quartas.") : n >= 5 ? `1º direto na semi; 2º ao ${Math.min(7, n)}º disputam as quartas.` : n >= 4 ? "Top 4 vai às semifinais (1º x 4º, 2º x 3º)." : "Top 2 faz a final."}</p></div>`;
}
function fixturesView() {
  const byR = {};
  S.season.fixtures.forEach(f => (byR[f.round] = byR[f.round] || []).push(f));
  return Object.keys(byR).sort((a, b) => b - a).map(r => {
    const fs = byR[r];
    return `<div class="card" style="padding:0;margin-bottom:12px"><div class="row" style="padding:10px 12px;border-bottom:1px solid var(--line)"><b>${fs[0].stage === "Liga" ? `Rodada ${+r + 1}` : fs[0].stage}</b></div>
    ${fs.map(f => { const res = f.res; return `<div class="fx"><div class="h ${res && res.w === 0 ? "w" : ""}">${esc(S.managers[f.h].team)} <span class="dot" style="--c:${S.managers[f.h].color}"></span></div>
      <div class="sc">${res ? `${res.s[0]}<span class="muted">x</span>${res.s[1]}` : `<span class="muted">x</span>`}${res && res.so ? `<div class="muted" style="font-size:12px">shootouts ${res.so[0]}-${res.so[1]}</div>` : ""}</div>
      <div class="${res && res.w === 1 ? "w" : ""}"><span class="dot" style="--c:${S.managers[f.a].color}"></span> ${esc(S.managers[f.a].team)}</div>
      <div>${res ? `<button class="btn sm" data-a="watch" data-id="${f.id}">Lances</button>` : ""}</div></div>`; }).join("")}</div>`;
  }).join("") || `<p class="muted">Nenhum jogo ainda.</p>`;
}
function rostersView() {
  return `<div class="mgrs">${S.managers.map((m, i) => {
    const tac = m.tac; if (!tac) return "";
    const row = (id, tag) => { const p = P(id); return `<div class="row" style="gap:6px;font-size:13.5px"><span class="num" style="color:${p.p === "GOL" ? "var(--blue)" : "var(--gold)"};width:24px">${O(p)}</span>${posb(p.p, p.p2)} ${esc(p.n)} ${tag ? `<span class="pill">${tag}</span>` : ""}</div>`; };
    const used = new Set([tac.gk].concat(tac.slots));
    return `<div class="mgr" style="--c:${m.color}"><div class="t"><span>${esc(m.team)}</span>${m.cpu ? '<span class="pill cpu">bot</span>' : ""}</div>
      <div class="muted" style="font-size:12px">${tac.form} · ${STYLES[tac.style].n} · sobrou ${m.budget} K$</div>
      ${row(tac.gk)}${tac.slots.filter(x => x != null).map(id => row(id)).join("")}${m.roster.filter(id => !used.has(id)).map(id => row(id, "reserva")).join("")}</div>`;
  }).join("")}</div>`;
}
// rankings do campeonato a partir dos resultados das partidas
function seasonStats() {
  const P2 = {}, T2 = {};
  const pl = id => P2[id] = P2[id] || { id, j: 0, g: 0, a: 0, mvp: 0, sv: 0, gc: 0, y: 0, r: 0, ns: 0, nc: 0 };
  S.season.fixtures.forEach(f => {
    const r = f.res; if (!r) return;
    [f.h, f.a].forEach((mi, ti) => {
      const t = T2[mi] = T2[mi] || { mi, j: 0, gf: 0, gc: 0, fouls: 0, y: 0, r: 0 };
      t.j++; t.gf += r.s[ti]; t.gc += r.s[1 - ti]; t.fouls += (r.fouls || [0, 0])[ti]; t.y += (r.yc || [0, 0])[ti]; t.r += (r.rc || [0, 0])[ti];
      (r.pl ? r.pl[ti] : []).forEach(id => { pl(id).j++; if (P(id) && P(id).p === "GOL") pl(id).gc += r.s[1 - ti]; });
      (r.sc ? r.sc[ti] : []).forEach(([id, n]) => pl(id).g += n);
      (r.ast ? r.ast[ti] : []).forEach(([id, n]) => pl(id).a += n);
      (r.svs ? r.svs[ti] : []).forEach(([id, n]) => pl(id).sv += n);
      (r.cl ? r.cl[ti] : []).forEach(([id, c]) => { if (c === "r") pl(id).r++; else pl(id).y++; });
    });
    if (r.mvp) pl(r.mvp).mvp++;
    (r.nt || []).forEach(([id, n]) => { pl(id).ns += n; pl(id).nc++; });
  });
  return { P: Object.values(P2).filter(x => P(x.id)), T: Object.values(T2) };
}
function statsView() {
  const st = seasonStats();
  if (!st.P.length) return `<p class="muted">As estatísticas aparecem depois dos primeiros jogos.</p>`;
  const who = x => { const p = P(x.id), ow = ownerOf(S, x.id); return `<span class="rnl">${posb(p.p, p.p2)} <b>${esc(p.n)}</b></span><span class="rnt muted">${ow >= 0 ? esc(S.managers[ow].team) : ""}</span>`; };
  const box = (title, list, val, unit) => `<div class="card rank"><h4>${title}</h4>${list.length ? list.slice(0, 6).map((x, k) => `<div class="rrow"><span class="num rk">${k + 1}</span><span class="rn">${who(x)}</span><b class="num">${val(x)}</b>${unit ? `<small class="muted">${unit}</small>` : ""}</div>`).join("") : '<p class="muted">—</p>'}</div>`;
  const tbox = (title, list, val, unit) => `<div class="card rank"><h4>${title}</h4>${list.slice(0, 6).map((x, k) => `<div class="rrow"><span class="num rk">${k + 1}</span><span class="rn">${mgrName(x.mi)}</span><b class="num">${val(x)}</b>${unit ? `<small class="muted">${unit}</small>` : ""}</div>`).join("")}</div>`;
  const by = (f, filt) => st.P.filter(filt || (x => f(x) > 0)).sort((a, b) => f(b) - f(a) || P(b.id).o - P(a.id).o);
  const minJ = Math.max(1, Math.floor(Math.max(...st.P.map(x => x.j)) / 2));
  return `<div class="ranks">
    ${box("Artilharia", by(x => x.g), x => x.g, "gols")}
    ${box("Assistências", by(x => x.a), x => x.a, "assist.")}
    ${box("Participações em gol", by(x => x.g + x.a), x => x.g + x.a, "G+A")}
    ${box("Rei dos MVPs", by(x => x.mvp), x => x.mvp, "MVP")}
    ${box("Melhor média", by(x => x.ns / x.nc, x => x.nc >= minJ), x => (x.ns / x.nc).toFixed(1), "nota")}
    ${box("Goleiros: mais defesas", by(x => x.sv, x => P(x.id).p === "GOL" && x.sv > 0), x => x.sv, "defesas")}
    ${box("Goleiros: menos gols por jogo", by(x => -x.gc / x.j, x => P(x.id).p === "GOL" && x.j >= minJ), x => (x.gc / x.j).toFixed(1), "sofridos/jogo")}
    ${box("Cartões", by(x => x.y + x.r * 3), x => `${x.y ? "🟨" + x.y : ""} ${x.r ? "🟥" + x.r : ""}`, "")}
    ${tbox("Melhor ataque", st.T.slice().sort((a, b) => b.gf / b.j - a.gf / a.j), x => (x.gf / x.j).toFixed(1), "gols/jogo")}
    ${tbox("Melhor defesa", st.T.slice().sort((a, b) => a.gc / a.j - b.gc / b.j), x => (x.gc / x.j).toFixed(1), "sofridos/jogo")}
    ${tbox("Mais faltas", st.T.slice().sort((a, b) => b.fouls - a.fouls), x => x.fouls, "faltas")}
    ${tbox("Fair play", st.T.slice().sort((a, b) => (a.y + a.r * 3) - (b.y + b.r * 3)), x => x.y + x.r * 3, "pts de cartão")}
  </div>`;
}
function scorersView() {
  const ts = topScorers(S).slice(0, 20);
  if (!ts.length) return `<p class="muted">Ainda sem gols.</p>`;
  return `<div class="scroll" style="max-height:none"><table class="tbl"><thead><tr><th>#</th><th>Jogador</th><th>Time</th><th>Gols</th></tr></thead><tbody>
  ${ts.map((x, k) => { const p = P(x.id), ow = ownerOf(S, x.id); return `<tr><td class="num">${k + 1}</td><td>${posb(p.p, p.p2)} <b>${esc(p.n)}</b></td><td>${ow >= 0 ? mgrName(ow) : ""}</td><td class="num" style="font-size:20px;color:var(--gold)">${x.n}</td></tr>`; }).join("")}
  </tbody></table></div>`;
}

/* ---------- lances de jogos encerrados ---------- */
async function openReplay(fid) {
  const f = S.season.fixtures.find(x => x.id === fid); if (!f || !f.res) return;
  let evs = EVS[fid];
  if (!evs && NET.srv) evs = await srvEv(fid);
  if (!evs && NET.db) { try { const d = await NET.db.doc(`mev/${NET.code}-${fid}`).get(); if (d.exists) evs = d.data().ev; EVS[fid] = evs; } catch (e) { } }
  const H = S.managers[f.h], A = S.managers[f.a];
  const icon = e => ({ goal: "⚽", card: "🃏", pp: "👔", penres: "🥅", sores: "🥅", chance: "↗", so: e.ok ? "⚽" : "✖", end: "🏁", phase: "⏱", dice: "🎲", foul: "🦶", inj: "🩹", yellow: "🟨", red: "🟥", sub: "⇄", tac: "📋", info: "•" }[e.type] || "•");
  $("#viewer").innerHTML = `<div class="vbox">
    <div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="phase">${esc(f.stage === "Liga" ? `Rodada ${f.round + 1}` : f.stage)}</span><button class="btn sm" data-a="vclose">Fechar</button></div>
    <div class="board"><div class="tn" style="color:${H.color}">${esc(H.team)}<small>pres. ${esc(H.name)}</small></div>
    <div><div class="score num">${f.res.s[0]}<span class="muted">:</span>${f.res.s[1]}</div>${f.res.so ? `<div class="muted num" style="text-align:center">shootouts ${f.res.so[0]}-${f.res.so[1]}</div>` : ""}</div>
    <div class="tn" style="text-align:right;color:${A.color}">${esc(A.team)}<small>pres. ${esc(A.name)}</small></div></div>
    <p class="muted" style="font-size:13px">Cartas: ${esc(H.team)} tinha <b>${cardNames(f.res.cards[0])}</b>, ${esc(A.team)} tinha <b>${cardNames(f.res.cards[1])}</b>.${f.res.yc ? ` Cartões: 🟨 ${f.res.yc[0]}x${f.res.yc[1]} · 🟥 ${f.res.rc[0]}x${f.res.rc[1]}.` : ""}${f.res.mvp ? ` MVP: <b>${esc(P(f.res.mvp).n)}</b>.` : ""} Finalizações ${f.res.shots[0]} x ${f.res.shots[1]}.</p>
    <div class="feed">${evs ? evs.filter(e => e.text).map(e => `<div class="ev k-${e.type}" style="--c:${e.team === 0 ? H.color : e.team === 1 ? A.color : "#555"}"><div class="m num">${e.m >= 36 && (e.type === "so") ? "SO" : Math.floor(e.m) + "'"}</div><div class="ic">${icon(e)}</div><div class="t">${esc(e.text)}${e.type === "goal" ? ` <span class="muted num">${e.s[0]}-${e.s[1]}</span>` : ""}</div></div>`).join("") : `<p class="muted">Os lances deste jogo não estão salvos.</p>`}</div></div>`;
  $("#viewer").classList.add("on"); document.body.style.overflow = "hidden";
}
function closeReplay() { $("#viewer").classList.remove("on"); document.body.style.overflow = ""; }

/* ---------- render principal ---------- */
function stepper(k, label, v, min, max, step, on) {
  return `<div class="f"><span>${label}</span><div class="stepper"><button class="btn sm" data-a="stp" data-k="${k}" data-d="${-step}" data-min="${min}" data-max="${max}" ${on && v > min ? "" : "disabled"} aria-label="Diminuir">−</button><b class="num">${v}</b><button class="btn sm" data-a="stp" data-k="${k}" data-d="${step}" data-min="${min}" data-max="${max}" ${on && v < max ? "" : "disabled"} aria-label="Aumentar">+</button></div></div>`;
}
function readSettings() {
  const sv = id => { const el = $(id); return el ? el.value : undefined; };
  return { t: "settings", v: { inj: sv("#s-inj"), hide: sv("#s-hide"), fmt: sv("#s-fmt"), year: sv("#s-year") === "1", staff: sv("#s-staff"), trades: sv("#s-trades"), career: sv("#s-career") === "1" } };
}
function editing(box) {
  const ae = document.activeElement;
  if (!ae || ae === document.body || (box && !box.contains(ae))) return false;
  if (ae.tagName === "SELECT") return true;
  if (ae.tagName === "INPUT" && ["color", "number"].includes(ae.type)) return true;
  if (ae.tagName === "INPUT" && ae.type === "text" && !["q", "mq"].includes(ae.id)) return true;
  return false;
}
function setLocal(mi, field, v) { UI.local = UI.local || {}; (UI.local[mi] = UI.local[mi] || {})[field] = { v: JSON.parse(JSON.stringify(v)), until: Date.now() + 6000 }; }
function applyLocalOverrides() {
  if (!UI.local || !S) return;
  Object.entries(UI.local).forEach(([mi, fields]) => {
    const m = S.managers[+mi]; if (!m) return;
    Object.entries(fields).forEach(([f, o]) => {
      if (Date.now() > o.until || JSON.stringify(m[f]) === JSON.stringify(o.v)) delete fields[f];
      else m[f] = JSON.parse(JSON.stringify(o.v));
    });
  });
}
function render(force) {
  if (document.hidden) { UI.hiddenRender = true; return; } // aba escondida: não desenha (economiza processador)
  if (!force && editing($("#app"))) { UI.pendingRender = true; return; }
  UI.pendingRender = false;
  const ae = document.activeElement, aid = ae && ae.id, ss = ae && ae.selectionStart;
  const keepVal = ae && ae.tagName === "INPUT" && ae.type === "text" ? ae.value : null;
  let body;
  if (UI.page === "admin") body = viewAdmin(); else if (UI.page === "perfil") body = viewProfile();
  else if (!S) body = viewHome();
  else if (S.phase === "lobby") body = viewLobby();
  else if (S.phase === "auction" || (S.phase === "wc" && S.auction)) body = viewAuction();
  else if (S.phase === "wc") body = viewWC();
  else if (S.phase === "lottery") body = viewLottery();
  else if (S.phase === "draft") body = viewDraft();
  else if (S.phase === "staff") body = viewStaff();
  else if (S.phase === "trade") body = viewTrade();
  else if (S.phase === "keep") body = viewKeep();
  else body = viewSeason();
  if (S && NET.mode === "client" && myMi() < 0 && S.phase !== "lobby") { const bots = S.managers.map((m, i) => [m, i]).filter(([m]) => m.cpu); body = `<div class="card unhbox" style="margin-bottom:12px;display:grid;gap:10px"><div><b>Você entrou com o campeonato em andamento.</b> ${bots.length ? "Escolha um time de bot para assumir: você fica com o elenco, o dinheiro e a posição dele na tabela." : "Não há times de bot para assumir agora; você pode assistir."}</div>${bots.length ? `<div class="row" style="gap:8px">${bots.map(([m, i]) => `<button class="btn sm" data-a="takebot" data-mi="${i}">${crestSVG(tcrest(m), 16)} Assumir o ${esc(m.team)}</button>`).join("")}</div>` : ""}<div class="muted" style="font-size:12.5px">Já é presidente de um time desta sala e voltou por outro aparelho? Entre com o mesmo nome de presidente: assim que o aparelho antigo ficar uns 30 segundos fora, você reassume o seu time sozinho.</div></div>` + body; }
  if (!UI.page) body = adminNotice() + body;
  const keepScroll = {}; document.querySelectorAll("#app .scroll[id]").forEach(x => { keepScroll[x.id] = x.scrollTop; }); const winY = window.scrollY;
  $("#app").innerHTML = header() + `<main class="wrap">${body}</main><footer class="foot"><div class="wrap">${CROWN}<span><b>The Kings Game</b></span><span class="spacer"></span><span>Dados: kingsleague.pro e <a href="https://klscout.netlify.app/" target="_blank" rel="noopener">Kings League Scout</a></span></div></footer>` + loginModal();
  Object.entries(keepScroll).forEach(([id, top]) => { const x = document.getElementById(id); if (x) x.scrollTop = top; }); if (UI.page === "admin" && Math.abs(window.scrollY - winY) > 2) window.scrollTo(0, winY);
  if (aid) { const el = document.getElementById(aid); if (el) { if (keepVal != null) el.value = keepVal; el.focus(); try { if (ss != null && el.setSelectionRange) el.setSelectionRange(ss, ss); } catch (e) { } } }
  tickClocks(); renderChat(); try { profSync(); } catch (e) { }
}
/* ---------- chat da sala ---------- */
const QUICK = ["Boa!", "Que golaço!", "Roubado!", "Bora!", "Sem chance 😂", "GG"];
function chatMi() { return NET.mode === "local" ? (humansIdx()[0] != null ? humansIdx()[0] : -1) : myMi(); }
function renderChat() {
  let box = document.getElementById("chat");
  if (!S || NET.mode === "local") { if (box) box.style.display = "none"; return; }
  if (!box) { box = document.createElement("div"); box.id = "chat"; box.className = "chat"; document.body.appendChild(box);
    box.innerHTML = `<button class="chatbtn" data-a="chattog" aria-label="Chat da sala">💬<span id="chatn" class="chatn"></span></button><div class="chatpanel" id="chatpanel"><div class="chatlist" id="chatlist" aria-live="polite"></div>
      <div class="chatq">${QUICK.map(q => `<button class="btn sm ghost" data-a="chatq" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <form id="chatform" class="row" style="gap:6px;flex-wrap:nowrap"><input id="chat-in" type="text" maxlength="140" placeholder="Mensagem para a sala…" autocomplete="off" style="flex:1"><button class="btn sm gold" type="submit">Enviar</button></form></div>`;
    box.querySelector("#chatform").addEventListener("submit", ev => { ev.preventDefault(); const i = $("#chat-in"); const v = i.value.trim(); if (v) { sendChat(v); i.value = ""; } });
  }
  box.style.display = "";
  const msgs = S.chat || [], last = msgs.length ? msgs[msgs.length - 1].i : 0;
  box.classList.toggle("open", !!UI.chatOpen);
  if (UI.chatOpen) UI.chatSeen = last;
  const unread = Math.max(0, msgs.filter(m => m.i > (UI.chatSeen || 0)).length);
  $("#chatn").textContent = unread ? unread : ""; $("#chatn").style.display = unread ? "" : "none";
  const sig = last + ":" + msgs.length;
  if (UI.chatSig !== sig) { UI.chatSig = sig; const l = $("#chatlist"); l.innerHTML = msgs.map(m => `<div class="cmsg"><b style="color:${m.c}">${esc(m.n)}</b> ${esc(m.txt)}</div>`).join("") || '<p class="muted" style="margin:0">Ninguém falou nada ainda.</p>'; l.scrollTop = l.scrollHeight;
    const nw = msgs.filter(m => m.i > (UI.chatToast || 0) && m.mi !== myMi()); if (UI.chatToast != null && nw.length && !UI.chatOpen) toast(`💬 ${nw[nw.length - 1].n}: ${nw[nw.length - 1].txt}`); UI.chatToast = last; }
}
function sendChat(txt) { const mi = chatMi(); if (mi < 0) return; if (NET.mode === "client") { S.chat = (S.chat || []).concat({ i: (S.chatN || 0) + 0.5, mi, n: S.managers[mi].name, c: S.managers[mi].color, txt }); UI.chatSig = null; renderChat(); } act({ t: "chat", txt, mi }); }

document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a;
  if (a === "create") return createOnline();
  if (a === "join") return joinOnline();
  if (a === "login") { UI.loginOpen = true; UI.lg = { mode: "in", msg: "" }; return render(true); }
  if (a === "loginclose") { UI.loginOpen = false; return render(true); }
  if (a === "logingoogle") { const L = UI.lg = UI.lg || {}; L.msg = ""; window.klAuth.signIn().then(() => { UI.loginOpen = false; render(true); }).catch(e => { L.msg = authErr(e); L.ok = false; render(true); }); return; }
  if (a === "lgmode") { UI.lg = Object.assign(UI.lg || {}, { mode: b.dataset.v, msg: "" }); return render(true); }
  if (a === "lgreset") { const L = UI.lg = UI.lg || {}; const em = (($("#lg-email") || {}).value || "").trim(); L.email = em; if (!em) { L.msg = "Digite seu e-mail acima e toque de novo em Esqueci a senha."; L.ok = false; return render(true); } window.klAuth.reset(em).then(() => { L.msg = "Mandamos um link para trocar a senha no seu e-mail."; L.ok = true; render(true); }).catch(e => { L.msg = authErr(e); L.ok = false; render(true); }); return; }
  if (a === "profile") { UI.page = "perfil"; UI.kitTab = 1; window.scrollTo(0, 0); return render(true); }
  if (a === "profileclose") { UI.page = null; return render(true); }
  if (a === "adminpage") { UI.page = "admin"; window.scrollTo(0, 0); return render(true); }
  if (a === "adsec") { UI.adsec = b.dataset.v; UI.adq = ""; UI.adteam = ""; return render(true); }
  if (a === "ovrsave") { const ov = Object.assign({}, ADMIN_CFG.ovr || {}); Object.entries(UI.ovrEd || {}).forEach(([id, x]) => { const o0 = PLAYERS_ORIG[id], cur = Object.assign({}, ov[id] || {}, x), diff = {}; Object.keys(cur).forEach(k => { if (k === "sec") return; if (cur[k] !== o0[k]) diff[k] = cur[k]; }); if (Object.keys(diff).length) { if (cur.sec) diff.sec = true; ov[id] = diff; } else delete ov[id]; }); saveAdminCfg({ ovr: ov }).then(() => { UI.ovrEd = {}; toast("Overall salvo! Já vale para as salas novas."); render(true); }).catch(() => toast("Não consegui salvar (sem permissão ou sem internet).")); return; }
  if (a === "ovrreset") { const ov = Object.assign({}, ADMIN_CFG.ovr || {}); delete ov[b.dataset.id]; if (UI.ovrEd) delete UI.ovrEd[b.dataset.id]; saveAdminCfg({ ovr: ov }).then(() => { toast("Voltou ao overall original."); render(true); }).catch(() => toast("Não consegui salvar.")); return; }
  if (a === "msgsave") { const txt = (($("#ad-msg") || {}).value || "").trim().slice(0, 240), on = b.dataset.on === "1"; saveAdminCfg({ msg: { txt, on: on && !!txt, at: Date.now() } }).then(() => { toast(on ? "Aviso publicado!" : "Aviso retirado."); render(true); }).catch(() => toast("Não consegui salvar.")); return; }
  if (a === "defsave") { const g = id => ($("#" + id) || {}).value; const d = { mode: g("df-mode"), fmt: g("df-fmt"), inj: g("df-inj"), budget: +g("df-budget"), squad: +g("df-squad"), timer: +g("df-timer"), total: +g("df-total"), hide: g("df-hide"), career: g("df-career") === "1" }; saveAdminCfg({ defaults: d }).then(() => { toast("Padrões salvos para as salas novas."); render(true); }).catch(() => toast("Não consegui salvar.")); return; }
  if (a === "defclear") { saveAdminCfg({ defaults: null }).then(() => { toast("Salas novas voltam aos padrões do jogo."); render(true); }).catch(() => toast("Não consegui salvar.")); return; }
  if (a === "adtab") { UI.adtab = b.dataset.v; UI.adteam = ""; return render(true); }
  if (a === "addel") { savePhoto(b.dataset.key, null).then(() => { toast("Foto removida."); render(true); }).catch(() => toast("Não consegui remover (sem permissão ou sem internet).")); return; }
  if (a === "copyuid") { try { navigator.clipboard.writeText(ACC.user.uid); toast("ID copiado!"); } catch (e) { } return; }
  if (a === "profapply") { const mi = myMi(), P0 = getProf(); if (mi < 0) return; const patch = { t: "editme", mi, crest: mgrOf(PROF_MI).crest, kit: mgrOf(PROF_MI).kit }; if (P0.kit2) patch.kit2 = P0.kit2; if (S.phase === "lobby" && P0.team) patch.team = P0.team; UI.profHold = 0; act(patch); toast("Pronto: seu time desta sala está com o visual do perfil."); return; }
  if (a === "logout") { if (window.klAuth) window.klAuth.signOut(); UI.lprof = null; return; }
  if (a === "rejoin") { const c = b.dataset.code; return joinOnline(c, ($("#j-name") && $("#j-name").value) || store("kl_name") || "Presidente", ($("#j-team") && $("#j-team").value) || store("kl_team") || "Meu Time FC"); }
  if (a === "resumelocal") { const sv = savedLocal(); if (sv) loadLocal(sv); return; }
  if (a === "dellocal") { try { localStorage.removeItem("kl_save"); localStorage.removeItem("kl_save_at"); } catch (e) { } return render(); }
  if (a === "exportsave") return exportSave();
  if (a === "local") return startLocal();
  if (a === "lpadd") { const lp = $("#lp"); if (lp.children.length < 12) { const i = document.createElement("input"); i.className = "lp-name"; i.type = "text"; i.maxLength = 18; i.id = "lp" + lp.children.length; i.placeholder = "Jogador " + (lp.children.length + 1); lp.appendChild(i); i.focus(); } return; }
  if (a === "newsok") { store("kl_news", NEWS_V); return render(true); }
  if (a === "leave") return leave();
  if (a === "copyinvite") { const url = location.origin + location.pathname + "?sala=" + S.code; try { navigator.clipboard.writeText(url).then(() => toast("Link copiado!"), () => prompt("Copie o link:", url)); } catch (e) { prompt("Copie o link:", url); } return; }
  if (a === "rejoin") { if (NET.joinInfo) { NET.lastJoin = Date.now(); sendIntent({ t: "join", name: NET.joinInfo.name, team: NET.joinInfo.team }); toast("Pedido reenviado."); render(); } return; }
  if (a === "kick") return act({ t: "kick", mi: +b.dataset.mi });
  if (a === "editme") return act({ t: "editme", team: $("#me-team").value.trim() });
  const val = id => { const el = $(id); return el ? +el.value : undefined; };
  const sv = id => { const el = $(id); return el ? el.value : undefined; };
  const settings = () => readSettings();
  if (a === "setmode") { act(settings()); return act({ t: "settings", v: { mode: b.dataset.v } }); }
  if (a === "wcadd") { const mi = +b.dataset.mi, id = +b.dataset.id; const d = UI.wcd[mi] = UI.wcd[mi] || {}; const need = wcLeft(S, S.managers[mi]); if (Object.keys(d).length >= need) { toast(`Você só tem ${need} vaga${need > 1 ? "s" : ""} de wild card.`); return; } d[id] = Math.max(1, hid() ? 5 : Math.round(P(id).v)); return render(); }
  if (a === "wcdel") { const d = UI.wcd[+b.dataset.mi] || {}; delete d[+b.dataset.id]; return render(); }
  if (a === "wcsend") { const mi = +b.dataset.mi; const d = UI.wcd[mi] || {}; if (!wcValid(S, mi, d)) { toast("Propostas inválidas: confira o total e as vagas."); return; } act({ t: "wcbids", bids: d, mi }); UI.wcsent[S.wc.round + "-" + mi] = true; return render(); }
  if (a === "wcedit") { delete UI.wcsent[S.wc.round + "-" + (+b.dataset.mi)]; return render(); }
  if (a === "wcmi") { UI.wcMi = +b.dataset.mi; return render(); }
  if (a === "wcclose") return act({ t: "wcclose" });
  if (a === "ttog") { const side = b.dataset.side, id = +b.dataset.id; const l = UI.tr[side]; const k = l.indexOf(id); if (k >= 0) l.splice(k, 1); else l.push(id); return render(); }
  if (a === "tfrom") { UI.tr = { from: +b.dataset.mi, to: null, give: [], get: [], cf: 0, ct: 0 }; return render(); }
  if (a === "tto") { UI.tr.to = +b.dataset.mi; UI.tr.get = []; UI.tr.ct = 0; return render(); }
  if (a === "tsend") { const cf = +($("#t-cf") || {}).value || 0, ct = +($("#t-ct") || {}).value || 0; const o = { to: UI.tr.to, give: UI.tr.give.slice(), get: UI.tr.get.slice(), cf, ct }; act({ t: "tprop", o, mi: UI.tr.from }); UI.tr.give = []; UI.tr.get = []; UI.tr.cf = 0; UI.tr.ct = 0; toast("Proposta enviada."); return render(); }
  if (a === "tresp") return act({ t: "tresp", id: b.dataset.id, ok: b.dataset.ok === "1", mi: +b.dataset.mi });
  if (a === "tcancel") return act({ t: "tcancel", id: b.dataset.id, mi: +b.dataset.mi });
  if (a === "tclose" || a === "keepclose") return act({ t: a });
  if (a === "kpmi") { UI.kpMi = +b.dataset.mi; return render(); }
  if (a === "kptog") { const mi = +b.dataset.mi, id = +b.dataset.id, kind = b.dataset.kind; const d = UI.kp[mi]; const other = kind === "wc" ? "keep" : "wc"; d[other] = d[other].filter(x => x !== id); const l = d[kind], k = l.indexOf(id); if (k >= 0) l.splice(k, 1); else { const max = kind === "wc" ? S.keep.maxWC : S.keep.maxKeep; if (l.length >= max) { toast(`Máximo de ${max}.`); return; } l.push(id); } return render(); }
  if (a === "kpsend") { const mi = +b.dataset.mi; return act({ t: "keep", k: UI.kp[mi], mi }); }
  if (a === "takebot") { const nm = (getProf().name || store("kl_name") || "Presidente").slice(0, 18); act({ t: "takebot", mi: +b.dataset.mi, name: nm }); toast("Pedido enviado: assumindo o time…"); return; }
  if (a === "dsel") { UI.dsel = +b.dataset.id >= 0 ? +b.dataset.id : null; return render(); }
  if (a === "dpick") { const mi = NET.mode === "local" ? draftPicker(S) : myMi(); const pid = b.dataset.id ? +b.dataset.id : UI.dsel; UI.dsel = null; return act({ t: "dpick", pid, mi }); }
  if (a === "savesettings") return act(settings());
  if (a === "stp") { const k = b.dataset.k, cur = +(S.settings[k] != null ? S.settings[k] : (k === "tmin" ? 1 : 0)); const nv = Math.max(+b.dataset.min, Math.min(+b.dataset.max, cur + +b.dataset.d)); if (nv === cur) return; return act({ t: "settings", v: { [k]: nv } }); }
  if (a === "start") { act(settings()); return act({ t: "start" }); }
  if (a === "bid") { optimistic("bid", +b.dataset.mi, +b.dataset.amt); return act({ t: "bid", amount: +b.dataset.amt, mi: +b.dataset.mi }); }
  if (a === "pass") { optimistic("pass", +b.dataset.mi); return act({ t: "pass", mi: +b.dataset.mi }); }
  if (a === "pause" || a === "autofill" || a === "quickround" || a === "simstage") return act({ t: a });
  if (a === "ready") { const mi = +b.dataset.mi, fid = b.dataset.fid; if (NET.mode === "client" && S.season && S.season.rs) { S.season.rs.ready[fid + ":" + mi] = true; UI.optReady = { k: fid + ":" + mi, until: Date.now() + 6000 }; } act({ t: "ready", fid, mi }); b.disabled = true; b.textContent = "Pronto ✓"; return updateRoundBoard(); }
  if (a === "watch2") return setWatch(b.dataset.fid);
  if (a === "react") { const t = Date.now(); if (t - (UI.lastReact || 0) < 900) return; UI.lastReact = t; return act({ t: "m", a: { t: "mreact", e: b.dataset.e }, mi: NET.mode === "local" ? humansIdx()[0] : myMi() }); }
  if (a === "tab") { UI.tab = b.dataset.tab; return render(); }
  if (a === "editmi") { UI.editMi = +b.dataset.mi; return render(); }
  if (a === "crestmi") { UI.crestMi = +b.dataset.mi; return render(); }
  if (a === "vote") { const mi = +b.dataset.mi, v = b.dataset.v === "1"; if (NET.mode === "client") { S.votes = S.votes || {}; S.votes[mi] = v; render(true); } return act({ t: "vote", v, mi, next: !!S.settings.career }); }
  if (a === "relobby") return act({ t: "relobby" });
  if (a === "lu") return luTap(+b.dataset.mi, b.dataset.k);
  if (a === "chattog") { UI.chatOpen = !UI.chatOpen; renderChat(); if (UI.chatOpen) setTimeout(() => { const i = $("#chat-in"); if (i) i.focus(); }, 50); return; }
  if (a === "chatq") return sendChat(b.dataset.q);
  if (a === "ficha") { UI.ficha = UI.ficha === +b.dataset.id ? null : +b.dataset.id; return render(true); }
  if (a === "fichaall") { UI.fichaAll = !UI.fichaAll; return render(true); }
  if (a === "fasign" || a === "farel") return act({ t: a, id: +b.dataset.id, mi: +b.dataset.mi });
  if (a === "nextseason") return act({ t: "nextseason" });
  if (a === "replay") { if (LV.lastGoal) { LV.replay = { frames: LV.lastGoal.frames, i: 0 }; } return; }
  if (a === "ktog") { const m = mgrOf(+b.dataset.mi), k = (UI.kitTab === 2 ? m.kit2 || awayKit(m.kit) : m.kit) || {}, f = b.dataset.f, fl = b.dataset.flag; if (fl) return setKit(+b.dataset.mi, k[fl] ? { [fl]: false } : { [fl]: true, [f]: ($("#k-" + f) && $("#k-" + f).value) || b.dataset.def }); return setKit(+b.dataset.mi, { [f]: k[f] ? null : (($("#k-" + f) && $("#k-" + f).value) || b.dataset.def) }); }
  if (a === "ctog") { const m = mgrOf(+b.dataset.mi), c = m.crest || {}, f = b.dataset.f; const patch = { [f]: c[f] ? null : (($("#c-" + f) && $("#c-" + f).value) || b.dataset.def) }; if (f === "c4" && !c.c4 && (!c.pat2 || c.pat2 === "liso")) patch.pat2 = "faixa"; return setCrest(+b.dataset.mi, patch); }
  if (a === "looksave") { const m = mgrOf(+b.dataset.mi), P0 = getProf(), L = (P0.looks || []).slice(); if (L.length >= 12) return; const n = (($("#look-n") && $("#look-n").value) || "").trim().slice(0, 20) || ("Visual " + (L.length + 1)); L.push({ n, crest: JSON.parse(JSON.stringify(m.crest || {})), kit: JSON.parse(JSON.stringify(m.kit || {})), kit2: m.kit2 ? JSON.parse(JSON.stringify(m.kit2)) : null, at: Date.now() }); putProf({ looks: L }); toast("Visual salvo: " + n); return render(true); }
  if (a === "lookuse") { const x = (getProf().looks || [])[+b.dataset.k]; if (x) { useLook(+b.dataset.mi, x); toast("Usando o visual " + x.n); } return; }
  if (a === "lookdel") { const L = (getProf().looks || []).slice(); L.splice(+b.dataset.k, 1); putProf({ looks: L }); return render(true); }
  if (a === "crestrand") { const m = mgrOf(+b.dataset.mi); return setCrest(+b.dataset.mi, Object.assign(randCrestFull((m.crest && m.crest.txt) || initials(m.team)), { stars: (m.crest && m.crest.stars) || 0, spos: (m.crest && m.crest.spos) || "fora", ano: (m.crest && m.crest.ano) || "" })); }
  if (a === "kitrand") { const m = mgrOf(+b.dataset.mi), cur = (UI.kitTab === 2 ? m.kit2 : m.kit) || {}; return setKit(+b.dataset.mi, Object.assign(randKitFull(), { sp: cur.sp || "" })); }
  if (a === "kittab") { UI.kitTab = +b.dataset.v; return render(true); }
  if (a === "kitinvert") { const m = mgrOf(+b.dataset.mi); const k = m.kit || {}; return setKit(+b.dataset.mi, { c1: k.c2 || "#111111", c2: k.c1 || "#f5c542", pat: k.pat || "liso", num: k.c1 || "#ffffff" }); }
  if (a === "kitfromcrest") { const m = mgrOf(+b.dataset.mi); const c = m.crest || {}; return setKit(+b.dataset.mi, { c1: c.c1 || "#f5c542", c2: c.c2 || "#111111" }); }
  if (a === "crestpre") { const p = CREST_PRESETS[+b.dataset.k]; return setCrest(+b.dataset.mi, { shape: p.shape, c1: p.c1, c2: p.c2, pat: p.pat, icon: p.icon }); }
  if (a === "ord") { const mi = +b.dataset.mi, k = +b.dataset.k, d = +b.dataset.d; return tacChange(mi, tac => { const o = tac.order.filter(id => tac.slots.includes(id)); const j = k + d; if (j < 0 || j >= o.length) return; [o[k], o[j]] = [o[j], o[k]]; tac.order = o; }); }
  if (a === "watch") return openReplay(b.dataset.id);
  if (a === "vclose") return closeReplay();
  if (a === "showlive") { const ms = Object.values(LIVES); const M = ms.find(x => x.status === "playing" && myLiveTeams(x)) || ms.find(x => x.status === "playing") || ms[0]; if (M) setWatch(M.fid); return; }
  if (a === "hidelive" || a === "closelive") { UI.dismiss = UI.dismiss || {}; if (UI.watch) UI.dismiss[UI.watch] = true; UI.watch = null; LIVE = null; return renderLive(true); }
  // ao vivo
  if (a === "lcard") return act({ t: "m", a: { t: "mcard", ti: +b.dataset.ti, idx: +b.dataset.idx }, mi: liveMi(+b.dataset.ti) });
  if (a === "lpp") return act({ t: "m", a: { t: "mpp", ti: +b.dataset.ti }, mi: liveMi(+b.dataset.ti) });
  if (a === "lstyle") return act({ t: "m", a: { t: "mstyle", style: b.dataset.v, ti: +b.dataset.ti }, mi: liveMi(+b.dataset.ti) });
  if (a === "lsubpick") { const ti = +b.dataset.ti, id = +b.dataset.id; LV.subSel = LV.subSel || {}; if (b.dataset.side === "f") { LV.subSel[ti] = LV.subSel[ti] === id ? null : id; return renderCtrl(true); } const o = LV.subSel[ti]; if (!o) { toast("Primeiro toque em quem sai."); return; } LV.subSel[ti] = null; act({ t: "m", a: { t: "msub", out: o, in: id, ti }, mi: liveMi(ti) }); return renderCtrl(true); }
  if (a === "lsub") { const ti = +b.dataset.ti; const o = +$("#sub-out-" + ti).value, i = +$("#sub-in-" + ti).value; if (!o || !i) return; return act({ t: "m", a: { t: "msub", out: o, in: i, ti }, mi: liveMi(ti) }); }
  if (a === "lchoice") { UI.gate = null; return act({ t: "m", a: { t: "mchoice", f: b.dataset.f, v: b.dataset.f === "val" ? b.dataset.v : +b.dataset.v, ti: +b.dataset.ti }, mi: liveMi(+b.dataset.ti) }); }
  if (a === "lgate") { UI.gate = b.dataset.k; return renderLive(true); }
  if (a === "lspeed") { UI.speed = +b.dataset.v; return act({ t: "lspeed", v: +b.dataset.v }); }
  if (a === "lpause" || a === "lff") return act({ t: a });
});
function liveMi(ti) { return LIVE ? LIVE.t[ti].mi : -1; }
document.addEventListener("submit", e => { if (e.target && e.target.id === "lgform") { e.preventDefault(); emailSubmit(); } });
document.addEventListener("input", e => {
  if (e.target && (e.target.id === "pf-name" || e.target.id === "pf-team")) { const k = e.target.id === "pf-name" ? "name" : "team", v = e.target.value.slice(0, k === "name" ? 18 : 24); UI._pft = UI._pft || {}; clearTimeout(UI._pft[k]); UI._pft[k] = setTimeout(() => putProf({ [k]: v.trim() }), 400); }
  const el = e.target;
  if (el.classList && el.classList.contains("wcamt")) { const d = UI.wcd[+el.dataset.mi] = UI.wcd[+el.dataset.mi] || {}; d[+el.dataset.id] = Math.max(1, Math.floor(+el.value || 1)); clearTimeout(UI._wct); UI._wct = setTimeout(render, 600); }
  if (el.id === "ad-q") { UI.adq = el.value; clearTimeout(UI._adt); UI._adt = setTimeout(() => { render(true); const i = $("#ad-q"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); }
  if (el.id === "mq") { UI.mq = el.value; clearTimeout(UI._mqt); UI._mqt = setTimeout(render, 250); }
});
document.addEventListener("change", e => {
  const el = e.target, id = el.id;
  if (id === "loadsave" && el.files && el.files[0]) return importSave(el.files[0]);
  if (el.classList && el.classList.contains("ovsec")) { UI.ovrEd = UI.ovrEd || {}; (UI.ovrEd[el.dataset.id] = UI.ovrEd[el.dataset.id] || {}).sec = el.checked; const n = Object.keys(UI.ovrEd).length, b = document.querySelector('[data-a="ovrsave"]'); if (b) { b.disabled = !n; b.textContent = "Salvar " + n + " alteraç" + (n === 1 ? "ão" : "ões"); } return; }
  if (el.classList && el.classList.contains("ovin")) { // ajuste de over: atualiza só a célula, sem redesenhar a tela (não perde o lugar da lista)
    const pid = el.dataset.id, k = el.dataset.k, v = Math.max(k === "at" || k === "df" ? 30 : 50, Math.min(99, Math.round(+el.value || 0)));
    UI.ovrEd = UI.ovrEd || {}; (UI.ovrEd[pid] = UI.ovrEd[pid] || {})[k] = v; if (+el.value !== v) el.value = v;
    const orig = PLAYERS_ORIG ? PLAYERS_ORIG[pid][k] : null; el.classList.toggle("chg", orig != null && v !== orig);
    const n = Object.keys(UI.ovrEd).length, b = document.querySelector('[data-a="ovrsave"]'); if (b) { b.disabled = !n; b.textContent = "Salvar " + (n ? n + " alteraç" + (n === 1 ? "ão" : "ões") : "alterações"); }
    return;
  }
  if (id === "ad-ch") { UI.adch = el.value; return render(true); }
  if (id === "ad-team") { UI.adteam = el.value; return render(true); }
  if (id === "ad-sem") { UI.adsem = el.value; return render(true); }
  if (el.classList && el.classList.contains("ad-file") && el.files && el.files[0]) { const key = el.dataset.key; toast("Enviando foto…"); shrinkImage(el.files[0]).then(u => savePhoto(key, u)).then(() => { toast("Foto salva! Já aparece para todo mundo."); render(true); }).catch(() => toast("Não consegui salvar a foto (sem permissão ou sem internet).")); return; }
  if (id === "mpos") { UI.mpos = el.value; return render(); }
  if (id && id.startsWith("st-")) { const mi = +el.dataset.mi; if (NET.mode === "client" && S.managers[mi]) { const st = Object.assign({}, S.managers[mi].strat, { [el.dataset.k]: el.value }); S.managers[mi].strat = st; setLocal(mi, "strat", st); } return act({ t: "strat", [el.dataset.k]: el.value, mi }); }
  if (["s-fmt", "s-year", "s-staff", "s-trades", "s-hide", "s-career", "s-inj"].includes(id) && isHost()) return act(readSettings());
  if (id && /^c-/.test(id) && el.dataset.mi != null) { const f = id.slice(2), v = el.value; const val = f === "stars" ? +v : (f === "hn" || f === "nch") ? v === "1" : f === "fx" ? v.replace(/[<>&"']/g, "").slice(0, 28) : f === "txt" ? v.toUpperCase().replace(/[^A-Z0-9À-Ú]/g, "").slice(0, 3) : f === "ano" ? v.replace(/[^0-9]/g, "").slice(0, 4) : v; const patch = { [f]: val }; if (f === "g2" && (mgrOf(+el.dataset.mi).crest || {}).gr in { undefined: 1, nenhum: 1 }) patch.gr = "vertical"; if (f === "pat2" && v !== "liso" && !(mgrOf(+el.dataset.mi).crest || {}).c4) patch.c4 = ($("#c-c4") && $("#c-c4").value) || "#ffffff"; return setCrest(+el.dataset.mi, patch); }
  if (id && /^k-/.test(id) && el.dataset.mi != null) { const f = id.slice(2), v = el.value; const val = (f === "tr" || f === "bd") ? v === "1" : f === "sp" ? v.replace(/[<>&"']/g, "").slice(0, 12) : v; const patch = { [f]: val }; if (f === "pc") patch.pu = true; if (f === "g2") { const mm = mgrOf(+el.dataset.mi), kk = (UI.kitTab === 2 ? mm.kit2 : mm.kit) || {}; if (!kk.gr || kk.gr === "nenhum") patch.gr = "vertical"; } if (f === "pat2" && v !== "liso") { const m = mgrOf(+el.dataset.mi), k = (UI.kitTab === 2 ? m.kit2 : m.kit) || {}; if (!k.c3) patch.c3 = ($("#k-c3") && $("#k-c3").value) || "#ffffff"; } return setKit(+el.dataset.mi, patch); }
  if (id === "t-auto") return tacChange(+el.dataset.mi, tac => { tac.autoSub = el.checked; });
  if (id === "t-gkm") return tacChange(+el.dataset.mi, tac => { tac.gkMode = el.value; });
  if (id === "t-pk") return tacChange(+el.dataset.mi, tac => { tac.pk = el.value ? +el.value : null; });
  if (id === "t-form") return tacChange(+el.dataset.mi, tac => { tac.form = el.value; tac.slots = autoTac(S, +el.dataset.mi, el.value, tac.style, tac.gk).slots; });
  if (id === "t-style") return tacChange(+el.dataset.mi, tac => { tac.style = el.value; });
  if (id === "t-gk") return tacChange(+el.dataset.mi, tac => { const nv = +el.value; const s = tac.slots.indexOf(nv); if (s >= 0) tac.slots[s] = tac.gk; tac.gk = nv; });
  if (id && id.startsWith("t-s")) return tacChange(+el.dataset.mi, tac => { const i = +el.dataset.slot, nv = +el.value, old = tac.slots[i]; const j = tac.slots.indexOf(nv); if (j >= 0) { tac.slots[j] = old; tac.slots[i] = nv; } else { tac.slots[i] = nv; const oi = tac.order.indexOf(old); if (oi >= 0) tac.order[oi] = nv; } });
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#viewer").classList.contains("on")) closeReplay(); });

function boot(saved) {
  accountInit(); loadPhotos();
  try {
    const raw = saved && saved.S ? saved.S : JSON.parse(sessionStorage.getItem("kl_local2") || "null");
    if (raw && raw.mode === "local" && raw.v === 2) { S = raw; setPov(S.pov); NET.mode = "local"; NET.code = "LOCL"; startLoop(); }
  } catch (e) { }
  render(); initLive();
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot(() => (NET.mode === "local" ? { S } : {})); } catch (e) { }

document.addEventListener("change", e => { const t = e.target; if (t && (t.tagName === "SELECT" || t.type === "color")) { try { t.blur(); } catch (x) { } } }, true);
document.addEventListener("focusout", () => setTimeout(() => {
  if (UI.pendingRender && !editing($("#app"))) render();
  if (typeof LV !== "undefined" && LV.ctrlPending && !editing($("#l-ctrl"))) { LV.ctrlPending = false; renderCtrl(true); }
}, 40));
