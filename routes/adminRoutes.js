const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Admin = require("../models/Admin"); // Ensure this path is correct

const app = express();
app.use(express.json());

// Function to generate a random alphanumeric string
const IdGen = (length) => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
};

// Function to generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

// Admin registration (sign up)
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ error: "Admin already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new admin object
    const newAdmin = new Admin({
      username,
      email,
      password: hashedPassword,
    });

    // Save the new admin
    await newAdmin.save();

    // Return success message along with the admin details
    res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
      },
    });
  } catch (error) {
    console.error("Error during admin registration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "No records found" });
    }

    // Check password
    const isMatch = await bcrypt.compare(
      password,
      admin.customPassword || admin.password
    );
    if (isMatch) {
      // Generate a JWT token
      const token = generateToken({ id: admin._id, email: admin.email });

      // Save the token to the admin document (optional, based on use case)
      admin.token = token;
      await admin.save();

      // Return success message along with the admin object and token
      return res.status(200).json({
        message: "Login successful",
        admin: { id: admin._id, username: admin.username, email: admin.email },
        token,
      });
    } else {
      return res.status(401).json({ error: "Wrong password" });
    }
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin password change
app.post("/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Check if the current password matches
    const isMatch = await bcrypt.compare(
      currentPassword,
      admin.customPassword || admin.password
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    // Hash the new password before saving
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the admin's custom password
    admin.customPassword = hashedNewPassword;
    await admin.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = app;
