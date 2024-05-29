const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const otpGenerator = require("otp-generator");
// const nodemailer = require("nodemailer");
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
    kycDocuments,
    preferredLanguage,
    termsAgreement,
  } = req.body;

  if (!termsAgreement) {
    return res.status(400).json({ message: "You must agree to the terms and conditions" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const otp = otpGenerator.generate(6, {
      upperCase: false,
      specialChars: false,
      alphabets: false,
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAccountPin = await bcrypt.hash(accountPin, 10);
    console.log("Hashed password:", hashedPassword); // Log hashed password
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

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
      kycDocuments,
      preferredLanguage,
      termsAgreement,
      otp,
      otpExpires,
    });

    await user.save();

    const emailSubject = "OTP for Account Registration";
    const emailText = `Dear ${firstName},

We are delighted to assist you in completing your account registration with Central City Bank.

Please find below your One-Time Password (OTP) required for account registration:
OTP: ${otp}
This OTP is valid for a limited time. Please use it promptly to finalize your registration process.
If you encounter any difficulties or have any questions, please don't hesitate to contact our dedicated support team at centralcitybank0@gmail.com.

Thank you for choosing Central City Bank for your banking needs.

The Central City Bank Team
`;

    sendEmail(email, emailSubject, emailText);

    res.status(201).json({
      message: "User registered successfully",
      user: {
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
        preferredLanguage,
        otp,
        kycStatus: "pending"
      },
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});


router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Validate input
    if (!email || !otp) {
      console.log("Missing fields:", { email, otp });
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP has expired
    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Generate account number
    const accountNumber = await generateAccountNumber();

    // Define the new account object
    const newAccount = {
      accountId: new mongoose.Types.ObjectId(),
      accountNumber: accountNumber,
      type: "default", // Default type if not provided yet
      balance: 0,
      currency: "USD", // Default currency if not provided yet
      transactions: [],
    };

    // Add the new account to the user's accounts array
    user.accounts.push(newAccount);

    // Save the updated user document
    await user.save();

    // Compose email
    const emailSubject = "Your New Account Information";
    const emailText = `Dear ${user.firstName} ${user.lastName},\n\nWe are thrilled to inform you that your account has been successfully created with our platform. Your account details are provided below:\n\nAccount Number: ${accountNumber}\n\nPlease keep this information secure and do not share it with anyone. If you have any questions or need assistance, feel free to contact our support team at centralcitybank0@gmail.com 
.\n\nThank you for choosing our platform.\n\nBest regards,\n Central City Bank
USA
centralcitybank0@gmail.com 
+12074021612`;

    // Send account number to the user's email
    sendEmail(email, emailSubject, emailText);

    // Return success message along with user details and account number
    res.status(201).json({
      message: "Account number sent to your email successfully",
      user: {
        firstName: user.firstName,
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
        balance: newAccount.balance,
        dateOfAccountCreation: user.dateOfAccountCreation,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/login", async (req, res) => {
  const { accountNumber, password } = req.body;

  try {
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      console.log("User not found with account number:", accountNumber);
      return res.status(400).json({ message: "Invalid account number or password" });
    }

    if (user.kycStatus !== "verified") {
      console.log("User KYC status not verified:", user.kycStatus);
      return res.status(403).json({ message: "KYC verification is pending" });
    }

    console.log("User found:", user);
    console.log("Password provided:", password);
    console.log("Stored hashed password:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", user._id);
      return res.status(400).json({ message: "Invalid account number or password" });
    }

    const token = jwt.sign(
      { userId: user._id, accountNumber: accountNumber },
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
        accountNumber: accountNumber,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/verify-kyc", async (req, res) => {
  const { userId, kycDocuments } = req.body;

  try {
    // Find user by userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", status: 404 });
    }

    // Update user KYC documents
    user.kycDocuments = kycDocuments;
    user.kycStatus = "verified"; // or 'pending' based on your logic

    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: "KYC documents verified successfully",
      status: 200,
      user: {
        id: user._id,
        kycStatus: user.kycStatus,
        kycDocuments: user.kycDocuments,
      },
    });
  } catch (error) {
    console.error("Error verifying KYC documents:", error);
    res
      .status(500)
      .json({ message: "Server error. Please try again later.", status: 500 });
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

router.post("/update-transaction", async (req, res) => {
  const { userId, accountId, transaction } = req.body;

  try {
    console.log(
      "Received request to update transaction for userId:",
      userId,
      "and accountId:",
      accountId
    );

    // Find user by userId
    const user = await User.findById(userId);
    console.log("Found user:", user);

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    // Find the account in user's accounts array
    const account = user.accounts.find(
      (acc) => acc.accountId.toString() === accountId
    );
    console.log("Found account:", account);

    if (!account) {
      console.log("Account not found");
      return res.status(404).json({ message: "Account not found" });
    }

    // Update account transactions
    account.transactions.push(transaction);

    // Save the updated user document
    await user.save();

    console.log("Transaction updated successfully");

    // Send a successful response with updated data
    res.status(200).json({
      message: "Transaction updated successfully",
      user: {
        _id: user._id,
        firstName: user.firstName,
        account: {
          _id: account._id,
          transactions: account.transactions,
        },
      },
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});


router.get("/user-transaction/:userId/:transactionId", async (req, res) => {
  const { userId, transactionId } = req.params;

  try {
    // Find user by userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", status: 404 });
    }

    // Find the transaction in user's accounts transactions array
    let transaction;
    user.accounts.forEach((account) => {
      transaction = account.transactions.find(
        (trans) => trans._id.toString() === transactionId
      );
      if (transaction) return; // Break out of loop if transaction found
    });

    if (!transaction) {
      return res
        .status(404)
        .json({ message: "Transaction not found", status: 404 });
    }

    // If user and transaction are found, return the transaction
    res.status(200).json({
      message: "Transaction retrieved successfully",
      transaction: transaction,
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching user transaction:", error);
    res
      .status(500)
      .json({ message: "Server error. Please try again later.", status: 500 });
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
