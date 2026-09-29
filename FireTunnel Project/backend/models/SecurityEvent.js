const mongoose = require("mongoose");

const securityEventSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  source: String,
  sourceIp: String,
  sourceZone: { type: String, enum: ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN"] },
  destination: String,
  destinationIp: String,
  destinationZone: { type: String, enum: ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN"] },
  protocol: String,
  port: Number,
  action: { type: String, enum: ["ALLOW", "BLOCK"] },
  reason: String,
  scenario: { type: String, enum: ["MINIMAL", "FIREWALL", "FIREWALL_VPN"], default: "FIREWALL" },
});

module.exports = mongoose.model("SecurityEvent", securityEventSchema);
