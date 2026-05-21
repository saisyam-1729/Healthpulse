const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const UserDeviceSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  deviceId: String
}, { collection: 'userdevices' });

const UserDevice = mongoose.model('UserDevice', UserDeviceSchema);

async function link() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find the first user (assuming it's you)
    const User = mongoose.model('User', new mongoose.Schema({ email: String }), 'users');
    const user = await User.findOne();
    
    if (user) {
      const deviceId = "ESP32-HEALTH-001";
      await UserDevice.findOneAndUpdate(
        { deviceId },
        { userId: user._id, deviceId },
        { upsert: true }
      );
      console.log(`SUCCESS: Linked device ${deviceId} to user ${user.email}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

link();
