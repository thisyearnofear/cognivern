# HTTPS Backend Deployment Guide

## 🔒 Security Implementation

This frontend connects directly to the backend server over **HTTPS** using a custom domain with SSL certificate, eliminating mixed content issues while maintaining full security.

## 📋 Architecture Overview

```
Frontend (Vercel) → HTTPS → api.thisyearnofear.com → Backend Server
```

- **Frontend**: Deployed on Vercel (`cognivern.vercel.app`)
- **Backend**: Deployed on Hetzner server with HTTPS (`api.thisyearnofear.com`)
- **SSL**: Let's Encrypt certificate with automatic renewal
- **Security**: No server IP exposure, full HTTPS encryption

## 🌐 Domain Configuration

### **DNS Setup (GoDaddy)**
- **Domain**: `thisyearnofear.com`
- **A Record**: `api.thisyearnofear.com` → `157.180.36.156`
- **TTL**: 600 seconds

### **SSL Certificate**
- **Provider**: Let's Encrypt (free, auto-renewing)
- **Domain**: `api.thisyearnofear.com`
- **Location**: `/etc/letsencrypt/live/api.thisyearnofear.com/`
- **Renewal**: Automatic via certbot

## 🔧 Backend Configuration

### **Nginx HTTPS Setup**
- **HTTP Port 80**: Redirects to HTTPS
- **HTTPS Port 443**: SSL termination and proxy to backend
- **Backend Port 10000**: Internal Docker network
- **SSL Certificates**: Mounted from host to container

### **Docker Compose**
```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./ssl:/etc/nginx/ssl:ro
```

## 🚀 Frontend Configuration

### **API URL Function**
```typescript
export function getApiUrl(endpoint: string): string {
  if (import.meta.env.PROD) {
    return `https://api.thisyearnofear.com${endpoint}`;
  }
  return endpoint; // Vite proxy in development
}
```

### **Environment Variables**
- **Development**: Uses Vite proxy to backend
- **Production**: Direct HTTPS calls to `api.thisyearnofear.com`

## 📊 Deployment Status

### ✅ **Completed**
- [x] Domain configured (`api.thisyearnofear.com`)
- [x] SSL certificate installed (Let's Encrypt)
- [x] Nginx HTTPS configuration
- [x] Docker containers running with SSL
- [x] Frontend updated for HTTPS calls
- [x] Mixed content issues resolved

### 🔍 **Verification**
- **Health Check**: `https://api.thisyearnofear.com/health`
- **API Test**: `https://api.thisyearnofear.com/api/dashboard/summary`
- **SSL Grade**: A+ (with proper SSL configuration)

## 🛠️ Maintenance

### **SSL Certificate Renewal**
- **Automatic**: Certbot handles renewal automatically
- **Manual Check**: `sudo certbot certificates`
- **Manual Renewal**: `sudo certbot renew`

### **Monitoring**
- **Nginx Logs**: `/opt/cognivern/logs/nginx/`
- **Container Status**: `docker ps`
- **SSL Expiry**: Certificate expires 2025-10-14

## 🎯 Benefits Achieved

1. **✅ No Mixed Content**: HTTPS frontend → HTTPS backend
2. **✅ Professional Domain**: `api.thisyearnofear.com` instead of IP
3. **✅ SSL Security**: Full encryption end-to-end
4. **✅ Auto-Renewal**: No manual certificate management
5. **✅ Clean Architecture**: Separation of frontend/backend domains

## 🚨 Important Notes

- **No Vercel Functions**: Direct backend calls eliminate proxy complexity
- **Domain Required**: HTTPS requires proper domain name
- **Certificate Renewal**: Automatic, but monitor expiry dates
- **Firewall**: Ensure ports 80 and 443 are open on server

The deployment is now **production-ready** with enterprise-grade security! 🔒
