const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  postalCode: String,
  country: String,
});

const identificationSchema = new mongoose.Schema({
  type: String,
  number: String,
  document: Buffer, // BLOB to store the uploaded identification document
  documentContentType: String, // Content type of the uploaded document (e.g., image/jpeg)
});

const facialRecognitionSchema = new mongoose.Schema({
  verified: Boolean,
  photo: Buffer, // BLOB to store the user's facial recognition photo or video selfie
  photoContentType: String, // Content type of the facial recognition photo (e.g., image/jpeg)
});

const securityQuestionSchema = new mongoose.Schema({
  question: String,
  answer: String,
});

const notificationPreferencesSchema = new mongoose.Schema({
  email: Boolean,
  sms: Boolean,
});

const marketingPreferencesSchema = new mongoose.Schema({
  optIn: Boolean,
  optOut: Boolean,
});

const accountSchema = new mongoose.Schema({
  accountId: mongoose.Schema.Types.ObjectId,
  accountNumber: String,
  type: String,
  balance: Number,
  currency: String,
  transactions: [
    {
      transactionId: mongoose.Schema.Types.ObjectId,
      date: Date,
      type: String,
      amount: Number,
      currency: String,
      description: String,
    },
  ],
});

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  address: addressSchema,
  phone: String,
  dateOfBirth: Date,
  identification: identificationSchema,
  facialRecognition: facialRecognitionSchema,
  kycStatus: String, // e.g., "pending", "verified", "rejected"
  securityQuestions: [securityQuestionSchema],
  notificationPreferences: notificationPreferencesSchema,
  termsAgreement: Boolean,
  marketingPreferences: marketingPreferencesSchema,
  preferredLanguage: String,
  balance: Number,
  currency: String,
  accounts: [accountSchema],
  dateOfAccountCreation: { type: Date, default: Date.now },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
