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
            username: user.username,
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

    res.json({
        success: true,
        review
    });

} catch (err) {
    res.status(500).json({
        error: err.message
    });
}

});

/* =========================
GET REVIEWS FOR APP
========================= */
router.get("/", async (req, res) => {
try {
const reviews = await Review.find({
appId: req.params.appId
})
.sort({
updatedAt: -1
});

    res.json(reviews);

} catch (err) {
    res.status(500).json({
        error: err.message
    });
}

});

/* =========================
DELETE OWN REVIEW
========================= */
router.delete("/", async (req, res) => {
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

} catch (err) {
    res.status(500).json({
        error: err.message
    });
}

});

module.exports = router;