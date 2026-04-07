# =============================================================================
# FamilyDashBoard — Lightweight container for TV deployment
# Serves the dashboard via nginx on port 80
# =============================================================================
FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/RajwanYair/FamilyDashBoard"
LABEL org.opencontainers.image.description="Family TV Dashboard — Hebrew RTL, dark glassmorphism"
LABEL org.opencontainers.image.licenses="MIT"

# Copy dashboard files
COPY BestDashBoard.html /usr/share/nginx/html/index.html
COPY BestDashBoard.html /usr/share/nginx/html/BestDashBoard.html

# Custom nginx config for SPA + security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
