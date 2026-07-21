# Multi-stage Dockerfile for React frontend
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

ARG REACT_APP_API_URL=http://localhost:5000/api
ARG REACT_APP_GOOGLE_CLIENT_ID=

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

COPY --from=builder /app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
