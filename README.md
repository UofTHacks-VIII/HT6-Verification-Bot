# Hack the 6ix verification bot

A Discord verification bot that reads from a mongoDB database and verifies users on a Discord server. Tracks attendance and assigns nicknames and roles from the database.

Fork of the MasseyHacks-Verification-Bot. (Not that much of a fork anymore; quite a lot has changed lol)

Licensed under MIT.

Requires a list of roles and role ids in JSON format in the `data` directory.

Requires `.env` (also in the data directory) for all other configuration. Use `.env.template` as a guide.
