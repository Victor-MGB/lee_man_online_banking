const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  transactionId: mongoose.Schema.Types.ObjectId,
  date: { type: Date, default: Date.now },
  type: String,
  amount: Number,
  currency: String,
  description: String,
});

const accountSchema = new Schema({
  accountId: mongoose.Schema.Types.ObjectId,
  accountNumber: { type: String, unique: true, required: true },
  type: String,
  balance: Number,
  currency: String,
  transactions: [transactionSchema],
});

const userSchema = new Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  phone: String,
  dateOfBirth: Date,
  identification: {
    type: String,
    number: String,
    document: Buffer,
    documentContentType: String,
  },
  facialRecognition: {
    verified: Boolean,
    photo: Buffer,
    photoContentType: String,
  },
  kycStatus: String,
  securityQuestions: [
    {
      question: String,
      answer: String,
    },
  ],
  notificationPreferences: {
    email: Boolean,
    sms: Boolean,
  },
  termsAgreement: Boolean,
  marketingPreferences: {
    optIn: Boolean,
    optOut: Boolean,
  },
  preferredLanguage: String,
  balance: Number,
  currency: String,
  accounts: [accountSchema],
  DateOfAccountCreation: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
