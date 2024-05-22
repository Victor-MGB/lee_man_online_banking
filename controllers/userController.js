// controllers/userController.js

const User = require("../models/Users");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utilss/email");

// Function to generate unique account number
const generateAccountNumber = async () => {
  let accountNumber;
  let user;
  do {
    accountNumber = Math.floor(
      1000000000 + Math.random() * 9000000000
    ).toString();
    user = await User.findOne({ "accounts.accountNumber": accountNumber });
  } while (user);
  return accountNumber;
};

exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      address,
      phone,
      dateOfBirth,
      identification,
      securityQuestions,
      notificationPreferences,
      termsAgreement,
      marketingPreferences,
      preferredLanguage,
      balance,
      currency,
    } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const accountNumber = await generateAccountNumber();

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      address,
      phone,
      dateOfBirth,
      identification,
      securityQuestions,
      notificationPreferences,
      termsAgreement,
      marketingPreferences,
      preferredLanguage,
      balance,
      currency,
      accounts: [
        {
          accountId: new mongoose.Types.ObjectId(),
          accountNumber,
          type: "default",
          balance,
          currency,
        },
      ],
    });

    await newUser.save();

    // Send account number via email
    const emailSubject = "Your New Account Number";
    const emailText = `Hello ${firstName},\n\nYour account has been created successfully. Your account number is: ${accountNumber}\n\nThank you!`;
    sendEmail(email, emailSubject, emailText);

    // Return the user details and account number
    res.status(201).json({
      message: "User registered successfully",
      user: {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        dateOfBirth: newUser.dateOfBirth,
        address: newUser.address,
        accounts: newUser.accounts,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { accountNumber, password } = req.body;

    // Find the user by account number
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET, // Make sure to set JWT_SECRET in your environment variables
      { expiresIn: "2m" } // Set token expiration to 2 months
    );

    // Return user details and token
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        accounts: user.accounts,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude password from the response
    res.status(200).json({
      message: "Users retrieved successfully",
      users,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving users", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // If the user exists, delete it
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.logout = (req, res) => {
  // Ideally, you'd handle token invalidation here, like adding the token to a blacklist
  res.status(200).json({ message: "Logout successful" });
};