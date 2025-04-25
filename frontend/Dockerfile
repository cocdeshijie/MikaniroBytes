FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the frontend source
COPY . .

# Build the Next.js production bundle
RUN npm run build

# ---- Production stage ----
FROM node:18-alpine

WORKDIR /app

# Copy the compiled build from builder
COPY --from=builder /app ./

# Expose Next.js default port
EXPOSE 3000

# Default command
CMD ["npm", "run", "start"]
