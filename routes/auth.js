const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const crypto = require("crypto");

const User = require("../models/User");
const Review = require("../models/Review");
const Comment = require("../models/Comment");

const router = express.Router();

const ALLOWED_ORIGINS = [
    "https://gdcr.dankassassin368.com",
    "https://rdcubing.github.io",
    "http://localhost:3000"
];

/* =========================
   DISCORD NEW USER EMBED
========================= */
async function sendNewUserEmbed(user) {
    const webhookUrl = process.env.DISCORD_USERS_URL;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                embeds: [
                    {
                        title: "New GDC Account Created",
                        description: `Welcome to the Geek Devs Community, **${user.username}**!`,
                        thumbnail: user.avatar ? { url: user.avatar } : undefined,
                        fields: [
                            { name: "Username", value: user.username, inline: true },
                            {
                                name: "Joined",
                                value: new Date().toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                                }),
                                inline: true
                            }
                        ],
                        footer: { text: "Geek Devs Community • Accounts" },
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });
    } catch (err) {
        console.error("Failed to send Discord user webhook:", err);
    }
}

/* =========================
   SHARED DISCORD USER HELPER
========================= */
async function processDiscordUser(discordUser) {
    const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

    // Only permit email linking if Discord explicitly confirmed the email is verified
    const isEmailVerified = Boolean(discordUser.email && discordUser.verified);

    // 1. Locate existing account by permanent Discord Snowflake ID (or verified email fallback)
    let user = await User.findOne({
        $or: [
            { discordId: discordUser.id },
            ...(isEmailVerified ? [{ email: discordUser.email }] : [])
        ]
    });

    let nameCollision = false;

    if (!user) {
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        // Keep raw Discord handle without cutting, slicing, or regex character stripping
        let username = discordUser.username || discordUser.global_name || `User_${discordUser.id}`;

        // Handle collision only if another account took this exact username
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            username = `${username}_${discordUser.id.slice(-4)}`;
            nameCollision = true;
        }

        user = await User.create({
            username,
            email: isEmailVerified ? discordUser.email : `${discordUser.id}@discord.placeholder`,
            passwordHash,
            discordId: discordUser.id,
            avatar: avatarUrl
        });

        await sendNewUserEmbed(user);
    } else {
        let userUpdated = false;
        const oldUsername = user.username;
        const oldAvatar = user.avatar;

        // 2. Check for username updates
        const currentDiscordName = discordUser.username || discordUser.global_name;
        let newUsername = oldUsername;

        if (currentDiscordName && oldUsername !== currentDiscordName) {
            const nameTaken = await User.findOne({ 
                username: currentDiscordName, 
                _id: { $ne: user._id } 
            });

            if (nameTaken) {
                // Suffix with last 4 digits of snowflake to ensure rename succeeds
                newUsername = `${currentDiscordName}_${discordUser.id.slice(-4)}`;
                user.username = newUsername;
                nameCollision = true;
                userUpdated = true;
            } else {
                user.username = currentDiscordName;
                newUsername = currentDiscordName;
                userUpdated = true;
            }
        }

        // 3. Check for avatar updates
        let newAvatar = oldAvatar;
        if (oldAvatar !== avatarUrl) {
            user.avatar = avatarUrl;
            newAvatar = avatarUrl;
            userUpdated = true;
        }

        // Ensure permanent ID is linked
        if (!user.discordId) {
            user.discordId = discordUser.id;
            userUpdated = true;
        }

        if (userUpdated) {
            await user.save();

            // 4. Cascade updates across all historical Reviews and Comments
            const updatePayload = {};
            if (newUsername !== oldUsername) updatePayload.username = newUsername;
            if (newAvatar !== oldAvatar) updatePayload.avatar = newAvatar;

            if (Object.keys(updatePayload).length > 0) {
                await Promise.all([
                    Review.updateMany(
                        { $or: [{ userId: user._id }, { username: oldUsername }] },
                        { $set: updatePayload }
                    ),
                    Comment.updateMany(
                        { $or: [{ userId: user._id }, { username: oldUsername }] },
                        { $set: updatePayload }
                    )
                ]);
            }
        }
    }

    return { user, nameCollision };
}

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: "Invalid email address" });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: "Username must be between 3 and 20 characters" });
        }

        if (!/^[A-Za-z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: "Username may only contain letters, numbers, and underscores" });
        }

        if (password.length < 8 || password.length > 64) {
            return res.status(400).json({ error: "Password must be between 8 and 64 characters" });
        }

        const exists = await User.findOne({ $or: [{ email }, { username }] });
        if (exists) {
            return res.status(400).json({ error: "Email or username already exists" });
        }

        const hash = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, username, passwordHash: hash });

        await sendNewUserEmbed(newUser);

        return res.json({ success: true });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: "Email or username already exists" });
        }
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Missing credentials" });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, avatar: user.avatar || null },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        return res.json({
            success: true,
            token,
            username: user.username,
            avatar: user.avatar || null
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

/* =========================
   GET CURRENT USER PROFILE (LIVE HYDRATION)
========================= */
router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-passwordHash");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.json({
            id: user._id,
            username: user.username,
            avatar: user.avatar || null,
            email: user.email,
            discordId: user.discordId || null
        });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

/* =========================
   DISCORD OAUTH2 (BROWSER)
========================= */
router.get("/discord", (req, res) => {
    let detectedOrigin = req.query.origin;

    if (!detectedOrigin && req.headers.referer) {
        try {
            detectedOrigin = new URL(req.headers.referer).origin;
        } catch {
            detectedOrigin = null;
        }
    }

    const activeDomain = ALLOWED_ORIGINS.includes(detectedOrigin)
        ? detectedOrigin
        : ALLOWED_ORIGINS[0];

    const csrf = crypto.randomBytes(16).toString("hex");

    res.cookie("oauth_state", csrf, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000
    });

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

router.get("/discord/callback", async (req, res) => {
    const { code, state } = req.query;

    let targetOrigin = ALLOWED_ORIGINS[0];
    let stateCsrf = null;

    if (state) {
        try {
            const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
            if (ALLOWED_ORIGINS.includes(decoded.origin)) {
                targetOrigin = decoded.origin;
            }
            stateCsrf = decoded.csrf;
        } catch {}
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
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI
            }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            console.error("Discord token error:", tokenData);
            return res.redirect(`${targetOrigin}/account/?error=token_exchange_failed`);
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const discordUser = await userRes.json();
        if (!userRes.ok || !discordUser.id) {
            console.error("Discord profile error:", discordUser);
            return res.redirect(`${targetOrigin}/account/?error=profile_fetch_failed`);
        }

        const { user, nameCollision } = await processDiscordUser(discordUser);

        const token = jwt.sign(
            { id: user._id, username: user.username, avatar: user.avatar || null },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

		const redirectUrl = new URL(`${targetOrigin}/account/`);
        redirectUrl.searchParams.set("token", token);
        // Explicitly encode in case of emojis, spaces, or # symbols
        redirectUrl.searchParams.set("username", encodeURIComponent(user.username));
        if (user.avatar) {
            redirectUrl.searchParams.set("avatar", encodeURIComponent(user.avatar));
        }
        if (nameCollision) {
            redirectUrl.searchParams.set("name_collision", "true");
        }

        return res.redirect(redirectUrl.toString());
    } catch (err) {
        console.error("Discord OAuth Error:", err);
        return res.redirect(`${targetOrigin}/account/?error=oauth_failed`);
    }
});

/* =========================
   NATIVE API TOKEN EXCHANGE
========================= */
router.post("/discord/token", async (req, res) => {
    const { code, redirect_uri } = req.body;

    if (!code) {
        return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirect_uri || process.env.DISCORD_REDIRECT_URI
            }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            return res.status(400).json({
                error: "Token exchange failed",
                details: tokenData
            });
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const discordUser = await userRes.json();
        if (!userRes.ok || !discordUser.id) {
            return res.status(400).json({ error: "Failed to fetch Discord user profile" });
        }

        const { user, nameCollision } = await processDiscordUser(discordUser);

        const token = jwt.sign(
            { id: user._id, username: user.username, avatar: user.avatar || null },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        return res.json({
            success: true,
            token,
            nameCollision,
            user: {
                id: user._id,
                username: user.username,
                avatar: user.avatar
            }
        });
    } catch (err) {
        console.error("Native Discord OAuth Error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;