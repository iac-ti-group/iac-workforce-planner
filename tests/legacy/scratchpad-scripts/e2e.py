import re, sys, subprocess, time
from playwright.sync_api import sync_playwright

SCR = r"C:/Users/Usuario/AppData/Local/Temp/claude/C--Windows-System32-clones-iac-workforce-planner/da405e23-6407-4521-af64-06f7fd0350b3/scratchpad"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8090", "-d", SCR + "/original"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
TARGETS = {"old": "http://localhost:8090/index.html", "new": "http://localhost:8080/"}
if len(sys.argv) > 1 and sys.argv[1] == "dist":
    TARGETS["new"] = "file:///C:/Windows/System32/clones/iac-workforce-planner/dist/escala-5x2.html"

IDS = ["kpis", "esc", "alerts", "cres", "cobs", "sug", "tn", "dayrow", "func", "days", "mesc", "weeks",
       "sugTitle", "sugHint", "tipoHint", "cF", "cM", "mbadge"] + [f"sum{i}" for i in range(1, 9)]
SNAP = """ids => ids.map(id => { const e = document.getElementById(id); if (!e) return [id, null];
  return [id, e.hidden ? 'HIDDEN' : e.innerHTML]; })"""
EXTRA = """() => ({ undo: document.getElementById('undo').hidden, contr: document.getElementById('contratar').checked,
  contrDis: document.getElementById('contratar').disabled, segm: document.getElementById('segm').value,
  alm: document.getElementById('almDur').value, sal: document.getElementById('sal').value,
  fases: [...document.querySelectorAll('#fases .fase')].map(b=>b.getAttribute('aria-pressed')).join(),
  tnAuto: document.getElementById('tnAuto').hidden, mtab: document.body.dataset.mtab,
  badge: document.getElementById('mbadge').hidden })"""


def norm(h):
    if h is None:
        return h
    h = h.replace('data-field="opensAt"', 'data-f="a"').replace('data-field="closesAt"', 'data-f="f"')
    return re.sub(r"\s+", " ", re.sub(r">\s+<", "><", h)).strip()


def q(s):
    return repr(s)


def click(sel, i=0):
    return f"(() => {{ const e = document.querySelectorAll({q(sel)})[{i}]; if (!e) return 'missing'; e.click(); return 'ok'; }})()"


def change(sel, v, i=0, ev="change"):
    return (f"(() => {{ const e = document.querySelectorAll({q(sel)})[{i}]; if (!e) return 'missing'; e.value = {q(v)}; "
            f"e.dispatchEvent(new Event({q(ev)}, {{bubbles:true}})); return 'ok'; }})()")


def check(sel, v):
    return (f"(() => {{ const e = document.querySelector({q(sel)}); e.checked = {str(v).lower()}; "
            f"e.dispatchEvent(new Event('change', {{bubbles:true}})); return 'ok'; }})()")


STEPS = [
    ("init", None),
    ("fase40", click("#fases .fase", 2)), ("fase44", click("#fases .fase", 0)), ("fase42", click("#fases .fase", 1)),
    ("contratar off", check("#contratar", False)), ("contratar on", check("#contratar", True)),
    ("cell t click", click("#esc .cell.t", 3)), ("cell f click", click("#esc .cell.f", 1)), ("cell t click 2", click("#esc .cell.t", 10)),
    ("week2", click("#weeks button", 1)), ("cell in w2", click("#esc .cell.f", 0)), ("week4", click("#weeks button", 3)),
    ("undo", click("#undo")),
    ("tn plus", click("#tn .mini button", 1)), ("tn minus", click("#tn .mini button", 4)),
    ("tn time", change("#tn input[type=time]", "09:30", 1)),
    ("tnAuto", click("#tnAuto")),
    ("sal", change("#sal", "3.000,00", 0, "input")), ("ben", change("#ben", "250", 0, "input")),
    ("sx toggle", click("#esc .sx", 2)), ("rename", change("#esc td.nm input", "Zé <b>&\"x\"", 1)),
    ("seg posto", change("#segm", "5")), ("seg lanchonete", change("#segm", "6")), ("fase40b", click("#fases .fase", 2)),
    ("seg escola", change("#segm", "13")), ("sug plus", click("#sug .mini button", 1)), ("sug minus", click("#sug .mini button", 0)),
    ("needAuto", click("#needAuto")),
    ("chip dom", click("#dayrow .dchip", 6)), ("chip sab", click("#dayrow .dchip", 5)), ("chip seg off", click("#dayrow .dchip", 0)),
    ("func change", change("#func input", "10:00", 1)), ("days change", change("#days input", "07:30", 4)),
    ("stepper +F", click(".stepper button[data-c=F][data-d='1']")), ("stepper +M", click(".stepper button[data-c=M][data-d='1']")),
    ("stepper -F", click(".stepper button[data-c=F][data-d='-1']")),
    ("tipo outros", click("#tipo button", 1)),
    ("modelo5", click("#modelos .modelo", 0)), ("modelo6", click("#modelos .modelo", 1)), ("fase42 m6", click("#fases .fase", 1)),
    ("modelo7", click("#modelos .modelo", 2)),
    ("alm30", change("#almDur", "30")), ("alm150", change("#almDur", "150")), ("almIni", change("#almIni", "13:30")),
    ("fase40c", click("#fases .fase", 2)), ("contratar off2", check("#contratar", False)),
    ("seg custom", change("#segm", "-1")), ("chip ter", click("#dayrow .dchip", 1)), ("chip ter2", click("#dayrow .dchip", 1)),
    ("seg hotel", change("#segm", "8")), ("contratar on3", check("#contratar", True)),
    ("tn many plus", click("#tn .mini button", 3)), ("tn many plus2", click("#tn .mini button", 3)),
    ("hire rename", change("#esc tr.novo td.nm input", "Contratado X", 0)),
    ("cells", click("#esc .cell.f", 5)), ("cells2", click("#esc .cell.t", 7)),
    ("exemplo", click("#exemplo")),
    ("drag", "DRAG"), ("reload persists", "RELOAD"), ("go mobile", "MOBILE"), ("mnav escala", click("#mnav button", 1)),
    ("m tap folga", click("#mesc .mx.f", 0)),
    ("m tap work same person", "(() => { const s = document.querySelector('#mesc .mx.f.sel'); const t = s.closest('.mp').querySelector('.mx.t'); t.click(); return 'ok'; })()"),
    ("m tap work toast", click("#mesc .mx.t", 2)), ("m tap folga sel", click("#mesc .mx.f", 3)), ("m cancel", click("#mesc .mx.f.sel", 0)),
    ("mfase 40", click("#mfase button", 2)), ("mnav custo", click("#mnav button", 2)), ("verEscala", click("#verEscala")),
    ("reload m", "RELOAD"),
]


def run(page, url):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.goto(url)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(300)
    out = []
    for name, js in STEPS:
        if js == "MOBILE":
            page.set_viewport_size({"width": 390, "height": 800}); res = "ok"
        elif js == "RELOAD":
            page.reload(); page.wait_for_timeout(300); res = "ok"
        elif js == "DRAG":
            src = page.locator("#esc .cell.f").nth(0)
            dst = src.locator("xpath=ancestor::tr").locator(".cell.t").nth(1)
            a, b = src.bounding_box(), dst.bounding_box()
            page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2); page.mouse.down()
            page.mouse.move(a["x"] + 30, a["y"] + 10, steps=3)
            page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, steps=5); page.mouse.up()
            page.wait_for_timeout(400); res = "ok"
        else:
            res = page.evaluate(js) if js else "ok"
        page.wait_for_timeout(40)
        snap = page.evaluate(SNAP, IDS)
        extra = page.evaluate(EXTRA)
        toast = page.evaluate("(() => { const t = document.getElementById('toast'); return t.hidden ? null : t.className + '|' + t.textContent; })()")
        out.append((name, res, {k: norm(v) for k, v in snap}, extra, toast))
    return out, errors


with sync_playwright() as p:
    br = p.chromium.launch()
    res = {}
    for k, url in TARGETS.items():
        ctx = br.new_context(viewport={"width": 1400, "height": 900})
        res[k] = run(ctx.new_page(), url)
        ctx.close()
    br.close()
srv.terminate()

(o, oe), (n, ne) = res["old"], res["new"]
print("errors old:", oe[:5])
print("errors new:", ne[:5])
diffs = 0
for (name, r1, s1, e1, t1), (_, r2, s2, e2, t2) in zip(o, n):
    if r1 != r2:
        print(f"[{name}] action result differs: {r1} vs {r2}")
    for k in s1:
        if s1[k] != s2[k]:
            if k in ("sug", "tn") and "HIDDEN" in (s1[k], s2[k]):
                continue
            diffs += 1
            if diffs <= 10:
                a, b = s1[k] or "", s2[k] or ""
                i = next((j for j in range(min(len(a), len(b))) if a[j] != b[j]), min(len(a), len(b)))
                print(f"[{name}] #{k} differs at {i}:\n  old: {a[max(0, i - 80):i + 120]!r}\n  new: {b[max(0, i - 80):i + 120]!r}")
    if e1 != e2:
        diffs += 1; print(f"[{name}] extra differs: {e1} vs {e2}")
    if t1 != t2:
        diffs += 1; print(f"[{name}] toast differs:\n  {t1}\n  {t2}")
print("results:", [r for _, r, *_ in o].count("missing"), "missing actions (old)")
print(f"steps: {len(o)}, diffs: {diffs}")
