const path = require('path');
require('dotenv').config({path: path.resolve(process.cwd(),'data','.env')});
const Discord = require('discord.js');
const bot = new Discord.Client();

const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid');

const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

let sheets;

const TOKEN = process.env.TOKEN;

bot.login(TOKEN);

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.resolve('data', 'token.json');

let applicationData = {};

// Load client secrets from a local file.
fs.readFile(path.resolve('data', 'credentials.json'), (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), applyAuth);
});

function applyAuth(auth) {
   sheets = google.sheets({version: 'v4', auth});
   getHackerInfo();
}

// connect to mysql database for currency
// const con = mysql.createConnection({
//   host: process.env.MYSQL_HOST,
//   user: process.env.MYSQL_USER,
//   password: process.env.MYSQL_PASSWORD,
//   database: process.env.MYSQL_DB
// });

let pool = mysql.createPool({
   host: process.env.MYSQL_HOST,
   user: process.env.MYSQL_USER,
   password: process.env.MYSQL_PASSWORD,
   database: process.env.MYSQL_DB,
   connectionLimit: process.env.MYSQL_MAX_CONNECTIONS || 5
})

// con.connect(function(err){
//   if (err) throw err;
//   console.log("Connected to MySQL database!");
//
//   let sql = "CREATE TABLE IF NOT EXISTS EventEconomy (discordID VARCHAR(20), balance DECIMAL(20,2), PRIMARY KEY (`discordID`))";
//   con.query(sql, function (err, result) {
//     if (err) throw err;
//     console.log("Database initialized!");
//   });
// });

pool.on('acquire', function(connection){
  console.log("Connected to MySQL database!");
})

pool.query("CREATE TABLE IF NOT EXISTS EventEconomy (discordID VARCHAR(20), balance DECIMAL(20,2), PRIMARY KEY (`discordID`))", function (err, result) {
  if (err) throw err;
  console.log("Database initialized!");
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getHackerInfo() {
  //const sheets = google.sheets({version: 'v4', auth});
  return new Promise((resolve, reject) => {
    // first get the usernames
    sheets.spreadsheets.values.get({
      spreadsheetId: process.env.DATA_SHEET_ID,
      range: 'Form Responses 1!B2:D',
    }, (err, res) => {
      if (err) return reject('The API returned an error: ' + err);

      const rows = res.data.values;

      if (rows.length) {
        //console.log(rows);

        // fill the cache
        for(let i=0;i<rows.length;i++){
          let row = rows[i];
          applicationData[row[0].toLowerCase()] = {
            row: i+1,
            fullname: row[1] + " " + row[2]
          }
        }

        // get corresponding Discord info
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.DATA_SHEET_ID,
          range: 'Discord!A2:C',
        }, (err, res) => {
          if (err) return reject('The API returned an error: ' + err);

          const rows = res.data.values;
          if (rows.length) {
            //console.log(rows);

            // update the cache with discord IDs
            for(let i=0;i<rows.length;i++){
              let row = rows[i];
              applicationData[row[0].toLowerCase()]["discord_tag"] = row[1];
              applicationData[row[0].toLowerCase()]["discord_id"] = row[2];
            }

            resolve('Updated cache successfully.')
          } else {
            console.log('No data found.');
            return resolve('No data found. Discord info.');
          }
        });

      } else {
        console.log('No data found.');
        return resolve('No data found. User info.')
      }
    });
  });


}

function registerMember(email, discordTag, discordID){
  return new Promise(function(resolve, reject){
    let spreadRow = applicationData[email]["row"] + 1;

    // update the sheet
    sheets.spreadsheets.values.update({
      spreadsheetId: process.env.DATA_SHEET_ID,
      range: 'Discord!B' + spreadRow + ':C'+spreadRow,
      valueInputOption: 'RAW',
      resource: {
        "values": [
            [discordTag, discordID]
        ]
      }
    }, (err, result) => {
      if (err) {
        console.log("err");
        console.log(err);
        return reject(err);
      }

      // update our cache
      applicationData[email]["discord_tag"] = discordTag;
      applicationData[email]["discord_id"] = discordID;
      return resolve();
    })
  })
}

function setupEconomyAccount(discordID){
  return new Promise(function(resolve, reject){
    // set up economy
    pool.query("INSERT INTO EventEconomy (discordID, balance) VALUES ('"+ discordID +"',0)", function(err, result){
      if (err) return reject(err);
      return resolve();
    })
  })
}

function respond(message, reply){
  // if message was sent in the bot testing channel, don't delete the command message and reply in the channel
  if(message.channel.id !== process.env.BOT_TESTING_CHANNEL_ID){
    // public channel, delete the command message and reply in private message
    message.delete();
    return message.author.send(reply);
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
    if(!applicationData[email]){
      return respond(message, "No such email in our database!")
    }

    for (let email in applicationData) {
      if (applicationData.hasOwnProperty(email)) {
        if(applicationData[email].discord_id === message.author.id){
          return respond(message, "This Discord user is already associated with an email!");
        }
      }
    }

    // check if email has already been used before
    if(!applicationData[email].discord_tag && !applicationData[email].discord_id){
      // good email, try to add the role now
      message.member.addRole(process.env.HACKER_ROLE_ID).then(() => {
          message.member.setNickname(applicationData[email].fullname)
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
    else{
      return respond(message,`The email \`${email}\` has already been used to verify a user!`)
    }
  }
  else if(message.content.startsWith('!help')){
    return respond(message, 'Welcome to the MasseyHacks Discord!\n\nUse `!verify (email)` to gain access to this server.\n\nFor any questions or concerns, message a member of the MasseyHacks team or shoot us an email a hello@masseyhacks.ca.')
  }
  else if(message.content.startsWith('!updateverify')){
    if(message.member.roles.has(process.env.ADMIN_ROLE_ID)){
      getHackerInfo().then((msg) => {
        return respond(message, msg);
      }).catch((err) => {
        return respond(message, err);
      })
    }
  }
  else if(message.content.startsWith('!dumpverify')){
    if(message.member.roles.has(process.env.ADMIN_ROLE_ID)){
      let buffer = Buffer.from(JSON.stringify(applicationData), "utf-8");
      return respond(message, {files: [{name: 'userInfoCache_'+Date.now()+'.json', attachment: buffer}]})
    }
  }
  else if(message.content.startsWith('!linkmc')){
    pool.getConnection(function (err, con) {
      con.query(`SELECT secret, mcUUID FROM MinecraftDiscordLink WHERE discordID='${message.author.id}'`, function(err, result){
        if (err){
          con.release();
          return respond(message, "Error contacting the database!");
        }

        //console.log(result);
        if(result.length < 1){
          let newSecret = uuidv4();
          con.query(`INSERT INTO MinecraftDiscordLink (discordID, discordTag, secret) VALUES ('${message.author.id}', '${message.author.tag}', '${newSecret}')`, function(err2, result2){
            if(err2){
              con.release();
              return respond(message, "Error registering secret!");
            }

            con.release();
            return respond(message, "Discord link process started. Log in to the Minecraft server and issue the following command: `/linkdiscord " + newSecret + "`");
          });
        }
        else if(result[0].mcUUID){
          con.release();
          return respond(message, "Your account has already been linked to a Minecraft user with UUID " + result[0].mcUUID);
        }
        else {
          con.release();
          return respond(message, "Discord link process started. Log in to the Minecraft server and issue the following command: `/linkdiscord " + result[0].secret + "`");
        }
      })
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
    pool.query("SELECT mcUUID FROM MinecraftDiscordLink WHERE discordID='"+ message.author.id +"' AND mcUUID IS NOT NULL", function(err, result){
      if (err) return respond(message, "Unable to retrieve link status!");
      if(result.length < 1) return respond(message, "Your account is not linked to a Minecraft player.")
      return respond(message, "Currently linked to player with UUID " + result[0].mcUUID);
    });
  }
  else if(message.content.startsWith('!balance')){
    pool.query("SELECT balance from EventEconomy WHERE discordID='" + message.author.id + "'", function(err, result){
      if (err || result.length < 1) return respond("Unable to retrieve your balance!");
      return respond(message, "Your current balance: " + result[0].balance);
    });
  }
  else if(!message.member.roles.has(process.env.ADMIN_ROLE_ID) && message.channel.id === process.env.VERIFY_CHANNEL_ID){
    message.delete();
  }
});