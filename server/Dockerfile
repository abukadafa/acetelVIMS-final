# Build stage
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build -- --skipLibCheck || npx tsc --skipLibCheck
# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads data
EXPOSE 5000
CMD ["npm", "run", "start"]
