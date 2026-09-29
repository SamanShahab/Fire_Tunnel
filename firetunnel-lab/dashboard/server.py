#!/usr/bin/env python3
"""FireTunnel control panel.

Runs on the Docker host (the Ubuntu VM), standard library only.
  ./lab.sh dashboard            -> http://127.0.0.1:8088
  ./lab.sh dashboard 0.0.0.0    -> reachable from the VMware host machine too (no auth: lab use only)

It wraps lab.sh / tests/*.sh (one job at a time, live output), reads results/ for evidence, and
queries the running lab (nftables counters, kernel firewall log, OpenVPN status, live path probes).
"""
import argparse, csv, json, os, re, shutil, subprocess, sys, threading, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(ROOT, "results")
STATIC = os.path.join(ROOT, "dashboard", "static")
JOBLOG = os.path.join(RESULTS, "dashboard-jobs")
MODES = ["minimal", "firewall", "firewall-broken", "vpn"]
RESULT_MODES = ["minimal", "firewall", "vpn"]
NODES = ["firewall", "internal", "guest", "dmz", "kali", "vpnclient"]

ACTIONS = {  # whitelist: name -> (label, argv)
    "up":             ("Build & start lab (minimal)",      ["./lab.sh", "up", "minimal"]),
    "verify":         ("Verify connectivity",              ["./lab.sh", "verify"]),
    "pki":            ("Generate VPN PKI",                 ["./lab.sh", "pki"]),
    "nmap":           ("Nmap reconnaissance",              ["tests/run-nmap.sh"]),
    "matrix":         ("Ethical Hacking Test Matrix",      ["tests/run-matrix.sh"]),
    "perf":           ("Performance (ping/iperf3/VPN)",    ["tests/run-perf.sh"]),
    "events":         ("Detect security events",          ["tests/detect-events.sh"]),
    "run-all":        ("RUN ALL: 3 modes + comparison",    ["./lab.sh", "run-all"]),
    "rule-conflict":  ("Rule-conflict exercise",          ["tests/rule-conflict-exercise.sh"]),
    "backup-restore": ("Backup & restore test",           ["tests/backup-restore-test.sh"]),
    "persistence":    ("Restart / persistence test",      ["tests/persistence-test.sh"]),
    "export":         ("Export sanitized configs",        ["tests/export-configs.sh"]),
    "compare":        ("Build comparison report",         ["python3", "tests/compare.py"]),
    "down":           ("Stop lab",                        ["./lab.sh", "down"]),
}
for m in MODES:
    ACTIONS["mode:" + m] = ("Switch to mode " + m, ["./lab.sh", "mode", m])

# Live probes drawn on the topology. (id, src node, src ip, dst label, dst ip, port, expected in hardened modes, expected in minimal)
PROBES = [
    ("guest->internal:80",   "guest",     "10.20.0.10",   "internal",  "10.10.0.10",  80,   "Blocked", "Allowed"),
    ("guest->external:8000", "guest",     "10.20.0.10",   "kali",      "203.0.113.50", 8000, "Allowed", "Allowed"),
    ("external->dmz-web",    "kali",      "203.0.113.50", "dmz",       None,          80,   "Allowed", "Allowed"),
    ("external->dmz:8080",   "kali",      "203.0.113.50", "dmz",       None,          8080, "Blocked", "Allowed"),
    ("external->internal:80","kali",      "203.0.113.50", "internal",  "10.10.0.10",  80,   "Blocked", "Allowed"),
    ("internal->dmz:80",     "internal",  "10.10.0.10",   "dmz",       "10.30.0.10",  80,   "Allowed", "Allowed"),
    ("internal->external",   "internal",  "10.10.0.10",   "kali",      "203.0.113.50", 8000, "Allowed", "Allowed"),
    ("dmz->internal:80",     "dmz",       "10.30.0.10",   "internal",  "10.10.0.10",  80,   "Blocked", "Allowed"),
    ("remote(noVPN)->internal","vpnclient","203.0.113.60","internal",  "10.10.0.10",  80,   "Blocked", "Allowed"),
]


def sh(argv, timeout=20, cwd=ROOT):
    try:
        r = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout + (r.stderr if r.returncode else "")
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except FileNotFoundError as e:
        return 127, str(e)


def current_mode():
    rc, out = sh(["docker", "inspect", "-f", "{{range .Config.Env}}{{println .}}{{end}}", "ft-firewall"], 5)
    if rc:
        return None
    for line in out.splitlines():
        if line.startswith("MODE="):
            return line[5:]
    return None


def containers():
    rc, out = sh(["docker", "ps", "-a", "--filter", "name=^ft-", "--format", "{{.Names}}|{{.State}}|{{.Status}}"], 5)
    res = {}
    for line in out.splitlines():
        p = line.split("|")
        if len(p) == 3:
            res[p[0][3:]] = {"state": p[1], "status": p[2]}
    return {n: res.get(n, {"state": "missing", "status": "not created"}) for n in NODES}


class Job:
    lock = threading.Lock()
    current = None

    def __init__(self, name, argv, env_mode=None):
        self.name, self.argv = name, argv
        self.lines, self.rc, self.start, self.end = [], None, time.time(), None
        os.makedirs(JOBLOG, exist_ok=True)
        self.logfile = os.path.join(JOBLOG, time.strftime("%Y%m%d-%H%M%S-") + re.sub(r"[^a-z0-9-]", "_", name) + ".log")
        env = dict(os.environ, PYTHONUNBUFFERED="1", TERM="dumb")
        if env_mode:
            env["MODE"] = env_mode
        self.proc = subprocess.Popen(argv, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        threading.Thread(target=self._pump, daemon=True).start()

    def _pump(self):
        with open(self.logfile, "w") as f:
            for line in self.proc.stdout:
                line = re.sub(r"\x1b\[[0-9;]*m", "", line.rstrip("\n"))
                self.lines.append(line); f.write(line + "\n"); f.flush()
        self.rc = self.proc.wait(); self.end = time.time()

    def state(self, offset=0):
        return {"name": self.name, "running": self.rc is None, "rc": self.rc, "started": self.start,
                "elapsed": round((self.end or time.time()) - self.start, 1), "offset": len(self.lines),
                "lines": self.lines[offset:], "log": os.path.relpath(self.logfile, ROOT)}

    @classmethod
    def start(cls, name):
        if name not in ACTIONS:
            return None, "unknown action"
        with cls.lock:
            if cls.current and cls.current.rc is None:
                return None, f"job '{cls.current.name}' is still running"
            mode = current_mode() if name in ("nmap", "matrix", "perf", "events") else None
            cls.current = Job(name, ACTIONS[name][1], mode)
            return cls.current, None


def probe_all(mode):
    dmz_public = "10.30.0.10" if mode == "minimal" else "203.0.113.1"

    def one(p):
        pid, src, sip, dlabel, dip, port, exp_h, exp_m = p
        dip = dip or dmz_public
        rc, _ = sh(["docker", "exec", "ft-" + src, "timeout", "4", "nc", "-z", "-w", "3", dip, str(port)], 8)
        actual = "Allowed" if rc == 0 else "Blocked"
        expected = exp_m if mode == "minimal" else exp_h
        return {"id": pid, "src": src, "dst": dlabel, "target": f"{dip}:{port}", "actual": actual, "expected": expected, "ok": actual == expected}
    with ThreadPoolExecutor(max_workers=len(PROBES)) as ex:
        res = list(ex.map(one, PROBES))
    vpn = None
    if mode == "vpn":
        rc, out = sh(["docker", "exec", "ft-vpnclient", "ip", "-4", "-o", "addr", "show", "tun0"], 5)
        vpn = {"tunnel": rc == 0, "addr": out.strip().split()[3] if rc == 0 and len(out.split()) > 3 else None}
    return {"mode": mode, "probes": res, "vpn": vpn}


def ruleset():
    rc, out = sh(["docker", "exec", "ft-firewall", "nft", "list", "ruleset"], 8)
    rules = []
    for line in out.splitlines():
        m = re.search(r'counter packets (\d+) bytes (\d+).*?comment "([^"]+)"', line)
        if m:
            verdict = "drop" if re.search(r"\bdrop\b", line) else ("accept" if "accept" in line else ("nat" if re.search(r"dnat|masquerade", line) else "-"))
            rules.append({"rule": m.group(3), "packets": int(m.group(1)), "bytes": int(m.group(2)), "verdict": verdict})
    return {"text": out, "rules": rules}


def fwlog(since="30 min ago", limit=300):
    rc, out = sh(["journalctl", "-k", "--no-pager", "-o", "short-iso", "--since", since], 15)
    if rc:
        rc, out = sh(["sudo", "-n", "journalctl", "-k", "--no-pager", "-o", "short-iso", "--since", since], 15)
    rows = []
    for line in out.splitlines():
        m = re.search(r"^(\S+).*?(FW-(?:DROP|ALLOW) \S+ )", line)
        if not m:
            continue
        kv = dict(re.findall(r"\b([A-Z]+)=(\S*)", line))
        rows.append({"time": m.group(1)[11:19], "action": "DROP" if "FW-DROP" in line else "ALLOW", "rule": m.group(2).split()[1],
                     "in": kv.get("IN", ""), "out": kv.get("OUT", ""), "src": kv.get("SRC", ""), "dst": kv.get("DST", ""),
                     "proto": kv.get("PROTO", ""), "dpt": kv.get("DPT", ""), "spt": kv.get("SPT", "")})
    rows = rows[-limit:]
    per_src = {}
    for r in rows:
        if r["action"] == "DROP":
            per_src[r["src"]] = per_src.get(r["src"], 0) + 1
    alerts = [{"src": s, "denied": c} for s, c in per_src.items() if c >= 5]
    return {"rows": rows, "denied_per_source": per_src, "alerts": alerts, "readable": rc == 0 or bool(rows)}


def vpn_status():
    rc, st = sh(["docker", "exec", "ft-firewall", "cat", "/opt/lab/vpn/server/openvpn-status.log"], 5)
    rc2, log = sh(["docker", "logs", "--tail", "80", "ft-firewall"], 8)
    fails = [l for l in log.splitlines() if re.search(r"FT-AUTH DENY|AUTH_FAILED|verification failed|certificate revoked|VERIFY ERROR", l)]
    clients = []
    if not rc:
        for line in st.splitlines():
            if line.startswith("CLIENT_LIST,"):
                p = line.split(",")
                if len(p) > 7:
                    clients.append({"name": p[1], "real": p[2], "vip": p[3], "rx": p[5], "tx": p[6], "since": p[7]})
    return {"status_raw": st if not rc else "", "clients": clients, "log": log.splitlines()[-60:], "auth_failures": fails[-20:]}


def read_csv(path):
    if not os.path.exists(path):
        return None
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def read_text(path, limit=200000):
    if not os.path.exists(path):
        return None
    with open(path, errors="replace") as f:
        return f.read(limit)


def results_summary():
    out = {}
    for m in RESULT_MODES:
        d = os.path.join(RESULTS, m)
        mx = read_csv(os.path.join(d, "matrix.csv")) or []
        out[m] = {"has_scan": os.path.exists(os.path.join(d, "scan.gnmap")), "matrix_rows": len(mx),
                  "matrix_pass": sum(1 for r in mx if r.get("Pass/Fail") == "PASS"),
                  "has_perf": os.path.exists(os.path.join(d, "perf.csv")), "has_events": os.path.exists(os.path.join(d, "events.csv"))}
    out["comparison"] = os.path.exists(os.path.join(RESULTS, "comparison.csv"))
    out["extras"] = {k: os.path.isdir(os.path.join(RESULTS, k)) for k in ("rule-conflict", "backup-restore", "persistence", "config-export")}
    return out


def safe_results_path(rel):
    p = os.path.realpath(os.path.join(RESULTS, rel))
    if not p.startswith(os.path.realpath(RESULTS) + os.sep):
        return None
    return p


def evidence(rel):
    p = safe_results_path(rel)
    if not p or not os.path.exists(p):
        return {"error": "not found"}
    if p.endswith(".pcap"):
        if shutil.which("tcpdump"):
            rc, out = sh(["tcpdump", "-nn", "-r", p], 20)
        else:  # host without tcpdump (e.g. WSL + Docker Desktop): decode with the one in ft-kali
            try:
                with open(p, "rb") as f:
                    out = subprocess.run(["docker", "exec", "-i", "ft-kali", "tcpdump", "-nn", "-r", "-"], stdin=f,
                                         capture_output=True, timeout=20).stdout.decode(errors="replace")
            except (subprocess.TimeoutExpired, FileNotFoundError) as e:
                out = str(e)
        lines = out.splitlines()
        return {"name": rel, "kind": "pcap", "packets": len(lines), "text": "\n".join(lines[:200]) + ("\n... (%d more)" % (len(lines) - 200) if len(lines) > 200 else "")}
    return {"name": rel, "kind": "text", "text": read_text(p)}


def list_dir(rel):
    p = safe_results_path(rel)
    if not p or not os.path.isdir(p):
        return []
    return sorted(f for f in os.listdir(p) if os.path.isfile(os.path.join(p, f)))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query); path = u.path
        g = lambda k, d=None: q.get(k, [d])[0]
        try:
            if path == "/":
                body = open(os.path.join(STATIC, "index.html"), "rb").read()
                self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            if path == "/api/state":
                job = Job.current.state(int(g("offset", 0))) if Job.current else None
                return self.send_json({"mode": current_mode(), "containers": containers(), "job": job, "results": results_summary(),
                                       "actions": {k: v[0] for k, v in ACTIONS.items()}, "modes": MODES, "pki": os.path.exists(os.path.join(ROOT, "vpn/server/pki/ca.crt"))})
            if path == "/api/job":
                return self.send_json(Job.current.state(int(g("offset", 0))) if Job.current else None)
            if path == "/api/probe":
                m = current_mode()
                return self.send_json(probe_all(m) if m else {"error": "firewall not running"})
            if path == "/api/ruleset":
                return self.send_json(ruleset())
            if path == "/api/fwlog":
                return self.send_json(fwlog(g("since", "30 min ago")))
            if path == "/api/vpn":
                return self.send_json(vpn_status())
            if path == "/api/results":
                m = g("mode", "minimal")
                if m not in RESULT_MODES:
                    return self.send_json({"error": "bad mode"}, 400)
                d = os.path.join(RESULTS, m)
                return self.send_json({"mode": m, "matrix": read_csv(os.path.join(d, "matrix.csv")), "perf": read_csv(os.path.join(d, "perf.csv")),
                                       "vpn_connect": read_csv(os.path.join(d, "vpn-connect.csv")), "events": read_csv(os.path.join(d, "events.csv")),
                                       "events_txt": read_text(os.path.join(d, "events.txt")), "scan": read_text(os.path.join(d, "scan.nmap")),
                                       "scan_udp": read_text(os.path.join(d, "scan-udp1194.nmap")), "evidence": list_dir(m + "/evidence")})
            if path == "/api/comparison":
                return self.send_json({"table": read_csv(os.path.join(RESULTS, "comparison.csv")), "md": read_text(os.path.join(RESULTS, "comparison.md"))})
            if path == "/api/extras":
                return self.send_json({k: {"files": list_dir(k)} for k in ("rule-conflict", "backup-restore", "persistence", "config-export")})
            if path == "/api/evidence":
                return self.send_json(evidence(g("file", "")))
            self.send_json({"error": "not found"}, 404)
        except Exception as e:  # keep the panel alive
            self.send_json({"error": str(e)}, 500)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        n = int(self.headers.get("Content-Length", 0)); body = json.loads(self.rfile.read(n) or b"{}")
        if u.path == "/api/action":
            job, err = Job.start(body.get("name", ""))
            return self.send_json({"error": err}, 409 if err else 200) if err else self.send_json(job.state())
        if u.path == "/api/cancel":
            if Job.current and Job.current.rc is None:
                Job.current.proc.terminate(); return self.send_json({"ok": True})
            return self.send_json({"ok": False})
        self.send_json({"error": "not found"}, 404)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--port", type=int, default=8088)
    a = ap.parse_args(); os.makedirs(RESULTS, exist_ok=True)
    print(f"FireTunnel dashboard: http://{a.host}:{a.port}/   (lab root: {ROOT})")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()
