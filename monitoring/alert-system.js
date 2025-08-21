require('dotenv').config();
const nodemailer = require('nodemailer');
const PerformanceMonitor = require('./performance-monitor');

class AlertSystem {
  constructor() {
    this.monitor = new PerformanceMonitor();
    this.alertThresholds = {
      consecutiveFailures: parseInt(process.env.ALERT_CONSECUTIVE_FAILURES) || 3,
      lowProfitThreshold: parseFloat(process.env.ALERT_LOW_PROFIT_THRESHOLD) || 0.001,
      highGasThreshold: parseFloat(process.env.ALERT_HIGH_GAS_THRESHOLD) || 0.01,
      lowSuccessRate: parseFloat(process.env.ALERT_LOW_SUCCESS_RATE) || 80.0,
      maxUptimeHours: parseInt(process.env.ALERT_MAX_UPTIME_HOURS) || 24
    };
    
    this.emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
    
    this.notificationEmail = process.env.NOTIFICATION_EMAIL;
    this.alertsEnabled = process.env.ALERTS_ENABLED === 'true';
    
    this.alertHistory = [];
    this.lastAlertTime = {};
    
    if (this.alertsEnabled && this.notificationEmail) {
      this.setupEmailTransporter();
    }
  }

  setupEmailTransporter() {
    try {
      this.transporter = nodemailer.createTransporter(this.emailConfig);
      console.log('📧 Email alerts configured');
    } catch (error) {
      console.error('❌ Failed to configure email alerts:', error.message);
      this.alertsEnabled = false;
    }
  }

  async checkAlerts() {
    try {
      const metrics = this.monitor.getCurrentMetrics();
      const summary = await this.monitor.getPerformanceSummary();
      
      const alerts = [];
      
      // Check consecutive failures
      if (metrics.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
        alerts.push({
          type: 'consecutive_failures',
          severity: 'high',
          message: `Bot has ${metrics.consecutiveFailures} consecutive failures`,
          data: { consecutiveFailures: metrics.consecutiveFailures }
        });
      }
      
      // Check success rate
      if (metrics.successRate < this.alertThresholds.lowSuccessRate) {
        alerts.push({
          type: 'low_success_rate',
          severity: 'medium',
          message: `Success rate is ${metrics.successRate}% (below ${this.alertThresholds.lowSuccessRate}%)`,
          data: { successRate: metrics.successRate }
        });
      }
      
      // Check uptime
      if (metrics.uptimeMinutes > this.alertThresholds.maxUptimeHours * 60) {
        alerts.push({
          type: 'extended_uptime',
          severity: 'low',
          message: `Bot has been running for ${Math.floor(metrics.uptimeMinutes / 60)} hours`,
          data: { uptimeHours: Math.floor(metrics.uptimeMinutes / 60) }
        });
      }
      
      // Check profitability
      if (summary.total_profit && parseFloat(summary.total_profit) < this.alertThresholds.lowProfitThreshold) {
        alerts.push({
          type: 'low_profitability',
          severity: 'medium',
          message: `Total profit is ${summary.total_profit} USDC (below threshold)`,
          data: { totalProfit: summary.total_profit }
        });
      }
      
      // Process alerts
      for (const alert of alerts) {
        await this.processAlert(alert);
      }
      
      return alerts;
    } catch (error) {
      console.error('❌ Error checking alerts:', error.message);
      return [];
    }
  }

  async processAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}`;
    const now = Date.now();
    
    // Rate limiting: don't send same alert type more than once per hour
    if (this.lastAlertTime[alertKey] && 
        (now - this.lastAlertTime[alertKey]) < 3600000) {
      return;
    }
    
    // Record alert
    this.alertHistory.push({
      ...alert,
      timestamp: new Date().toISOString(),
      processed: false
    });
    
    // Send notification
    if (this.alertsEnabled) {
      await this.sendNotification(alert);
    }
    
    // Log alert
    this.logAlert(alert);
    
    // Update last alert time
    this.lastAlertTime[alertKey] = now;
  }

  async sendNotification(alert) {
    if (!this.transporter || !this.notificationEmail) {
      return;
    }
    
    try {
      const subject = `🚨 CryptoBot Alert: ${alert.type.replace(/_/g, ' ').toUpperCase()}`;
      const html = this.formatAlertEmail(alert);
      
      await this.transporter.sendMail({
        from: this.emailConfig.auth.user,
        to: this.notificationEmail,
        subject: subject,
        html: html
      });
      
      console.log(`📧 Alert notification sent: ${alert.type}`);
    } catch (error) {
      console.error('❌ Failed to send alert notification:', error.message);
    }
  }

  formatAlertEmail(alert) {
    const severityColors = {
      low: '#FFA500',
      medium: '#FF8C00',
      high: '#FF0000'
    };
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColors[alert.severity]}; color: white; padding: 20px; text-align: center;">
          <h1>🚨 CryptoBot Alert</h1>
          <p style="font-size: 18px; margin: 0;">${alert.message}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h3>Alert Details:</h3>
          <ul>
            <li><strong>Type:</strong> ${alert.type.replace(/_/g, ' ').toUpperCase()}</li>
            <li><strong>Severity:</strong> ${alert.severity.toUpperCase()}</li>
            <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>Message:</strong> ${alert.message}</li>
          </ul>
          
          ${alert.data ? `
            <h3>Additional Data:</h3>
            <pre style="background-color: white; padding: 10px; border-radius: 5px;">${JSON.stringify(alert.data, null, 2)}</pre>
          ` : ''}
        </div>
        
        <div style="padding: 20px; text-align: center; color: #666;">
          <p>This is an automated alert from your CryptoBot monitoring system.</p>
          <p>Please check your bot's status and take appropriate action if necessary.</p>
        </div>
      </div>
    `;
  }

  logAlert(alert) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${alert.severity.toUpperCase()} ALERT: ${alert.message}`;
    
    console.log(logMessage);
    
    // You could also log to a file or external logging service
    // fs.appendFileSync('alerts.log', logMessage + '\n');
  }

  async getAlertHistory(limit = 50) {
    return this.alertHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getAlertStats() {
    const total = this.alertHistory.length;
    const bySeverity = {
      low: this.alertHistory.filter(a => a.severity === 'low').length,
      medium: this.alertHistory.filter(a => a.severity === 'medium').length,
      high: this.alertHistory.filter(a => a.severity === 'high').length
    };
    
    const byType = {};
    this.alertHistory.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    });
    
    return {
      total,
      bySeverity,
      byType,
      last24Hours: this.alertHistory.filter(a => 
        (Date.now() - new Date(a.timestamp).getTime()) < 86400000
      ).length
    };
  }

  // Method to be called when a trade fails
  async onTradeFailure(tradeData) {
    const alert = {
      type: 'trade_failure',
      severity: 'medium',
      message: `Trade failed: ${tradeData.errorMessage || 'Unknown error'}`,
      data: tradeData
    };
    
    await this.processAlert(alert);
  }

  // Method to be called when a trade succeeds
  async onTradeSuccess(tradeData) {
    // Check if this was after consecutive failures
    const metrics = this.monitor.getCurrentMetrics();
    if (metrics.consecutiveFailures > 0) {
      const alert = {
        type: 'recovery',
        severity: 'low',
        message: `Bot recovered from ${metrics.consecutiveFailures} consecutive failures`,
        data: { consecutiveFailures: metrics.consecutiveFailures }
      };
      
      await this.processAlert(alert);
    }
  }

  // Method to be called for gas price alerts
  async onHighGasPrice(gasData) {
    if (parseFloat(gasData.gasPriceGwei) > this.alertThresholds.highGasThreshold) {
      const alert = {
        type: 'high_gas_price',
        severity: 'medium',
        message: `Gas price is high: ${gasData.gasPriceGwei} gwei`,
        data: gasData
      };
      
      await this.processAlert(alert);
    }
  }

  // Test email configuration
  async testEmailConfiguration() {
    if (!this.transporter || !this.notificationEmail) {
      console.log('❌ Email alerts not configured');
      return false;
    }
    
    try {
      await this.transporter.sendMail({
        from: this.emailConfig.auth.user,
        to: this.notificationEmail,
        subject: '🧪 CryptoBot Alert System Test',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Alert System Test Successful</h2>
            <p>Your CryptoBot alert system is properly configured and working.</p>
            <p>Test time: ${new Date().toLocaleString()}</p>
          </div>
        `
      });
      
      console.log('✅ Test email sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Test email failed:', error.message);
      return false;
    }
  }
}

module.exports = AlertSystem;
