FROM node:24-slim

WORKDIR /app

# Install dependencies first so this layer is reused when only source code changes.
# Dev dependencies must stay in (do not set NODE_ENV=production here): the worker runs through tsx,
# and npm ci skips devDependencies when NODE_ENV is production.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The official node image ships a non-root "node" user (uid 1000).
USER node

CMD ["npm", "run", "worker"]
