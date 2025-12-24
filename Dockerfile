# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.13.0

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production


WORKDIR /usr/src/app

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Run the application as a non-root user.
USER node

# Copy the rest of the source files into the image.
COPY . .

# Expose the port that the application listens on.
# EXPOSE 3000
ENV PORT=3000

# Run the application.
CMD npm start


# # 1. Use a light version of Node.js
# FROM node:20-alpine
# # 2. Create an app directory inside the container
# WORKDIR /app
# # WORKDIR /usr/src/app
# # 3. Copy your package files and install dependencies
# COPY package*.json ./
# RUN npm install --production
# # 4. Copy the rest of your code
# COPY . .
# RUN npm run prisma
# RUN npm run prisma:base
# # RUN npx prisma generate --schema=prisma/schemaBase.prisma
# # 5. The port your app uses (Cloud Run usually expects 8080)
# ENV PORT=3002
# # 6. Start the app
# # CMD ["node", "app.js"]
# CMD npm start

const { encryptData } = require("./functions/encryption")

let data = {
    TOKO_CLIENT_ID:'914f5a39682b42e2b1d6eca50b12bc5d',
TOKO_CLIENT_SECRET:'89f4d6ec9aac43d4922c0efc1f65e443',
TOKO_APP_ID:'18242'
}
console.log(encryptData(JSON.stringify(data)));