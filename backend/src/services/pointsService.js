import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';

/**
 * awardPoints(userId, action, points, options)
 * - options.meta: object
 * - options.updateStats: { field:'newsPosts', inc:1 } or array of such
 */
export async function awardPoints(userId, action, points, options = {}) {
  if (!userId) throw new Error('userId required');
  const { meta = {}, updateStats = [] } = options;

  // log transaction
  await PointsTransaction.create({ userId, action, points, meta });

  // build $inc
  const inc = { points: points || 0 };
  if (Array.isArray(updateStats)) {
    updateStats.forEach(s => {
      if (s && s.field) inc[`stats.${s.field}`] = (inc[`stats.${s.field}`] || 0) + (s.inc || 1);
    });
  } else if (updateStats && updateStats.field) {
    inc[`stats.${updateStats.field}`] = (inc[`stats.${updateStats.field}`] || 0) + (updateStats.inc || 1);
  }

  // apply update
  const user = await User.findByIdAndUpdate(userId, { $inc: inc }, { new: true }).lean();

  // evaluate badges
  evaluateBadges(user).catch(err => console.error("badge eval error", err));

  return user;
}

async function evaluateBadges(user) {
  if (!user) return;
  const toAdd = [];
  const has = k => (user.badges || []).some(b => b.key === k);

  if (user.points >= 100 && !has('contributor')) toAdd.push({ key: 'contributor', name: 'Contributor' });
  if (user.points >= 300 && !has('influencer')) toAdd.push({ key: 'influencer', name: 'Influencer' });
  if ((user.stats?.eventsCreated || 0) >= 5 && !has('organizer')) toAdd.push({ key: 'organizer', name: 'Organizer' });
  if ((user.stats?.connectionsAccepted || 0) >= 50 && !has('connector')) toAdd.push({ key: 'connector', name: 'Connector' });

  if (toAdd.length) {
    const now = new Date();
    const arr = toAdd.map(t => ({ ...t, awardedAt: now }));
    await User.findByIdAndUpdate(user._id, { $push: { badges: { $each: arr } } });
  }
}
