const router = require("express").Router();
const ScanResult = require("../models/ScanResult");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const scans = await ScanResult.find().sort({ timestamp: -1 });
  res.json(scans);
});

router.get("/comparison", authMiddleware, async (req, res) => {
  const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];
  const result = {};
  for (const s of scenarios) {
    const latest = await ScanResult.findOne({ scenario: s }).sort({ timestamp: -1 });
    result[s] = latest || null;
  }
  res.json(result);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const scan = await ScanResult.create(req.body);
    res.status(201).json(scan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
