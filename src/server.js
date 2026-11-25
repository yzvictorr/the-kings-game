/* ===== The Kings Game: servidor da sala (Cloudflare Durable Object) =====
   Cada sala é um "Room": o jogo roda AQUI, não no aparelho de ninguém. Os jogadores só mandam ações
   e recebem o estado pelo WebSocket. Se qualquer um (inclusive quem criou a sala) fechar o site,
   o jogo continua; o bot assume o time de quem saiu até ele voltar.
   Este arquivo é juntado com players.json + engine.js pelo build.py em server/worker.js. */

const FS_PROJECT = "kings-leilao", FS_KEY = "AIzaSyCGYnNyDzSFaxsPz1fRcUmzrLxwfMMCZrc";
const READY_MS = 60000, AWAY_GRACE = 10000, SILENT_MS = 40000;
const MARKET_PH = ["auction", "wc", "lottery", "draft", "staff", "trade", "keep"];
const HOST_ONLY = ["quickround", "simstage", "lspeed", "lpause", "lff"];
const LIVE_URGENT = { goal: 1, card: 1, pp: 1, penres: 1, dice: 1, so: 1, sores: 1, inj: 1, red: 1 };
const REACTS = ["🔥", "😂", "😱", "👏", "😡", "👑"];

// ---- ajustes do administrador (overs editados no site) ----
const SRV = { cfg: {}, cfgAt: 0, orig: null, cur: null };
function srvApplyOvr() {
  if (!SRV.orig) { SRV.orig = {}; PLAYERS.forEach(p => { SRV.orig[p.id] = { o: p.o, at: p.at, df: p.df, pot: p.pot, v: p.v }; }); }
  PLAYERS.forEach(p => { const b = SRV.orig[p.id], x = (SRV.cfg.ovr || {})[p.id]; Object.assign(p, b); if (x) { ["o", "at", "df", "pot"].forEach(k => { if (x[k] != null) p[k] = x[k]; }); ovrShift(p, b, x); p.v = Math.max(1, Math.round(1.25 * Math.exp((p.o - 64) * 0.13))); if (p.pot < p.o) p.pot = p.o; } });
  SRV.cur = null; // força recalcular a evolução da sala atual
}
// mudou só o over? ataque e defesa acompanham (senão um 99 de over jogaria igual ao original)
function ovrShift(p, b, x) { if (x.o == null) return; const d = x.o - b.o; if (x.at == null) p.at = Math.max(20, Math.min(99, b.at + d)); if (x.df == null) p.df = Math.max(20, Math.min(99, b.df + d)); }
async function srvLoadCfg(force) {
  if (!force && Date.now() - SRV.cfgAt < 600000) return;
  SRV.cfgAt = Date.now();
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents/admin/cfg?key=${FS_KEY}`);
    if (!r.ok) return;
    const d = await r.json(), j = d && d.fields && d.fields.j && d.fields.j.stringValue;
    if (j) { SRV.cfg = JSON.parse(j) || {}; srvApplyOvr(); }
  } catch (e) { }
}
// a evolução dos jogadores (carreira) fica numa variável do engine: troca para a sala certa antes de mexer
function useRoom(R) { if (SRV.cur !== R) { setPov(R.S && R.S.pov); SRV.cur = R; } }

const clone = o => JSON.parse(JSON.stringify(o));
// diferença entre o que já foi mandado e o estado novo: só vai o que mudou (economiza dados no celular)
const ARR_KEYS = { managers: 1, t: 1, fixtures: 1 };
function mkDiff(prev, obj, skip) {
  const d = {}, next = {}; let n = 0;
  for (const k of Object.keys(obj)) {
    if (skip && skip[k]) continue;
    const v = obj[k];
    if (Array.isArray(v) && ARR_KEYS[k]) {
      const arr = v.map(x => JSON.stringify(x === undefined ? null : x)); next[k] = arr; const p = prev && prev[k];
      if (Array.isArray(p) && p.length === arr.length) { const ch = {}; let c = 0; arr.forEach((x, i) => { if (x !== p[i]) { ch[i] = v[i]; c++; } }); if (c) { d[k] = { __i: ch }; n++; } }
      else { d[k] = v; n++; }
    } else if (k === "season" && v && typeof v === "object") { // a temporada tem a lista de jogos, que é grande: compara por dentro
      const sub = mkDiff(prev && prev[k] && prev[k].__o, v); next[k] = { __o: sub.next };
      if (!prev || !prev[k] || !prev[k].__o) { d[k] = v; n++; } else if (sub.n || sub.del.length) { d[k] = { __s: sub.d, __del: sub.del }; n++; }
    } else { const x = JSON.stringify(v === undefined ? null : v); next[k] = x; if (!prev || prev[k] !== x) { d[k] = v; n++; } }
  }
  const del = prev ? Object.keys(prev).filter(k => !(k in obj) && !(skip && skip[k])) : [];
  return { d, del, next, n };
}

export class Room {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.R = { S: null, LIVES: {}, speed: 1, paused: false };
    this.socks = new Set();          // conexões abertas
    this.last = {}; this.closedAt = {}; this.bye = {}; this.vis = {};
    this.dirty = false; this.urgent = false; this.ldirty = false; this.lurgent = false;
    this.lastS = 0; this.lastL = 0; this.lastSave = 0; this.saveDirty = false; this.lastAuc = 0; this.awayChk = 0;
    this.evSent = {}; this.levSeen = {}; this.loop = null; this.since = Date.now();
    state.blockConcurrencyWhile(async () => {
      await Promise.race([srvLoadCfg(), new Promise(r => setTimeout(r, 3000))]);
      try {
        const s = await state.storage.get("S"), l = await state.storage.get("L"), o = await state.storage.get("O");
        if (s) this.R.S = JSON.parse(s);
        if (l) this.R.LIVES = JSON.parse(l) || {};
        if (o) Object.assign(this.R, JSON.parse(o));
      } catch (e) { }
    });
  }

  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("The Kings Game: sala " + (this.R.S ? this.R.S.code : "vazia"), { headers: { "content-type": "text/plain; charset=utf-8" } });
    const pair = new WebSocketPair(), [client, ws] = Object.values(pair);
    ws.accept();
    ws.pid = null;
    this.socks.add(ws);
    ws.addEventListener("message", ev => { try { this.onMsg(ws, JSON.parse(ev.data)); } catch (e) { } });
    const gone = () => { if (!this.socks.has(ws)) return; this.socks.delete(ws); if (ws.pid) { this.closedAt[ws.pid] = Date.now(); } this.awayChk = 0; };
    ws.addEventListener("close", gone); ws.addEventListener("error", gone);
    this.startLoop();
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm() {
    // vigia: enquanto tem gente conectada, garante que o relógio do jogo está rodando e salva
    srvLoadCfg().catch(() => { });
    if (this.socks.size) { this.startLoop(); await this.save(true); await this.state.storage.setAlarm(Date.now() + 30000); }
    else await this.save(true);
  }

  send(ws, o) { try { ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch (e) { } }
  all(o) { const s = JSON.stringify(o); this.socks.forEach(ws => { if (ws.ok) this.send(ws, s); }); }

  online(pid, t) {
    if (!pid) return false;
    for (const ws of this.socks) if (ws.pid === pid && t - (this.last[pid] || 0) < SILENT_MS) return true;
    if (this.bye[pid]) return false;
    const c = this.closedAt[pid]; return !!c && t - c < AWAY_GRACE && t - (this.last[pid] || 0) < SILENT_MS;
  }

  onMsg(ws, m) {
    const R = this.R, t = Date.now();
    if (!m || typeof m !== "object") return;
    if (m.t === "hello") {
      const pid = String(m.pid || "").slice(0, 40); if (!pid) return;
      ws.pid = pid; this.last[pid] = t; delete this.bye[pid]; delete this.closedAt[pid]; if (m.vis != null) this.vis[pid] = !!m.vis;
      if (m.create) {
        if (R.S && R.S.managers && R.S.managers.length) { if (R.S.hostPid === pid || R.S.owner === pid) { this.welcome(ws); return; } return this.send(ws, { t: "taken" }); }
        const c = m.create;
        R.S = newGame(String(m.code || "XXXX").slice(0, 4), pid, String(c.name || "Presidente").slice(0, 18), String(c.team || "Meu Time FC").slice(0, 24), "online");
        R.S.owner = pid; R.S.srv = 1; R.LIVES = {}; this.prevS = null; this.prevRev = null; this.prevL = {}; this.evSent = {}; R.speed = 1; R.paused = false;
        SRV.cur = null; useRoom(R);
        const df = Object.assign({}, SRV.cfg.defaults || {}, c.defaults || {});
        if (Object.keys(df).length) { try { applyAction(R.S, { t: "settings", v: df }, 0, true, t); } catch (e) { } }
        this.commit(true); this.save(true);
      }
      if (!R.S) return this.send(ws, { t: "nf" });
      this.welcome(ws); this.awayChk = 0;
      return;
    }
    const pid = ws.pid; if (!pid || !R.S) return;
    this.last[pid] = t;
    if (m.vis != null) { const v = !!m.vis; if (this.vis[pid] !== v) { this.vis[pid] = v; } }
    if (m.t === "hb") return;
    if (m.t === "bye") { this.bye[pid] = true; this.awayChk = 0; return; }
    if (m.t === "ev") { this.sendEv(ws, String(m.fid)); return; }
    if (m.t === "full") { this.sendLive(ws, true); return; }
    if (m.t === "cfg") { // o administrador salvou ajustes: recarrega e avisa todo mundo da sala na hora
      if (t - (this.cfgAt || 0) < 1500) return; this.cfgAt = t;
      srvLoadCfg(true).then(() => { SRV.cur = null; this.all({ t: "cfg", ovr: SRV.cfg.ovr || {}, msg: SRV.cfg.msg || null }); this.writeLive(true); }).catch(() => { });
      return;
    }
    if (m.t === "fullS") { if (this.dirty) this.sendS(t); this.send(ws, { t: "S", S: R.S }); return; }
    if (m.t === "in") { this.intents(pid, Array.isArray(m.q) ? m.q : [m]); return; }
  }

  welcome(ws) {
    const R = this.R, t = Date.now();
    if (this.dirty || !this.prevS) this.sendS(t); // manda antes a mudança pendente para todos ficarem na mesma base
    if (this.ldirty) { this.ldirty = false; this.lastL = t; this.sendLive(null, false); }
    this.send(ws, { t: "S", S: R.S }); ws.ok = true;
    this.sendLive(ws, true);
  }
  sendS(t) {
    const S = this.R.S; this.dirty = false; this.urgent = false; this.lastS = t; S.hostNow = t;
    const base = this.prevRev, df = mkDiff(this.prevS, S);
    this.prevS = df.next; this.prevRev = S.rev;
    if (base == null) this.all({ t: "S", S }); else this.all({ t: "Sd", base, rev: S.rev, d: df.d, del: df.del });
  }

  async sendEv(ws, fid) {
    let ev = null;
    const M = this.R.LIVES[fid]; if (M && M.ev) ev = M.ev;
    if (!ev) { try { const j = await this.state.storage.get("ev:" + fid); if (j) ev = JSON.parse(j); } catch (e) { } }
    this.send(ws, { t: "ev", fid, ev: ev || null });
  }

  // ---- ações dos jogadores ----
  intents(pid, q) {
    const R = this.R, S = R.S; useRoom(R);
    S.seqs = S.seqs || {};
    let changed = false, touched = false;
    q.slice().sort((x, y) => x.s - y.s).forEach(it => {
      if (!it || typeof it.s !== "number" || it.s <= (S.seqs[pid] || 0)) return;
      S.seqs[pid] = it.s; touched = true;
      const a = Object.assign({}, it.a || {}), t = Date.now();
      if (a.t === "join" || a.t === "takebot") a.pid = pid;
      const adm = pid === S.hostPid;
      if (HOST_ONLY.includes(a.t)) { if (adm) this.hostAction(a); return; }
      const mi = S.managers.findIndex(m => m.pid === pid);
      if (a.t === "m") { this.lurgent = true; this.liveAct(a.a || {}, mi); return; }
      let ok = false; try { ok = applyAction(S, a, mi, adm, t); } catch (e) { ok = false; }
      if (ok) { changed = true; if (a.t === "takebot") Object.values(R.LIVES).forEach(M => M.t.forEach(T => { if (T.mi === a.mi) { T.cpu = false; T.bot = false; } })); if (a.t === "join" || a.t === "takebot") this.awayChk = 0; }
    });
    if (changed) this.commit(true); else if (touched) { this.saveDirty = true; }
  }

  commit(urgent) {
    const R = this.R, S = R.S; if (!S) return;
    if (S.phase === "lobby" && Object.keys(R.LIVES).length) { R.LIVES = {}; this.evSent = {}; this.writeLive(true); }
    S.rev = (S.rev || 0) + 1;
    this.dirty = true; this.saveDirty = true; if (urgent) this.urgent = true;
  }
  writeLive(urgent) { this.ldirty = true; this.saveDirty = true; if (urgent) this.lurgent = true; }

  // ---- relógio do jogo ----
  startLoop() {
    if (this.loop) return;
    this.loop = setInterval(() => this.tick(), 100);
    this.state.storage.setAlarm(Date.now() + 30000).catch(() => { });
  }
  tick() {
    const R = this.R, S = R.S, t = Date.now();
    if (!this.socks.size) { // ninguém conectado: guarda o jogo e para o relógio (continua quando alguém voltar)
      if (t - Math.max(...Object.values(this.closedAt), this.since) > 15000) { clearInterval(this.loop); this.loop = null; this.save(true); }
      return;
    }
    if (!S) return;
    try {
      useRoom(R);
      if (MARKET_PH.includes(S.phase) && t - this.lastAuc > 450) { this.lastAuc = t; if (marketTick(S, t)) this.commit(); }
      if (S.phase === "season") this.roundTick(t);
      Object.values(R.LIVES).forEach(M => { if (M.status === "playing") this.liveLoop(M, t); });
      if (t - this.awayChk > 2000) { this.awayChk = t; this.awayCheck(t); }
    } catch (e) { }
    this.flush(t);
  }

  flush(t) {
    const R = this.R, S = R.S;
    if (this.dirty && t - this.lastS >= (this.urgent ? 120 : 1000)) this.sendS(t);
    if (this.ldirty) {
      if (!this.lurgent) for (const M of Object.values(R.LIVES)) { const e = M.ev && M.ev[M.ev.length - 1]; if (e && e.i > (this.levSeen[M.fid] || 0) && LIVE_URGENT[e.type]) this.lurgent = true; if (e) this.levSeen[M.fid] = e.i; }
      if (t - this.lastL >= (this.lurgent ? 120 : 600)) { this.ldirty = false; this.lurgent = false; this.lastL = t; this.sendLive(null, false); }
    }
    if (this.saveDirty && t - this.lastSave > 3000) this.save();
  }
  // manda as partidas ao vivo; para não pesar no celular, os lances (ev) vão só os novos
  sendLive(ws, full) {
    const R = this.R, ms = {}, prevL = this.prevL = this.prevL || {}, nextL = {};
    Object.entries(R.LIVES).forEach(([fid, M]) => {
      const ev = M.ev || [];
      if (full) { ms[fid] = { M }; return; }
      const df = mkDiff(prevL[fid], M, { ev: 1 }); nextL[fid] = df.next;
      const from = this.evSent[fid] || 0;
      if (!prevL[fid]) ms[fid] = { M };
      else ms[fid] = { d: df.d, del: df.del, evFrom: from, ev: ev.slice(from) };
      this.evSent[fid] = ev.length;
    });
    if (!full) this.prevL = nextL;
    const d = { t: "L", ms, hostNow: Date.now(), full: !!full };
    if (ws) this.send(ws, d); else this.all(d);
  }
  async save(now) {
    if (!this.R.S || (!this.saveDirty && !now)) return;
    this.saveDirty = false; this.lastSave = Date.now();
    try { await this.state.storage.put({ S: JSON.stringify(this.R.S), L: JSON.stringify(this.R.LIVES), O: JSON.stringify({ speed: this.R.speed, paused: this.R.paused }) }); } catch (e) { this.saveDirty = true; }
  }

  // ---- quem saiu: bot assume; quem voltou: reassume ----
  awayCheck(t) {
    const R = this.R, S = R.S, A = S.away = S.away || {}; let ch = false;
    S.managers.forEach((m, i) => {
      if (m.cpu) { if (A[i]) { delete A[i]; ch = true; } return; }
      const on = this.online(m.pid, t);
      if (!on && !A[i] && S.phase !== "lobby" && t - this.since > 12000) { A[i] = true; ch = true; addLog(S, `${m.name} saiu da sala. Um bot assume o ${m.team} até ele voltar.`); }
      if (on && A[i]) { delete A[i]; ch = true; addLog(S, `${m.name} voltou e reassumiu o ${m.team}!`); }
    });
    // os botões de "anfitrião" (configurar, começar, pular...) ficam com quem criou a sala;
    // se ele sair, passam para outro jogador conectado e voltam quando ele voltar
    const own = S.owner && S.managers.some(m => m.pid === S.owner) ? S.owner : null;
    if (own && S.hostPid !== own && this.online(own, t)) { S.hostPid = own; ch = true; }
    else if (!this.online(S.hostPid, t) && t - this.since > 12000) {
      const c = S.managers.find((m, i) => !m.cpu && !A[i] && this.online(m.pid, t));
      if (c && c.pid !== S.hostPid) { S.hostPid = c.pid; ch = true; addLog(S, `${c.name} ficou com os controles da sala enquanto o criador está fora.`); }
    }
    Object.values(R.LIVES).forEach(M => M.t.forEach(T => { const b = isBot(S, T.mi); if (T.cpu !== b) { T.cpu = b; if (b) T.autoSub = true; ch = true; } }));
    if (ch) { this.commit(true); this.writeLive(true); }
  }

  // ---- campeonato: rodadas simultâneas ----
  hostAction(a) {
    const R = this.R, S = R.S; if (!S) return;
    if (a.t === "lspeed") { const v = [1, 2, 4].includes(a.v) ? a.v : 1; R.speed = v; Object.values(R.LIVES).forEach(M => M.speed = v); this.writeLive(true); return; }
    if (a.t === "lpause") { const p = !Object.values(R.LIVES).some(M => M.paused); Object.values(R.LIVES).forEach(M => M.paused = p); R.paused = p; this.writeLive(true); return; }
    if (!S.season) return;
    if (["quickround", "simstage"].includes(a.t)) {
      if (S.phase !== "season") return;
      Object.values(R.LIVES).forEach(M => { let g = 0; while (M.status === "playing" && g++ < 6000) stepMatch(M, Date.now(), true); const f = S.season.fixtures.find(x => x.id === M.fid); if (f && !f.res) this.finishFixture(f, M); });
      R.LIVES = {}; this.evSent = {}; this.writeLive(true);
      if (a.t === "quickround") { roundFixtures(S).filter(f => !f.res).forEach(f => this.finishFixture(f, simMatchInstant(S, f))); advanceRound(S); }
      else { const st0 = S.season.stage; let g = 0; while (S.phase === "season" && S.season.stage === st0 && g++ < 60) { roundFixtures(S).filter(f => !f.res).forEach(f => this.finishFixture(f, simMatchInstant(S, f))); advanceRound(S); } }
      this.commit(true); return;
    }
    if (a.t === "lff") {
      const M = a.fid != null ? R.LIVES[a.fid] : null; if (!M || M.status !== "playing") return;
      let g = 0; while (M.status === "playing" && g++ < 5000) stepMatch(M, Date.now(), true);
      this.onLiveDone(M); return;
    }
  }
  roundTick(t) {
    const R = this.R, S = R.S, se = S.season; if (!se || se.stage === "done") return;
    let ch = false;
    const key = se.stage + "-" + se.round;
    if (!se.rs || se.rs.key !== key) { se.rs = { key, ready: {}, av: {} }; ch = true; }
    const rs = se.rs, fx = roundFixtures(S);
    const busy = new Set(); Object.values(R.LIVES).forEach(M => { if (M.status === "playing") M.t.forEach(T => busy.add(T.mi)); });
    fx.forEach(f => {
      if (f.res || R.LIVES[f.id] || busy.has(f.h) || busy.has(f.a)) return;
      if (!rs.av[f.id]) { rs.av[f.id] = t + READY_MS; ch = true; }
      const rd = mi => isBot(S, mi) || rs.ready[f.id + ":" + mi] || this.vis[S.managers[mi].pid] === false;
      if ((rd(f.h) && rd(f.a)) || t > rs.av[f.id]) { this.startLive(f, t); busy.add(f.h); busy.add(f.a); ch = true; }
    });
    if (fx.length && fx.every(f => f.res) && !Object.values(R.LIVES).some(M => M.status === "playing")) {
      if (!rs.doneAt) { rs.doneAt = t; ch = true; }
      else if (t - rs.doneAt > 9000) { R.LIVES = {}; this.evSent = {}; this.writeLive(true); advanceRound(S); ch = true; }
    }
    if (ch) this.commit(true);
  }
  finishFixture(f, M) {
    f.res = matchResult(M);
    try { this.state.storage.put("ev:" + f.id, JSON.stringify(M.ev || [])); } catch (e) { }
  }
  startLive(f, t) {
    const R = this.R, M = newMatch(R.S, f); attachRosters(R.S, M);
    M.speed = R.speed || 1; M.paused = !!R.paused; M.holdUntil = t + 2500; M._next = 0;
    R.LIVES[f.id] = M; this.evSent[f.id] = 0;
    this.writeLive(true);
  }
  liveLoop(M, t) {
    if (M.paused) return;
    if (M.pending) { const before = M.seq; stepMatch(M, t, false); if (M.seq !== before || !M.pending) this.afterStep(M, t); return; }
    if (t < (M.holdUntil || 0) || t < (M._next || 0)) return;
    M._next = t + ({ 1: 900, 2: 450, 4: 170 }[M.speed || 1] || 900);
    stepMatch(M, t, false);
    this.afterStep(M, t);
  }
  afterStep(M, t) {
    if (M.hold) { M.holdUntil = t + M.hold * (M.speed === 4 ? 0.5 : M.speed === 2 ? 0.75 : 1); M.hold = 0; }
    if (M.status === "done") return this.onLiveDone(M);
    this.writeLive();
  }
  onLiveDone(M) {
    const S = this.R.S, f = S.season.fixtures.find(x => x.id === M.fid);
    if (f && !f.res) this.finishFixture(f, M);
    this.writeLive(true); this.commit(true);
  }
  liveAct(a, mi) {
    const R = this.R, S = R.S;
    let M = a.fid != null ? R.LIVES[a.fid] : null;
    if (!M) M = Object.values(R.LIVES).find(x => x.status === "playing" && x.t.some(T => T.mi === mi));
    if (M && a.t === "mreact" && REACTS.includes(a.e) && mi >= 0) {
      const t = Date.now(); M.rlast = M.rlast || {}; if (t - (M.rlast[mi] || 0) < 900) return; M.rlast[mi] = t;
      M.rseq = (M.rseq || 0) + 1; M.reacts = (M.reacts || []).concat({ i: M.rseq, e: a.e, n: S.managers[mi].name, c: S.managers[mi].color }).slice(-8);
      this.writeLive(true); return;
    }
    if (!M || M.status !== "playing") return;
    const ti = M.t.findIndex(T => T.mi === mi);
    if (ti < 0 || M.t[ti].cpu) return;
    if (matchAction(M, ti, a, Date.now())) this.afterStep(M, Date.now());
    this.lurgent = true;
  }
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const m = u.pathname.match(/^\/room\/([A-Za-z]{4})$/);
    if (m) return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(req);
    return new Response("The Kings Game: servidor das salas no ar.", { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*" } });
  }
};
