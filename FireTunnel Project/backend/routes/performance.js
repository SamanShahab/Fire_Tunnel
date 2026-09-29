const router = require("express").Router();
const PerformanceMetric = require("../models/PerformanceMetric");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const metrics = await PerformanceMetric.find().sort({ timestamp: -1 });
  res.json(metrics);
});

router.get("/averages", authMiddleware, async (req, res) => {
  const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];
  const types = ["LATENCY", "THROUGHPUT", "VPN_CONNECT_TIME"];
  const result = {};

  for (const scenario of scenarios) {
    result[scenario] = {};
    for (const type of types) {
      const metrics = await PerformanceMetric.find({ scenario, metricType: type });
      if (metrics.length > 0) {
        const avg = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        result[scenario][type] = { average: parseFloat(avg.toFixed(2)), unit: metrics[0].unit, count: metrics.length };
      }
    }
  }
  res.json(result);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const metric = await PerformanceMetric.create(req.body);
    res.status(201).json(metric);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
