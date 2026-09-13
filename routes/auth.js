const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");

const User = require("../models/User");

const router = express.Router();

/* =========================
   DISCORD NEW USER EMBED
========================= */

async function sendNewUserEmbed(user) {

    const webhookUrl =
        process.env.DISCORD_USERS_URL;

    if (!webhookUrl) {
        console.log(
            "Discord users webhook URL not configured."
        );

        return;
    }

    try {

        const response =
            await fetch(
                webhookUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        embeds: [
                            {
                                title:
                                    "New GDC Account Created",

                                description:
                                    `Welcome to the Geek Devs Community, **${user.username}**!`,

                                fields: [
                                    {
                                        name:
                                            "Username",

                                        value:
                                            user.username,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "Joined",

                                        value:
                                            new Date()
                                                .toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        year:
                                                            "numeric",

                                                        month:
                                                            "long",

                                                        day:
                                                            "numeric"
                                                    }
                                                ),

                                        inline:
                                            true
                                    }
                                ],

                                footer: {
                                    text:
                                        "Geek Devs Community • Accounts"
                                },

                                timestamp:
                                    new Date()
                                        .toISOString()
                            }
                        ]

                    })
                }
            );

        if (!response.ok) {

            console.error(
                "Discord user webhook failed:",
                response.status
            );

        }

    }
    catch (err) {

        console.error(
            "Failed to send Discord new user embed:",
            err
        );

    }
}

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

    const newUser = await User.create({
		email,
		username,
		passwordHash: hash
	});

	// Discord notification
	await sendNewUserEmbed(newUser);

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
            expiresIn: "30d"
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

const crypto = require("crypto");

// Whitelist of domains your site is allowed to run on
const ALLOWED_ORIGINS = [
    "https://gdcr.dankassassin368.com",
    "https://rdcubing.github.io",
    "http://localhost:3000" // For local development
];

/* =========================
   DISCORD OAUTH2 LOGIN
========================= */

// 1. Initiate OAuth
router.get("/discord", (req, res) => {
    // 1. Prioritize ?origin= query param, 2. check Referer header, 3. fallback to default
    let detectedOrigin = req.query.origin;

    if (!detectedOrigin && req.headers.referer) {
        try {
            detectedOrigin = new URL(req.headers.referer).origin;
        } catch {
            detectedOrigin = null;
        }
    }

    // Ensure it matches your approved domain list
    const activeDomain = ALLOWED_ORIGINS.includes(detectedOrigin) 
        ? detectedOrigin 
        : ALLOWED_ORIGINS[0];

    const csrf = crypto.randomBytes(16).toString("hex");

    // Store CSRF in cookie
    res.cookie("oauth_state", csrf, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000
    });

    // Pack the actual origin into the state payload
    const statePayload = Buffer.from(
        JSON.stringify({ origin: activeDomain, csrf })
    ).toString("base64url");

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify email",
        state: statePayload
    });

    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// 2. Callback
router.get("/discord/callback", async (req, res) => {
    const { code, state } = req.query;

    let targetOrigin = ALLOWED_ORIGINS[0];
    let stateCsrf = null;

    // Unpack the exact domain that sent the request
    if (state) {
        try {
            const decoded = JSON.parse(
                Buffer.from(state, "base64url").toString("utf-8")
            );
            if (ALLOWED_ORIGINS.includes(decoded.origin)) {
                targetOrigin = decoded.origin;
            }
            stateCsrf = decoded.csrf;
        } catch {
            // Keep fallback
        }
    }

    const savedState = req.cookies?.oauth_state;
    res.clearCookie("oauth_state");

    if (!code) {
        return res.redirect(`${targetOrigin}/account/?error=no_code`);
    }

    if (savedState && stateCsrf !== savedState) {
        return res.redirect(`${targetOrigin}/account/?error=invalid_state`);
    }

    try {
        // Exchange code with Discord and process user...
        // (Keep your existing token exchange and User logic here)

        const token = jwt.sign(
            { id: user._id, username: user.username, avatar: user.avatar },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Redirect back to the exact domain the user came from
        const redirectUrl = new URL(`${targetOrigin}/account/`);
        redirectUrl.searchParams.set("token", token);
        redirectUrl.searchParams.set("username", user.username);
        if (user.avatar) {
            redirectUrl.searchParams.set("avatar", user.avatar);
        }

        res.redirect(redirectUrl.toString());
    } catch (err) {
        res.redirect(`${targetOrigin}/account/?error=oauth_failed`);
    }
});

module.exports = router;
