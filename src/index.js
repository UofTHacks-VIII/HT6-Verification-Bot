const path = require('path');
require('dotenv').config({path: path.resolve(process.cwd(),'data','.env')});
const Discord = require('discord.js');
const bot = new Discord.Client();
const fs = require('fs');
const mongoose = require('mongoose');

const TOKEN = process.env.TOKEN;

if (mongoose.connect(process.env.DB_CONN, { useNewUrlParser: true })) {
  console.log("DB Connected")
}

const discordSchema = new mongoose.Schema({
  email: String, // String is shorthand for {type: String}
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

// Recursively add roles
// idk if there is a better way to do this lol
function addRole(message, remainingRoles, callback) {
  if (remainingRoles.length > 0) {
    const currentRole = remainingRoles[0];
    remainingRoles.splice(0, 1);

    const roleID = getRoleID(currentRole);

    if (!roleID) {
      return callback({error: 'Role not found!'});
    }

    message.member.roles.add(roleID).then(() => {
      addRole(message, remainingRoles, callback);
    }).catch((e) => {
      console.log(e);
      return callback({error: e});
    })
  } else {
    return callback(null, true);
  }
}

function getRoleID(roleName) {
  if (!roles[roleName]) {
    console.log(`Role ${roleName} was not found!`);
  }

  return roles[roleName]
}

function respond(message, reply){
  // if message was sent in the bot testing channel, don't delete the command message and reply in the channel
  if(message.channel.id !== process.env.BOT_TESTING_CHANNEL_ID){
    // public channel, delete the command message and reply in private message

    message.author.send(reply);
    return message.delete();
  }
  else{
    return message.channel.send(reply)
  }
}

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

bot.on('message', message => {
  // Don't respond to yourself! (That's sad)
  if(message.author.id === bot.user.id){
    return;
  }

  if (message.content.startsWith('!roles') && isAdmin(message)) {
    return respond(message, JSON.stringify(roles, null, 4));
  } else if (message.content.startsWith('!verify')) {
    if(message.channel.type !== "text"){
      return message.author.send('Please enter your command in the #verification channel!');
    }

    if(message.channel.id !== process.env.VERIFY_CHANNEL_ID){
      return respond('Please enter your command in the #verification channel!');
    }

    const args = message.content.slice('!verify '.length).split(' ');

    if (!args.length || !args[0].length) {
      return respond(message,`Please provide your email!`)
    }

    let email = args[0].toLowerCase();

    DiscordEntry.findOne({
      discordID: message.author.id
    }, function (err, user) {
      if (err) {
        respond(message, "Unable to determine verification status! Please message a team member for assistance.");
      }

      if (user) {
        return respond(message, `Your Discord user is already associated with an email. If you believe this is an error, please contact a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.`);
      } else {

        DiscordEntry.findOne({
          email: email,
          discordID: null
        }, function (err, user) {
          if(err) return respond(message, "Unable to query unassociated emails! Please message a team member for assistance.");

          console.log('MEMBER', message.member);

          if (!user) {
            return respond(message, "The email you specified either does not exist in our database or has already been associated with a Discord user. Please check the information you provided or contact a team member for assistance.");
          } else {

            addRole(message, user.roles, function (err, msg) {
              if (err) {
                return respond(message,`Error adding your role! Please contact a ${process.env.EVENT_NAME} team member for assistance.`);
              }

              message.member.setNickname(user.displayName)
              .catch((e) => {
                console.log(e);
                respond(message, `There was an error updating your name. Please message a ${process.env.EVENT_NAME} team member to have it set manually.`);

              }).finally(() => {

                DiscordEntry.findOneAndUpdate({
                  email: email
                }, {
                  $set: {
                    discordTag: message.author.tag,
                    discordID: message.author.id
                  }
                }, function (err, user) {
                  if (err) {
                    return respond(message, "There was an error updating our database. Please contact a team member.");
                  }

                  return respond(message, "Your account has been successfully verified! If you have any questions, feel free to contact a team member.");
                });
              });
            });
          }
        });
      }
    });
  }
  else if(message.content.startsWith('!help')){
    return respond(message, `Welcome to the ${process.env.EVENT_NAME} Discord!\n\n` +
        'Use `!verify <email>` (do not include the < and > symbols) with the email you used to register to gain access to this server.\n\n'+
        `For any questions or concerns, message a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.\n\n`);
  }
  else if(message.channel.id === process.env.VERIFY_CHANNEL_ID){
    message.delete();
  }
});
