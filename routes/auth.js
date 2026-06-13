const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
    try {
        const { email, username, password } = req.body;

        // basic validation
        if (!email || !username || !password) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        // check existing user (UX check)
        const exists = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (exists) {
            return res.status(400).json({
                error: "Email or username already exists"
            });
        }

        // hash password
        const hash = await bcrypt.hash(password, 10);

        // create user
        await User.create({
            email,
            username,
            passwordHash: hash
        });

        return res.json({ success: true });

    } catch (err) {
        // handle MongoDB duplicate key error (IMPORTANT SAFETY NET)
        if (err.code === 11000) {
            return res.status(400).json({
                error: "Email or username already exists"
            });
        }

        return res.status(500).json({
            error: "Server error"
        });
    }
});


/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // validation
        if (!username || !password) {
            return res.status(400).json({
                error: "Missing credentials"
            });
        }

        // find user
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({
                error: "Invalid credentials"
            });
        }

        // verify password
        const ok = await bcrypt.compare(password, user.passwordHash);

        if (!ok) {
            return res.status(400).json({
                error: "Invalid credentials"
            });
        }

        // create JWT token
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({
            token,
            username: user.username
        });

    } catch (err) {
        return res.status(500).json({
            error: "Server error"
        });
    }
});

module.exports = router;