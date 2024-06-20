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

async function validateUserAndWithdrawal(req, res, next) {
  const { email, accountPin, withdrawalId } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(accountPin, user.accountPin);
    if (!isMatch) {
      console.log("Invalid account pin for user:", email);
      return res.status(400).json({ message: "Invalid account pin" });
    }

    // Log withdrawals for debugging
    console.log(
      "User's withdrawals:",
      JSON.stringify(user.withdrawals, null, 2)
    );

    // Search by both _id and withdrawalId
    const withdrawal = user.withdrawals.find(
      (w) =>
        w._id.toString() === withdrawalId ||
        w.withdrawalId.toString() === withdrawalId
    );

    if (!withdrawal) {
      console.log("Requested withdrawalId:", withdrawalId);
      return res.status(400).json({ message: "Withdrawal not found" });
    }

    console.log("Validated Withdrawal:", JSON.stringify(withdrawal, null, 2));
    req.user = user;
    req.withdrawal = withdrawal;
    next();
  } catch (error) {
    console.error("Error validating user and withdrawal:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
}

async function processPayment(userId, amount) {
  // Simulate payment processing logic here
  // Replace with actual payment processing logic if available
  try {
    // For demonstration, just returning true if userId is valid
    if (userId) {
      console.log(
        `Payment processed successfully for user ${userId} with amount ${amount}`
      );
      return true;
    } else {
      console.log("Payment processing failed: Invalid user ID");
      return false;
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    return false;
  }
}

// Fetch user by email
router.get('/users/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Stage 1: Verify Account Pin
router.post("/stage1", async (req, res) => {
  const { email, accountPin } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });

    // If user is not found, return error
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Verify account pin
    const isMatch = await bcrypt.compare(accountPin, user.accountPin);

    // If account pin is invalid, return error
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid account pin" });
    }

    // If account pin is valid, update withdrawal stage
    const withdrawal = user.withdrawals.find(
      (withdrawal) => withdrawal.status === "pending"
    ); // Assuming you find the correct withdrawal object
    if (!withdrawal) {
      return res.status(400).json({ message: "Withdrawal not found" });
    }

    withdrawal.stages.push({
      stageName: "Verify Account Pin",
      status: "completed",
    });
    await user.save();

    // Send response indicating successful completion of stage 1
    res.status(200).json({ message: "Stage 1 completed" });
  } catch (error) {
    console.error("Error during Stage 1:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Upload Identification for Withdrawal
router.post('/stage2', async (req, res) => {
  const { email, identification } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });

    // If user is not found, return error
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Find the pending withdrawal associated with the user
    const withdrawal = user.withdrawals.find(withdrawal => withdrawal.status === 'pending');
    if (!withdrawal) {
      return res.status(400).json({ message: "Withdrawal not found" });
    }

    // Update withdrawal stages to mark 'Upload Identification' as completed
    withdrawal.stages.push({ stageName: "Upload Identification", status: "completed", notes: identification });
    await user.save();

    // Send response indicating successful completion of stage 2
    res.status(200).json({ message: "Stage 2 completed" });

  } catch (error) {
    console.error("Error during Stage 2:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/stage3", validateUserAndWithdrawal, async (req, res) => {
  const { answers } = req.body; // Extract answers from request body
  const user = req.user;
  const withdrawal = req.withdrawal;

  // Check if answers is defined and is an array
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: "Invalid answers provided" });
  }

  try {
    // Simulate security questions verification logic
    const correctAnswers = user.securityAnswers; // Assuming securityAnswers is stored in user schema

    if (!correctAnswers || correctAnswers.length !== answers.length) {
      return res
        .status(400)
        .json({ message: "Invalid security answers setup" });
    }

    const isMatch = answers.every(
      (answer, index) => answer === correctAnswers[index]
    );

    if (isMatch) {
      withdrawal.stages.push({
        stageName: "Security Questions",
        status: "completed",
      });
      await user.save();
      res.status(200).json({ message: "Stage 3 completed" });
    } else {
      res.status(400).json({ message: "Security answers do not match" });
    }
  } catch (error) {
    console.error("Error during Stage 3:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Stage 4: Submit Tax Information
router.post("/stage4", validateUserAndWithdrawal, async (req, res) => {
  const { taxInfo } = req.body;
  const user = req.user;
  const withdrawal = req.withdrawal;

  try {
    // Simulate tax information submission logic
    withdrawal.stages.push({
      stageName: "Submit Tax Information",
      status: "completed",
      notes: taxInfo,
    });
    await user.save();
    res.status(200).json({ message: "Stage 4 completed" });
  } catch (error) {
    console.error("Error during Stage 4:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// POST /stage5 endpoint to process payment
router.post("/stage5", validateUserAndWithdrawal, async (req, res) => {
  const user = req.user;
  const withdrawal = req.withdrawal;

  try {
    const paymentProcessed = await processPayment(user._id, 5); // Adjust amount as needed
    if (paymentProcessed) {
      withdrawal.stages.push({
        stageName: "Payment Processing",
        status: "completed",
      });
      await user.save();
      res.status(200).json({ message: "Stage 5 completed" });
    } else {
      res.status(400).json({ message: "Payment processing failed" });
    }
  } catch (error) {
    console.error("Error during Stage 5:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Stage 7: Insurance Verification
router.post("/stage6", validateUserAndWithdrawal, async (req, res) => {
  const { insuranceDocument } = req.body;
  const user = req.user;
  const withdrawal = req.withdrawal;

  try {
    // Simulate insurance verification logic
    withdrawal.stages.push({
      stageName: "Insurance Verification",
      status: "completed",
      notes: insuranceDocument,
    });
    await user.save();
    res.status(200).json({ message: "Stage 6 completed" });
  } catch (error) {
    console.error("Error during Stage 6:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Stage 6: Document Upload Verification
router.post("/stage7", validateUserAndWithdrawal, async (req, res) => {
  const { document } = req.body; // Assume document is a base64 encoded string or a link to the document
  const user = req.user;
  const withdrawal = req.withdrawal;

  try {
    // Simulate document upload verification logic
    // Here you could add actual verification logic, for now we just check if document exists
    if (document) {
      withdrawal.stages.push({
        stageName: "Document Upload Verification",
        status: "completed",
        notes: "Document verified successfully",
      });
      await user.save();
      res.status(200).json({ message: "Stage 7 completed" });
    } else {
      res
        .status(400)
        .json({ message: "Document upload failed or document is invalid" });
    }
  } catch (error) {
    console.error("Error during Stage 7:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Stage 8: Final Approval
router.post("/stage8", validateUserAndWithdrawal, async (req, res) => {
  const user = req.user;
  const withdrawal = req.withdrawal;

  try {
    // Simulate final approval logic
    withdrawal.stages.push({
      stageName: "Final Approval",
      status: "completed",
    });
    withdrawal.status = "completed";
    await user.save();
    res
      .status(200)
      .json({ message: "Stage 8 completed. Withdrawal approved." });
  } catch (error) {
    console.error("Error during Stage 8:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

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
    confirmPassword,
    accountPin,
  } = req.body;

  // Validate required fields
  if (
    !firstName ||
    !lastName ||
    !email ||
    !phoneNumber ||
    !gender ||
    !dateOfBirth ||
    !accountType ||
    !address ||
    !postalCode ||
    !state ||
    !country ||
    !currency ||
    !password ||
    !confirmPassword ||
    !accountPin
  ) {
    console.log("Validation failed: Missing fields");
    return res.status(400).json({ message: "All fields are required" });
  }

  // Validate password confirmation
  if (password !== confirmPassword) {
    console.log("Validation failed: Passwords do not match");
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Validation failed: User already exists");
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCase: false,
      specialChars: false,
      alphabets: false,
    });

    // Hash password and account pin
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAccountPin = await bcrypt.hash(accountPin, 10);
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // Create new user
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
      agree: true,
      kycStatus: "pending",
      otp,
      otpExpires,
    });

    // Save user to the database
    await user.save();

    // Email content
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

    const emailHtml = `<p>Dear ${firstName},</p>
<p>We are delighted to assist you in completing your account registration with Central City Bank.</p>
<p>Please find below your One-Time Password (OTP) required for account registration:</p>
<p><strong>OTP: ${otp}</strong></p>
<p>This OTP is valid for a limited time. Please use it promptly to finalize your registration process.</p>
<p>If you encounter any difficulties or have any questions, please don't hesitate to contact our dedicated support team at <a href="mailto:centralcitybank0@gmail.com">centralcitybank0@gmail.com</a>.</p>
<p>Thank you for choosing Central City Bank for your banking needs.</p>
<p>The Central City Bank Team</p>`;

    // Send email
    try {
      await sendEmail(email, emailSubject, emailText, emailHtml);
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
          otp,
          kycStatus: "pending",
        },
      });
    } catch (emailError) {
      console.error("Error during email sending:", emailError);
      res
        .status(500)
        .json({ message: "Error sending email. Please try again later." });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.get("/", (req, res) => {
  res.send("hello world");
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
    const emailHtml = `
      <p>Dear ${user.firstName} ${user.lastName},</p>
      <p>We are thrilled to inform you that your account has been successfully created with our platform. Your account details are provided below:</p>
      <p><strong>Account Number:</strong> ${accountNumber}</p>
      <p>Please keep this information secure and do not share it with anyone. If you have any questions or need assistance, feel free to contact our support team at <a href="mailto:centralcitybank0@gmail.com">centralcitybank0@gmail.com</a>.</p>
      <p>Thank you for choosing our platform.</p>
      <p>Best regards,<br/>Central City Bank</p>
      <p>USA<br/>
      centralcitybank0@gmail.com<br/>
      +12074021612</p>
    `;

    // Send account number to the user's email
    sendEmail(email, emailSubject, "", emailHtml);

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
    // Find the user by account number within their accounts array
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      console.log("User not found with account number:", accountNumber);
      return res
        .status(400)
        .json({ message: "Invalid account number or password" });
    }

    console.log("User found:", user);
    console.log("Password provided:", password);
    console.log("Stored hashed password:", user.password);

    // Check if the provided password matches the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", user._id);
      return res
        .status(400)
        .json({ message: "Invalid account number or password" });
    }

    // Extract the account number from the accounts array
    const account = user.accounts.find(
      (acc) => acc.accountNumber === accountNumber
    );

    // Generate a JWT token for the user
    const token = jwt.sign(
      { userId: user._id, accountNumber: accountNumber },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Send back a successful response with the token and all user details
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        ...user.toObject(),
        accountNumber: account.accountNumber, // Include account number in response
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/verify-kyc", async (req, res) => {
  const { userId, kycDocuments } = req.body;

  if (!userId || !kycDocuments) {
    return res
      .status(400)
      .json({ message: "User ID and KYC documents are required", status: 400 });
  }

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

router.post('/withdraw', async (req, res) => {
  const { email, accountPin, amount } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findOne({ email }).session(session);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(accountPin, user.accountPin);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid account pin' });
    }

    // Assume a single default account for simplicity
    const account = user.accounts[0];
    if (!account) {
      return res.status(400).json({ message: 'No account found for this user' });
    }

    // Check if sufficient balance is available
    if (account.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Deduct the amount from account balance
    account.balance -= amount;

    // Create withdrawal transaction record
    const withdrawalTransaction = {
      transactionId: new mongoose.Types.ObjectId(),
      date: new Date(),
      type: 'withdrawal',
      amount: amount,
      currency: account.currency,
      description: 'Withdrawal',
      accountNumber: account.accountNumber,
      accountId: account.accountId,
    };

    // Add transaction record to account and root withdrawals array
    account.transactions.push(withdrawalTransaction);
    user.withdrawals.push(withdrawalTransaction);

    // Save the user document to update the account details
    await user.save({ session });

    await session.commitTransaction();

    res.status(200).json({ message: 'Withdrawal successful', withdrawalTransaction });
  } catch (error) {
    console.error('Error during withdrawal:', error);
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error. Please try again later.' });
  } finally {
    session.endSession();
  }
});

router.post("/deposit", async (req, res) => {
  const { accountNumber, accountPin, amount } = req.body;

  try {
    // Find user by account number
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Verify account pin
    const isMatch = await bcrypt.compare(accountPin, user.accountPin);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid account pin" });
    }

    // Find the account by account number
    const account = user.accounts.find(
      (acc) => acc.accountNumber === accountNumber
    );
    if (!account) {
      return res.status(400).json({ message: "Account not found" });
    }

    // Deposit funds into the account
    account.balance += amount;

    // Add transaction record
    account.transactions.push({
      transactionId: new mongoose.Types.ObjectId(),
      date: new Date(),
      type: "deposit",
      amount: amount,
      currency: account.currency,
      description: "Deposit",
    });

    // Save the user document
    await user.save();

    res.status(200).json({ message: "Deposit successful", account });
  } catch (error) {
    console.error("Error during deposit:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
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

router.get("/recent-transactions", async (req, res) => {
  const { userId } = req.body; // Assuming userId is provided in the request

  try {
    // Find user by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get the most recent transactions
    const recentTransactions = user.accounts
      .reduce((acc, curr) => {
        return acc.concat(curr.transactions);
      }, [])
      .sort((a, b) => b.date - a.date)
      .slice(0, 10); // Get the top 10 recent transactions

    res.status(200).json({ recentTransactions });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/update-balance", async (req, res) => {
  const { accountNumber, amountToAdd } = req.body;

  if (!accountNumber || typeof amountToAdd !== "number") {
    return res
      .status(400)
      .json({ message: "Account number and amount to add are required" });
  }

  try {
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User with given account number not found" });
    }

    const accountIndex = user.accounts.findIndex(
      (acc) => acc.accountNumber === accountNumber
    );
    if (accountIndex === -1) {
      return res.status(404).json({ message: "Account not found" });
    }

    user.accounts[accountIndex].balance += amountToAdd;

    // Update the user's primary balance as the sum of all account balances
    user.balance = user.accounts.reduce(
      (acc, account) => acc + account.balance,
      0
    );

    await user.save();

    res.status(200).json({
      message: "Account balance updated successfully",
      account: user.accounts[accountIndex],
      totalBalance: user.balance,
    });
  } catch (error) {
    console.error("Error updating balance:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/send-notification", async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !subject || !message) {
    return res
      .status(400)
      .json({ message: "Email, subject, and message are required" });
  }

  try {
    // Send email
    await sendEmail(email, subject, message);
    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res
      .status(500)
      .json({ message: "Error sending notification. Please try again later." });
  }
});

// router.post("/send-notification-message", async (req, res) => {
//   const { userId, message } = req.body;

//   if (!userId || !message) {
//     return res
//       .status(400)
//       .json({ message: "User ID and message are required" });
//   }

//   try {
//     // Find the user by their ID
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Create a new notification object
//     const notification = {
//       message,
//       date: new Date(),
//     };

//     // Push the notification to the user's notifications array
//     user.notifications.push(notification);

//     // Save the updated user document
//     await user.save();

//     // Return success response
//     res.status(200).json({ message: "Notification sent successfully" });
//   } catch (error) {
//     console.error("Error sending notification:", error);
//     res
//       .status(500)
//       .json({ message: "Error sending notification. Please try again later." });
//   }
// });

router.get("/balance/:accountNumber", async (req, res) => {
  const { accountNumber } = req.params;

  try {
    const user = await User.findOne({
      "accounts.accountNumber": accountNumber,
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User with given account number not found" });
    }

    const account = user.accounts.find(
      (acc) => acc.accountNumber === accountNumber
    );
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.status(200).json({ balance: account.balance });
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// router.get("/user-transaction/:userId/:transactionId", async (req, res) => {
//   const { userId, transactionId } = req.params;

//   try {
//     // Find user by userId
//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ message: "User not found", status: 404 });
//     }

//     // Find the transaction in user's accounts transactions array
//     let transaction;
//     user.accounts.forEach((account) => {
//       transaction = account.transactions.find(
//         (trans) => trans._id.toString() === transactionId
//       );
//       if (transaction) return; // Break out of loop if transaction found
//     });

//     if (!transaction) {
//       return res
//         .status(404)
//         .json({ message: "Transaction not found", status: 404 });
//     }

//     // If user and transaction are found, return the transaction
//     res.status(200).json({
//       message: "Transaction retrieved successfully",
//       transaction: transaction,
//       status: 200,
//     });
//   } catch (error) {
//     console.error("Error fetching user transaction:", error);
//     res
//       .status(500)
//       .json({ message: "Server error. Please try again later.", status: 500 });
//   }
// });

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

router.post("/logout", async (req, res) => {
  // Ideally, you'd handle token invalidation here, like adding the token to a blacklist
  res.status(200).json({ message: "Logout successful" });
});

module.exports = router;
