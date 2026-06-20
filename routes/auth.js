const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");

const User = require("../models/User");

const router = express.Router();

/* =========================
REGISTER
========================= */
router.post("/register", async (req, res) => {
try {
const { email, username, password } = req.body;

    // Required fields
    if (!email || !username || !password) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    // Email validation
    if (!validator.isEmail(email)) {
        return res.status(400).json({
            error: "Invalid email address"
        });
    }

    // Username length
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
            error: "Username must be between 3 and 20 characters"
        });
    }

    // Username characters
    if (!/^[A-Za-z0-9_]+$/.test(username)) {
        return res.status(400).json({
            error: "Username may only contain letters, numbers, and underscores"
        });
    }

    // Password length
    if (password.length < 8 || password.length > 64) {
        return res.status(400).json({
            error: "Password must be between 8 and 64 characters"
        });
    }

    // Check existing email/username
    const exists = await User.findOne({
        $or: [
            { email },
            { username }
        ]
    });

    if (exists) {
        return res.status(400).json({
            error: "Email or username already exists"
        });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
    await User.create({
        email,
        username,
        passwordHash: hash
    });

    return res.json({
        success: true
    });

} catch (err) {

    // Duplicate key safety net
    if (err.code === 11000) {
        return res.status(400).json({
            error: "Email or username already exists"
        });
    }

    console.error(err);

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
    if (!username || !password) {
        return res.status(400).json({
            error: "Missing credentials"
        });
    }

    const user = await User.findOne({
        username
    });

    if (!user) {
        return res.status(400).json({
            error: "Invalid credentials"
        });
    }

    const validPassword = await bcrypt.compare(
        password,
        user.passwordHash
    );

    if (!validPassword) {
        return res.status(400).json({
            error: "Invalid credentials"
        });
    }

    const token = jwt.sign(
        {
            id: user._id,
            username: user.username
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

    return res.json({
        success: true,
        token,
        username: user.username
    });

} catch (err) {

    console.error(err);

    return res.status(500).json({
        error: "Server error"
    });
}


});

module.exports = router;
