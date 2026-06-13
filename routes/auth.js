const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
    try {
        const { email, username, password } = req.body;

        const exists = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (exists) {
            return res.status(400).json({ error: "User already exists" });
        }

        const hash = await bcrypt.hash(password, 10);

        await User.create({
            email,
            username,
            passwordHash: hash
        });

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);

        if (!ok) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            username: user.username
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;