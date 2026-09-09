FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time,
# so they must be passed as build args (docker-compose `build.args`),
# not just container `environment` (which only affects the runtime).
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_STORED_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_STORED_URL=$NEXT_PUBLIC_STORED_URL

# Build next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]