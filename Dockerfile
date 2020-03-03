FROM node:lts-alpine3.11

LABEL Chase Miller <chase.a.miller@gmail.com>

WORKDIR /namesilo
ADD . .
RUN npm install

CMD [ "npm", "start" ]