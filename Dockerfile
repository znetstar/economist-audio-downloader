FROM node:10

ADD . /app

WORKDIR /app

VOLUME /data

ENV OUTPUT /data

RUN npm install

CMD npm start