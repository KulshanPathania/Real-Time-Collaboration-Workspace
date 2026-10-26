import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI || !process.env.SESSION_SECRET) {
  throw new Error("MONGO_URI and SESSION_SECRET must be set in .env");
}

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

app.use(express.json());

app.use(express.json({ limit: "10kb" }));

app.use(
  session({
    name: "collab.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "A server error occurred. Please try again.",
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });