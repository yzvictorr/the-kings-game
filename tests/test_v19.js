const fs = require("fs"); const path = require("path");
const E = require(path.join(__dirname, "../src/engine.js"));
E.setPlayers(JSON.parse(fs.readFileSync(path.join(__dirname, "../src/players.json"))));
const S = E.newGame("TEST", "p0", "Ana", "Reis FC", "online");
S.managers.push(Object.assign({}, S.managers[0], { pid: "p1", name: "Bia", team: "Rainhas", crest: Object.assign({}, S.managers[0].crest), champ: undefined }));
S.season = { fixtures: [], fmt: "split" };
const ok = (c, m) => { if (!c) { console.error("FALHOU: " + m); process.exit(1); } };
E.applyAction(S, { t: "editme", crest: Object.assign({}, S.managers[0].crest, { sa: "auto", stars: 5 }) }, 0, true, Date.now());
ok(S.managers[0].crest.stars === 0, "auto stars começa em 0 no save novo");
E.hallTitle(S, 0, "Split"); ok(S.managers[0].crest.stars === 1 && S.managers[0].champ.comp === "Split", "1 Split");
E.hallTitle(S, 0, "Kings Cup"); ok(S.managers[0].crest.stars === 2 && S.managers[0].crest.scup === 1, "Cup prateada");
E.hallTitle(S, 1, "Split"); ok(!S.managers[0].champ || S.managers[0].champ.comp !== "Split", "selo do Split passou");
ok(S.managers[1].champ.comp === "Split", "novo campeão tem selo");
console.log("ok v19");
// assumir bot no meio do campeonato
{ const S2 = E.newGame("T2", "h", "Host", "Host FC", "online"); S2.managers.push(Object.assign({}, S2.managers[0], { pid: "bot1", name: "Bot", team: "Robôs", cpu: true })); S2.phase = "season";
  ok(E.applyAction(S2, { t: "takebot", mi: 1, pid: "novo", name: "Zé" }, -1, false, Date.now()), "assumiu bot");
  ok(!S2.managers[1].cpu && S2.managers[1].pid === "novo" && S2.managers[1].team === "Robôs", "time herdado");
  ok(!E.applyAction(S2, { t: "takebot", mi: 0, pid: "outro", name: "X" }, -1, false, Date.now()), "não assume humano");
  console.log("ok takebot"); }
// lance inválido (NaN) não pode entrar no leilão
{ const S3 = E.newGame("T3", "h", "Host", "Host FC", "online"); S3.managers.push(Object.assign({}, S3.managers[0], { pid: "x2", name: "X", team: "X FC" })); let t3 = Date.now();
  E.applyAction(S3, { t: "settings", v: { total: 2, squad: 7 } }, 0, true, t3); E.applyAction(S3, { t: "start" }, 0, true, t3);
  for (let i = 0; i < 40 && !(S3.auction && S3.auction.lot); i++) { t3 += 500; E.marketTick(S3, t3); }
  if (S3.auction && S3.auction.lot) { const b0 = S3.auction.lot.bid; E.applyAction(S3, { t: "bid", amt: 5 }, 0, true, t3); E.applyAction(S3, { t: "bid", amount: "abc" }, 1, true, t3); ok(S3.auction.lot.bid === b0 && Number.isFinite(S3.auction.lot.bid), "lance inválido recusado"); }
  console.log("ok lance inválido"); }
// coringa rouba a carta que o rival acabou de ativar
{ const S4 = E.newGame("T4", "h", "Host", "Host FC", "online"); let t4 = Date.now();
  for (let i = 1; i < 4; i++) E.applyAction(S4, { t: "join", pid: "p" + i, name: "N" + i, team: "T" + i }, -1, false, t4);
  E.applyAction(S4, { t: "settings", v: { total: 4 } }, 0, true, t4); E.applyAction(S4, { t: "start" }, 0, true, t4);
  let g = 0; while (S4.phase !== "season" && g++ < 20000) { t4 += 500; E.applyAction(S4, { t: "autofill" }, 0, true, t4); E.marketTick(S4, t4); }
  const run = yes => { const M = E.newMatch(S4, { id: "z", h: 0, a: 1, stage: "Liga", round: 0 }); E.attachRosters(S4, M);
    M.t.forEach(T => { T.cpu = false; }); M.min = 8; M.phase = "full"; M.nOut = 6;
    M.t[0].cards = [{ k: "PEN", used: false }]; M.t[1].cards = [{ k: "CUR", used: false }];
    ok(E.matchAction(M, 0, { t: "mcard" }, t4), "ativou a carta");
    ok(M.pending && M.pending.k === "steal" && M.pending.team === 1, "rival com coringa recebe a opção de roubar");
    ok(E.matchAction(M, 1, { t: "mchoice", f: "yes", v: yes ? 1 : 0 }, t4), "escolha aceita");
    return M; };
  const A = run(true); ok(A.pending && A.pending.k === "pen" && A.pending.team === 1 && A.t[1].cards[0].used, "roubou: pênalti vai para quem tinha o coringa");
  const B = run(false); ok(B.pending && B.pending.k === "pen" && B.pending.team === 0 && !B.t[1].cards[0].used, "não roubou: carta segue com quem ativou e o coringa fica guardado");
  console.log("ok coringa rouba depois"); }
// escolha de wild card com jogador que já saiu do elenco não trava a confirmação
{ const S5 = E.newGame("T5", "h", "Host", "Host FC", "online"); S5.managers[0].roster = [1, 2, 3, 4]; S5.phase = "keep"; S5.keep = { sub: {}, maxWC: 2, maxKeep: 3 };
  S5.managers.push(Object.assign({}, S5.managers[0], { pid: "b", cpu: true, roster: [5, 6] })); S5.keep.sub[1] = { wc: [5], keep: [6] };
  S5.settings.wc = 2; S5.settings.picks = 6;
  const okk = E.applyAction(S5, { t: "keep", k: { wc: [99, 1], keep: [2] }, mi: 0 }, 0, true, Date.now());
  ok(okk !== false && S5.managers[0].wc.length === 1 && S5.managers[0].wc[0] === 1, "wild card antigo (fora do elenco) é ignorado e o resto vale");
  console.log("ok keep com jogador trocado"); }
