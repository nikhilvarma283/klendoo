FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm install

# Build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
