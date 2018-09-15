FROM node:10-slim

ENV NODE_ENV production

ENV NODE_ENV production

ADD . /app

WORKDIR /app

RUN npm install

ENTRYPOINT [ "bin/economist-audio-downloader" ]