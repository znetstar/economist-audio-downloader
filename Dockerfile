FROM node:10

ADD . /app

WORKDIR /app

RUN npm install --only=production

ENTRYPOINT [ "bin/economist-audio-downloader" ]