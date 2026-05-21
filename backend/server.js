const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const tiktokRoutes = require("./routes/tiktokRoutes");

const app = express();

connectDB();
app.set("trust proxy", 1);

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const corsOrigins = [frontendUrl, "http://localhost:3000", "http://127.0.0.1:3000"].filter(
  (v, i, a) => a.indexOf(v) === i
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tiktok", tiktokRoutes);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, sandbox: process.env.TIKTOK_SANDBOX === "true" });
});

const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
