const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema({
  scenario: { type: String, enum: ["MINIMAL", "FIREWALL", "FIREWALL_VPN"], required: true },
  timestamp: { type: Date, default: Date.now },
  testName: String,
  source: String,
  destination: String,
  expectedAction: { type: String, enum: ["ALLOW", "BLOCK"] },
  actualAction: { type: String, enum: ["ALLOW", "BLOCK"] },
  status: { type: String, enum: ["PASS", "FAIL"] },
  notes: String,
});

module.exports = mongoose.model("TestResult", testResultSchema);
