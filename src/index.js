const path = require('path');
require('dotenv').config({path: path.resolve(process.cwd(),'data','.env')});
const Discord = require('discord.js');
const bot = new Discord.Client();

const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid');

const TOKEN = process.env.TOKEN;

bot.login(TOKEN);

let pool = mysql.createPool({
   host: process.env.MYSQL_HOST,
   user: process.env.MYSQL_USER,
   password: process.env.MYSQL_PASSWORD,
   database: process.env.MYSQL_DB,
   connectionLimit: process.env.MYSQL_MAX_CONNECTIONS || 5
})

pool.on('acquire', function(connection){
  console.log("Connected to MySQL database!");
})

pool.query("CREATE TABLE IF NOT EXISTS EventEconomy (discordID VARCHAR(20), balance DECIMAL(20,2), PRIMARY KEY (`discordID`))", function (err, result) {
  if (err) throw err;
  console.log("Economy table initialized!");
});

pool.query("CREATE TABLE IF NOT EXISTS `Registration` (`Email` VARCHAR(255) NOT NULL,`FirstName` VARCHAR(30) NOT NULL,`LastName` VARCHAR(30) NOT NULL,`DiscordID` VARCHAR(20),`DiscordTag` VARCHAR(40),`OnboardTime` INTEGER,`UserType` INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (`Email`));", function (err, result) {
  if (err) throw err;
  // TYPES:
  // 0 - HACKER
  // 1 - EXTERNAL PARTICIPANTS (MENTORS, SPONSORS, WORKSHOP HOSTS, ETC.)
  // 2 - TEAM
  console.log("Registration table initialized!");
});

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

function setupEconomyAccount(discordID){
  return new Promise(function(resolve, reject){
    // set up economy
    pool.query(`INSERT INTO EventEconomy (discordID, balance) VALUES ('${discordID}',0)`, function(err, result){
      if (err) return reject(err);
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
      url: "https://masseyhacks.ca"
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
        return respond(message, "Your Discord user is already associated with an email.");
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
                    respond(message, "There was an error updating your name. Please message a MasseyHacks team member to have it set manually.");

                  }).finally(() => {
                registerMember(email, message.author.tag, message.author.id).catch((e) => {

                  respond(message, "There was an error updating our database. Please contact a team member, otherwise you will not be eligible for prizes and swag.");

                }).finally(() => {

                  setupEconomyAccount(message.author.id).then(() => {
                    return respond(message, "Successfully verified!");
                  }).catch((e) => {
                    console.log(e);
                    return respond(message, "Successfully verified! However, there was an error setting up your economy account. Please contact a team member, otherwise you will not be able to earn points during the event.")
                  })

                });
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
    return respond(message, 'Welcome to the MasseyHacks Discord!\n\n' +
        'Use `!verify <email>` (do not include the < and > symbols) to gain access to this server.\n\n'+
        'For any questions or concerns, message a member of the MasseyHacks team or shoot us an email at hello@masseyhacks.ca.\n\n' +
        'Additional commands:\n\n' +
        '`!linkmc` - Link your Minecraft account to your Discord account\n' +
        '`!unlinkmc` - Unlink your Minecraft account from your Discord account\n' +
        '`!linkstatus` - View current Minecraft link status\n' +
        '`!balance` - View your current Activities points balance')
  }
  else if(message.content.startsWith('!linkmc')){
    pool.query(`SELECT secret, mcUUID FROM MinecraftDiscordLink WHERE discordID='${message.author.id}'`, function(err, result){
      if (err) return respond(message, "Error contacting the database!");

      if(result.length < 1){
        let newSecret = uuidv4();
        pool.query(`INSERT INTO MinecraftDiscordLink (discordID, discordTag, secret) VALUES ('${message.author.id}', '${message.author.tag}', '${newSecret}')`, function(err, result){
          if(err) return respond(message, "Error registering secret!");

          return respond(message, "Discord link process started. Log in to the Minecraft server and issue the following command: `/linkdiscord " + newSecret + "`");
        });
      }
      else if(result[0].mcUUID){
        return respond(message, "Your account has already been linked to a Minecraft user with UUID " + result[0].mcUUID);
      }
      else {
        return respond(message, "Discord link process started. Log in to the Minecraft server and issue the following command: `/linkdiscord " + result[0].secret + "`");
      }
    })

  }
  else if(message.content.startsWith('!unlinkmc')){
    const args = message.content.slice('!unlinkmc '.length).split(' ');
    //console.log(args);
    if(args.length === 0 || args[0].length === 0){
      return respond(message, "You are about to unlink your Discord user from your Minecraft account. You will lose access to all in-game currency that has not very been transferred until you re-link your account. If you would like to continue, run `!unlinkmc confirm` to confirm this action.")
    }
    else if(args.length === 1 && args[0].toLowerCase() === "confirm"){
      pool.query(`UPDATE MinecraftDiscordLink SET mcUUID=NULL WHERE discordID='${message.author.id}'`, function(err, result){
        if (err) return respond(message, "Unable to update the database.");

        return respond(message, "Successfully unlinked your accounts.")
      });
    }

  }
  else if(message.content.startsWith('!linkstatus'))
  {
    pool.query(`SELECT mcUUID FROM MinecraftDiscordLink WHERE discordID='${message.author.id}' AND mcUUID IS NOT NULL`, function(err, result){
      if (err) return respond(message, "Unable to retrieve link status!");
      if(result.length < 1) return respond(message, "Your account is not linked to a Minecraft player.")
      return respond(message, "Currently linked to player with UUID " + result[0].mcUUID);
    });
  }
  else if(message.content.startsWith('!balance')){
    pool.query(`SELECT balance from EventEconomy WHERE discordID='${message.author.id}'`, function(err, result){
      if (err || result.length < 1) return respond("Unable to retrieve your balance!");
      return respond(message, "Your current balance: " + result[0].balance);
    });
  }
  else if(message.channel.id === process.env.VERIFY_CHANNEL_ID && !message.member.roles.has(process.env.ADMIN_ROLE_ID)){
    message.delete();
  }
});