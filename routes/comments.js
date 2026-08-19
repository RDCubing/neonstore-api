const express = require("express");
const jwt = require("jsonwebtoken");
const Comment = require("../models/Comment");

const router = express.Router();

/* =========================
   AUTH HELPER
========================= */

function getUser(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");

    try {
        return jwt.verify(
            token,
            process.env.JWT_SECRET
        );
    }
    catch {
        return null;
    }
}

/* =========================
   DISCORD COMMENT EMBED
========================= */

async function sendCommentEmbed(comment) {

    const webhookUrl =
        process.env.DISCORD_COMMENTS_URL;

    if (!webhookUrl) {
        console.log(
            "Discord comments webhook URL not configured."
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
                                    "New News Comment",

                                description:
                                    comment.comment,

                                fields: [
                                    {
                                        name:
                                            "News",

                                        value:
                                            String(
                                                comment.newsId
                                            ),

                                        inline:
                                            true
                                    },

                                    {
                                        name:
                                            "Commented By",

                                        value:
                                            comment.username,

                                        inline:
                                            true
                                    }
                                ],

                                footer: {
                                    text:
                                        "Geek Devs Community • News"
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
                "Discord comment webhook failed:",
                response.status
            );

        }

    }
    catch (err) {

        console.error(
            "Failed to send Discord comment embed:",
            err
        );

    }
}


/* =========================
   CREATE OR UPDATE COMMENT
========================= */

router.post("/", async (req, res) => {

    try {

        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                error: "Invalid or missing token"
            });
        }


        const { newsId, comment } = req.body;


        if (!newsId || !comment) {
            return res.status(400).json({
                error: "Missing fields"
            });
        }


        const result = await Comment.findOneAndUpdate(

            {
                userId: user.id,
                newsId: newsId
            },

            {
                userId: user.id,
                username: user.username,
                newsId: newsId,
                comment: comment,
                updatedAt: new Date()
            },

            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );
		
		await sendCommentEmbed(result);


        res.json({
            success: true,
            comment: result
        });

    }
    catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


/* =========================
   GET COMMENTS FOR NEWS
========================= */

router.get("/", async (req, res) => {

    try {

        const { newsId } = req.query;

        if (!newsId) {
            return res.status(400).json({
                error: "Missing newsId"
            });
        }

        const comments = await Comment.find({
            newsId: newsId
        })
        .sort({
            updatedAt: -1
        });

        res.json(comments);

    }
    catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


/* =========================
   DELETE OWN COMMENT
========================= */

router.delete("/:newsId", async (req, res) => {

    try {

        const user = getUser(req);

        if (!user) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }


        const deleted = await Comment.findOneAndDelete({

            userId: user.id,
            newsId: req.params.newsId

        });


        if (!deleted) {
            return res.status(404).json({
                error: "Comment not found"
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