require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const PerformanceMonitor = require('./performance-monitor');
const cron = require('node-cron');

class DashboardServer {
  constructor(port = 3000) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.port = port;
    this.monitor = new PerformanceMonitor();
    this.clients = new Set();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupCronJobs();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // API endpoints for dashboard data
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = this.monitor.getCurrentMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/summary', async (req, res) => {
      try {
        const summary = await this.monitor.getPerformanceSummary();
        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/trades', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const trades = await this.monitor.getRecentTrades(limit);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/trends', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 7;
        const trends = await this.monitor.getProfitabilityTrend(days);
        res.json(trends);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/gas', async (req, res) => {
      try {
        const gasAnalysis = await this.monitor.getGasAnalysis();
        res.json(gasAnalysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/export/:format', async (req, res) => {
      try {
        const format = req.params.format || 'json';
        const data = await this.monitor.exportMetrics(format);
        
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=trading-metrics.csv');
          res.send(data);
        } else {
          res.json(data);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('New client connected to dashboard');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('Client disconnected from dashboard');
        this.clients.delete(ws);
      });

      // Send initial data
      this.sendInitialData(ws);
    });
  }

  setupCronJobs() {
    // Update metrics every 5 minutes instead of every minute
    cron.schedule('*/5 * * * *', async () => {
      try {
        const metrics = this.monitor.getCurrentMetrics();
        this.broadcastToClients({
          type: 'metrics_update',
          data: metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating metrics:', error);
      }
    });

    // Send performance summary every 10 minutes instead of every 5 minutes
    cron.schedule('*/10 * * * *', async () => {
      try {
        const summary = await this.monitor.getPerformanceSummary();
        this.broadcastToClients({
          type: 'summary_update',
          data: summary,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating summary:', error);
      }
    });
  }

  async sendInitialData(ws) {
    try {
      const [metrics, summary, recentTrades] = await Promise.all([
        this.monitor.getCurrentMetrics(),
        this.monitor.getPerformanceSummary(),
        this.monitor.getRecentTrades(10)
      ]);

      ws.send(JSON.stringify({
        type: 'initial_data',
        data: { metrics, summary, recentTrades },
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  broadcastToClients(message) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Method to be called from external sources (like the bot)
  broadcastTradeUpdate(tradeData) {
    this.broadcastToClients({
      type: 'trade_update',
      data: tradeData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastPriceUpdate(priceData) {
    this.broadcastToClients({
      type: 'price_update',
      data: priceData,
      timestamp: new Date().toISOString()
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`📊 Dashboard server running on http://localhost:${this.port}`);
      console.log(`🔌 WebSocket server ready for real-time updates`);
    });
  }

  stop() {
    this.server.close(() => {
      console.log('Dashboard server stopped');
    });
  }
}

// Create and start the dashboard server
const dashboard = new DashboardServer(process.env.DASHBOARD_PORT || 3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down dashboard server...');
  dashboard.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down dashboard server...');
  dashboard.stop();
  process.exit(0);
});

// Start the server
dashboard.start();

module.exports = DashboardServer;
