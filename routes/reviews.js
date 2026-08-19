const express = require("express");
const jwt = require("jsonwebtoken");
const Review = require("../models/Review");

const router = express.Router();

/* =========================
   AUTH HELPER
========================= */
function getUser(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    }
    catch {
        return null;
    }
}

/* =========================
   DISCORD REVIEW EMBED
========================= */

async function sendReviewEmbed(review) {

    const webhookUrl =
        process.env.DISCORD_REVIEWS_URL;

    if (!webhookUrl) {
        console.log(
            "Discord reviews webhook URL not configured."
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
                                    "New WebStore Review",

                                description:
                                    review.comment,

                                fields: [
                                    {
                                        name:
                                            "Application",

                                        value:
                                            String(
                                                review.appId
                                            ),

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "Rating",

                                        value:
                                            `${review.rating}/5`,

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "Submitted By",

                                        value:
                                            review.username,

                                        inline:
                                            true
                                    }
                                ],

                                footer: {
                                    text:
                                        "Geek Devs Community • WebStore Reviews"
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
                "Discord review webhook failed:",
                response.status
            );
        }

    }
    catch (err) {

        console.error(
            "Failed to send Discord review embed:",
            err
        );

    }
}

/* =========================
   CREATE OR UPDATE REVIEW
========================= */
router.post("/", async (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                error: "Invalid or missing token"
            });
        }

        const { appId, rating, comment } = req.body;

        if (!appId || !rating || !comment) {
            return res.status(400).json({
                error: "Missing fields"
            });
        }

        const review = await Review.findOneAndUpdate(
            {
                userId: user.id,
                appId: appId
            },
            {
                userId: user.id,
                username: user.username,
                appId: appId,
                rating: rating,
                comment: comment,
                updatedAt: new Date()
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );
		
		await sendReviewEmbed(review);

        res.json({
            success: true,
            review
        });
    }
    catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

/* =========================
   GET REVIEWS FOR APP
========================= */
router.get("/:appId", async (req, res) => {
    try {
        const reviews = await Review.find({
            appId: req.params.appId
        })
        .sort({
            updatedAt: -1
        });

        res.json(reviews);
    }
    catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

/* =========================
   DELETE OWN REVIEW
========================= */
router.delete("/:appId", async (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        const deleted = await Review.findOneAndDelete({
            userId: user.id,
            appId: req.params.appId
        });

        if (!deleted) {
            return res.status(404).json({
                error: "Review not found"
            });
        }

        res.json({
            success: true
        });
    }
    catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

module.exports = router;