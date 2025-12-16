import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import User from '../src/models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.updateMany({}, { $set: { points: 0, badges: [], 'stats.posts': 0 } });
  console.log('Migration done');
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
