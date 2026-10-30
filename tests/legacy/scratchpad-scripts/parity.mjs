import fs from "node:fs"; import vm from "node:vm"; import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(ROOT + "/src/js/" + p).href);
const { buildSchedule } = await imp("domain/scheduler.js");
const { evaluateCompliance } = await imp("domain/compliance.js");
const { fromPersisted, toPersisted } = await imp("infrastructure/stateRepository.js");
const { createExampleState } = await imp("domain/simulationState.js");

const lines = fs.readFileSync("original/app.js", "utf8").split("\n");
const code = "let S;\n" + lines.slice(1, 58).join("\n") + "\n" + lines.slice(150, 308).join("\n") +
  "\nglobalThis.__run = st => { S = st; const R = build(); const C = check(R); return {R, C, S}; }; globalThis.__ex = exemplo;";
const ctx = vm.createContext({ document: { getElementById: () => null } });
vm.runInContext(code, ctx);

let seed = +(process.argv[3] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[ri(0, a.length - 1)];
const clock = () => String(ri(0, 23)).padStart(2, "0") + ":" + pick(["00", "10", "30", "45", "59"]);
function randomRaw() {
  const N = ri(0, 14);
  const team = Array.from({ length: N }, (_, i) => ({ n: "P" + i, s: pick(["F", "M"]) }));
  const days = Array.from({ length: 7 }, () => {
    const a = rnd() < .7 ? pick(["06:00", "07:00", "08:00", "09:00", "10:00", "17:00"]) : clock();
    const f = rnd() < .7 ? pick(["12:00", "14:00", "18:00", "20:00", "22:00", "23:30", "23:59"]) : clock();
    return { on: rnd() < .8, a, f, need: ri(0, N + 2) };
  });
  if (rnd() < .4) days.forEach(d => d.on = true);
  const raw = { seg: ri(-1, 28), tipo: pick(["comercio", "outros"]), team, days, needAuto: rnd() < .5, fase: pick(["44", "42", "40"]),
    contratar: rnd() < .5, sal: 2000, enc: 75, ben: 0, ov: {}, wk: ri(0, 3), names: {}, modelo: pick([null, null, "5", "6", "7"]),
    alm: pick([30, 45, 60, 60, 75, 90, 120, 150, 180]), almIni: pick(["12:00", "11:30", "13:00", clock()]) };
  if (rnd() < .5) raw.tnAuto = rnd() < .5;
  if (rnd() < .4) raw.tt = [0, 1, 2].map(() => rnd() < .5 ? { auto: true, ini: clock() } : { auto: false, ini: clock() });
  if (rnd() < .4) raw.tn = [0, 1, 2].map(() => [ri(0, 4), ri(0, 4), ri(0, 3)]);
  const nov = ri(0, 12);
  for (let k = 0; k < nov; k++) raw.ov[(rnd() < .2 ? "novo" + ri(1, 3) : ri(0, N)) + "-" + ri(0, 3) + "-" + ri(0, 6)] = rnd() < .5;
  if (rnd() < .3) raw.names.novo1 = "Fulano";
  return raw;
}
const oldShift = s => s && [s[0], s[1], s[2], s[3], s[4], s[5]];
const newShift = a => a && [a.start, a.end, a.lunchStart, a.breakMinutes, a.shiftIndex, a.shiftName];
function compare(raw) {
  const old = ctx.__run(JSON.parse(JSON.stringify(raw)));
  const st = fromPersisted(JSON.parse(JSON.stringify(raw)));
  const R = buildSchedule(st), C = evaluateCompliance(st, R);
  const o = old.R, P = o.P;
  const A = {
    P: [P.K, P.min, P.lim, P.folgas, P.week, P.txt, [0,1,2,3,4,5,6].map(P.dm)],
    team: o.team.map(p => [p.n, p.s, p.novo, p.id]), weeks: o.weeks, need: o.need, req: o.req, hires: o.hires, N: o.N, multi: o.multi, span: o.span,
    shifts: [0,1,2,3].map(w => [0,1,2,3,4,5,6].map(d => { const sh = o.shift(w, d); return o.team.map((_, i) => oldShift(sh[i]) || null); })),
    falta: o.multi ? Object.entries(o.falta) : [],
    al: old.C.al.map(a => [a[0], a[1], a[2]]), cell: [...old.C.cellErr].sort(), wk: [...old.C.wkBad].sort(),
    days: old.S.days, tt: old.S.tt ? old.S.tt.map(t => [t.ini, t.auto !== false]) : null, tn: old.S.tn || null,
  };
  if (R.usesShifts) globalThis.__multi = (globalThis.__multi||0)+1; if (C.alerts.some(a=>a.level==="bad")) globalThis.__bad=(globalThis.__bad||0)+1; if (R.hires) globalThis.__h=(globalThis.__h||0)+1;
  const W = R.workload, ps = toPersisted(st);
  const B = {
    P: [W.workDays, W.dailyMinutes, W.weeklyLimitHours, W.minDaysOff, W.weeklyHours, W.label, [0,1,2,3,4,5,6].map(W.minutesOnDay)],
    team: R.roster.map(p => [p.name, p.sex, p.isHire, p.id]), weeks: R.weeks, need: R.demand, req: R.requiredHeadcount, hires: R.hires, N: R.teamSize, multi: R.usesShifts, span: R.span,
    shifts: [0,1,2,3].map(w => [0,1,2,3,4,5,6].map(d => { const m = R.assignmentsFor(w, d); return R.roster.map((_, i) => newShift(m.get(i)) || null); })),
    falta: R.shiftShortages.map(s => [`${s.week}-${s.day}-${s.shift}`, s.missing]),
    al: C.alerts.map(a => [a.level, a.title, a.detail]), cell: [...C.cellErrors].sort(), wk: [...C.weeksWithIssues].sort(),
    days: ps.days, tt: ps.tt ? ps.tt.map(t => [t.ini, t.auto]) : null, tn: ps.tn,
  };
  for (const k of Object.keys(A)) {
    const a = JSON.stringify(A[k]), b = JSON.stringify(B[k]);
    if (a !== b) return k + "\n old: " + a.slice(0, 400) + "\n new: " + b.slice(0, 400);
  }
  return null;
}
// exemplo
const exOld = JSON.parse(JSON.stringify(ctx.__ex())); const exNew = toPersisted(createExampleState());
console.log("example days equal:", JSON.stringify(exOld.days) === JSON.stringify(exNew.days), JSON.stringify(exOld.team) === JSON.stringify(exNew.team));
let fails = 0, multi = 0; const total = +(process.argv[4] || 3000);
for (let t = 0; t < total; t++) { const raw = randomRaw(); const r = compare(raw);
  if (r) { if (fails++ < 3) console.log("MISMATCH", r, "\n raw:", JSON.stringify(raw).slice(0, 600)); } }
console.log(`${total - fails}/${total} identical`);
console.log("multi",globalThis.__multi,"withViolations",globalThis.__bad,"withHires",globalThis.__h)
