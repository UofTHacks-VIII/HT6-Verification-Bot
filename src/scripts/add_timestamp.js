const mongoose = require('mongoose');
const fs = require('fs');

// Nice env code by Alex @ Hack the 6ix
const env_data = fs.readFileSync('../data/.env', {encoding: 'utf8'}).split(/\r?\n/)

const env = {};
env_data.forEach((line) => {
  if (line.length > 0) {
    const lineArray = line.split('=');
    const key = lineArray.splice(0, 1);

    env[key] = lineArray.join('=').replace(/\"/g, '');
  }
});

if(mongoose.connect(env.DB_CONN, { useNewUrlParser: true })) {
  console.log("DB Connected")
}

const discordSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  discordID: String,
  discordTag: String,
  displayName: String,
  roles: [String],
  timeOfCheckin: Number,
  expires: Number
});

const discords = mongoose.model('discords', discordSchema);

discords.updateMany({
  roles: { $in: 'hacker' }
}, {
  expires: 1613365199000
}, (err, user) => {
  console.log(err, user);
});
