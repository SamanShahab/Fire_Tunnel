#!/usr/bin/env python3
"""Three-mode security + performance comparison (SRS FR xi, 1.2 'compare the three modes').
Reads results/<mode>/{scan.gnmap, matrix.csv, perf.csv, vpn-connect.csv, events.csv}
Writes results/comparison.md and results/comparison.csv
"""
import csv, os, re, statistics as st, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")
MODES = [("minimal", "Minimal Protection"), ("firewall", "Firewall-Only Protection"), ("vpn", "Firewall + VPN Protection")]

def read_csv(p):
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []

def scan_stats(mode):
    p = os.path.join(ROOT, mode, "scan.gnmap")
    if not os.path.exists(p): return None
    hosts, ports, services = set(), 0, set()
    for line in open(p):
        if "Status: Up" in line: hosts.add(line.split()[1])
        if "Ports:" in line:
            host = line.split()[1]
            for m in re.finditer(r"(\d+)/open/(\w+)//([^/]*)/", line):
                ports += 1; services.add(f"{host}:{m.group(1)}/{m.group(2)}")
    return {"hosts": len(hosts), "host_list": sorted(hosts), "ports": ports, "services": len(services), "service_list": sorted(services)}

def matrix_stats(mode):
    rows = read_csv(os.path.join(ROOT, mode, "matrix.csv"))
    if not rows: return None
    auth_ok = sum(1 for r in rows if r["Class"] == "auth" and r["Actual"] in ("Allowed", "Encrypted"))
    unauth = [r for r in rows if r["Class"] == "unauth" and r["Actual"] in ("Allowed", "Blocked", "Plaintext")]
    un_ok = sum(1 for r in unauth if r["Actual"] in ("Allowed", "Plaintext"))
    return {"tests": len(rows), "pass": sum(1 for r in rows if r["Pass/Fail"] == "PASS"),
            "blocked": sum(1 for r in rows if r["Actual"] == "Blocked"), "auth_ok": auth_ok,
            "unauth_ok": un_ok, "unauth_blocked": len(unauth) - un_ok}

def perf_stats(mode):
    rows = read_csv(os.path.join(ROOT, mode, "perf.csv")); out = {}
    for path in ("remote->internal", "internal->dmz"):
        lat = [float(r["latency_avg_ms"]) for r in rows if r["path"] == path and r["latency_avg_ms"]]
        thr = [float(r["throughput_mbps"]) for r in rows if r["path"] == path and r["throughput_mbps"]]
        note = next((r["note"] for r in rows if r["path"] == path), "")
        out[path] = {"lat": st.mean(lat) if lat else None, "thr": st.mean(thr) if thr else None, "n": len(lat), "note": note}
    vc = read_csv(os.path.join(ROOT, mode, "vpn-connect.csv"))
    ct = [float(r["connect_time_s"]) for r in vc if r["connect_time_s"]]
    out["vpn_connect"] = st.mean(ct) if ct else None; out["vpn_connect_n"] = len(ct)
    return out

def events_stats(mode):
    rows = read_csv(os.path.join(ROOT, mode, "events.csv"))
    return {"alerts": sum(1 for r in rows if r["alert"] == "ALERT"), "denied": sum(int(r["count"]) for r in rows if r["event"] == "repeated-denied"),
            "vpn_fail": sum(int(r["count"]) for r in rows if r["event"] == "invalid-vpn-auth")}

def fmt(v, unit="", nd=2):
    return "n/a" if v is None else (f"{v:.{nd}f}{unit}" if isinstance(v, float) else f"{v}{unit}")

data = {m: {"scan": scan_stats(m), "mx": matrix_stats(m), "perf": perf_stats(m), "ev": events_stats(m)} for m, _ in MODES}
present = [m for m, _ in MODES if data[m]["scan"] or data[m]["mx"]]
if not present: sys.exit("No results found. Run ./lab.sh run-all first.")
base = data["minimal"]["scan"]

def reduction(mode, key):
    s = data[mode]["scan"]
    if not base or not s or base[key] == 0: return "n/a"
    return f"{(base[key] - s[key]) / base[key] * 100:.1f}%"

rows = []
def row(label, fn, unit=""):
    rows.append([label] + [fn(m) if (data[m]["scan"] or data[m]["mx"]) else "n/a" for m, _ in MODES])

row("Reachable hosts (Nmap from External/Kali)", lambda m: fmt(data[m]["scan"]["hosts"]) if data[m]["scan"] else "n/a")
row("Open/exposed TCP ports", lambda m: fmt(data[m]["scan"]["ports"]) if data[m]["scan"] else "n/a")
row("Exposed services (host:port)", lambda m: fmt(data[m]["scan"]["services"]) if data[m]["scan"] else "n/a")
row("Exposed-service reduction vs baseline", lambda m: "baseline" if m == "minimal" else reduction(m, "services"))
row("Open-port reduction vs baseline", lambda m: "baseline" if m == "minimal" else reduction(m, "ports"))
row("Test-matrix rows executed", lambda m: fmt(data[m]["mx"]["tests"]) if data[m]["mx"] else "n/a")
row("Matrix PASS (behaviour matched policy)", lambda m: f'{data[m]["mx"]["pass"]}/{data[m]["mx"]["tests"]}' if data[m]["mx"] else "n/a")
row("Successful authorized connections", lambda m: fmt(data[m]["mx"]["auth_ok"]) if data[m]["mx"] else "n/a")
row("Unauthorized attempts that SUCCEEDED", lambda m: fmt(data[m]["mx"]["unauth_ok"]) if data[m]["mx"] else "n/a")
row("Unauthorized attempts BLOCKED", lambda m: fmt(data[m]["mx"]["unauth_blocked"]) if data[m]["mx"] else "n/a")
row("Denied connections logged (kernel log)", lambda m: fmt(data[m]["ev"]["denied"]))
row("Invalid VPN auth attempts logged", lambda m: fmt(data[m]["ev"]["vpn_fail"]))
row("Security alerts raised (>=5 from one source)", lambda m: fmt(data[m]["ev"]["alerts"]))
row("Latency remote->internal (avg ms)", lambda m: fmt(data[m]["perf"]["remote->internal"]["lat"], " ms", 3))
row("Throughput remote->internal (avg Mbps)", lambda m: fmt(data[m]["perf"]["remote->internal"]["thr"], " Mbps", 1))
row("Latency internal->dmz (avg ms)", lambda m: fmt(data[m]["perf"]["internal->dmz"]["lat"], " ms", 3))
row("Throughput internal->dmz (avg Mbps)", lambda m: fmt(data[m]["perf"]["internal->dmz"]["thr"], " Mbps", 1))
row("VPN connection time (avg s)", lambda m: fmt(data[m]["perf"]["vpn_connect"], " s") if m == "vpn" else "n/a")
row("Remote traffic readable on External side", lambda m: {"minimal": "yes (plaintext HTTP)", "firewall": "n/a (blocked)", "vpn": "no (encrypted UDP/1194)"}[m])

md = ["# FireTunnel - Security & Performance Comparison", "", f"Generated from `results/` on {__import__('datetime').datetime.now(__import__('datetime').timezone.utc):%Y-%m-%d %H:%M UTC}.", "",
      "| Metric | " + " | ".join(l for _, l in MODES) + " |", "|---|" + "---|" * len(MODES)]
for r in rows: md.append("| " + " | ".join(r) + " |")
md += ["", "Exposed-Service Reduction (%) = (Baseline Exposed Services - Protected Exposed Services) / Baseline Exposed Services x 100 (SRS FR xi); computed only when baseline > 0.", ""]
md += ["## Attack surface detail", ""]
for m, l in MODES:
    s = data[m]["scan"]
    if not s: continue
    md += [f"### {l}", f"Reachable hosts ({s['hosts']}): {', '.join(s['host_list']) or '-'}", "", f"Exposed services ({s['services']}):", ""]
    md += [f"- {x}" for x in s["service_list"]] or ["- none"]
    md.append("")
md += ["## Notes", "",
       "- Performance path `remote->internal` uses the same endpoints in every mode (203.0.113.60 -> 10.10.0.10). In Firewall-Only it is blocked by policy, which is the intended security outcome, so no figure exists. In Firewall + VPN the path gains an encryption hop through the OpenVPN tunnel (documented path change).",
       "- Path `internal->dmz` is routed through the firewall in all three modes and isolates the pure firewall processing overhead.",
       "- 'Reachable hosts' counts every IP that answered host discovery, including the gateway's own interfaces.",
       "- Raw evidence: `results/<mode>/scan.nmap`, `matrix.csv`, `evidence/*.txt|*.pcap`, `perf.csv`, `vpn-connect.csv`, `events.txt`, `fwlog.txt`."]
open(os.path.join(ROOT, "comparison.md"), "w").write("\n".join(md) + "\n")
with open(os.path.join(ROOT, "comparison.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Metric"] + [l for _, l in MODES]); w.writerows(rows)
print("\n".join(md[:len(rows) + 6]))
print(f"\nWritten: {os.path.join(ROOT, 'comparison.md')}  and comparison.csv")
