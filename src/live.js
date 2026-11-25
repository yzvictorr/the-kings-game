/* ===== PARTIDA AO VIVO: tela, campo animado, animações e escolhas ===== */
const LV = { fid: null, animSeq: 0, queue: [], playing: false, sigCtrl: "", sigPrompt: "", sigFeed: -1, canvas: null, ctx: null, rp: {}, ball: { x: .5, y: .5 }, parts: [], shake: 0, goalFlash: null };

function initLive() {
  const root = $("#live");
  root.innerHTML = `<div class="lbox">
    <div class="row" style="justify-content:space-between;gap:8px"><span class="phase" id="l-stage"></span><div class="row" id="l-host" style="gap:6px"></div></div>
    <div class="sbstrip" id="l-sb"></div>
    <div class="lgrid">
      <div class="lmain">
        <div class="board" id="l-board"></div>
        <div class="pitchwrap"><canvas id="pitch" width="900" height="520" aria-label="Campo da partida"></canvas><div id="ovl" class="ovl"></div></div>
        <div class="timeline" id="l-tl" aria-hidden="true"></div>
        <div class="reacts" id="l-reacts">${REACTS.map(e => `<button class="rbtn" data-a="react" data-e="${e}" aria-label="Reagir ${e}">${e}</button>`).join("")}</div>
      </div>
      <div class="lside">
        <div id="l-prompt"></div>
        <div id="l-ctrl" class="lctrl"></div>
        <div id="l-feed" class="feed"></div>
      </div>
    </div>
  </div>`;
  LV.canvas = $("#pitch"); LV.ctx = LV.canvas.getContext("2d");
  requestAnimationFrame(frame);
}
function liveVisible() { return LIVE && LIVE.status && !UI.hideLive; }
function renderLive(force) {
  const root = $("#live");
  if (!LIVE || !LIVE.status || LIVE.status === "none") { const was = LV.fid != null || root.classList.contains("on"); root.classList.remove("on"); document.body.style.overflow = ""; LV.fid = null; if (was && S) render(); return; }
  if (LV.fid !== LIVE.fid) {
    LV.fid = LIVE.fid; LV.rp = {}; LV.queue = []; LV.parts = []; UI.hideLive = false; UI.gate = null; LV.hist = []; LV.lastGoal = null; LV.replay = null;
    LV.animSeq = LIVE.seq > 4 ? LIVE.seq : 0; LV.sigCtrl = ""; LV.sigPrompt = ""; LV.sigFeed = -1;
    if (S) render();
  }
  if (UI.hideLive) { root.classList.remove("on"); document.body.style.overflow = ""; return; }
  root.classList.add("on"); document.body.style.overflow = "hidden";
  const M = LIVE, H = M.t[0], A = M.t[1];
  $("#l-sb").innerHTML = liveStrip();
  $("#l-stage").textContent = (M.stage === "Liga" ? `Rodada ${M.round + 1}` : M.stage) + (M.status === "done" ? " · encerrado" : " · ao vivo");
  const host = isHost();
  $("#l-host").innerHTML = (host && M.status === "playing" ? `${[1, 2, 4].map(s => `<button class="btn sm ${(M.speed || 1) === s ? "gold" : ""}" data-a="lspeed" data-v="${s}">${s}x</button>`).join("")}
    <button class="btn sm" data-a="lpause">${M.paused ? "Continuar" : "Pausar"}</button><button class="btn sm ghost" data-a="lff">Simular até o fim</button>` : "")
    + (LV.lastGoal ? `<button class="btn sm" data-a="replay" title="Rever o último gol">▶ Replay: ${esc(shortName(LV.lastGoal.who || "gol"))}</button>` : "")
    + (isAdmin() ? `<button class="btn sm ghost" data-a="liveadm" title="Abrir a tela do administrador sem sair da partida">⚙️ Adm</button>` : "")
    + `<button class="btn sm ghost" data-a="hidelive">${M.status === "done" ? "Fechar" : "Minimizar"}</button>`;
  const ph = phaseLabel(M);
  const mm = Math.floor(M.min), ss = Math.round((M.min - mm) * 60);
  $("#l-board").innerHTML = `<div class="tn" style="color:${H.color}"><span class="bcrest">${crestSVG(S && S.managers[H.mi] ? tcrest(S.managers[H.mi]) : null, 34)}</span>${esc(H.name)}<small>pres. ${esc(H.pres)} · ${M.t[0].tac.form} · ${STYLES[H.tac.style].n}</small></div>
    <div><div class="score num">${M.score[0]}<span class="muted">:</span>${M.score[1]}</div>
    <div class="min num">${M.status === "done" ? "FIM" : M.phase === "so" ? "SHOOTOUTS" : (mm >= 36 ? "36'+" : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`)}</div>
    ${M.so ? `<div class="muted num" style="text-align:center">shootouts ${M.so[0]}-${M.so[1]}</div>` : ""}
    <div style="text-align:center;margin-top:6px"><span class="phase ${ph.k}">${esc(ph.t)}</span>${M.paused ? ' <span class="phase mb">pausado</span>' : ""}</div></div>
    <div class="tn" style="text-align:right;color:${A.color}"><span class="bcrest">${crestSVG(S && S.managers[A.mi] ? tcrest(S.managers[A.mi]) : null, 34)}</span>${esc(A.name)}<small>pres. ${esc(A.pres)} · ${A.tac.form} · ${STYLES[A.tac.style].n}</small></div>`;
  const zone = (a, b, c) => `<div class="z" style="left:${a / 40 * 100}%;width:${(b - a) / 40 * 100}%;background:${c}"></div>`;
  $("#l-tl").innerHTML = zone(0, 6, "rgba(76,201,240,.35)") + zone(6, 17, "rgba(179,146,240,.25)") + zone(17, 20, "rgba(245,197,66,.6)") + zone(20, 23, "rgba(47,212,126,.45)") + zone(23, 36, "rgba(179,146,240,.25)") + zone(36, 40, "rgba(255,77,97,.5)") + `<div class="cur" style="left:${Math.min(39.6, M.min) / 40 * 100}%"></div>`;
  renderPrompt(force); renderCtrl(force); renderFeed(); showReacts(M);
  queueAnims();
}
function phaseLabel(M) {
  if (M.status === "done") return { k: "", t: "Fim de jogo" };
  const n = M.nOut;
  return {
    esc: { k: "", t: `Escalonado ${n}x${n}` }, full: { k: "", t: inWindow(M.min) ? "7x7 · cartas liberadas" : "7x7" }, dob: { k: "dob", t: "Gol dobro (17'-20')" },
    dice: { k: "dice", t: M.dice === 1 ? "Dado: 1x1 com goleiro" : `Dado: ${M.dice}x${M.dice}` }, mb: { k: "mb", t: `Match ball ${MB_LBL[Math.max(0, Math.min(4, M.mbStep))]} · primeiro a ${M.target}` }, so: { k: "mb", t: "Shootouts" }
  }[M.phase] || { k: "", t: "" };
}
function myTeams(M) { // índices de times que este aparelho controla
  if (NET.mode === "local") return [0, 1].filter(ti => !M.t[ti].cpu);
  const mi = myMi(); return [0, 1].filter(ti => M.t[ti].mi === mi && !M.t[ti].cpu);
}

/* ---------- escolhas (pênalti, shootout, coringa) ---------- */
function renderPrompt(force) {
  const M = LIVE, el = $("#l-prompt");
  const p = M.status === "playing" ? M.pending : null;
  const need = p ? chooser(M) : [];
  const mine = myTeams(M);
  const sig = p ? `${M.seq}|${p.k}|${need.map(n => n.team + n.f).join(",")}|${UI.gate}` : "none";
  if (sig === LV.sigPrompt && !force) return;
  LV.sigPrompt = sig;
  if (!p) { el.innerHTML = ""; return; }
  const T = M.t[p.team], O = M.t[1 - p.team];
  const mineNeed = need.filter(n => mine.includes(n.team));
  const pickT = { star: `Star Player: ${esc(T.name)} escolhe o jogador`, sus: `Suspensão: ${esc(T.name)} escolhe quem do ${esc(O.name)} sai`, rev: `Pênalti reverso: ${esc(T.name)} escolhe quem do ${esc(O.name)} vai bater`, cur: `Coringa do ${esc(T.name)}: escolha a carta` };
  const title = p.k === "pen" ? (p.pres ? `Pênalti do presidente: ${esc(T.pres)} (${esc(T.name)})` : p.rev != null ? `Pênalti reverso: ${esc(P(p.shooter).n)} (${esc(T.name)}) bate. Se errar, é gol do ${esc(O.name)}!` : `Pênalti: ${esc(P(p.shooter).n)} (${esc(T.name)})`)
    : p.k === "so" ? `Shootout: ${esc(P(p.shooter).n)} (${esc(T.name)}) contra ${esc(P(O.tac.gk) ? P(O.tac.gk).n : "goleiro")}`
      : p.k === "steal" ? `${esc(O.name)} ativou ${esc(CARDS[p.card].name)}! ${esc(T.name)} tem o Coringa e pode roubar a carta`
      : pickT[p.f] || "Escolha";
  let body = "";
  if (!mineNeed.length) body = `<p class="muted" style="margin:0">Aguardando ${need.map(n => esc(M.t[n.team].name)).join(" e ")} escolher… <span id="pcount" class="num"></span></p>`;
  else {
    const n = mineNeed[0], key = `${M.seq}-${n.team}-${n.f}`;
    const gateNeeded = NET.mode === "local" && mine.length > 1 && p.k !== "pick";
    if (gateNeeded && UI.gate !== key) body = `<div class="row"><b>Vez de ${esc(M.t[n.team].name)} escolher.</b> <span class="muted">O outro não olha!</span><button class="btn gold" data-a="lgate" data-k="${key}">Estou pronto</button></div>`;
    else body = choiceUI(p, n) + `<div class="muted" style="font-size:13px;margin-top:6px">Tempo: <span id="pcount" class="num"></span> · se acabar, escolho aleatório.</div>`;
  }
  el.innerHTML = `<div class="prompt"><h3 style="font-size:22px;margin-bottom:8px">${title}</h3>${body}</div>`;
  tickClocks();
}
function choiceUI(p, n) {
  const ti = n.team;
  if (n.f === "shot") return `<p class="muted" style="margin:0 0 8px">Escolha onde bater. Cantos de cima são mais difíceis de defender, mas podem ir pra fora.</p>
    <div class="goalpick">${[0, 1, 2, 3, 4, 5].map(z => `<button class="gz" data-a="lchoice" data-f="shot" data-v="${z}" data-ti="${ti}" aria-label="${["Alto esquerdo", "Alto meio", "Alto direito", "Baixo esquerdo", "Baixo meio", "Baixo direito"][z]}">${["↖", "↑", "↗", "↙", "↓", "↘"][z]}</button>`).join("")}</div>`;
  if (n.f === "dive") return `<p class="muted" style="margin:0 0 8px">Você é o goleiro. Para onde pular?</p>
    <div class="row">${["Pular à esquerda", "Ficar no meio", "Pular à direita"].map((t, i) => `<button class="btn big" data-a="lchoice" data-f="dive" data-v="${i}" data-ti="${ti}">${t}</button>`).join("")}</div>`;
  if (n.f === "att") return `<p class="muted" style="margin:0 0 8px">Saindo do meio-campo, 1x1 com o goleiro. O que fazer?</p>
    <div class="row">${SO_ATT.map((t, i) => `<button class="btn big" data-a="lchoice" data-f="att" data-v="${i}" data-ti="${ti}">${t}</button>`).join("")}</div>
    <p class="muted" style="font-size:12.5px;margin:6px 0 0">Chute de longe vence quem sai no abafa. Drible vence quem fica na linha. Cavadinha vence quem fecha o ângulo.</p>`;
  if (n.f === "gk") return `<p class="muted" style="margin:0 0 8px">Você é o goleiro no shootout. Como defender?</p>
    <div class="row">${SO_GK.map((t, i) => `<button class="btn big" data-a="lchoice" data-f="gk" data-v="${i}" data-ti="${ti}">${t}</button>`).join("")}</div>`;
  if (n.f === "val") {
    if (p.f === "cur") return `<p class="muted" style="margin:0 0 8px">O Coringa vira qualquer carta, ou rouba a do rival.</p><div class="row">${p.opts.map(k => `<button class="btn ${k === "ROUBAR" ? "gold" : ""}" data-a="lchoice" data-f="val" data-v="${k}" data-ti="${ti}" title="${k === "ROUBAR" ? "Pega a carta do rival e usa a seu favor" : esc(CARDS[k].desc)}">${k === "ROUBAR" ? "Roubar a carta do rival" : esc(CARDS[k].name)}</button>`).join("")}</div>`;
    const hint = { star: "O próximo gol dele vale 2.", sus: "Ele fica 2 minutos fora.", rev: "Escolha quem tem mais chance de errar!" }[p.f];
    return `<p class="muted" style="margin:0 0 8px">${hint}</p><div class="row">${p.opts.map(id => `<button class="btn" data-a="lchoice" data-f="val" data-v="${id}" data-ti="${ti}">${posb(P(id).p)} ${esc(P(id).n)} <span class="muted num">${O(P(id))}</span></button>`).join("")}</div>`;
  }
  if (n.f === "yes") return `<p class="muted" style="margin:0 0 8px">O rival ativou <b>${esc(CARDS[p.card].name)}</b>: ${esc(CARDS[p.card].desc)} Você tem o CORINGA: quer roubar essa carta e usar a favor do seu time? Se roubar, o seu Coringa é gasto.</p>
    <div class="row"><button class="btn gold big" data-a="lchoice" data-f="yes" data-v="1" data-ti="${ti}">Roubar!</button><button class="btn big" data-a="lchoice" data-f="yes" data-v="0" data-ti="${ti}">Guardar</button></div>`;
  return "";
}

/* ---------- painel de controle do técnico ---------- */
function renderCtrl(force) {
  const M = LIVE, el = $("#l-ctrl");
  const mine = myTeams(M);
  const sig = JSON.stringify([M.status, mine, mine.map(ti => { const T = M.t[ti]; return [T.cards, T.ppUsed, T.star, T.dobLeft > 0, T.out.filter(o => o.until > M.min).length, T.tac, T.field, T.bench, T.autoSub, T.gkMode, T.gkOut, canActCard(M, ti), canActPP(M, ti), (T.tac.slots.concat(T.bench || [])).map(id => Math.round((M.sta[id] || 100) / 5))]; }), Math.floor(M.min) >= 17 && Math.floor(M.min) < 23]);
  if (sig === LV.sigCtrl && !force) return;
  if (!force && editing(el)) { LV.ctrlPending = true; return; }
  LV.sigCtrl = sig;
  if (M.status === "done") {
    const host = isHost(), r = matchResult(M);
    el.innerHTML = `<div class="prompt" style="text-align:center"><h3 style="font-size:30px;color:${M.t[M.w].color}">${esc(M.t[M.w].name)} vence!</h3>
      <p class="muted">${M.so ? `Shootouts ${M.so[0]}-${M.so[1]} · ` : ""}Finalizações ${M.t[0].shots} x ${M.t[1].shots} · Defesas ${M.t[0].saves} x ${M.t[1].saves}${r.mvp ? ` · MVP: <b style="color:var(--ink)">${esc(P(r.mvp).n)}</b>` : ""}</p>
      ${r.nt && r.nt.length ? `<p class="muted">Notas: ${r.nt.slice().sort((x, y) => y[1] - x[1]).slice(0, 4).map(([id, n]) => `<b style="color:var(--ink)">${esc(shortName(P(id).n))}</b> ${n.toFixed(1)}`).join(" · ")}</p>` : ""}
      <p class="muted">Cartas: ${esc(M.t[0].name)} tinha <b>${cardNames(M.t[0].cards.map(c => c.k).join("+"))}</b>, ${esc(M.t[1].name)} tinha <b>${cardNames(M.t[1].cards.map(c => c.k).join("+"))}</b>. Faltas ${M.t[0].fouls || 0}x${M.t[1].fouls || 0} · Cartões: 🟨 ${M.t[0].cardsY}x${M.t[1].cardsY} · 🟥 ${M.t[0].cardsR}x${M.t[1].cardsR}.</p>
      <button class="btn gold big" data-a="closelive">Voltar ao campeonato</button>${Object.values(LIVES).some(x => x.status === "playing") ? `<p class="muted" style="margin-top:8px">Outros jogos da rodada ainda estão rolando: toque no placar lá em cima pra assistir.</p>` : ""}</div>`;
    return;
  }
  if (!mine.length) { el.innerHTML = `<p class="muted" style="text-align:center">Você está assistindo. Os técnicos dos dois times controlam cartas, pênaltis e táticas.</p>`; return; }
  const win = M.min < 5 ? "Cartas liberadas no 5'." : M.min < 17 ? "Liberadas até o 17'." : M.min < 23 ? "Bloqueadas até o 23'." : M.min < 36 ? "Liberadas até o 36'." : "Encerradas.";
  el.innerHTML = mine.map(ti => {
    const T = M.t[ti], cc = canActCard(M, ti), cp = canActPP(M, ti);
    const fieldSlots = T.tac.slots.filter(x => x != null);
    return `<div class="card lpanel" style="border-top:3px solid ${T.color}">
      <div class="row" style="justify-content:space-between"><b>${esc(T.name)}</b><span class="muted" style="font-size:12.5px">${win}</span></div>
      ${T.star || T.dobLeft > 0 || T.out.some(o => o.until > M.min) ? `<div class="row" style="gap:6px">${T.star ? `<span class="pill you">⭐ Star: ${esc(P(T.star.id).n)}</span>` : ""}${T.dobLeft > 0 ? `<span class="pill you">x2 Gol dobro: ${T.dobLeft} min</span>` : ""}${T.out.filter(o => o.until > M.min).map(o => `<span class="pill">${o.why === "red" ? "🟥" : o.why === "yel" ? "🟨" : "⛔"} ${esc(P(o.id).n)} fora</span>`).join("")}</div>` : ""}
      <div class="row" style="align-items:stretch">
        ${T.cards.map((cd, ci) => `<div class="mycard ${cd.used ? "used" : ""}"><div class="muted" style="font-size:11px">${T.cards.length > 1 ? `CARTA SECRETA ${ci + 1}${ci ? " (bônus do desafio)" : ""}` : "SUA CARTA SECRETA"}</div><b>${CARDS[cd.k].name}</b><span>${CARDS[cd.k].desc}</span>
          <button class="btn gold sm" data-a="lcard" data-ti="${ti}" data-idx="${ci}" ${cc && !cd.used ? "" : "disabled"}>${cd.used ? "Usada" : "Ativar carta"}</button></div>`).join("")}
        <div class="mycard pp ${T.ppUsed ? "used" : ""}"><div class="muted" style="font-size:11px">PÊNALTI DO PRESIDENTE</div><b>${esc(T.pres)}</b><span>Você bate e escolhe o canto.</span>
          <button class="btn gold sm" data-a="lpp" data-ti="${ti}" ${cp ? "" : "disabled"}>${T.ppUsed ? "Usado" : "Cobrar agora"}</button></div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:4px">ESTILO</div>
      <div class="row" style="gap:6px">${Object.entries(STYLES).map(([k, v]) => `<button class="btn sm ${T.tac.style === k ? "gold" : ""}" data-a="lstyle" data-v="${k}" data-ti="${ti}">${v.n}</button>`).join("")}</div>
      <div class="row" style="align-items:flex-end;margin-top:6px;gap:10px">
        <label class="f" for="l-form-${ti}">Formação<select id="l-form-${ti}" data-ti="${ti}" class="lform">${Object.keys(FORMS).map(f => `<option ${f === T.tac.form ? "selected" : ""}>${f}</option>`).join("")}</select></label>
        <span class="muted" style="font-size:12.5px;flex:1">${LV.subSel && LV.subSel[ti] ? `<b style="color:var(--gold)">Sai ${esc(shortName(P(LV.subSel[ti]).n))}.</b> Agora toque em quem entra (banco).` : "Substituição: toque em quem sai (em campo) e depois em quem entra (banco)."}</span>
      </div>
      <div class="subgrid">
        <div><div class="muted" style="font-size:11px;margin-bottom:4px">EM CAMPO</div><div class="subrow">${fieldSlots.map(id => subChip(M, ti, id, "f")).join("")}</div></div>
        <div><div class="muted" style="font-size:11px;margin-bottom:4px">BANCO</div><div class="subrow">${(T.bench || []).map(id => subChip(M, ti, id, "b")).join("") || '<span class="muted">sem reservas</span>'}</div></div>
      </div>
      <div class="row" style="gap:14px;align-items:flex-end">
        <label class="row" for="l-auto-${ti}" style="gap:6px;font-size:13.5px"><input id="l-auto-${ti}" class="lauto" data-ti="${ti}" type="checkbox" ${T.autoSub ? "checked" : ""}> Substituições automáticas</label>
        <label class="f" for="l-gk-${ti}">Goleiro linha ${T.gkOut ? '<b style="color:var(--gold)">· NA LINHA AGORA</b>' : ""}<select id="l-gk-${ti}" class="lgk" data-ti="${ti}">${[["auto", "Automático"], ["sempre", "Sempre que der"], ["nunca", "Nunca"]].map(([k, v]) => `<option value="${k}" ${T.gkMode === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      </div>`;
  }).join("");
}
document.addEventListener("change", e => {
  if (e.target.classList && e.target.classList.contains("lauto")) { const ti = +e.target.dataset.ti; act({ t: "m", a: { t: "mauto", v: e.target.checked, ti }, mi: liveMi(ti) }); }
  if (e.target.classList && e.target.classList.contains("lgk")) { const ti = +e.target.dataset.ti; act({ t: "m", a: { t: "mgk", v: e.target.value, ti }, mi: liveMi(ti) }); }
  if (e.target.classList && e.target.classList.contains("lform")) { const ti = +e.target.dataset.ti; act({ t: "m", a: { t: "mform", form: e.target.value, ti }, mi: liveMi(ti) }); }
});
function renderFeed() {
  const M = LIVE; if (LV.sigFeed === M.seq) return; LV.sigFeed = M.seq;
  const icon = e => ({ goal: "⚽", card: "🃏", pp: "👔", penres: "🥅", sores: "🥅", chance: "↗", so: e.ok ? "⚽" : "✖", end: "🏁", phase: "⏱", dice: "🎲", foul: "🦶", inj: "🩹", yellow: "🟨", red: "🟥", sub: "⇄", tac: "📋", gkl: "🧤", info: "•" }[e.type] || "•");
  $("#l-feed").innerHTML = M.ev.filter(e => e.text).slice(-14).reverse().map(e => `<div class="ev k-${e.type}" style="--c:${e.team === 0 ? M.t[0].color : e.team === 1 ? M.t[1].color : "#555"}"><div class="m num">${e.type === "so" ? "SO" : Math.floor(e.m) + "'"}</div><div class="ic">${icon(e)}</div><div class="t">${esc(e.text)}${e.type === "goal" ? ` <span class="muted num">${e.s[0]}-${e.s[1]}</span>` : ""}</div></div>`).join("");
}

function subChip(M, ti, id, side) {
  const T = M.t[ti], p = P(id), v = Math.round(M.sta[id] || 100), sel = side === "f" && LV.subSel && LV.subSel[ti] === id;
  const out = T.out.some(o => o.id === id && o.until > M.min) || T.banned.includes(id);
  const slot = side === "f" ? FORMS[T.tac.form][T.tac.slots.indexOf(id)] : null, fit = slot ? fitOf(p, slot) : "";
  return `<button class="subchip ${fit} ${sel ? "sel" : ""} ${out ? "off" : ""}" data-a="lsubpick" data-ti="${ti}" data-id="${id}" data-side="${side}" ${side === "b" && T.banned.includes(id) ? "disabled" : ""}>
    <span class="lup">${slot || p.p}</span><b>${esc(shortName(p.n))}${T.banned.includes(id) && (T.injR || []).some(x => x[0] === id) ? " 🩹" : ""}</b><span class="num muted">${O(p)}</span>
    <i class="stbar"><i style="width:${v}%;background:${v > 70 ? "var(--pitch)" : v > 50 ? "var(--gold)" : "var(--red)"}"></i></i></button>`;
}
/* ---------- reações dos amigos ---------- */
function showReacts(M) {
  const rs = M.reacts || []; if (LV.rfid !== M.fid) { LV.rfid = M.fid; LV.rseen = rs.length ? rs[rs.length - 1].i : 0; return; }
  rs.filter(r => r.i > (LV.rseen || 0)).forEach(r => {
    const el = document.createElement("div"); el.className = "rfloat"; el.style.left = (10 + Math.random() * 80) + "%";
    el.innerHTML = `<span>${r.e}</span><small style="color:${r.c}">${esc(r.n)}</small>`;
    const ov = $("#ovl"); if (ov) { ov.appendChild(el); setTimeout(() => el.remove(), 2600); }
  });
  if (rs.length) LV.rseen = Math.max(LV.rseen || 0, rs[rs.length - 1].i);
}
/* ---------- animações em sobreposição ---------- */
function queueAnims() {
  const M = LIVE;
  const fresh = M.ev.filter(e => e.i > LV.animSeq && ["goal", "card", "pp", "dice", "penres", "sores", "phase", "so", "end", "gkl", "yellow", "red"].includes(e.type));
  const g = fresh.filter(e => e.type === "goal").pop();
  if (g && M.status !== "done") setTimeout(() => { if (LV.hist && LV.hist.length > 10) { LV.lastGoal = { frames: LV.hist.slice(-48), who: g.who, team: g.team }; LV.sigCtrl = ""; renderLive(true); } }, 1300);
  if (M.ev.length) LV.animSeq = Math.max(LV.animSeq, M.ev[M.ev.length - 1].i);
  if (M.status === "done" && fresh.length > 3) { LV.queue = fresh.filter(e => e.type === "end"); }
  else fresh.forEach(e => LV.queue.push(e));
  if (LV.queue.length > 4) LV.queue = LV.queue.slice(-3);
  if (!LV.playing) playNext();
}
function playNext() {
  const e = LV.queue.shift(); if (!e) { LV.playing = false; return; }
  LV.playing = true;
  const M = LIVE; if (!M) { LV.playing = false; return; }
  const ov = $("#ovl"), col = e.team >= 0 ? M.t[e.team].color : "#f5c542";
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let html = "", dur = 1400;
  if (e.type === "goal") {
    const masc = mascotSVG(M.t[e.team].crest, 120); html = `<div class="ov ov-goal" style="--c:${col}">${masc ? `<div class="masc">${masc}</div>` : ""}<div class="big">GOOOL!</div><div class="who">${esc(e.who || "")}</div>${e.v === 2 ? '<div class="x2">VALE 2</div>' : ""}<div class="team">${esc(M.t[e.team].name)} ${e.s[0]}-${e.s[1]}</div></div>`;
    dur = 2300; burst(e.team, col); LV.shake = 14; LV.goalAt = LV.goalAt || {}; LV.goalAt[e.team] = performance.now() / 1000;
  } else if (e.type === "card") {
    const key = e.card;
    html = `<div class="ov ov-card"><div class="flip" style="--c:${col}"><div class="fin"><div class="fback">${CROWN}<span>CARTA SECRETA</span></div><div class="ffront" style="border-color:${col}"><small>${esc(M.t[e.team].name)}</small><b>${esc(CARDS[key].name)}</b>${e.stolen ? `<em>roubou: ${esc(CARDS[e.stolen].name)}</em>` : `<em>${esc(CARDS[key].desc)}</em>`}</div></div></div></div>`;
    dur = 2400;
  } else if (e.type === "pp") {
    html = `<div class="ov ov-pp" style="--c:${col}"><div class="tie">👔</div><div class="big">PÊNALTI DO PRESIDENTE</div><div class="who">${esc(M.t[e.team].pres)} vai pra bola</div></div>`;
    dur = 1800;
  } else if (e.type === "dice") {
    html = `<div class="ov ov-dice"><div class="die" id="die">1</div><div class="who">O DADO VAI DECIDIR</div></div>`;
    dur = 2600;
    setTimeout(() => { const d = $("#die"); if (!d) return; let k = 0; const it = setInterval(() => { k++; d.textContent = 1 + (k % 3); if (k > 12) { clearInterval(it); d.textContent = e.n; d.classList.add("land"); const w = d.nextElementSibling; if (w) w.textContent = `${e.n}x${e.n} até o 23'!`; } }, 90); }, 50);
  } else if (e.type === "penres") {
    const zx = [16, 50, 84][e.shot % 3], zy = e.shot < 3 ? 28 : 72, dx = [18, 50, 82][e.dive];
    const res = e.res === "gol" ? "GOL!" : e.res === "defesa" ? "DEFENDEU!" : "PRA FORA!";
    html = `<div class="ov ov-pen"><div class="gframe"><div class="keeper" id="kp"></div><div class="pball" id="pb"></div></div><div class="who res-${e.res}">${res}</div></div>`;
    dur = 2400;
    setTimeout(() => { const k = $("#kp"), b = $("#pb"); if (k) { k.style.left = dx + "%"; k.classList.add(e.dive === 1 ? "stay" : e.dive === 0 ? "dl" : "dr"); } if (b) { b.style.left = (e.res === "fora" ? zx + (zx < 50 ? -14 : 14) : zx) + "%"; b.style.top = (e.res === "fora" ? -12 : zy) + "%"; b.style.transform = "translate(-50%,-50%) scale(.7)"; } }, 120);
  } else if (e.type === "sores" || e.type === "so") {
    const ok = e.ok;
    html = `<div class="ov ov-so" style="--c:${col}"><div class="big">${ok ? "GOL!" : "DEFENDEU!"}</div><div class="who">${esc(SO_ATT[e.att])} x ${esc(SO_GK[e.gk])}</div>${e.so ? `<div class="team">shootouts ${e.so[0]}-${e.so[1]}</div>` : ""}</div>`;
    dur = 1800;
  } else if (e.type === "gkl") {
    html = `<div class="ov ov-phase ph-dob"><div class="big">🧤 GOLEIRO LINHA</div><div class="who">${esc(M.t[e.team].name)}</div></div>`; dur = 1500;
  } else if (e.type === "phase") {
    const t = { esc: e.n === 1 ? "ESCALONADO · 1x1" : null, full: "7x7", dob: "GOL DOBRO", mb: `MATCH BALL · PRIMEIRO A ${e.target}`, so: "SHOOTOUTS", mbn: e.gl ? "1x1 · GOLEIRO LINHA LIBERADO" : (e.n === 6 ? "7x7" : `${e.n}x${e.n}`) }[e.ph];
    if (!t) { playNext(); return; }
    html = `<div class="ov ov-phase ph-${e.ph}"><div class="big">${t}</div></div>`; dur = 1500;
  } else if (e.type === "yellow" || e.type === "red") {
    html = `<div class="ov ov-ref"><div class="refcard ${e.type}"></div><div class="who">${e.type === "red" ? "VERMELHO" : "AMARELO"} · ${esc(P(e.pid).n)}</div><div class="team">${e.type === "red" ? "5 min com um a menos · não volta" : "2 min fora"}</div></div>`;
    dur = 1700;
  } else if (e.type === "end") {
    html = `<div class="ov ov-goal" style="--c:${col}"><div class="big" style="font-size:clamp(38px,8vw,80px)">FIM DE JOGO</div><div class="who">${esc(M.t[e.team].name)} vence</div></div>`;
    dur = 2600; burst(e.team, col);
  }
  if (reduce) dur = Math.min(dur, 1200);
  ov.innerHTML = html;
  setTimeout(() => { ov.innerHTML = ""; setTimeout(playNext, 120); }, dur);
}
function burst(ti, col) {
  const W = LV.canvas.width, Hh = LV.canvas.height;
  const gx = ti === 0 ? W * 0.95 : W * 0.05;
  for (let i = 0; i < 90; i++) LV.parts.push({ x: gx, y: Hh / 2, vx: (Math.random() - 0.5) * 14 + (ti === 0 ? -4 : 4), vy: -Math.random() * 12 - 2, life: 70 + Math.random() * 40, c: Math.random() < 0.5 ? col : "#f5c542", s: 3 + Math.random() * 4 });
}

/* ---------- campo (canvas) ---------- */
function frame(ts) {
  requestAnimationFrame(frame);
  if (!liveVisible() || !LV.ctx) return;
  const cv = LV.canvas, wrap = cv.parentElement;
  // o campo cabe no espaço livre da tela, sempre na mesma proporção (sem precisar minimizar)
  const narrow = window.innerWidth <= 1000, r = wrap.clientWidth < 600 ? 0.86 : 0.68;
  const availH = narrow ? window.innerHeight * 0.46 : Math.max(200, wrap.clientHeight);
  const cw = Math.max(240, Math.floor(Math.min(wrap.clientWidth, availH / r))), ch = Math.round(cw * r);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + "px"; cv.style.height = ch + "px"; }
  const c = LV.ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cw, HT = ch, SH = Math.round(ch * 0.15), pad = 22;
  const H = HT - 2 * SH; // altura do gramado
  const fx = x => pad + x * (W - 2 * pad), fy = y => SH + 14 + y * (H - 28);
  const M = LIVE;
  let sx = 0, sy = 0; if (LV.shake > 0) { sx = (Math.random() - .5) * LV.shake; sy = (Math.random() - .5) * LV.shake; LV.shake *= 0.88; if (LV.shake < .5) LV.shake = 0; }
  c.save(); c.translate(sx, sy);
  const t0 = ts / 1000;
  drawStands(c, M, W, HT, SH, t0);
  // gramado
  const stripes = 10;
  for (let i = 0; i < stripes; i++) { c.fillStyle = i % 2 ? "#17181b" : "#101113"; c.fillRect(i * W / stripes, SH, W / stripes + 1, H); }
  c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 2;
  c.strokeRect(fx(0), fy(0), fx(1) - fx(0), fy(1) - fy(0));
  c.beginPath(); c.moveTo(fx(.5), fy(0)); c.lineTo(fx(.5), fy(1)); c.stroke();
  c.beginPath(); c.arc(fx(.5), fy(.5), (H - 28) * 0.16, 0, Math.PI * 2); c.stroke();
  [[0, 1], [1, -1]].forEach(([x0, d]) => {
    c.strokeRect(Math.min(fx(x0), fx(x0 + d * .14)), fy(.25), Math.abs(fx(x0 + d * .14) - fx(x0)), fy(.75) - fy(.25));
    c.fillStyle = "rgba(255,255,255,.9)"; c.fillRect(d > 0 ? fx(0) - 8 : fx(1), fy(.4), 8, fy(.6) - fy(.4));
  });
  c.fillStyle = "rgba(245,197,66,.10)"; c.font = `800 ${Math.round(H * 0.09)}px "Big Shoulders Display", sans-serif`; c.textAlign = "center"; c.fillText("KINGS", fx(.5), fy(.5) + H * 0.03);
  // alvos
  const t = ts / 1000;
  const bwx = M.ball.t === 0 ? M.ball.x : 1 - M.ball.x, bwy = M.ball.y;
  const targets = {};
  M.t.forEach((T, ti) => {
    const poss = M.ball.t === ti;
    const toWorld = (x, y) => [ti === 0 ? x : 1 - x, ti === 0 ? y : 1 - y];
    const bxT = ti === 0 ? bwx : 1 - bwx, byT = ti === 0 ? bwy : 1 - bwy;
    const gk = T.tac.gk;
    if (gk != null) { const [x, y] = T.gkOut ? toWorld(poss ? 0.55 : 0.32, 0.5 + (byT - 0.5) * 0.5 + Math.sin(t + ti) * 0.05) : toWorld(0.035 + (poss ? 0.03 : 0), 0.5 + (byT - 0.5) * 0.3); targets[gk] = { x, y, ti, gk: true }; }
    const fxy = FORM_XY[T.tac.form];
    T.field.forEach(id => {
      const s = T.tac.slots.indexOf(id); if (s < 0) return;
      let [x, y] = fxy[s];
      x += poss ? 0.1 : -0.06; x += (bxT - x) * 0.15; y += (byT - y) * 0.22;
      x += Math.sin(t * 1.3 + id) * 0.012; y += Math.cos(t * 1.1 + id * 2) * 0.015;
      x = Math.max(0.03, Math.min(0.97, x)); y = Math.max(0.05, Math.min(0.95, y));
      const [wx, wy] = toWorld(x, y); targets[id] = { x: wx, y: wy, ti };
    });
    T.out.filter(o => o.until > M.min).forEach((o, k) => { targets[o.id] = { x: 0.5 + (ti ? 0.06 + k * 0.03 : -0.06 - k * 0.03), y: -0.06, ti, out: true }; });
  });
  // bancos: quem não está em campo vai/fica na lateral
  Object.keys(LV.rp).forEach(id => { if (!targets[id]) { const r = LV.rp[id]; targets[id] = { x: 0.5 + (r.ti ? 0.12 : -0.12), y: 1.07, ti: r.ti, bench: true }; } });
  Object.entries(targets).forEach(([id, tg]) => {
    let r = LV.rp[id];
    if (!r) r = LV.rp[id] = { x: 0.5 + (tg.ti ? 0.1 : -0.1), y: 1.07, ti: tg.ti };
    const k = tg.bench ? 0.04 : 0.06;
    r.x += (tg.x - r.x) * k; r.y += (tg.y - r.y) * k; r.gk = tg.gk; r.bench = tg.bench; r.out = tg.out;
  });
  // bola: segue o jogador mais perto do alvo da bola
  let bt = { x: bwx, y: bwy };
  if (M.ball.goal) bt = { x: M.ball.t === 0 ? 1.01 : -0.01, y: 0.5 };
  else {
    const T = M.t[M.ball.t]; let best = null, bd = 9;
    T.field.forEach(id => { const r = LV.rp[id]; if (!r) return; const d = Math.hypot(r.x - bwx, r.y - bwy); if (d < bd) { bd = d; best = r; } });
    if (best) bt = { x: best.x + (M.ball.t === 0 ? 0.012 : -0.012), y: best.y + 0.01 };
  }
  LV.ball.x += (bt.x - LV.ball.x) * 0.09; LV.ball.y += (bt.y - LV.ball.y) * 0.09;
  // replay do gol: grava as últimas posições e, quando pedido, reproduz em câmera lenta
  if (!LV.replay) {
    if (!LV.recT || ts - LV.recT > 90) { LV.recT = ts; LV.hist = LV.hist || []; const rp = {}; Object.entries(LV.rp).forEach(([id, r]) => { rp[id] = { x: r.x, y: r.y, gk: r.gk, bench: r.bench, out: r.out, ti: r.ti }; }); LV.hist.push({ rp, b: { x: LV.ball.x, y: LV.ball.y } }); if (LV.hist.length > 70) LV.hist.shift(); }
  } else {
    const fr = LV.replay.frames[Math.min(LV.replay.frames.length - 1, Math.floor(LV.replay.i))];
    Object.entries(fr.rp).forEach(([id, r]) => { if (LV.rp[id]) Object.assign(LV.rp[id], r); });
    LV.ball.x = fr.b.x; LV.ball.y = fr.b.y; LV.replay.i += 0.4;
    if (LV.replay.i >= LV.replay.frames.length + 8) LV.replay = null;
  }
  // jogadores
  const rad = Math.max(8, Math.min(13, W / 70));
  const kits = teamKits(M);
  c.textAlign = "center";
  Object.entries(LV.rp).forEach(([id, r]) => {
    const T = M.t[r.ti]; const p = P(+id); if (!p) return;
    const X = fx(r.x), Y = fy(Math.min(1.1, r.y));
    c.globalAlpha = r.bench ? 0.35 : r.out ? 0.55 : 1;
    c.beginPath(); c.arc(X, Y + 2, rad, 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
    drawKit(c, X, Y, rad, kits[r.ti], r.gk);
    c.fillStyle = r.gk ? kits[r.ti].c1 : kits[r.ti].num; c.font = `800 ${Math.round(rad * 1.05)}px "Big Shoulders Display", sans-serif`;
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 2.5; c.strokeText(hid() ? (r.gk ? "G" : String(T.field.indexOf(+id) + 1 || "")) : String(p.o), X, Y + rad * 0.38);
    c.fillText(hid() ? (r.gk ? "G" : String(T.field.indexOf(+id) + 1 || "")) : String(p.o), X, Y + rad * 0.38);
    if (!r.bench) { c.fillStyle = "rgba(255,255,255,.92)"; c.font = `600 ${Math.max(9, Math.round(rad * 0.85))}px Archivo, sans-serif`; c.fillText(shortName(p.n), X, Y + rad + 11); }
    c.globalAlpha = 1;
  });
  // bola
  c.beginPath(); c.arc(fx(LV.ball.x), fy(LV.ball.y), rad * 0.45, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.strokeStyle = "#222"; c.lineWidth = 1.5; c.stroke();
  // confete
  LV.parts = LV.parts.filter(q => q.life > 0);
  LV.parts.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += 0.35; q.vx *= 0.99; q.life--; c.fillStyle = q.c; c.globalAlpha = Math.min(1, q.life / 40); c.fillRect(q.x, q.y, q.s, q.s * 0.6); });
  c.globalAlpha = 1;
  // faixa de fase no campo
  if (M.phase === "dob") { c.fillStyle = "rgba(245,197,66,.13)"; c.fillRect(0, SH, W, H); }
  if (M.phase === "mb") { c.fillStyle = "rgba(255,77,97,.10)"; c.fillRect(0, SH, W, H); }
  M.t.forEach((T, ti) => { if (T.dobLeft > 0 && M.phase === "full") { c.fillStyle = T.color; c.globalAlpha = .2; c.fillRect(ti === 0 ? W / 2 : 0, SH, W / 2, H); c.globalAlpha = 1; } });
  if (LV.replay) { c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(0, SH, W, H); c.fillStyle = "#ff4d61"; c.font = `900 ${Math.round(H * 0.07)}px "Big Shoulders Display", sans-serif`; c.textAlign = "left"; c.fillText("● REPLAY", fx(0) + 8, fy(0) + H * 0.09); c.textAlign = "center"; }
  c.restore();
}
/* ---------- uniformes, torcida e mosaico ---------- */
function hex2rgb(h) { const n = parseInt((h || "#888888").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function cdist(a, b) { const x = hex2rgb(a), y = hex2rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
// uniforme de cada time em campo: se as camisas forem parecidas, o visitante usa o reserva
function teamKits(M, raw) {
  const base = T => Object.assign({ c1: T.color, c2: "#111111", pat: "liso", num: "#0b0d12" }, T.kit || {});
  const k = M.t.map(base);
  if (raw) return k;
  if (cdist(k[0].c1, k[1].c1) < 90) {
    const alt = M.t[1].kit2 ? Object.assign({ c2: "#111111", pat: "liso", num: "#ffffff" }, M.t[1].kit2) : null;
    if (alt && cdist(k[0].c1, alt.c1) >= 90) k[1] = alt;
    else k[1] = Object.assign({}, k[1], { c1: k[1].c2, c2: k[1].c1, num: cdist(k[1].c2, "#ffffff") < 200 ? "#111111" : "#ffffff" });
  }
  return k;
}
function drawKit(c, X, Y, r, k, gk) {
  c.save();
  c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.closePath();
  c.fillStyle = gk ? "#15171c" : k.c1; c.fill();
  c.clip();
  const tx = !gk && kitTex(k);
  if (tx) { c.drawImage(tx, X - r, Y - r, 2 * r, 2 * r); c.restore(); c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.lineWidth = 2.2; c.strokeStyle = "rgba(255,255,255,.7)"; c.stroke(); return; }
  c.fillStyle = gk ? k.c1 : k.c2;
  if (!gk) {
    if (k.pat === "listras") for (let i = -2; i <= 2; i += 2) c.fillRect(X + i * r * 0.38 - r * 0.16, Y - r, r * 0.32, 2 * r);
    else if (k.pat === "horizontais") for (let i = -2; i <= 2; i += 2) c.fillRect(X - r, Y + i * r * 0.38 - r * 0.16, 2 * r, r * 0.32);
    else if (k.pat === "faixa") { c.beginPath(); c.moveTo(X - r, Y - r * 0.6); c.lineTo(X - r * 0.4, Y - r); c.lineTo(X + r, Y + r * 0.6); c.lineTo(X + r * 0.4, Y + r); c.closePath(); c.fill(); }
    else if (k.pat === "metade") c.fillRect(X, Y - r, r, 2 * r);
    else if (k.pat === "centro") c.fillRect(X - r * 0.22, Y - r, r * 0.44, 2 * r);
    else if (k.pat === "ombros") c.fillRect(X - r, Y - r, 2 * r, r * 0.65);
    else if (k.pat === "v") { c.beginPath(); c.moveTo(X - r, Y - r * 0.5); c.lineTo(X, Y + r * 0.3); c.lineTo(X + r, Y - r * 0.5); c.lineTo(X + r, Y - r * 0.15); c.lineTo(X, Y + r * 0.65); c.lineTo(X - r, Y - r * 0.15); c.closePath(); c.fill(); }
    else if (k.pat === "finas") for (let i = -3; i <= 3; i++) c.fillRect(X + i * r * 0.28 - r * 0.05, Y - r, r * 0.1, 2 * r);
    else if (k.pat === "xadrez") { c.fillRect(X - r, Y - r, r, r); c.fillRect(X, Y, r, r); }
    else if (k.pat === "gola") { c.beginPath(); c.arc(X, Y - r * 0.9, r * 0.55, 0, Math.PI); c.fill(); }
  } else { c.fillRect(X - r, Y - r * 0.25, 2 * r, r * 0.5); }
  c.restore();
  c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.lineWidth = 2.2; c.strokeStyle = gk ? k.c1 : "rgba(255,255,255,.7)"; c.stroke();
}
function mosaicFor(M, ti) {
  LV.mos = LV.mos || {};
  const T = M.t[ti]; const key = JSON.stringify(T.crest || {}) + ti;
  const ex = LV.mos[ti];
  if (ex && ex.key === key) return ex.ready ? ex : null;
  const o = LV.mos[ti] = { key, ready: false, cols: 26, rows: 10 };
  const svg = crestSVG(T.crest || {}, 60);
  const img = new Image();
  img.onload = () => {
    try {
      const cv = document.createElement("canvas"); cv.width = o.cols; cv.height = o.rows;
      const x = cv.getContext("2d");
      const h = o.rows, w = Math.round(h / 1.2);
      x.drawImage(img, Math.round((o.cols - w) / 2), 0, w, h);
      o.data = x.getImageData(0, 0, o.cols, o.rows).data; o.ready = true;
    } catch (e) { }
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  return null;
}
function drawStands(c, M, W, HT, SH, t) {
  const kits = teamKits(M, true);
  [0, 1].forEach(ti => {
    const y0 = ti === 0 ? 0 : HT - SH;
    // concreto da arquibancada
    const g = c.createLinearGradient(0, y0, 0, y0 + SH);
    g.addColorStop(0, ti === 0 ? "#1a1f29" : "#232a36"); g.addColorStop(1, ti === 0 ? "#232a36" : "#1a1f29");
    c.fillStyle = g; c.fillRect(0, y0, W, SH);
    const k = kits[ti], CR = M.t[ti].crest || {}, sty = CR.tor || "mosaico", A1 = CR.t1 || k.c1, A2 = CR.t2 || k.c2 || "#111111", mos = sty === "mosaico" ? mosaicFor(M, ti) : null;
    const cell = Math.max(4, Math.floor(SH / 11));
    const cols = Math.floor(W / cell), rows = Math.floor((SH - 6) / cell);
    const goalAt = (LV.goalAt || {})[ti] || -99, cheer = t - goalAt < 2.6;
    const mx0 = Math.floor(cols / 2 - 13), my0 = Math.floor((rows - 10) / 2);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const seed = (q * 73 + r * 151 + ti * 977) % 997;
      let col;
      const mq = q - mx0, mr = r - my0;
      if (mos && mq >= 0 && mq < mos.cols && mr >= 0 && mr < mos.rows) {
        const i4 = (mr * mos.cols + mq) * 4;
        col = mos.data[i4 + 3] > 60 ? `rgb(${mos.data[i4]},${mos.data[i4 + 1]},${mos.data[i4 + 2]})` : (seed % 2 ? k.c1 : k.c2);
      } else if (sty === "listras") col = seed % 13 === 0 ? "#3a4252" : Math.floor(q / 3) % 2 ? A2 : A1;
      else if (sty === "xadrez") col = seed % 13 === 0 ? "#3a4252" : (Math.floor(q / 2) + Math.floor(r / 2)) % 2 ? A2 : A1;
      else if (sty === "ondas") col = r < rows / 2 + Math.sin(q / 3 - t * 2.2) * rows * 0.3 ? A1 : A2;
      else col = seed % 9 === 0 ? "#3a4252" : seed % 3 === 0 ? A2 : A1;
      const jump = cheer ? Math.abs(Math.sin(t * 9 + seed)) * cell * 0.5 : Math.sin(t * 2 + seed) * 0.6;
      c.fillStyle = col;
      c.fillRect(q * cell + 1, y0 + 3 + r * cell - (ti === 0 ? jump : -jump * 0) - (ti === 1 ? jump : 0), cell - 1.5, cell - 1.5);
    }
    if (sty === "bandeiras") for (let f = 0; f < 7; f++) { // bandeiras tremulando
      const px = (f + 0.5) * W / 7 + ((f * 37) % 23) - 11, top = y0 + 2, ph = t * 4 + f;
      c.fillStyle = "#d7dbe3"; c.fillRect(px, top, 1.5, SH - 8);
      for (let s2 = 0; s2 < 12; s2++) { const w2 = 2.2, xx = px + 1.5 + s2 * w2, yy = top + Math.sin(ph + s2 * 0.5) * 2.2; c.fillStyle = s2 % 4 < 2 ? A1 : A2; c.fillRect(xx, yy, w2 + 0.3, Math.min(16, SH * 0.45)); }
    }
    if (sty === "sinalizadores") for (let f = 0; f < 6; f++) { // sinalizadores com fumaça nas cores do time
      const px = (f + 0.5) * W / 6 + ((f * 53) % 31) - 15, py = y0 + SH * (0.35 + ((f * 7) % 4) * 0.12), fl = 0.6 + Math.abs(Math.sin(t * 13 + f * 3)) * 0.4;
      for (let s2 = 0; s2 < 5; s2++) { const a = ((t * 0.6 + s2 * 0.2 + f * 0.13) % 1); c.globalAlpha = 0.28 * (1 - a); c.fillStyle = s2 % 2 ? A1 : A2; c.beginPath(); c.arc(px + Math.sin(a * 6 + f) * 6, py - a * SH * 0.8, 4 + a * 12, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1; c.fillStyle = `rgba(255,${Math.round(80 + fl * 90)},40,${fl})`; c.beginPath(); c.arc(px, py, 3.2 * fl + 1.5, 0, Math.PI * 2); c.fill();
    }
    // faixa com o nome do time
    c.fillStyle = "rgba(0,0,0,.55)"; const by = ti === 0 ? y0 + SH - 14 : y0; c.fillRect(0, by, W, 14);
    c.fillStyle = k.c1; c.font = `800 11px "Big Shoulders Display", sans-serif`; c.textAlign = "center";
    const fx = (CR.fx || M.t[ti].name).toUpperCase(); c.fillStyle = A1;
    c.fillText(`${fx} · ${fx} · ${fx}`, W / 2, by + 11);
  });
}
function shortName(n) { const s = n.replace(/'/g, "").split(" "); const w = s.length > 1 && s[0].length <= 3 ? s[1] : s[0]; return w.length > 9 ? w.slice(0, 8) + "." : w; }

(window.claude && window.claude.hot && window.claude.hot.ready) ? window.claude.hot.ready(boot) : boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
