# Development Dockerfile for Training System Backend
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for nodemon)
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/images uploads/pdfs uploads/presentations

# Expose backend port
EXPOSE 5001

# Start development server with nodemon
CMD ["npm", "run", "dev"]
