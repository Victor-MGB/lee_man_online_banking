const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const User = require("../models/Users");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utilss/email");

const router = express.Router();

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

router.post("/register", async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    phoneNumber,
    gender,
    dateOfBirth,
    accountType,
    address,
    postalCode,
    state,
    country,
    currency,
    password,
    accountPin,
    agree,
    preferredLanguage,
    termsAgreement,
  } = req.body;

  if (!termsAgreement) {
    return res
      .status(400)
      .json({ message: "You must agree to the terms and conditions" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAccountPin = await bcrypt.hash(accountPin, 10);
    const accountNumber = await generateAccountNumber(); // Ensure the account number is resolved

    const user = new User({
      firstName,
      middleName,
      lastName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      accountType,
      address,
      postalCode,
      state,
      country,
      currency,
      password: hashedPassword,
      accountPin: hashedAccountPin,
      agree,
      kycStatus: "pending",
      balance: 0,
      accounts: [
        {
          accountId: new mongoose.Types.ObjectId(),
          accountNumber: accountNumber,
          type: accountType,
          balance: 0,
          currency,
          transactions: [],
        },
      ],
      dateOfAccountCreation: new Date(),
      preferredLanguage,
      termsAgreement,
    });

    await user.save();

const emailSubject = "Welcome to Our Banking Service!";
const emailText = `Dear ${firstName},

Welcome to Central City Bank! We are thrilled to have you on board.

Your account has been successfully created. Below are your account details:

Account Number: ${accountNumber}
Account Type: ${accountType}
Initial Balance: $0.00

Please keep your account number confidential and secure. You can access your account online at Central City Bank using your account number and the password you created during registration.

If you have any questions or need assistance, our customer support team is here to help you. You can reach us at centralcitybank0@gmail.com or call us at +12074021612.

Thank you for choosing Central City Bank. We look forward to serving you and helping you achieve your financial goals.

Best regards,

The Central City Bank Team
[Bank Name Address]
centralcitybank0@gmail.com 
+12074021612`;

sendEmail(email, emailSubject, emailText);
    sendEmail(email, emailSubject, emailText);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        accountType: user.accountType,
        address: user.address,
        postalCode: user.postalCode,
        state: user.state,
        country: user.country,
        currency: user.currency,
        accountNumber: accountNumber,
        balance: user.balance,
        dateOfAccountCreation: user.dateOfAccountCreation,
      },
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/login", async (req, res) => {
  const { accountNumber, password } = req.body;

  try {
    // Find the user by account number
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid account number or password" });
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Invalid account number or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, accountNumber: user.accountNumber },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        accountNumber: user.accountNumber,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.get("/users", async (req, res) => {
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
});

router.delete("/:userId", async (req, res) => {
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
});

router.post("/logout", async(req, res) => {
  // Ideally, you'd handle token invalidation here, like adding the token to a blacklist
  res.status(200).json({ message: "Logout successful" });
});

module.exports = router;
