# Ağ Testi & Kalite Güvencesi

## Otomatik Testler

### Birim Testleri

Network layer'ı test etmek için comprehensive unit test stratejileri gereklidir.

#### Ağ Katmanı Testi
```javascript
// NetworkService.test.js
import { NetworkService } from '../src/NetworkService';
import { MockAdapter } from 'axios-mock-adapter';

describe('NetworkService', () => {
  let networkService;
  let mockAdapter;

  beforeEach(() => {
    networkService = new NetworkService();
    mockAdapter = new MockAdapter(networkService.axiosInstance);
  });

  afterEach(() => {
    mockAdapter.restore();
  });

  describe('GET requests', () => {
    it('should handle successful GET request', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mockAdapter.onGet('/users/1').reply(200, mockData);

      const result = await networkService.get('/users/1');
      
      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
    });

    it('should handle GET request with query parameters', async () => {
      const mockData = [{ id: 1, name: 'User 1' }];
      mockAdapter.onGet('/users', { params: { page: 1, limit: 10 } })
                 .reply(200, mockData);

      const result = await networkService.get('/users', { 
        params: { page: 1, limit: 10 } 
      });
      
      expect(result.data).toEqual(mockData);
    });

    it('should handle network timeout', async () => {
      mockAdapter.onGet('/users/1').timeout();

      await expect(networkService.get('/users/1'))
        .rejects.toThrow('Network timeout');
    });

    it('should handle server errors', async () => {
      mockAdapter.onGet('/users/1').reply(500, { error: 'Internal Server Error' });

      await expect(networkService.get('/users/1'))
        .rejects.toThrow('Server Error: 500');
    });
  });

  describe('POST requests', () => {
    it('should handle successful POST request', async () => {
      const requestData = { name: 'New User', email: 'user@example.com' };
      const responseData = { id: 2, ...requestData };
      
      mockAdapter.onPost('/users', requestData).reply(201, responseData);

      const result = await networkService.post('/users', requestData);
      
      expect(result.data).toEqual(responseData);
      expect(result.status).toBe(201);
    });

    it('should handle validation errors', async () => {
      const requestData = { name: '', email: 'invalid-email' };
      const errorResponse = {
        errors: {
          name: ['Name is required'],
          email: ['Email format is invalid']
        }
      };
      
      mockAdapter.onPost('/users', requestData).reply(422, errorResponse);

      await expect(networkService.post('/users', requestData))
        .rejects.toThrow('Validation Error');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      const mockData = { id: 1, name: 'Test User' };
      
      mockAdapter
        .onGet('/users/1').replyOnce(500)
        .onGet('/users/1').replyOnce(500)
        .onGet('/users/1').reply(200, mockData);

      const result = await networkService.get('/users/1');
      
      expect(result.data).toEqual(mockData);
      expect(mockAdapter.history.get.length).toBe(3);
    });

    it('should fail after max retries', async () => {
      mockAdapter.onGet('/users/1').reply(500);

      await expect(networkService.get('/users/1'))
        .rejects.toThrow('Max retries exceeded');
    });
  });

  describe('Caching', () => {
    it('should cache successful GET requests', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mockAdapter.onGet('/users/1').reply(200, mockData);

      // First request
      const result1 = await networkService.get('/users/1');
      // Second request (should use cache)
      const result2 = await networkService.get('/users/1');
      
      expect(result1.data).toEqual(mockData);
      expect(result2.data).toEqual(mockData);
      expect(mockAdapter.history.get.length).toBe(1); // Only one actual request
    });

    it('should invalidate cache after TTL', async () => {
      const mockData = { id: 1, name: 'Test User' };
      mockAdapter.onGet('/users/1').reply(200, mockData);

      // Set short TTL for testing
      networkService.setCacheTTL(100);

      const result1 = await networkService.get('/users/1');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result2 = await networkService.get('/users/1');
      
      expect(mockAdapter.history.get.length).toBe(2);
    });
  });
});
```

#### Mock Responses
```javascript
// MockResponseFactory.js
class MockResponseFactory {
  static createUserResponse(overrides = {}) {
    return {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      ...overrides
    };
  }

  static createUsersListResponse(count = 5, overrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      this.createUserResponse({ 
        id: index + 1, 
        name: `User ${index + 1}`,
        ...overrides 
      })
    );
  }

  static createPaginatedResponse(data, page = 1, perPage = 10, total = 100) {
    return {
      data,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage)
      }
    };
  }

  static createErrorResponse(status, message, details = {}) {
    return {
      error: {
        status,
        message,
        details
      }
    };
  }

  static createValidationErrorResponse(errors) {
    return {
      error: {
        status: 422,
        message: 'Validation failed',
        errors
      }
    };
  }
}

// Usage in tests
describe('User API', () => {
  it('should fetch user list', async () => {
    const mockUsers = MockResponseFactory.createUsersListResponse(3);
    mockAdapter.onGet('/users').reply(200, mockUsers);

    const result = await api.getUsers();
    expect(result.data).toHaveLength(3);
  });

  it('should handle validation errors', async () => {
    const validationErrors = MockResponseFactory.createValidationErrorResponse({
      email: ['Email is required', 'Email must be valid'],
      name: ['Name is required']
    });
    
    mockAdapter.onPost('/users').reply(422, validationErrors);

    await expect(api.createUser({})).rejects.toThrow('Validation failed');
  });
});
```

#### Error Scenarios Testing
```javascript
// ErrorScenarios.test.js
describe('Network Error Scenarios', () => {
  describe('Connection Issues', () => {
    it('should handle network timeout', async () => {
      mockAdapter.onGet('/api/data').timeout();
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Request timeout');
    });

    it('should handle connection refused', async () => {
      mockAdapter.onGet('/api/data').networkError();
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Network Error');
    });

    it('should handle DNS resolution failure', async () => {
      mockAdapter.onGet('/api/data').networkErrorOnce();
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Network Error');
    });
  });

  describe('HTTP Status Codes', () => {
    it('should handle 401 Unauthorized', async () => {
      mockAdapter.onGet('/api/protected').reply(401, { 
        error: 'Unauthorized' 
      });
      
      await expect(networkService.get('/api/protected'))
        .rejects.toThrow('Unauthorized');
    });

    it('should handle 403 Forbidden', async () => {
      mockAdapter.onGet('/api/admin').reply(403, { 
        error: 'Forbidden' 
      });
      
      await expect(networkService.get('/api/admin'))
        .rejects.toThrow('Forbidden');
    });

    it('should handle 404 Not Found', async () => {
      mockAdapter.onGet('/api/nonexistent').reply(404, { 
        error: 'Not Found' 
      });
      
      await expect(networkService.get('/api/nonexistent'))
        .rejects.toThrow('Not Found');
    });

    it('should handle 429 Rate Limit', async () => {
      mockAdapter.onGet('/api/data').reply(429, { 
        error: 'Rate limit exceeded',
        retry_after: 60
      });
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should handle 500 Internal Server Error', async () => {
      mockAdapter.onGet('/api/data').reply(500, { 
        error: 'Internal Server Error' 
      });
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Internal Server Error');
    });
  });

  describe('Malformed Responses', () => {
    it('should handle invalid JSON', async () => {
      mockAdapter.onGet('/api/data').reply(200, 'invalid json{');
      
      await expect(networkService.get('/api/data'))
        .rejects.toThrow('Invalid JSON response');
    });

    it('should handle empty response', async () => {
      mockAdapter.onGet('/api/data').reply(200, '');
      
      const result = await networkService.get('/api/data');
      expect(result.data).toBeNull();
    });

    it('should handle unexpected response structure', async () => {
      mockAdapter.onGet('/api/users').reply(200, { unexpected: 'structure' });
      
      const result = await networkService.get('/api/users');
      expect(result.data).toEqual({ unexpected: 'structure' });
    });
  });
});
```

### Integration Tests

#### End-to-End Testing
```javascript
// e2e/network.integration.test.js
describe('Network Integration Tests', () => {
  let testServer;
  let networkService;

  beforeAll(async () => {
    // Start test server
    testServer = await startTestServer();
    networkService = new NetworkService({
      baseURL: testServer.url
    });
  });

  afterAll(async () => {
    await testServer.close();
  });

  describe('User Management Flow', () => {
    it('should complete full user CRUD cycle', async () => {
      // Create user
      const createData = {
        name: 'Integration Test User',
        email: 'integration@test.com'
      };
      
      const createResponse = await networkService.post('/users', createData);
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.id).toBeDefined();
      
      const userId = createResponse.data.id;
      
      // Read user
      const getResponse = await networkService.get(`/users/${userId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.name).toBe(createData.name);
      
      // Update user
      const updateData = { name: 'Updated Name' };
      const updateResponse = await networkService.put(`/users/${userId}`, updateData);
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.name).toBe(updateData.name);
      
      // Delete user
      const deleteResponse = await networkService.delete(`/users/${userId}`);
      expect(deleteResponse.status).toBe(204);
      
      // Verify deletion
      await expect(networkService.get(`/users/${userId}`))
        .rejects.toThrow('Not Found');
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        networkService.post('/users', {
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@test.com`
        })
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.data.name).toBe(`Concurrent User ${index}`);
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle login and protected routes', async () => {
      // Login
      const loginResponse = await networkService.post('/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.token).toBeDefined();
      
      const token = loginResponse.data.token;
      
      // Set auth header
      networkService.setAuthToken(token);
      
      // Access protected route
      const protectedResponse = await networkService.get('/auth/profile');
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.data.user).toBeDefined();
      
      // Test token refresh
      const refreshResponse = await networkService.post('/auth/refresh');
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.data.token).toBeDefined();
    });

    it('should handle token expiration', async () => {
      // Use expired token
      networkService.setAuthToken('expired.token.here');
      
      await expect(networkService.get('/auth/profile'))
        .rejects.toThrow('Unauthorized');
    });
  });
});
```

#### API Integration Testing
```javascript
// ApiIntegration.test.js
describe('API Integration', () => {
  describe('Pagination', () => {
    it('should handle paginated responses', async () => {
      const response = await networkService.get('/users', {
        params: { page: 1, per_page: 5 }
      });
      
      expect(response.data.data).toHaveLength(5);
      expect(response.data.pagination).toMatchObject({
        page: 1,
        per_page: 5,
        total: expect.any(Number),
        total_pages: expect.any(Number)
      });
    });

    it('should handle empty pagination', async () => {
      const response = await networkService.get('/users', {
        params: { page: 999, per_page: 10 }
      });
      
      expect(response.data.data).toHaveLength(0);
      expect(response.data.pagination.page).toBe(999);
    });
  });

  describe('Filtering and Sorting', () => {
    it('should handle query filters', async () => {
      const response = await networkService.get('/users', {
        params: { 
          filter: { role: 'admin' },
          sort: 'created_at',
          order: 'desc'
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.data.data).toBeInstanceOf(Array);
    });

    it('should handle search queries', async () => {
      const response = await networkService.get('/users/search', {
        params: { q: 'john' }
      });
      
      expect(response.status).toBe(200);
      response.data.data.forEach(user => {
        expect(user.name.toLowerCase()).toContain('john');
      });
    });
  });

  describe('File Uploads', () => {
    it('should handle file upload', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content'], { type: 'text/plain' }));
      formData.append('description', 'Test file upload');
      
      const response = await networkService.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      expect(response.status).toBe(201);
      expect(response.data.file_id).toBeDefined();
      expect(response.data.file_url).toBeDefined();
    });

    it('should handle large file upload with progress', async () => {
      const largeFile = new Blob(['x'.repeat(1024 * 1024)], { type: 'text/plain' }); // 1MB
      const formData = new FormData();
      formData.append('file', largeFile);
      
      let progressEvents = [];
      
      const response = await networkService.post('/files/upload', formData, {
        onUploadProgress: (progressEvent) => {
          progressEvents.push(progressEvent);
        }
      });
      
      expect(response.status).toBe(201);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].loaded).toBe(largeFile.size);
    });
  });
});
```

### Real Device Testing

#### Device-Specific Testing
```javascript
// DeviceTests.js
describe('Device-Specific Network Tests', () => {
  describe('iOS Safari', () => {
    beforeEach(() => {
      // Mock iOS Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true
      });
    });

    it('should handle iOS network constraints', async () => {
      const networkService = new NetworkService({
        timeout: 30000, // iOS typically needs longer timeouts
        maxConcurrent: 4 // iOS has connection limits
      });
      
      const response = await networkService.get('/api/data');
      expect(response.status).toBe(200);
    });

    it('should handle background app transitions', async () => {
      // Simulate app going to background
      window.dispatchEvent(new Event('pagehide'));
      
      // Simulate app coming to foreground
      window.dispatchEvent(new Event('pageshow'));
      
      // Network requests should still work
      const response = await networkService.get('/api/status');
      expect(response.status).toBe(200);
    });
  });

  describe('Android Chrome', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 Chrome/91.0.4472.120',
        configurable: true
      });
    });

    it('should handle Android network optimizations', async () => {
      const networkService = new NetworkService({
        compression: true,
        keepAlive: true
      });
      
      const response = await networkService.get('/api/data');
      expect(response.status).toBe(200);
    });

    it('should handle data saver mode', async () => {
      // Mock data saver mode
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true
      });
      
      const response = await networkService.get('/api/data');
      expect(response.config.headers['Save-Data']).toBe('on');
    });
  });

  describe('Low-End Devices', () => {
    beforeEach(() => {
      // Mock low-end device characteristics
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 1, // 1GB RAM
        configurable: true
      });
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2, // 2 CPU cores
        configurable: true
      });
    });

    it('should adapt to low-end device constraints', async () => {
      const networkService = new NetworkService();
      
      // Should use conservative settings
      expect(networkService.maxConcurrentRequests).toBeLessThanOrEqual(2);
      expect(networkService.requestTimeout).toBeGreaterThanOrEqual(30000);
    });

    it('should handle memory pressure', async () => {
      const networkService = new NetworkService();
      
      // Simulate memory pressure
      window.dispatchEvent(new Event('memory-pressure'));
      
      // Cache should be cleared
      expect(networkService.cache.size).toBe(0);
    });
  });
});
```

## Performance Testing

### Load Testing

#### Concurrent Users Simulation
```javascript
// LoadTest.js
class LoadTester {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.options = {
      maxConcurrentUsers: 100,
      rampUpTime: 30000, // 30 seconds
      testDuration: 300000, // 5 minutes
      ...options
    };
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      responseTimes: [],
      errors: []
    };
  }

  async runLoadTest() {
    console.log(`Starting load test with ${this.options.maxConcurrentUsers} concurrent users`);
    
    const startTime = Date.now();
    const promises = [];
    
    // Ramp up users gradually
    for (let i = 0; i < this.options.maxConcurrentUsers; i++) {
      const delay = (this.options.rampUpTime / this.options.maxConcurrentUsers) * i;
      
      promises.push(
        this.delayedStart(delay).then(() => this.simulateUser(i))
      );
    }
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    return this.generateReport(totalTime);
  }

  async delayedStart(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateUser(userId) {
    const startTime = Date.now();
    const endTime = startTime + this.options.testDuration;
    
    while (Date.now() < endTime) {
      try {
        await this.simulateUserAction(userId);
        await this.randomDelay(1000, 5000); // 1-5 seconds between actions
      } catch (error) {
        this.recordError(error);
      }
    }
  }

  async simulateUserAction(userId) {
    const actions = [
      () => this.makeRequest('GET', '/api/users'),
      () => this.makeRequest('GET', `/api/users/${userId % 100}`),
      () => this.makeRequest('POST', '/api/users', { name: `User ${userId}` }),
      () => this.makeRequest('PUT', `/api/users/${userId}`, { name: `Updated User ${userId}` }),
      () => this.makeRequest('GET', '/api/posts', { params: { user_id: userId } })
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    await randomAction();
  }

  async makeRequest(method, url, data = null) {
    const requestStart = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null
      });
      
      const requestEnd = Date.now();
      const responseTime = requestEnd - requestStart;
      
      this.recordSuccess(responseTime);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      const requestEnd = Date.now();
      const responseTime = requestEnd - requestStart;
      
      this.recordError(error, responseTime);
      throw error;
    }
  }

  recordSuccess(responseTime) {
    this.metrics.requestCount++;
    this.metrics.successCount++;
    this.metrics.responseTimes.push(responseTime);
  }

  recordError(error, responseTime = 0) {
    this.metrics.requestCount++;
    this.metrics.errorCount++;
    this.metrics.errors.push({
      error: error.message,
      timestamp: Date.now(),
      responseTime
    });
    
    if (responseTime > 0) {
      this.metrics.responseTimes.push(responseTime);
    }
  }

  randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  generateReport(totalTime) {
    const responseTimes = this.metrics.responseTimes;
    responseTimes.sort((a, b) => a - b);
    
    const report = {
      summary: {
        totalRequests: this.metrics.requestCount,
        successfulRequests: this.metrics.successCount,
        failedRequests: this.metrics.errorCount,
        successRate: (this.metrics.successCount / this.metrics.requestCount) * 100,
        totalTime: totalTime,
        requestsPerSecond: this.metrics.requestCount / (totalTime / 1000)
      },
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: this.percentile(responseTimes, 50),
        p90: this.percentile(responseTimes, 90),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99)
      },
      errors: this.groupErrors()
    };
    
    return report;
  }

  percentile(arr, p) {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[index];
  }

  groupErrors() {
    const grouped = {};
    
    this.metrics.errors.forEach(error => {
      const key = error.error;
      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key]++;
    });
    
    return grouped;
  }
}

// Usage
describe('Load Testing', () => {
  it('should handle concurrent load', async () => {
    const loadTester = new LoadTester('http://localhost:3000', {
      maxConcurrentUsers: 50,
      testDuration: 60000 // 1 minute
    });
    
    const report = await loadTester.runLoadTest();
    
    console.log('Load Test Report:', JSON.stringify(report, null, 2));
    
    // Assertions
    expect(report.summary.successRate).toBeGreaterThan(95);
    expect(report.responseTime.p95).toBeLessThan(5000); // 95% under 5 seconds
    expect(report.summary.requestsPerSecond).toBeGreaterThan(10);
  }, 120000); // 2 minute timeout
});
```

#### Response Time Testing
```javascript
// ResponseTimeTest.js
class ResponseTimeAnalyzer {
  constructor() {
    this.measurements = [];
  }

  async measureEndpoint(url, samples = 100) {
    console.log(`Measuring response time for ${url} with ${samples} samples`);
    
    const measurements = [];
    
    for (let i = 0; i < samples; i++) {
      const measurement = await this.singleMeasurement(url);
      measurements.push(measurement);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.analyzeResults(url, measurements);
  }

  async singleMeasurement(url) {
    const start = performance.now();
    
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const end = performance.now();
      
      return {
        responseTime: end - start,
        status: response.status,
        success: response.ok,
        size: parseInt(response.headers.get('Content-Length') || '0')
      };
    } catch (error) {
      const end = performance.now();
      
      return {
        responseTime: end - start,
        status: 0,
        success: false,
        error: error.message
      };
    }
  }

  analyzeResults(url, measurements) {
    const responseTimes = measurements.map(m => m.responseTime);
    const successfulRequests = measurements.filter(m => m.success);
    const failedRequests = measurements.filter(m => !m.success);
    
    responseTimes.sort((a, b) => a - b);
    
    return {
      url,
      totalRequests: measurements.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      successRate: (successfulRequests.length / measurements.length) * 100,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        median: this.median(responseTimes),
        p90: this.percentile(responseTimes, 90),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        standardDeviation: this.standardDeviation(responseTimes)
      },
      errors: this.groupErrors(failedRequests)
    };
  }

  median(arr) {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  percentile(arr, p) {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(avgSquaredDiff);
  }

  groupErrors(failedRequests) {
    const grouped = {};
    
    failedRequests.forEach(request => {
      const key = request.error || `HTTP ${request.status}`;
      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key]++;
    });
    
    return grouped;
  }
}

// Usage in tests
describe('Response Time Analysis', () => {
  let analyzer;
  
  beforeEach(() => {
    analyzer = new ResponseTimeAnalyzer();
  });

  it('should analyze API endpoint performance', async () => {
    const result = await analyzer.measureEndpoint('/api/users', 50);
    
    console.log('Response Time Analysis:', JSON.stringify(result, null, 2));
    
    // Performance assertions
    expect(result.responseTime.average).toBeLessThan(1000); // Average < 1s
    expect(result.responseTime.p95).toBeLessThan(2000); // 95% < 2s
    expect(result.successRate).toBeGreaterThan(99); // >99% success rate
  });

  it('should compare different endpoints', async () => {
    const endpoints = ['/api/users', '/api/posts', '/api/comments'];
    const results = await Promise.all(
      endpoints.map(endpoint => analyzer.measureEndpoint(endpoint, 30))
    );
    
    results.forEach(result => {
      console.log(`${result.url}: ${result.responseTime.average.toFixed(2)}ms average`);
      expect(result.responseTime.p95).toBeLessThan(5000);
    });
  });
});
```

### Stress Testing

#### Memory Pressure Testing
```javascript
// MemoryStressTest.js
class MemoryStressTest {
  constructor() {
    this.activeConnections = [];
    this.memoryUsage = [];
  }

  async runMemoryStressTest(duration = 60000) {
    console.log(`Starting memory stress test for ${duration}ms`);
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Monitor memory usage
    const memoryMonitor = setInterval(() => {
      if (performance.memory) {
        this.memoryUsage.push({
          timestamp: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        });
      }
    }, 1000);
    
    try {
      while (Date.now() < endTime) {
        // Create multiple concurrent connections
        await this.createBurstConnections(10);
        await this.delay(1000);
        
        // Cleanup some connections
        this.cleanupConnections(5);
        
        // Check memory pressure
        if (this.isMemoryPressureHigh()) {
          console.log('High memory pressure detected, cleaning up...');
          this.cleanupConnections(this.activeConnections.length / 2);
        }
      }
    } finally {
      clearInterval(memoryMonitor);
      this.cleanupAllConnections();
    }
    
    return this.analyzeMemoryUsage();
  }

  async createBurstConnections(count) {
    const promises = Array.from({ length: count }, () => this.createConnection());
    const connections = await Promise.allSettled(promises);
    
    connections.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.activeConnections.push(result.value);
      }
    });
  }

  async createConnection() {
    const controller = new AbortController();
    
    try {
      const response = await fetch('/api/stream', {
        signal: controller.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
      
      return {
        id: Date.now() + Math.random(),
        controller,
        response,
        startTime: Date.now()
      };
    } catch (error) {
      console.error('Connection creation failed:', error);
      throw error;
    }
  }

  cleanupConnections(count) {
    const toCleanup = this.activeConnections.splice(0, count);
    
    toCleanup.forEach(connection => {
      connection.controller.abort();
    });
  }

  cleanupAllConnections() {
    this.activeConnections.forEach(connection => {
      connection.controller.abort();
    });
    this.activeConnections = [];
  }

  isMemoryPressureHigh() {
    if (!performance.memory) return false;
    
    const memoryUsagePercent = 
      (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
    
    return memoryUsagePercent > 80; // 80% threshold
  }

  analyzeMemoryUsage() {
    if (this.memoryUsage.length === 0) {
      return { error: 'No memory data available' };
    }
    
    const usedMemory = this.memoryUsage.map(m => m.used);
    const totalMemory = this.memoryUsage.map(m => m.total);
    
    return {
      peakMemoryUsed: Math.max(...usedMemory),
      averageMemoryUsed: usedMemory.reduce((a, b) => a + b, 0) / usedMemory.length,
      memoryGrowth: usedMemory[usedMemory.length - 1] - usedMemory[0],
      peakTotalMemory: Math.max(...totalMemory),
      memoryUsageTimeline: this.memoryUsage
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('Memory Stress Testing', () => {
  it('should handle memory pressure gracefully', async () => {
    const stressTest = new MemoryStressTest();
    
    const result = await stressTest.runMemoryStressTest(30000); // 30 seconds
    
    console.log('Memory Stress Test Results:', result);
    
    // Memory usage should not grow indefinitely
    expect(result.memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
  }, 60000);
});
```

Bu comprehensive network testing stratejisi, mobile uygulamaların network layer'ının güvenilirliğini ve performansını garanti etmek için kritik öneme sahiptir. Unit testler, integration testler, performance testler ve stress testler kombinasyonu ile robust bir network layer oluşturabilirsiniz.
