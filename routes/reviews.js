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
    } catch {
        return null;
    }
}

/* =========================
   CREATE REVIEW
========================= */
router.post("/", async (req, res) => {
    try {
        const user = getUser(req);

        if (!user) {
            return res.status(401).json({ error: "Invalid or missing token" });
        }

        const { appId, rating, comment } = req.body;

        if (!appId || !rating || !comment) {
            return res.status(400).json({ error: "Missing fields" });
        }

        const review = await Review.create({
            userId: user.id,
            username: user.username,
            appId,
            rating,
            comment
        });

        res.json({ success: true, review });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   GET REVIEWS BY APP
========================= */
router.get("/:appId", async (req, res) => {
    try {
        const reviews = await Review.find({ appId: req.params.appId })
            .sort({ createdAt: -1 });

        res.json(reviews);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   UPDATE REVIEW (OWNER ONLY)
========================= */
router.put("/:id", async (req, res) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }

        if (review.userId.toString() !== user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }

        const { rating, comment } = req.body;

        if (rating) review.rating = rating;
        if (comment) review.comment = comment;

        await review.save();

        res.json({ success: true, review });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* =========================
   DELETE REVIEW (OWNER ONLY)
========================= */
router.delete("/:id", async (req, res) => {
    try {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }

        if (review.userId.toString() !== user.id) {
            return res.status(403).json({ error: "Not allowed" });
        }

        await review.deleteOne();

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;