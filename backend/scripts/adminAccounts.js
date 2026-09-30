/**
 * Manage admin accounts. There is no built-in admin login any more: an admin is a normal
 * account (registered through the app) whose role is set to 'admin' here.
 *
 *   node backend/scripts/adminAccounts.js promote you@example.com   # make an existing account admin
 *   node backend/scripts/adminAccounts.js demote  you@example.com   # back to a normal user
 *   node backend/scripts/adminAccounts.js lock    admin             # lock the old backdoor account
 *   node backend/scripts/adminAccounts.js list                      # show admin accounts
 *
 * Reads MONGO_URI from backend/.env. "lock" replaces the account's password with a random one
 * nobody knows and removes admin rights; it does not delete any data.
 */
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function promote(User, email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error(`No account with email ${email}. Register it in the app first.`);
  user.role = 'admin';
  await user.save();
  return `${email} is now an admin`;
}

async function demote(User, email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error(`No account with email ${email}`);
  user.role = 'user';
  await user.save();
  return `${email} is now a normal user`;
}

async function lock(User, email) {
  const user = await User.findOne({ email });
  if (!user) return `No account with email ${email}; nothing to lock`;
  user.password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  user.role = 'user';
  await user.save();
  return `${email} locked: password replaced with an unknown random value, admin rights removed`;
}

async function list(User) {
  const admins = await User.find({ role: 'admin' }, 'email');
  return admins.length ? admins.map((u) => u.email).join('\n') : 'No admin accounts';
}

const COMMANDS = { promote, demote, lock, list };

async function main() {
  const [command, email] = process.argv.slice(2);
  if (!COMMANDS[command] || (command !== 'list' && !email)) {
    console.error('Usage: node backend/scripts/adminAccounts.js <promote|demote|lock> <email>  |  list');
    process.exit(2);
  }
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const User = require('../models/User');
    console.log(await COMMANDS[command](User, email));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { promote, demote, lock, list };
