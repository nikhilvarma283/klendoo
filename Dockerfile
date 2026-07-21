FROM node:20-alpine

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm install

# Build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
