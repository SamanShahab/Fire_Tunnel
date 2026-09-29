const router = require("express").Router();
const SecurityEvent = require("../models/SecurityEvent");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const { scenario, action, limit = 100 } = req.query;
  const filter = {};
  if (scenario) filter.scenario = scenario;
  if (action) filter.action = action;
  const events = await SecurityEvent.find(filter).sort({ timestamp: -1 }).limit(Number(limit));
  res.json(events);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const event = await SecurityEvent.create(req.body);
    req.app.get("io").emit("newEvent", event);
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/stats", authMiddleware, async (req, res) => {
  const { scenario } = req.query;
  const filter = scenario ? { scenario } : {};
  const [total, blocked, allowed] = await Promise.all([
    SecurityEvent.countDocuments(filter),
    SecurityEvent.countDocuments({ ...filter, action: "BLOCK" }),
    SecurityEvent.countDocuments({ ...filter, action: "ALLOW" }),
  ]);
  res.json({ total, blocked, allowed });
});

module.exports = router;
