FROM node:12-alpine
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY ./src/package*.json ./
USER NODE
RUN mkdir data
RUN npm install
COPY --chown=node:node src/* ./
CMD ["node", "index.js"]