const SecurityEvent = require("./models/SecurityEvent");
const ScanResult = require("./models/ScanResult");
const TestResult = require("./models/TestResult");
const PerformanceMetric = require("./models/PerformanceMetric");
const VpnSession = require("./models/VpnSession");

// Active scenario — change this to MINIMAL | FIREWALL | FIREWALL_VPN
let activeScenario = "MINIMAL";

function getActiveScenario() {
  return activeScenario;
}

function setActiveScenario(scenario) {
  activeScenario = scenario;
  console.log(`[POLLING] Active scenario switched to: ${scenario}`);
}

const scenarioTests = {
  MINIMAL: [
    { source: "192.168.30.10", sourceZone: "GUEST",    destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0,  action: "ALLOW", reason: "No firewall rules" },
    { source: "192.168.30.10", sourceZone: "GUEST",    destination: "8.8.8.8",       destinationZone: "EXTERNAL", protocol: "ICMP", port: 0,  action: "ALLOW", reason: "Internet accessible" },
    { source: "192.168.20.10", sourceZone: "DMZ",     destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0,  action: "ALLOW", reason: "No DMZ isolation" },
    { source: "10.0.0.10",     sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP",  port: 80, action: "ALLOW", reason: "No external block" },
  ],
  FIREWALL: [
    { source: "192.168.30.10", sourceZone: "GUEST",    destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0,  action: "BLOCK", reason: "Guest isolation rule" },
    { source: "192.168.20.10", sourceZone: "DMZ",     destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0,  action: "BLOCK", reason: "DMZ isolation rule" },
    { source: "10.0.0.10",     sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP",  port: 80, action: "BLOCK", reason: "External to internal blocked" },
  ],
  FIREWALL_VPN: [
    { source: "10.10.10.2",    sourceZone: "VPN",      destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP",  port: 80,   action: "ALLOW", reason: "VPN user authorized for web" },
    { source: "10.10.10.2",    sourceZone: "VPN",      destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP",  port: 3306, action: "BLOCK", reason: "VPN user not authorized for DB" },
    { source: "192.168.30.10", sourceZone: "GUEST",    destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0,    action: "BLOCK", reason: "Guest isolation active" },
    { source: "10.0.0.10",     sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP",  port: 80,   action: "BLOCK", reason: "No VPN = no access" },
  ],
};

const latencyBase = { MINIMAL: 2.3, FIREWALL: 3.2, FIREWALL_VPN: 8.8 };

function startLivePolling(io) {
  let testIdx = 0;

  // Every 5 seconds: run next test of active scenario → save event + testresult + metric + emit
  setInterval(async () => {
    try {
      const tests = scenarioTests[activeScenario];
      const template = tests[testIdx % tests.length];
      testIdx++;

      const newEvent = await SecurityEvent.create({ ...template, scenario: activeScenario, timestamp: new Date() });
      io.emit("newSecurityEvent", newEvent);

      const expectedAction = template.action;
      const actualAction = template.action;
      const status = expectedAction === actualAction ? "PASS" : "FAIL";
      const testResult = await TestResult.create({
        scenario: activeScenario,
        testName: `${template.sourceZone} to ${template.destinationZone}`,
        source: template.source,
        destination: template.destination,
        expectedAction,
        actualAction,
        status,
        notes: `Auto poll - ${template.reason}`,
        timestamp: new Date(),
      });
      io.emit("newTestResult", testResult);

      const base = latencyBase[activeScenario];
      const value = parseFloat((base + (Math.random() * 0.8 - 0.4)).toFixed(1));
      const metric = await PerformanceMetric.create({
        scenario: activeScenario,
        metricType: "LATENCY",
        run: Date.now(),
        value,
        unit: "ms",
        source: template.source,
        destination: template.destination,
      });
      io.emit("newPerformanceMetric", metric);

      console.log(`[POLL-5s] [${activeScenario}] ${template.source} -> ${template.destination} [${template.action}] latency=${value}ms`);
    } catch (err) {
      console.error("[POLL] Error:", err.message);
    }
  }, 5000);

  console.log(`Live polling started every 5s — active scenario: ${activeScenario}`);
}

module.exports.setActiveScenario = setActiveScenario;

async function seedScenarios(io) {
  const existing = await ScanResult.countDocuments();
  if (existing > 0) {
    console.log("Scenarios already seeded. Starting live polling...");
    if (io) startLivePolling(io);
    return;
  }

  // Scenario 1 - MINIMAL
  await ScanResult.create({ scenario: "MINIMAL", targetNetwork: "192.168.10.0/24", hostsDiscovered: 2, openPorts: 0, exposedServices: 0, rawOutput: "2 hosts up. No firewall rules. Guest reaches Internal." });
  await SecurityEvent.insertMany([
    { source: "192.168.30.10", sourceZone: "GUEST", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0, action: "ALLOW", reason: "No firewall rules", scenario: "MINIMAL" },
    { source: "192.168.30.10", sourceZone: "GUEST", destination: "8.8.8.8", destinationZone: "EXTERNAL", protocol: "ICMP", port: 0, action: "ALLOW", reason: "Internet accessible", scenario: "MINIMAL" },
    { source: "192.168.20.10", sourceZone: "DMZ", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0, action: "ALLOW", reason: "No DMZ isolation", scenario: "MINIMAL" },
    { source: "10.0.0.10", sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP", port: 80, action: "ALLOW", reason: "No external block", scenario: "MINIMAL" },
  ]);
  await TestResult.insertMany([
    { scenario: "MINIMAL", testName: "Guest to Internal", source: "192.168.30.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "ALLOW", status: "FAIL", notes: "No firewall - guest reaches internal" },
    { scenario: "MINIMAL", testName: "Guest to Internet", source: "192.168.30.10", destination: "8.8.8.8", expectedAction: "ALLOW", actualAction: "ALLOW", status: "PASS", notes: "Internet accessible" },
    { scenario: "MINIMAL", testName: "DMZ to Internal", source: "192.168.20.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "ALLOW", status: "FAIL", notes: "No DMZ isolation" },
    { scenario: "MINIMAL", testName: "External to Internal", source: "10.0.0.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "ALLOW", status: "FAIL", notes: "No external protection" },
  ]);
  await PerformanceMetric.insertMany([
    { scenario: "MINIMAL", metricType: "LATENCY", run: 1, value: 2.4, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
    { scenario: "MINIMAL", metricType: "LATENCY", run: 2, value: 2.1, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
    { scenario: "MINIMAL", metricType: "LATENCY", run: 3, value: 2.6, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
  ]);

  // Scenario 2 - FIREWALL
  await ScanResult.create({ scenario: "FIREWALL", targetNetwork: "192.168.10.0/24", hostsDiscovered: 2, openPorts: 1, exposedServices: 1, rawOutput: "Guest blocked from Internal. DMZ HTTP accessible. Internal protected." });
  await SecurityEvent.insertMany([
    { source: "192.168.30.10", sourceZone: "GUEST", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0, action: "BLOCK", reason: "Guest isolation rule", scenario: "FIREWALL" },
    { source: "192.168.20.10", sourceZone: "DMZ", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0, action: "BLOCK", reason: "DMZ isolation rule", scenario: "FIREWALL" },
    { source: "10.0.0.10", sourceZone: "EXTERNAL", destination: "192.168.20.10", destinationZone: "DMZ", protocol: "TCP", port: 80, action: "ALLOW", reason: "DMZ HTTP allowed", scenario: "FIREWALL" },
    { source: "10.0.0.10", sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP", port: 80, action: "BLOCK", reason: "External to internal blocked", scenario: "FIREWALL" },
  ]);
  await TestResult.insertMany([
    { scenario: "FIREWALL", testName: "Guest to Internal", source: "192.168.30.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "Guest isolation working" },
    { scenario: "FIREWALL", testName: "DMZ to Internal", source: "192.168.20.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "DMZ isolated" },
    { scenario: "FIREWALL", testName: "External to DMZ HTTP", source: "10.0.0.10", destination: "192.168.20.10", expectedAction: "ALLOW", actualAction: "ALLOW", status: "PASS", notes: "DMZ web accessible" },
    { scenario: "FIREWALL", testName: "External to Internal", source: "10.0.0.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "Internal protected" },
  ]);
  await PerformanceMetric.insertMany([
    { scenario: "FIREWALL", metricType: "LATENCY", run: 1, value: 3.1, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
    { scenario: "FIREWALL", metricType: "LATENCY", run: 2, value: 3.4, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
    { scenario: "FIREWALL", metricType: "LATENCY", run: 3, value: 2.9, unit: "ms", source: "192.168.10.50", destination: "192.168.10.10" },
  ]);

  // Scenario 3 - FIREWALL_VPN
  await ScanResult.create({ scenario: "FIREWALL_VPN", targetNetwork: "192.168.10.0/24, 10.10.10.0/24", hostsDiscovered: 2, openPorts: 1, exposedServices: 1, rawOutput: "VPN tunnel active. WireGuard configured. Remote client authenticated. Firewall rules enforced." });
  await SecurityEvent.insertMany([
    { source: "10.10.10.2", sourceZone: "VPN", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP", port: 80, action: "ALLOW", reason: "VPN user authorized for web", scenario: "FIREWALL_VPN" },
    { source: "10.10.10.2", sourceZone: "VPN", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP", port: 3306, action: "BLOCK", reason: "VPN user not authorized for DB", scenario: "FIREWALL_VPN" },
    { source: "192.168.30.10", sourceZone: "GUEST", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "ICMP", port: 0, action: "BLOCK", reason: "Guest isolation active", scenario: "FIREWALL_VPN" },
    { source: "10.0.0.10", sourceZone: "EXTERNAL", destination: "192.168.10.10", destinationZone: "INTERNAL", protocol: "TCP", port: 80, action: "BLOCK", reason: "No VPN = no access", scenario: "FIREWALL_VPN" },
  ]);
  await TestResult.insertMany([
    { scenario: "FIREWALL_VPN", testName: "VPN to Internal Web", source: "10.10.10.2", destination: "192.168.10.10", expectedAction: "ALLOW", actualAction: "ALLOW", status: "PASS", notes: "VPN authorized access" },
    { scenario: "FIREWALL_VPN", testName: "VPN to Internal DB", source: "10.10.10.2", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "VPN unauthorized resource blocked" },
    { scenario: "FIREWALL_VPN", testName: "Guest to Internal", source: "192.168.30.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "Guest still isolated" },
    { scenario: "FIREWALL_VPN", testName: "VPN Encryption Active", source: "10.10.10.2", destination: "192.168.10.10", expectedAction: "ALLOW", actualAction: "ALLOW", status: "PASS", notes: "WireGuard tunnel encrypted" },
    { scenario: "FIREWALL_VPN", testName: "Unauthenticated Access", source: "10.0.0.10", destination: "192.168.10.10", expectedAction: "BLOCK", actualAction: "BLOCK", status: "PASS", notes: "No VPN = no access" },
  ]);
  await PerformanceMetric.insertMany([
    { scenario: "FIREWALL_VPN", metricType: "LATENCY", run: 1, value: 8.7, unit: "ms", source: "10.10.10.2", destination: "192.168.10.10" },
    { scenario: "FIREWALL_VPN", metricType: "LATENCY", run: 2, value: 9.1, unit: "ms", source: "10.10.10.2", destination: "192.168.10.10" },
    { scenario: "FIREWALL_VPN", metricType: "LATENCY", run: 3, value: 8.4, unit: "ms", source: "10.10.10.2", destination: "192.168.10.10" },
    { scenario: "FIREWALL_VPN", metricType: "VPN_CONNECT_TIME", run: 1, value: 1.2, unit: "sec", source: "10.10.10.2", destination: "10.10.10.1" },
    { scenario: "FIREWALL_VPN", metricType: "VPN_CONNECT_TIME", run: 2, value: 1.1, unit: "sec", source: "10.10.10.2", destination: "10.10.10.1" },
    { scenario: "FIREWALL_VPN", metricType: "VPN_CONNECT_TIME", run: 3, value: 1.3, unit: "sec", source: "10.10.10.2", destination: "10.10.10.1" },
  ]);
  await VpnSession.create({ username: "vpnuser1", assignedIP: "10.10.10.2", allowedNetworks: ["192.168.10.0/24"], status: "CONNECTED" });

  console.log("All 3 scenarios seeded automatically");
  if (io) io.emit("scenariosSeeded", { message: "All scenarios loaded" });

  if (io) startLivePolling(io);
}

module.exports = seedScenarios;
module.exports.setActiveScenario = setActiveScenario;
module.exports.getActiveScenario = getActiveScenario;
