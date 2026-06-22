FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY data ./data
COPY docs ./docs

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]

