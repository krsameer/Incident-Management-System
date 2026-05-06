FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
RUN npm install --workspace backend --include-workspace-root=false
COPY . .
RUN npm run build --workspace backend
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "backend"]
