const dgram = require("dgram");
const SecurityEvent = require("./models/SecurityEvent");

// OPNsense firewall log example:
// <4>filterlog: 5,,,1000000103,em1,match,block,in,4,0x0,,64,0,0,DF,1,icmp,84,192.168.30.10,192.168.10.10,request
// <6>filterlog: 5,,,1000000103,em1,match,pass,in,4,0x0,,64,12345,0,DF,6,tcp,60,10.0.0.10,192.168.20.10,1234,80,S

const IP_ZONE_MAP = {
  "192.168.10": "INTERNAL",
  "192.168.20": "DMZ",
  "192.168.30": "GUEST",
  "10.10.10":   "VPN",
  "10.0.0":     "EXTERNAL",
};

function getZone(ip) {
  for (const prefix of Object.keys(IP_ZONE_MAP)) {
    if (ip.startsWith(prefix)) return IP_ZONE_MAP[prefix];
  }
  return "EXTERNAL";
}

function getScenario(srcZone, dstZone, action) {
  if (srcZone === "VPN" || dstZone === "VPN") return "FIREWALL_VPN";
  if (action === "BLOCK") return "FIREWALL";
  return "MINIMAL";
}

function parseOPNsenseLog(raw) {
  // Must contain filterlog
  if (!raw.includes("filterlog")) return null;

  const parts = raw.split("filterlog: ")[1];
  if (!parts) return null;

  const fields = parts.split(",");
  // fields[6] = action (pass/block), fields[16] = protocol, fields[18] = src ip, fields[19] = dst ip
  // fields[20] = src port (tcp/udp), fields[21] = dst port (tcp/udp)
  if (fields.length < 19) return null;

  const actionRaw = fields[6]?.trim().toLowerCase();
  const action    = actionRaw === "pass" ? "ALLOW" : "BLOCK";
  const protocol  = fields[16]?.trim().toUpperCase() || "TCP";
  const srcIP     = fields[18]?.trim();
  const dstIP     = fields[19]?.trim();
  const port      = parseInt(fields[21]) || 0;

  if (!srcIP || !dstIP) return null;

  const sourceZone      = getZone(srcIP);
  const destinationZone = getZone(dstIP);
  const scenario        = getScenario(sourceZone, destinationZone, action);

  return {
    source:           srcIP,
    sourceZone,
    destination:      dstIP,
    destinationZone,
    protocol,
    port,
    action,
    reason:           `OPNsense firewall - ${actionRaw}`,
    scenario,
    timestamp:        new Date(),
  };
}

function startSyslogReceiver(io) {
  const server = dgram.createSocket("udp4");

  server.on("message", async (msg) => {
    const raw = msg.toString();
    const parsed = parseOPNsenseLog(raw);
    if (!parsed) return;

    try {
      const event = await SecurityEvent.create(parsed);
      io.emit("newSecurityEvent", event);
      console.log(`[SYSLOG] ${parsed.source} -> ${parsed.destination} [${parsed.action}] ${parsed.protocol}:${parsed.port}`);
    } catch (err) {
      console.error("[SYSLOG] DB error:", err.message);
    }
  });

  server.on("error", (err) => console.error("[SYSLOG] UDP error:", err.message));

  server.bind(514, () => console.log("[SYSLOG] Listening on UDP port 514"));
}

module.exports = startSyslogReceiver;
