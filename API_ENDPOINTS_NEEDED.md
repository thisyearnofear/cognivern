# API Endpoints Needed

Based on the frontend refactor to Sapience, these endpoints are needed on the backend.

## Required Endpoints

### 1. System Health
**Endpoint**: `GET /api/system/health`
**Purpose**: Check backend connectivity and system status
**Response Format**:
```json
{
  "overall": "healthy|warning|critical",
  "components": {
    "arbitrum": "online|degraded|offline",
    "eas": "operational|limited|unavailable",
    "ethereal": "online|degraded|offline",
    "policies": "active|warning|error"
  },
  "metrics": {
    "totalAgents": 1,
    "activeAgents": 1,
    "totalForecasts": 89,
    "complianceRate": 100,
    "averageAttestationTime": 2400
  }
}
```
**Status Codes**:
- 200: System healthy or degraded
- 500: System error
- 503: Service unavailable

### 2. Agent Monitoring
**Endpoint**: `GET /api/agents/monitoring`
**Purpose**: Get Sapience forecasting agent status
**Response Format**:
```json
[
  {
    "id": "sapience-forecast-1",
    "name": "Sapience Forecasting Agent",
    "type": "analysis",
    "status": "active|inactive|error|maintenance",
    "capabilities": ["forecasting", "eas-attestation", "market-analysis", "policy-enforcement"],
    "createdAt": "2024-01-19T00:00:00Z",
    "updatedAt": "2024-01-19T12:00:00Z",
    "lastActivity": "2024-01-19T12:00:00Z",
    "performance": {
      "uptime": 99.9,
      "successRate": 96.6,
      "avgResponseTime": 2400,
      "actionsToday": 12
    },
    "riskMetrics": {
      "currentRiskScore": 0.15,
      "violationsToday": 0,
      "complianceRate": 100
    },
    "financialMetrics": {
      "totalValue": 24500.50,
      "dailyPnL": 892.30,
      "winRate": 76.8
    }
  }
]
```
**Status Codes**:
- 200: Agents found
- 500: Server error

### 3. Blockchain Status (Already Implemented)
**Endpoint**: `GET /api/blockchain/status`
**Purpose**: Check blockchain connectivity
**Expected to return**: Arbitrum and Ethereal network status

## Optional Endpoints

### 4. Metrics Dashboard
**Endpoint**: `GET /api/metrics/daily`
**Purpose**: Historical metrics for dashboard
**Response Format**:
```json
{
  "timestamp": "2024-01-19T12:00:00Z",
  "period": "daily",
  "data": {
    "actions": {
      "total": 89,
      "successful": 86,
      "failed": 2,
      "blocked": 1
    },
    "policies": {
      "total": 50,
      "violations": 0,
      "enforced": 50
    },
    "performance": {
      "averageResponseTime": 2400,
      "p95ResponseTime": 3200,
      "maxResponseTime": 5000
    },
    "resources": {
      "cpuUsage": 35,
      "memoryUsage": 512,
      "storageUsage": 10.5
    }
  }
}
```

### 5. Forecasts History
**Endpoint**: `GET /api/forecasts?limit=50&offset=0`
**Purpose**: Get historical forecasts
**Response Format**:
```json
[
  {
    "id": "forecast-001",
    "marketId": "market-123",
    "probability": 0.72,
    "confidence": 0.95,
    "timestamp": "2024-01-19T10:00:00Z",
    "easAttestation": "0x...",
    "status": "attested|pending|failed",
    "reasoning": "Market analysis shows..."
  }
]
```

### 6. EAS Attestations
**Endpoint**: `GET /api/attestations/recent?limit=10`
**Purpose**: Get recent on-chain attestations
**Response Format**:
```json
[
  {
    "id": "0x...",
    "chainId": 42161,
    "schemaId": "0x...",
    "attester": "0x...",
    "recipient": "0x...",
    "timestamp": "2024-01-19T10:00:00Z",
    "data": {
      "probability": 0.72,
      "marketId": "market-123"
    },
    "txHash": "0x..."
  }
]
```

## Frontend Implementation Notes

### Current Mock Data
The frontend currently generates mock data when these endpoints are unavailable:

**System Health**: 
- Uses fallback with Arbitrum/EAS/Ethereal status
- 1 active agent, 89 total forecasts

**Agent Monitoring**:
- Single Sapience Forecasting Agent
- Performance: 99.9% uptime, 96.6% success rate
- Risk Score: 0.15 (low), 100% compliance

**Recommendations**:
- Auto-generated based on agent status
- Focuses on forecast accuracy, EAS optimization, market expansion

### Retry Logic
Frontend will retry failed requests 3 times with exponential backoff:
- Attempt 1: Wait 1s, then retry
- Attempt 2: Wait 2s, then retry  
- Attempt 3: Wait 4s, then fail with graceful fallback

### Connection Handling
- 4xx errors: Don't retry (client error)
- 5xx errors: Retry with backoff
- Network errors: Retry with backoff
- Timeout: Retry with backoff

## Implementation Timeline

### Phase 1 (Critical - Start Here)
1. Implement `/api/system/health` endpoint
2. Implement `/api/agents/monitoring` endpoint
3. Test with frontend

### Phase 2 (Important)
1. Implement `/api/metrics/daily` endpoint
2. Replace mock metrics with real data
3. Add proper error handling

### Phase 3 (Enhancement)
1. Add `/api/forecasts` endpoint
2. Add `/api/attestations` endpoint
3. Add websocket support for real-time updates

## Testing Checklist

- [ ] Endpoint returns correct HTTP status code
- [ ] JSON response matches documented format
- [ ] Frontend can parse response
- [ ] Frontend displays data correctly
- [ ] Connection status badge reflects availability
- [ ] Mock data shows when endpoint unavailable
- [ ] Retry logic works as expected
- [ ] CORS headers are set

## CORS Headers Required

All endpoints should return:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-KEY
```

Or if more restrictive:
```
Access-Control-Allow-Origin: https://sapience.example.com
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type, X-API-KEY
```

## API Key Authentication

All requests include header:
```
X-API-KEY: <api-key-from-env>
```

Verify this on the backend and return 401 if invalid.

## Error Response Format

When an error occurs, return appropriate status code and optional message:

```json
{
  "error": "Description of error",
  "code": "ERROR_CODE",
  "status": 500
}
```

Frontend will display error message to user if status is 5xx and retry logic exhausted.

## Performance Requirements

- Response time: < 2s (for health check)
- Database queries: Optimized with indexes
- Caching: Optional (frontend does 30s refresh)
- Rate limiting: Recommended (allow at least 1 req/sec per user)

## Next Steps

1. Implement Phase 1 endpoints
2. Update backend CORS configuration
3. Test with frontend in development
4. Verify connection badge shows correct status
5. Test with API down (should show mock data)
6. Deploy to staging
7. Verify production HTTPS works correctly
