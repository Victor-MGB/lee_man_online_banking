const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  accountNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  description: { type: String },
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
