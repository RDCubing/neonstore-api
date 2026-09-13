const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    discordId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: null }, // Stores image URL or Discord CDN link
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);