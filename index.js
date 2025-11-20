const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fix CORS for deployment
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/naviga8";

mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Route Schema
const routeSchema = new mongoose.Schema(
  {
    origin: { address: String },
    destination: { address: String },
  },
  { timestamps: true }
);

const Route = mongoose.model("Route", routeSchema);

// Serve static files FIRST
app.use(express.static(path.join(__dirname, "public")));

// API Routes - BACK TO ORIGINAL WORKING VERSION
app.post("/save-route", async (req, res) => {
  const { origin, destination } = req.body;
  if (!origin || !destination)
    return res.status(400).json({ msg: "Origin and destination required" });

  try {
    const originObj = typeof origin === "string" ? { address: origin } : origin;
    const destinationObj = typeof destination === "string" ? { address: destination } : destination;

    const newRoute = new Route({
      origin: originObj,
      destination: destinationObj,
    });
    const savedRoute = await newRoute.save();
    res.json(savedRoute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to save route" });
  }
});

app.get("/routes", async (req, res) => {
  try {
    const routes = await Route.find().sort({ createdAt: -1 });
    res.json(routes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to fetch routes" });
  }
});

app.delete("/delete-route/:id", async (req, res) => {
  try {
    const deleted = await Route.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: "Route not found" });
    res.json({ msg: "Deleted", id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to delete route" });
  }
});

app.get("/api/google-key", (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ msg: "API key not configured" });
  res.json({ key });
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
