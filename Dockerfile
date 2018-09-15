FROM node:10

ENV NODE_ENV production

ADD . /app

WORKDIR /app

RUN npm install

ENTRYPOINT [ "bin/economist-audio-downloader" ]