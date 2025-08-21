require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

class PerformanceMonitor {
  constructor() {
    this.dbPath = path.join(__dirname, 'trading_metrics.db');
    this.initDatabase();
    this.metrics = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      totalGasUsed: 0,
      averageExecutionTime: 0,
      startTime: Date.now(),
      lastTradeTime: null,
      consecutiveFailures: 0,
      maxConsecutiveFailures: 0
    };
  }

  initDatabase() {
    const db = new Database(this.dbPath);
    
    // Trades table
    db.exec(`CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      tx_hash TEXT,
      token_address TEXT,
      amount TEXT,
      profit TEXT,
      gas_used TEXT,
      gas_price TEXT,
      gas_cost TEXT,
      execution_time INTEGER,
      status TEXT,
      error_message TEXT,
      block_number INTEGER,
      network TEXT DEFAULT 'base-mainnet'
    )`);

    // Performance metrics table
    db.exec(`CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_trades INTEGER,
      successful_trades INTEGER,
      failed_trades INTEGER,
      total_profit TEXT,
      total_gas_used TEXT,
      average_execution_time REAL,
      consecutive_failures INTEGER,
      uptime_minutes INTEGER
    )`);

    // Price data table
    db.exec(`CREATE TABLE IF NOT EXISTS price_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      token_in TEXT,
      token_out TEXT,
      amount_in TEXT,
      amount_out TEXT,
      dex TEXT,
      fee_tier TEXT
    )`);

    // Gas metrics table
    db.exec(`CREATE TABLE IF NOT EXISTS gas_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      gas_price_gwei TEXT,
      gas_limit INTEGER,
      estimated_cost TEXT,
      actual_cost TEXT,
      network_congestion TEXT
    )`);
    
    db.close();
  }

  async recordTrade(tradeData) {
    try {
      const db = new Database(this.dbPath);
      
      const stmt = db.prepare(`
        INSERT INTO trades (
          tx_hash, token_address, amount, profit, gas_used, 
          gas_price, gas_cost, execution_time, status, 
          error_message, block_number, network
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run([
        tradeData.txHash || null,
        tradeData.tokenAddress,
        tradeData.amount,
        tradeData.profit,
        tradeData.gasUsed,
        tradeData.gasPrice,
        tradeData.gasCost,
        tradeData.executionTime,
        tradeData.status,
        tradeData.errorMessage || null,
        tradeData.blockNumber || null,
        tradeData.network || 'base-mainnet'
      ]);

      // Update metrics
      this.metrics.totalTrades++;
      if (tradeData.status === 'success') {
        this.metrics.successfulTrades++;
        this.metrics.consecutiveFailures = 0;
      } else {
        this.metrics.failedTrades++;
        this.metrics.consecutiveFailures++;
        if (this.metrics.consecutiveFailures > this.metrics.maxConsecutiveFailures) {
          this.metrics.maxConsecutiveFailures = this.metrics.consecutiveFailures;
        }
      }
      
      this.metrics.lastTradeTime = Date.now();
      this.updateMetrics();
      
      db.close();
      return result.lastInsertRowid;
    } catch (error) {
      throw error;
    }
  }

  async recordPriceData(priceData) {
    try {
      const db = new Database(this.dbPath);
      
      const stmt = db.prepare(`
        INSERT INTO price_data (
          token_in, token_out, amount_in, amount_out, dex, fee_tier
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run([
        priceData.tokenIn,
        priceData.tokenOut,
        priceData.amountIn,
        priceData.amountOut,
        priceData.dex,
        priceData.feeTier || null
      ]);

      db.close();
      return result.lastInsertRowid;
    } catch (error) {
      throw error;
    }
  }

  async recordGasMetrics(gasData) {
    try {
      const db = new Database(this.dbPath);
      
      const stmt = db.prepare(`
        INSERT INTO gas_metrics (
          gas_price_gwei, gas_limit, estimated_cost, 
          actual_cost, network_congestion
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run([
        gasData.gasPriceGwei,
        gasData.gasLimit,
        gasData.estimatedCost,
        gasData.actualCost,
        gasData.networkCongestion || 'normal'
      ]);

      db.close();
      return result.lastInsertRowid;
    } catch (error) {
      throw error;
    }
  }

  updateMetrics() {
    this.metrics.totalProfit = parseFloat(this.metrics.totalProfit) + parseFloat(this.metrics.lastTradeProfit || 0);
    this.metrics.totalGasUsed = parseFloat(this.metrics.totalGasUsed) + parseFloat(this.metrics.lastTradeGasUsed || 0);
    
    if (this.metrics.totalTrades > 0) {
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime * (this.metrics.totalTrades - 1) + this.metrics.lastTradeExecutionTime) / this.metrics.totalTrades;
    }
  }

  async getPerformanceSummary() {
    try {
      const db = new Database(this.dbPath);
      
      const row = db.prepare(`
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_trades,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_trades,
          SUM(CAST(profit AS REAL)) as total_profit,
          SUM(CAST(gas_cost AS REAL)) as total_gas_cost,
          AVG(CAST(execution_time AS REAL)) as avg_execution_time,
          MAX(timestamp) as last_trade_time
        FROM trades
      `).get();

      db.close();
      return row;
    } catch (error) {
      throw error;
    }
  }

  async getRecentTrades(limit = 10) {
    try {
      const db = new Database(this.dbPath);
      
      const rows = db.prepare(`
        SELECT * FROM trades 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).all(limit);

      db.close();
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getProfitabilityTrend(days = 7) {
    try {
      const db = new Database(this.dbPath);
      
      const rows = db.prepare(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as trades,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_trades,
          SUM(CAST(profit AS REAL)) as daily_profit,
          AVG(CAST(gas_cost AS REAL)) as avg_gas_cost
        FROM trades 
        WHERE timestamp >= datetime('now', '-${days} days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `).all();

      db.close();
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async getGasAnalysis() {
    try {
      const db = new Database(this.dbPath);
      
      const rows = db.prepare(`
        SELECT 
          AVG(CAST(gas_price_gwei AS REAL)) as avg_gas_price,
          AVG(CAST(estimated_cost AS REAL)) as avg_estimated_cost,
          AVG(CAST(actual_cost AS REAL)) as avg_actual_cost,
          COUNT(*) as total_metrics
        FROM gas_metrics
      `).all();

      db.close();
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  async exportMetrics(format = 'json') {
    const summary = await this.getPerformanceSummary();
    const recentTrades = await this.getRecentTrades(50);
    const profitabilityTrend = await this.getProfitabilityTrend(30);
    const gasAnalysis = await this.getGasAnalysis();

    const exportData = {
      summary,
      recentTrades,
      profitabilityTrend,
      gasAnalysis,
      exportTimestamp: new Date().toISOString()
    };

    if (format === 'json') {
      return exportData;
    } else if (format === 'csv') {
      // Convert to CSV format
      return this.convertToCSV(exportData);
    }
  }

  convertToCSV(data) {
    // Implementation for CSV conversion
    let csv = 'Metric,Value\n';
    csv += `Total Trades,${data.summary.total_trades}\n`;
    csv += `Successful Trades,${data.summary.successful_trades}\n`;
    csv += `Failed Trades,${data.summary.failed_trades}\n`;
    csv += `Total Profit,${data.summary.total_profit}\n`;
    csv += `Total Gas Cost,${data.summary.total_gas_cost}\n`;
    csv += `Average Execution Time,${data.summary.avg_execution_time}\n`;
    return csv;
  }

  getCurrentMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      ...this.metrics,
      uptimeMinutes: Math.floor(uptime / 60000),
      successRate: this.metrics.totalTrades > 0 ? 
        (this.metrics.successfulTrades / this.metrics.totalTrades * 100).toFixed(2) : 0,
      averageProfitPerTrade: this.metrics.totalTrades > 0 ? 
        (this.metrics.totalProfit / this.metrics.totalTrades).toFixed(6) : 0
    };
  }
}

module.exports = PerformanceMonitor;
