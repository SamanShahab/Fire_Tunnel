const router = require("express").Router();
const TestResult = require("../models/TestResult");
const authMiddleware = require("../middleware/auth");

router.get("/", authMiddleware, async (req, res) => {
  const { scenario, limit } = req.query;
  const filter = scenario ? { scenario } : {};
  const tests = await TestResult.find(filter).sort({ timestamp: -1 }).limit(Number(limit) || 200);
  res.json(tests);
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const test = await TestResult.create(req.body);
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/bulk", authMiddleware, async (req, res) => {
  try {
    const tests = await TestResult.insertMany(req.body);
    res.status(201).json(tests);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
