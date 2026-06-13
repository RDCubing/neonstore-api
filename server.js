require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

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

    app.listen(process.env.PORT || 3000);
})
.catch(err => console.log(err));