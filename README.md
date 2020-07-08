# Hack the 6ix verification bot

A Discord verification bot that reads from a mongoDB database and verifies users on a Discord server. Tracks attendance and assigns nicknames and roles from the database.

Fork of the MasseyHacks-Verification-Bot.

Licensed under MIT.

Requires `credentials.json` and `token.json` in the `data` directory for Google Sheets API.

Requires `.env` (also in the data directory) for all other configuration. Use `.env.template` as a guide.

If you are running the Docker image, you will need to generate `token.json` first, then mount all three files in a directory to `/home/node/app/data` as the container will not have permission to write to the `data` directory and you probably don't want to build an image with those files included.
