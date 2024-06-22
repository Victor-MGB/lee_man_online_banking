const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const registrationRoute = require("./routes/userRoutes");
const adminRoute = require("./routes/adminRoutes");


require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Database connection
mongoose
  .connect(process.env.DB_HOST)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}, Request Method: ${req.method}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});


// Routes
app.use("/api", registrationRoute);
app.use("/admin",adminRoute);


// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
