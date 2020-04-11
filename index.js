require('dotenv').config();
const Discord = require('discord.js');
const bot = new Discord.Client();

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
const TOKEN_PATH = 'token.json';

let applicationData = {};

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), applyAuth);
});

function applyAuth(auth) {
   sheets = google.sheets({version: 'v4', auth});
   getHackerInfo();
}

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
      range: 'Form Responses 1!B2:B',
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
      spreadsheetId: '1f-FmODoCMisa5dPWiFoypbg_h4Kdcb95PD3EzkSlaH8',
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
  if (message.content.startsWith('!verify')) {
    const args = message.content.slice('!verify '.length).split(' ');

    if (!args.length || !args[0].length) {
      return respond(message,`Please provide your email!`)
    }

    let email = args[0].toLowerCase();
    if(!applicationData[email]){
      return respond(message, "No such email in our database!")
    }

    // check if email has already been used before
    if(!applicationData[email].discord_tag && !applicationData[email].discord_id){
      // good email, try to add the role now
      message.member.addRole(process.env.HACKER_ROLE_ID).then(() => {
        registerMember(email, message.author.tag, message.author.id).then(() => {
          return respond(message, "Successfully verified!");
        }).catch((e) => {
          return respond(message, "Successfully verified! However, there was an error updating our database. Please contact a team member, otherwise you will not be eligible for prizes and swag.");
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
});