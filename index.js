// BunepSMBFPMlGrpq

const express = require("express");
const mongoose = require("mongoose");
// const userRoutes = require("./routes/userRoutes");
require("dotenv").config()

const app = express();
app.use(express.json());

const mongoURI = process.env.DB_HOST;
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
