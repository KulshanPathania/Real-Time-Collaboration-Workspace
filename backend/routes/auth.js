import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

// Register
router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        message: "Name must be between 2 and 80 characters.",
      });
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user;

    try {
      user = await User.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      throw error;
    }

    // Create a fresh session after registration.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    req.session.userId = user._id.toString();

    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.status(201).json({
      message: "Registration successful.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Regenerate the session to reduce session-fixation risk.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    req.session.userId = user._id.toString();

    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.json({
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// Check whether the current session is authenticated.
router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not logged in.",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "Session is no longer valid.",
      });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post("/logout", async (req, res, next) => {
  try {
    if (!req.session) {
      return res.json({ message: "Logged out." });
    }

    await new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    res.clearCookie("collab.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
});

export default router;