const router = require("express").Router();
const FirewallRule = require("../models/FirewallRule");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const rules = await FirewallRule.find().sort({ priority: 1 });
  res.json(rules);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const rule = await FirewallRule.create(req.body);
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const rule = await FirewallRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(rule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  await FirewallRule.findByIdAndDelete(req.params.id);
  res.json({ message: "Rule deleted" });
});

// Detect conflicts: same source/dest zones with different actions
router.get("/conflicts", authMiddleware, async (req, res) => {
  const rules = await FirewallRule.find({ enabled: true }).sort({ priority: 1 });
  const conflicts = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i], b = rules[j];
      if (
        a.sourceZone === b.sourceZone &&
        a.destinationZone === b.destinationZone &&
        a.action !== b.action
      ) {
        conflicts.push({ rule1: a, rule2: b, message: `Rule "${a.name}" conflicts with "${b.name}"` });
      }
    }
  }
  res.json(conflicts);
});

module.exports = router;
