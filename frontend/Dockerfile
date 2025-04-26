FROM node:18-alpine AS builder
WORKDIR /app

# Accept build-time environment variables
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . ./

RUN npm run build && \
    if [ ! -d public ]; then mkdir -p public; fi

# ---------- runtime ----------
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# only the compiled .next + node_modules + public assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
