const path = require('path');
require('dotenv').config({path: path.resolve(process.cwd(), 'data', '.env')});
const Discord = require('discord.js');
const bot = new Discord.Client();
const fs = require('fs');
const mongoose = require('mongoose');

const TOKEN = process.env.TOKEN;

if (mongoose.connect(process.env.DB_CONN, {useNewUrlParser: true})) {
  console.log("DB Connected")
}

const discordSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  discordID: String,
  discordTag: String,
  displayName: String,
  roles: [String],
  timeOfCheckin: Number
});

const DiscordEntry = mongoose.model('discord', discordSchema);

bot.login(TOKEN);

const roles = JSON.parse(fs.readFileSync('data/roles.json'));

console.log('Loaded roles:', roles);

const getRoleID = (roleName) => {
  if (!roles[roleName]) {
    console.log(`Role ${roleName} was not found!`);
  }

  return roles[roleName]
};

const isAdmin = (message) => message.member && message.member.roles.cache.some(r => r.id === process.env.ADMIN_ROLE_ID)

const respond = (message, reply) => {

  console.log(`[${new Date()}] ${reply}`);

  // if message was sent in the bot testing channel, don't delete the command message and reply in the channel
  if (message.channel.id !== process.env.BOT_TESTING_CHANNEL_ID) {
    // public channel, delete the command message and reply in private message
    message.author.send(reply);
    return message.delete();
  } else {
    return message.channel.send(reply)
  }
};

bot.on('ready', () => {
  console.info(`Logged in as ${bot.user.tag}!`);
  bot.user.setStatus('online');
  bot.user.setPresence({
    game: {
      name: 'Use !help',
      type: "Playing",
      url: "https://hackthe6ix.com"
    }
  });
});

bot.on('message', async message => {
  // Don't respond to yourself! (That's sad)
  if (message.author.id === bot.user.id) {
    return;
  }

  if (message.content.startsWith('!roles') && isAdmin(message)) {
    return respond(message, JSON.stringify(roles, null, 4));
  } else if (message.content.startsWith('!stats') && isAdmin(message)) {
    const numTotal = await DiscordEntry.countDocuments({});
    const numJoined = await DiscordEntry.countDocuments({ discordID: { $ne: null } });

    const roleNames = Object.keys(roles);
    let roleBreakdown = {};

    for (let r of roleNames) {
      const numTotalRole = await DiscordEntry.countDocuments({roles: { $in: r }});
      const numJoinedRole = await DiscordEntry.countDocuments({ discordID: { $ne: null }, roles: { $in: r } });

      roleBreakdown[r] = {
        'numTotal': numTotalRole,
        'numJoined': numJoinedRole,
        'numRemaining': numTotalRole - numJoinedRole
      }
    }

    let stats = {
      'numTotal': numTotal,
      'numJoined': numJoined,
      'numRemaining': numTotal - numJoined,
      'roleBreakdown': roleBreakdown
    };

    return respond(message, JSON.stringify(stats, null, 4));
  } else if (message.content.startsWith('!adminhelp') && isAdmin(message)) {
    return respond(message, 'Admin help:\n'+
    '!adminhelp - this, duh\n' +
    '!roles - list of roles\n' +
    '!stats - statistics');
  } else if (message.content.startsWith('!verify')) {
    if (message.channel.type !== "text") {
      return message.author.send(
          'Please enter your command in the #verification channel!');
    }

    if (message.channel.id !== process.env.VERIFY_CHANNEL_ID) {
      return respond('Please enter your command in the #verification channel!');
    }

    const args = message.content.slice('!verify '.length).split(' ');

    if (!args.length || !args[0].length) {
      return respond(message, `Please provide your email!`)
    }

    let email = args[0].toLowerCase();

    console.log(`[${new Date()}]Verification request: ${email}, ${message.author.tag}`);

    DiscordEntry.findOne({
      discordID: message.author.id
    }, (err, user) => {
      if (err) {
        respond(message,
            "Unable to determine verification status! Please message a team member for assistance.");
      }

      if (user) {
        return respond(message,
            `Your Discord user is already associated with an email. If you believe this is an error, please contact a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.`);
      } else {

        DiscordEntry.findOne({
          email: email,
          discordID: null
        }, (err, user) => {
          if (err) {
            return respond(message,
                "Unable to query unassociated emails! Please message a team member for assistance.");
          }

          if (!user) {
            return respond(message,
                "The email you specified either does not exist in our database or has already been associated with a Discord user.\n\n" +
                "**IMPORTANT: IF YOU'RE A HACKER, YOU MUST RSVP BEFORE YOU CAN VERIFY YOUR ACCOUNT**\n\n" +
                "Please check the information you provided or contact a team member for assistance.");
          } else {

            let rolePromises = [];

            user.roles.forEach((role) => {
              rolePromises.push(message.member.roles.add(getRoleID(role.toLowerCase())));
            });

            Promise.all(rolePromises)
            .then((err, msg) => {
              message.member.setNickname(user.displayName)
              .catch((e) => {
                console.log(e);
                respond(message,
                    `There was an error updating your name. Please message a ${process.env.EVENT_NAME} team member to have it set manually.`);

              }).finally(() => {
                DiscordEntry.findOneAndUpdate({
                  email: email
                }, {
                  $set: {
                    discordTag: message.author.tag,
                    discordID: message.author.id,
                    timeOfCheckin: new Date()
                  }
                }, (err, user) => {
                  if (err) {
                    return respond(message,
                        "There was an error updating our database. Please contact a team member.");
                  }

                  return respond(message,
                      "Your account has been successfully verified! If you have any questions, feel free to contact a team member.");
                });
              });
            })
            .catch((e) => {
              return respond(message,
                  `Error adding your role! Please contact a ${process.env.EVENT_NAME} team member for assistance.`)
            });
          }
        });
      }
    });
  } else if (message.content.startsWith('!help')) {
    return respond(message,
        `Welcome to the ${process.env.EVENT_NAME} Discord!\n\n` +
        'Use `!verify <email>` (do not include the < and > symbols) with the email you used to register to gain access to this server.\n\n'
        +
        `For any questions or concerns, message a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.\n\n`);
  } else if (message.channel.id === process.env.VERIFY_CHANNEL_ID
      && !isAdmin(message)) {
    return respond(message, 'That command is invalid! Run `!help` for verification instructions. Please contact a team member if you run into any problems!');
  }
});
