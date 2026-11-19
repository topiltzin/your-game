FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is reused when only source code changes.
# Dev dependencies stay in: the worker runs through tsx.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The official node image ships a non-root "node" user (uid 1000).
USER node

CMD ["npm", "run", "worker"]
