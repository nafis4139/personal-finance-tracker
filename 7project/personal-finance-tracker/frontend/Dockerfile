# frontend/Dockerfile
# --- Build ---
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve (Nginx) ---
FROM nginx:alpine

# Install CA roots so Nginx can validate HTTPS upstreams (Render uses valid certs)
RUN apk add --no-cache ca-certificates && update-ca-certificates

# Built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
