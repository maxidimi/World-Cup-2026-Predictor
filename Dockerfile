FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

USER node
EXPOSE 8000

CMD ["node", "server.js"]
