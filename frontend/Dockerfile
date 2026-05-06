FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
ARG VITE_API_BASE_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm install --workspace frontend --include-workspace-root=false
COPY . .
RUN npm run build --workspace frontend
EXPOSE 5173
CMD ["npm", "run", "preview", "--workspace", "frontend", "--", "--port", "5173"]
