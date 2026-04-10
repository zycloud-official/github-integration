import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/auth.js";
import { webhookRoutes } from "./routes/webhook.js";
import { dashboardRoutes } from "./routes/dashboard.js";

const app = express();

// Parse JSON and capture raw bytes — required for webhook HMAC verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(cookieParser());

app.use(authRoutes);
app.use(webhookRoutes);
app.use(dashboardRoutes);

app.get("/health", (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`github-integration listening on port ${port}`);
});
