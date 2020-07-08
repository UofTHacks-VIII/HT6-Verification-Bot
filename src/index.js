const path = require('path');
require('dotenv').config({path: path.resolve(process.cwd(),'data','.env')});
const Discord = require('discord.js');
const bot = new Discord.Client();

const TOKEN = process.env.TOKEN;

bot.login(TOKEN);

function getRoleFromType(type){
  type = parseInt(type);

  if(type === 1){
    return process.env.MENTOR_ROLE_ID;
  }
  else{
    return process.env.HACKER_ROLE_ID;
  }
}

function registerMember(email, discordTag, discordID){
  return new Promise(function(resolve, reject){
    pool.query(`UPDATE Registration SET discordTag='${discordTag}', discordID='${discordID}', OnboardTime='${Math.round(Date.now()/1000)}' WHERE Email='${email}'`, function(err, result){
      if(err) return reject(err);
      return resolve();
    })
  })
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
  if(message.author.id === bot.user.id){
    return;
  }

  if (message.content.startsWith('!verify')) {
    if(message.channel.type !== "text"){
      return message.author.send('Please enter your command in the #verification channel!')
    }

    const args = message.content.slice('!verify '.length).split(' ');

    if (!args.length || !args[0].length) {
      return respond(message,`Please provide your email!`)
    }

    let email = args[0].toLowerCase();

    pool.query(`SELECT EXISTS(SELECT * FROM Registration WHERE DiscordID='${message.author.id}')`, function(err, result, fields){
      if(err) return respond(message, "Unable to determine verification status! Please message a team member for assistance.");

      if(result[0][fields[0]["name"]]){
        return respond(message, `Your Discord user is already associated with an email. If you believe this is an error, please contact a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.`);
      }
      else{
        pool.query(`SELECT FirstName, LastName, UserType FROM Registration WHERE Email='${email}' AND DiscordID IS NULL`, function(err, result){
          if(err) return respond(message, "Unable to query unassociated emails! Please message a team member for assistance.");

          if(result.length < 1){

            return respond(message, "The email you specified either does not exist in our database or has already been associated with a Discord user. Please check the information you provided or contact a team member for assistance.");
          }
          else{
            message.member.addRole(getRoleFromType(result[0].UserType)).then(() => {
              message.member.setNickname(result[0].FirstName + " " + result[0].LastName)
                  .catch((e) => {
                    console.log(e);
                    respond(message, `There was an error updating your name. Please message a ${process.env.EVENT_NAME} team member to have it set manually.`);

                  }).finally(() => {
                registerMember(email, message.author.tag, message.author.id).catch((e) => {

                  respond(message, "There was an error updating our database. Please contact a team member, otherwise you will not be eligible for prizes and swag.");

                })
              });


            }).catch((e) => {
              console.log(e);
              return respond(message,"Error adding your role!")
            })
          }
        })
      }
    })
  }
  else if(message.content.startsWith('!help')){
    return respond(message, `Welcome to the ${process.env.EVENT_NAME} Discord!\n\n` +
        'Use `!verify <email>` (do not include the < and > symbols) to gain access to this server.\n\n'+
        'For any questions or concerns, message a member of the ${process.env.EVENT_NAME} team or shoot us an email at ${process.env.CONTACT_EMAIL}.\n\n');
  }
  else if(message.channel.id === process.env.VERIFY_CHANNEL_ID && !message.member.roles.has(process.env.ADMIN_ROLE_ID)){
    message.delete();
  }
});
