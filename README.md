# MasseyHacks Verification Bot
![MasseyHacks Verification Bot - Build and Publish to Docker](https://github.com/MasseyHacks/MasseyHacks-Verification-Bot/workflows/MasseyHacks%20Verification%20Bot%20-%20Build%20and%20Publish%20to%20Docker/badge.svg)

A Discord verification bot that uses emails from a Google Sheet to verify users on a Discord server. Tracks emails that have already been used to verify a user.

Licensed under MIT.

Requires `credentials.json` and `token.json` in the `data` directory for Google Sheets API.

Requires `.env` (also in the data directory) for all other configuration. Use `.env.template` as a guide.

If you are running the Docker image, you will need to generate `token.json` first, then mount all three files in a directory to `/home/node/app/data` as the container will not have permission to write to the `data` directory and you probably don't want to build an image with those files included.
