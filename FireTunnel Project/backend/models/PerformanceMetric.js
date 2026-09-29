const mongoose = require("mongoose");

const performanceMetricSchema = new mongoose.Schema({
  scenario: { type: String, enum: ["MINIMAL", "FIREWALL", "FIREWALL_VPN"], required: true },
  timestamp: { type: Date, default: Date.now },
  metricType: { type: String, enum: ["LATENCY", "THROUGHPUT", "VPN_CONNECT_TIME"] },
  run: { type: Number, min: 1, max: 3 },
  value: Number,
  unit: String,
  source: String,
  destination: String,
});

module.exports = mongoose.model("PerformanceMetric", performanceMetricSchema);
