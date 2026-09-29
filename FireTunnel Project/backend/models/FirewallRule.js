const mongoose = require("mongoose");

const firewallRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sourceZone: { type: String, enum: ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN", "ANY"] },
  destinationZone: { type: String, enum: ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN", "ANY"] },
  sourceIP: { type: String, default: "ANY" },
  destinationIP: { type: String, default: "ANY" },
  protocol: { type: String, default: "ANY" },
  port: { type: String, default: "ANY" },
  action: { type: String, enum: ["ALLOW", "BLOCK"], required: true },
  priority: { type: Number, default: 100 },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FirewallRule", firewallRuleSchema);
