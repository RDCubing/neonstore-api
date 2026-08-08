require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

app.use("/auth", require("./routes/auth"));
app.use("/reviews", require("./routes/reviews"));

app.get("/", (req, res) => {
    res.send("NeonStore API running ✔");
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB Connected ✔");

        app.listen(PORT, HOST, () => {
            console.log(`NeonStore API running at http://${HOST}:${PORT}`);
        });
    })
    .catch(err => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });