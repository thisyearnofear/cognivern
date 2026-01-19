# Frontend Improvements Plan

## Issues & Fixes

### 1. **Wallet Integration Conflicts**
**Problem**: Backpack wallet trying to override `window.ethereum` when MetaMask already injected it

**Root Cause**: 
- Multiple wallet providers trying to inject themselves into `window.ethereum`
- No wallet provider selection mechanism
- Unsafe property assignment pattern

**Solutions**:
- [ ] Implement WalletConnect integration instead of direct `window.ethereum` injection
- [ ] Add wallet provider selection UI
- [ ] Implement safe wallet detection with fallback order
- [ ] Remove hardcoded Filecoin chain switching (Sapience uses Arbitrum/Ethereal)

### 2. **Mixed Content / HTTPS Issues**
**Problem**: "Mixed Content: The page at ... was loaded over HTTPS, but requested an insecure resource"

**Root Cause**:
- Backend URL using HTTP in production environment
- Vite proxy not properly configured for mixed environments

**Solutions**:
- [ ] Ensure VITE_BACKEND_URL uses HTTPS in production
- [ ] Add CORS headers to backend
- [ ] Update vite.config.ts to handle HTTPS properly
- [ ] Implement retry logic for failed requests

### 3. **Failed Fetch Errors**
**Problem**: Repeated "Failed to fetch" errors for `/api/agents` and `/api/blockchain-stats`

**Root Causes**:
- Missing backend endpoints
- CORS headers not configured
- API unreachable during development
- Backpack wallet interference with fetch

**Solutions**:
- [ ] Implement proper error handling with user feedback
- [ ] Add graceful fallback to mock data
- [ ] Implement exponential backoff for retries
- [ ] Add connection status indicator in UI

### 4. **Inconsistent Messaging**
**Current Issues**:
- Dashboard shows Sapience forecasting, but trading pages still reference trading agents
- AI Trading Agents in sidebar/navigation
- Header page titles mention "Trading" agents
- Audit logs show Vincent/Recall agents
- Policy management references trading agents
- Web3Auth mentions Filecoin but app uses Arbitrum

**Needed Changes**:
- [ ] Update all navigation/sidebar labels
- [ ] Update header titles for consistency
- [ ] Replace trading agent references with Sapience/forecasting
- [ ] Update page descriptions and explanations
- [ ] Align blockchain chain references (Arbitrum primary, Ethereal for trades)
- [ ] Update API service to reference correct endpoints

### 5. **UI/UX Improvements**
**Current Issues**:
- No connection status indicator
- No error recovery UI
- No wallet selection UI
- Inconsistent loading states
- Mock data shown without indication
- No feedback for network errors

**Improvements**:
- [ ] Add persistent connection status bar
- [ ] Add proper error boundaries with recovery actions
- [ ] Add network status monitoring
- [ ] Improve loading skeleton states
- [ ] Add data source indicator (mock vs. real)
- [ ] Add retry buttons on failed requests

### 6. **API Structure Alignment**
**Issues**:
- API endpoints reference old agent types (recall, vincent, trading)
- No Sapience-specific endpoints
- Dashboard tries to fetch `/api/agents` which likely doesn't exist
- Metrics endpoint expects trading data format

**Solutions**:
- [ ] Create Sapience-specific API service
- [ ] Update dashboard to use correct endpoints
- [ ] Align mock data with actual API response formats
- [ ] Add API documentation/discovery

## Implementation Priority

### Phase 1: Critical (Fixes Breaking Errors)
1. Wallet integration - remove Backpack conflicts
2. HTTPS/CORS issues
3. Failed fetch error handling
4. Mock data fallback with indicators

### Phase 2: Important (Consistency)
1. Update all Sapience references
2. Remove trading agent references
3. Update navigation/sidebar
4. Align blockchain chain references

### Phase 3: Enhancement (UX)
1. Connection status monitoring
2. Better error recovery
3. Wallet selection UI
4. Improved loading states
