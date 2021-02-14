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

fs.readFile('users.json', 'utf8', async (err, data) => {

  const jsonData = JSON.parse(data);

  console.log(data);

  for (let user of jsonData) {
    try {
      const result = await discords.create(user);
      console.log('Success', result)
    } catch (e) {
      console.log('Error', e, user);
    }
  }
});
