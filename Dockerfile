FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/site ./site
COPY --from=build /app/public/seed-data.json ./public/seed-data.json
COPY --from=build /app/backend/sqlite-server/server.mjs ./backend/sqlite-server/server.mjs
ENV PORT=7860
ENV DATA_DIR=/app/data
ENV SITE_DIR=/app/site
EXPOSE 7860
CMD ["node", "backend/sqlite-server/server.mjs"]
