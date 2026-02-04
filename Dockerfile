# Use Node.js 20 as the base image
FROM node:20-slim

# Install system dependencies: Python3 and FFmpeg
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    python3 -m pip install --no-cache-dir --break-system-packages yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]