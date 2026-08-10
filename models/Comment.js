const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
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

    newsId: {
        type: String,
        required: true,
        index: true
    },

    comment: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    }
},
{
    timestamps: true
});

module.exports = mongoose.model("Comment", CommentSchema);