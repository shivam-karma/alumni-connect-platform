import mongoose from 'mongoose';

const PointsTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },   // e.g. "news_post", "signup"
  points: { type: Number, required: true },
  meta: { type: Object, default: {} },        // optional: {newsId, jobId, source}
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('PointsTransaction', PointsTransactionSchema);
