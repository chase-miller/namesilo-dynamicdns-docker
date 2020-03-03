FROM node:lts-alpine3.11

LABEL Tim Turner <timdturner@gmail.com>

WORKDIR /namesilo

ADD . .

CMD [ "npm", "start" ]