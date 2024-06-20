const mongoose = require("mongoose");

const stageSchema = new mongoose.Schema({
  stageName: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "in progress", "completed"],
    default: "pending",
  },
  notes: { type: String },
});

const internationalTransferSchema = new mongoose.Schema({
  transferId: { type: mongoose.Types.ObjectId, required: true },
  senderEmail: { type: String, required: true },
  senderAccountNumber: { type: String, required: true },
  senderAccountPin: { type: String, required: true },
  recipientName: { type: String, required: true },
  recipientBankAccountNumber: { type: String, required: true },
  recipientBankName: { type: String, required: true },
  recipientBankSWIFTCode: { type: String, required: true },
  recipientCountry: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  description: { type: String, required: true },
  paymentReference: { type: String },
  stages: {
    type: [stageSchema],
    default: [
      { stageName: "Account Activation" },
      { stageName: "Initial Verification and Setup" },
      { stageName: "Cross-Border Processing" },
      { stageName: "Currency Conversion" },
      { stageName: "Enhanced Security" },
      { stageName: "Regulatory Compliance" },
      { stageName: "Transaction Monitoring" },
      { stageName: "Priority Processing" },
      { stageName: "Legal Documentation" },
      { stageName: "Insurance" },
      { stageName: "Document Handling and Storage" },
    ],
  },
  status: {
    type: String,
    enum: ["pending", "approved", "completed"],
    default: "pending",
  },
});

module.exports = mongoose.model(
  "InternationalTransfer",
  internationalTransferSchema
);
