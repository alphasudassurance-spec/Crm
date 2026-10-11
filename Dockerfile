FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server ./server
COPY public ./public
RUN mkdir -p /app/data
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
