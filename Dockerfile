# -------------------------
# 1) Build Stage
# -------------------------
    FROM node:18-alpine AS build

    # Create an app directory
    WORKDIR /app
    
    # Copy only pnpm-related files first so we can cache deps
    COPY package.json pnpm-lock.yaml ./
    
    # Install pnpm globally
    RUN npm install -g pnpm
    
    # Install all dependencies (production + dev) 
    # using the lockfile for a repeatable install
    RUN pnpm install --frozen-lockfile
    
    # Now copy the full source code to /app
    COPY . .
    
    # Build the Next.js app
    RUN pnpm run build
    
    # -------------------------
    # 2) Runner Stage
    # -------------------------
    FROM node:18-alpine AS runner
    
    # Create and set work directory
    WORKDIR /app
    
    # Install pnpm globally in the runner
    RUN npm install -g pnpm
    
    # Copy only the essential artifacts from the build
    COPY --from=build /app/package.json ./
    COPY --from=build /app/pnpm-lock.yaml ./
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/.next ./.next
    COPY --from=build /app/public ./public
    COPY --from=build /app/next.config.js ./
    
    # Expose port 3000 for Railway
    EXPOSE 3000
    
    # Start the Next.js production server
    CMD ["pnpm", "start"]
    