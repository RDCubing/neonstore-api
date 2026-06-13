const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
{
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    username: {
        type: String,
        required: true,
        trim: true
    },

    appId: {
        type: String,
        required: true,
        index: true
    },

    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },

    comment: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    }
},
{
    timestamps: true // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model("Review", ReviewSchema);