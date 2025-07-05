# 🔐 API Keys Setup Guide

## 🚨 Security First

**NEVER commit API keys to version control!**
- The `.env` file is already in `.gitignore`
- Use environment variables in production
- Rotate keys regularly
- Monitor API usage for anomalies

## 🔑 Required API Keys

### **1. Alchemy (✅ Already Configured)**
```bash
ALCHEMY_API_KEY=032_oXCLHa5sDIkZji0am
```
- **Purpose**: Blockchain data, token balances, NFTs
- **Cost**: Free tier available (100k requests/month)
- **Status**: ✅ Ready to use

### **2. Etherscan (🔴 NEEDED)**
```bash
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY_HERE
```
- **Get it**: https://etherscan.io/apis
- **Purpose**: Transaction history, contract interactions
- **Cost**: FREE (5 calls/second)
- **Setup**:
  1. Go to etherscan.io/apis
  2. Create account
  3. Generate API key
  4. Add to `.env` file

### **3. OpenSea (🔴 NEEDED)**
```bash
OPENSEA_API_KEY=YOUR_OPENSEA_KEY_HERE
```
- **Get it**: https://docs.opensea.io/reference/api-overview
- **Purpose**: NFT metadata and collections
- **Cost**: FREE with rate limits
- **Setup**:
  1. Go to opensea.io/account/settings
  2. Request API access
  3. Get API key
  4. Add to `.env` file

### **4. DeBank (🟡 OPTIONAL)**
```bash
DEBANK_API_KEY=YOUR_DEBANK_KEY_HERE
```
- **Get it**: https://docs.cloud.debank.com/
- **Purpose**: DeFi positions and portfolio values
- **Cost**: PAID service
- **Note**: Optional for basic testing

### **5. Plaid (🟡 OPTIONAL)**
```bash
PLAID_CLIENT_ID=YOUR_PLAID_CLIENT_ID
PLAID_SECRET=YOUR_PLAID_SECRET
```
- **Get it**: https://plaid.com/docs/
- **Purpose**: Bank account connections
- **Cost**: FREE tier (100 items/month)
- **Note**: Requires user consent flow

## 🚀 Quick Setup Commands

### **Step 1: Get Essential Keys**
```bash
# 1. Get Etherscan API key (FREE)
open https://etherscan.io/apis

# 2. Get OpenSea API key (FREE)
open https://docs.opensea.io/reference/api-overview
```

### **Step 2: Update .env File**
```bash
# Edit your .env file
nano .env

# Add the new keys:
ETHERSCAN_API_KEY=your_actual_key_here
OPENSEA_API_KEY=your_actual_key_here
```

### **Step 3: Test Configuration**
```bash
# Test that keys are loaded
npm run test:api-keys
```

## 🧪 Testing Without All Keys

The app gracefully handles missing API keys:

### **With Alchemy Only** (Current Setup)
✅ **Works**:
- Token balance discovery
- NFT discovery
- Basic blockchain analysis

❌ **Limited**:
- No transaction history
- No OpenSea NFT metadata
- No DeFi position data

### **With Alchemy + Etherscan**
✅ **Works**:
- Full blockchain asset discovery
- Transaction pattern analysis
- Contract interaction history

### **With All Keys**
✅ **Full Functionality**:
- Complete blockchain asset discovery
- Rich NFT metadata
- DeFi position tracking
- Traditional asset discovery framework

## 🔒 Production Security

### **Environment Variables**
```bash
# Production deployment
export ALCHEMY_API_KEY="your_key"
export ETHERSCAN_API_KEY="your_key"
export OPENSEA_API_KEY="your_key"
```

### **Key Rotation Schedule**
- **Monthly**: Rotate all API keys
- **Immediately**: If any key is compromised
- **Quarterly**: Review API usage and costs

### **Monitoring**
- Set up API usage alerts
- Monitor for unusual activity
- Track rate limit usage
- Log all API calls for audit

## 🚨 Security Checklist

### **Before Going Live**
- [ ] All API keys in environment variables
- [ ] `.env` file in `.gitignore`
- [ ] API usage monitoring enabled
- [ ] Rate limiting implemented
- [ ] Error handling for invalid keys
- [ ] Key rotation schedule established

### **Regular Maintenance**
- [ ] Monthly key rotation
- [ ] API usage review
- [ ] Security audit of key storage
- [ ] Update API client libraries
- [ ] Monitor for API deprecations

## 🆘 Troubleshooting

### **Common Issues**

#### **"API Key Invalid" Errors**
```bash
# Check if key is properly set
echo $ALCHEMY_API_KEY

# Verify .env file format
cat .env | grep ALCHEMY
```

#### **Rate Limit Exceeded**
```bash
# Check API usage
# Implement exponential backoff
# Consider upgrading API plan
```

#### **CORS Errors**
```bash
# Ensure API calls are from backend only
# Never expose API keys to frontend
```

## 📊 API Usage Monitoring

### **Set Up Alerts**
- Alchemy: Monitor request count
- Etherscan: Track rate limit usage
- OpenSea: Monitor response times

### **Cost Management**
- Set monthly spending limits
- Monitor usage trends
- Optimize API call efficiency

---

## 🎯 Next Steps

1. **Get Etherscan API key** (5 minutes, FREE)
2. **Get OpenSea API key** (10 minutes, FREE)
3. **Test asset discovery** with real data
4. **Monitor API usage** and performance
5. **Consider premium APIs** for production use

**With just these two additional FREE API keys, you'll have 90% of the asset discovery functionality working!** 🚀
