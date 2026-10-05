const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  clientPackage: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientPackage' }, // Linked package subscription, if any
  billingCycle: { type: String }, // e.g. Monthly, Yearly
  category: { type: String },
  packageOrService: { type: String },
  
  // Client business details (captured at invoice creation time for historical accuracy)
  clientCompanyName: { type: String },
  clientGstNumber: { type: String },
  clientContactPerson: { type: String },
  clientPhone: { type: String },
  clientEmail: { type: String },
  clientAddress: { type: String },
  clientState: { type: String },
  clientCountry: { type: String },

  amount: { type: Number, required: true }, // Subtotal before GST/discount
  discount: { type: Number, default: 0 },   // Total discount amount
  tax: { type: Number, default: 0 },       // Total Tax (GST)
  cgst: { type: Number, default: 0 },      // Central GST
  sgst: { type: Number, default: 0 },      // State GST
  igst: { type: Number, default: 0 },      // Integrated GST
  total: { type: Number, required: true },     // Grand Total
  
  status: { 
    type: String, 
    enum: ['Paid', 'Partially Paid', 'Pending', 'Unpaid', 'Overdue', 'Cancelled', 'Refunded'],
    default: 'Pending'
  },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  dueDate: { type: Date, required: true },
  
  // Payment Details
  paymentMethod: { type: String }, // e.g. Cash, UPI, Bank Transfer, Cheque, Razorpay, etc.
  paymentDate: { type: Date },
  transactionId: { type: String },
  referenceNumber: { type: String },
  bankName: { type: String },
  paymentNotes: { type: String },

  // Recurring settings
  isRecurring: { type: Boolean, default: false },
  recurringCycle: { type: String }, // e.g. Monthly, Quarterly, Half-Yearly, Yearly

  notes: { type: String }, // Admin notes / Special instructions

  // Invoice edit history / audit trail
  editHistory: [{
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    updatedAt: { type: Date, default: Date.now },
    action: { type: String }, // e.g. 'CREATED', 'UPDATED', 'CLONED', 'CANCELLED', 'PAYMENT_RECORDED'
    previousValues: { type: mongoose.Schema.Types.Mixed },
    newValues: { type: mongoose.Schema.Types.Mixed }
  }],

  payments: [{
    amountPaid: { type: Number },
    paymentDate: { type: Date },
    paymentMethod: { type: String },
    referenceNumber: { type: String },
    transactionId: { type: String },
    paymentNotes: { type: String },
    nextPaymentDate: { type: Date },
    recordedBy: { type: String },
    recordedAt: { type: Date, default: Date.now }
  }],

  items: [{
    serviceName: { type: String },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number },
    discount: { type: Number, default: 0 },
    amount: { type: Number, required: true }, // subtotal for item
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
