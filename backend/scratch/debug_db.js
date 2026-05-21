const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

async function debugDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    // Check Device collection
    const Device = mongoose.connection.collection('devices');
    const devices = await Device.find().toArray();
    console.log("Devices in DB:", devices);

    // Check UserDevice collection
    const UserDevice = mongoose.connection.collection('userdevices');
    const mappings = await UserDevice.find().toArray();
    console.log("Mappings in DB:", mappings);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugDB();
