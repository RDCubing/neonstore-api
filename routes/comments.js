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