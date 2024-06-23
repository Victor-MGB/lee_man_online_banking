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
        _id: user._id,
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
        accountPin: user.accountPin,
        agree: user.agree,
        kycStatus: user.kycStatus,
        balance: user.balance,
        accounts: user.accounts,
        withdrawals: user.withdrawals,
        dateOfAccountCreation: user.dateOfAccountCreation,
        otp: user.otp,
        otpExpires: user.otpExpires,
        stage_1: user.stage_1,
        stage_2: user.stage_2,
        stage_3: user.stage_3,
        stage_4: user.stage_4,
        stage_5: user.stage_5,
        stage_6: user.stage_6,
        stage_7: user.stage_7,
        accountNumber: account.accountNumber, // Include account number in response
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ message: "Email and OTP are required", status: 400 });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found", status: 404 });
    }

    // Check if OTP matches and is not expired
    const currentTime = new Date();
    if (user.otp !== otp || user.otpExpires < currentTime) {
      return res
        .status(400)
        .json({ message: "Invalid email or OTP", status: 400 });
    }

    // OTP verification successful
    res.status(200).json({
      message: "OTP verified successfully",
      status: 200,
      user: {
        id: user._id,
        email: user.email,
        otpVerified: true,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
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

router.post("/withdraw", async (req, res) => {
  const { email, accountPin, amount } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Verify account pin
    const isMatch = await bcrypt.compare(accountPin, user.accountPin);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid account pin" });
    }

    // Assume a single default account for simplicity
    const account = user.accounts[0];
    if (!account) {
      return res
        .status(400)
        .json({ message: "No account found for this user" });
    }

    // Check if sufficient balance is available
    if (account.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct the amount from account balance
    account.balance -= amount;

    // Update the root balance field
    user.balance -= amount;

    // Create withdrawal transaction record
    const withdrawalTransaction = {
      transactionId: new mongoose.Types.ObjectId(),
      date: new Date(),
      type: "withdrawal",
      amount: amount,
      currency: account.currency,
      description: "Withdrawal",
      accountNumber: account.accountNumber, // Add accountNumber
      accountId: account.accountId, // Add accountId
    };

    // Add transaction record to account and root withdrawals array
    account.transactions.push(withdrawalTransaction);
    user.withdrawals.push(withdrawalTransaction);

    // Save the user document to update the account details
    await user.save();

    res
      .status(200)
      .json({ message: "Withdrawal successful", withdrawalTransaction });
  } catch (error) {
    console.error("Error during withdrawal:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
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

// Endpoint to update stage_1
router.post("/update-stage-1", async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-1:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_1: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "stage_1 updated to true",
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error("Error updating stage_1:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Update stage 2
router.post("/update-stage-2", async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-2:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_2: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "stage_2 updated to true",
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error("Error updating stage_2:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Update stage 3
router.post('/update-stage-3', async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-3:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_3: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'stage_3 updated to true',
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error('Error updating stage_3:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Update stage 4
router.post('/update-stage-4', async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-4:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_4: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'stage_4 updated to true',
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error('Error updating stage_4:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Update stage 5
router.post('/update-stage-5', async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-5:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_5: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'stage_5 updated to true',
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error('Error updating stage_5:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Update stage 6
router.post('/update-stage-6', async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-6:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_6: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'stage_6 updated to true',
      user,
      requestBody: req.body // Return the request body in the response
    });
  } catch (error) {
    console.error('Error updating stage_6:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Update stage 7
router.post('/update-stage-7', async (req, res) => {
  const { userId } = req.body;

  // Log the request body to the console
  console.log("Request body for update-stage-7:", req.body);

  try {
    if (!userId) {
      console.error("userId not provided in request body");
      return res.status(400).json({ message: "userId not provided" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { stage_7: true },
      { new: true }
    );

    if (!user) {
      console.error("User not found with userId:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'stage_7 updated to true',
      user,
      requestBody: req.body 
    });
  } catch (error) {
    console.error('Error updating stage_7:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
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
