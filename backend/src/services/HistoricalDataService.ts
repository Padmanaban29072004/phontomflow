/**
 * Historical Data Query Service
 * Service for querying and analyzing historical time-series data
 */

import { logger } from '@/utils/logger';
import { InfluxDBService } from './InfluxDBService';
import {
  HistoricalDataInterface,
  QueryOptions,
  TimeSeriesQuery,
  InfluxDBQueryResult,
  PerformanceReport,
  ThreatAnalytics,
  TimeSeriesAnalytics,
  AggregationFunction
} from '@/types/influxdb';

export class HistoricalDataService implements HistoricalDataInterface {
  private influxDB: InfluxDBService;

  constructor(influxDB: InfluxDBService) {
    this.influxDB = influxDB;
  }

  // ============================================================================
  // PERFORMANCE METRICS QUERIES
  // ============================================================================

  public async getPerformanceMetrics(options: QueryOptions): Promise<PerformanceReport> {
    try {
      logger.debug('Getting performance metrics report', { options });

      const timeRange = {
        start: options.startTime ? new Date(options.startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
        end: options.endTime ? new Date(options.endTime) : new Date()
      };

      // Get basic metrics
      const [responseTimeData, throughputData, errorRateData, topEndpointsData] = await Promise.all([
        this.getResponseTimeMetrics(options),
        this.getThroughputMetrics(options),
        this.getErrorRateMetrics(options),
        this.getTopEndpoints(options)
      ]);

      // Calculate trends
      const trends = {
        responseTime: await this.calculateTrend(responseTimeData, 'avg_response_time'),
        throughput: await this.calculateTrend(throughputData, 'total_requests'),
        errorRate: await this.calculateTrend(errorRateData, 'error_rate')
      };

      // Calculate summary metrics
      const metrics = {
        averageResponseTime: this.calculateAverage(responseTimeData, 'avg_response_time'),
        p95ResponseTime: this.calculatePercentile(responseTimeData, 'avg_response_time', 95),
        p99ResponseTime: this.calculatePercentile(responseTimeData, 'avg_response_time', 99),
        throughput: this.calculateSum(throughputData, 'total_requests'),
        errorRate: this.calculateAverage(errorRateData, 'error_rate'),
        uptime: 100 - this.calculateAverage(errorRateData, 'error_rate') // Simplified uptime calculation
      };

      return {
        timeRange,
        metrics,
        trends,
        topEndpoints: topEndpointsData
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  // ============================================================================
  // THREAT ANALYTICS QUERIES
  // ============================================================================

  public async getThreatAnalytics(options: QueryOptions): Promise<ThreatAnalytics> {
    try {
      logger.debug('Getting threat analytics report', { options });

      const timeRange = {
        start: options.startTime ? new Date(options.startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: last 7 days
        end: options.endTime ? new Date(options.endTime) : new Date()
      };

      // Get threat data
      const [threatCountData, riskScoreData, blockedThreatsData, topThreatTypesData, geoData] = await Promise.all([
        this.getThreatCountData(options),
        this.getRiskScoreData(options),
        this.getBlockedThreatsData(options),
        this.getTopThreatTypes(options),
        this.getGeographicDistribution(options)
      ]);

      // Calculate trends
      const trends = {
        threatCount: await this.calculateTrend(threatCountData, 'threat_count'),
        riskScore: await this.calculateTrend(riskScoreData, 'avg_risk_score'),
        blockedRate: await this.calculateTrend(blockedThreatsData, 'blocked_count')
      };

      // Calculate summary
      const totalThreats = this.calculateSum(threatCountData, 'threat_count');
      const blockedThreats = this.calculateSum(blockedThreatsData, 'blocked_count');
      const averageRiskScore = this.calculateAverage(riskScoreData, 'avg_risk_score');

      const summary = {
        totalThreats,
        blockedThreats,
        falsePositives: Math.round(totalThreats * 0.05), // Estimate 5% false positive rate
        averageRiskScore,
        topThreatTypes: topThreatTypesData.map(item => ({
          type: item.threat_type,
          count: item.count,
          percentage: (item.count / totalThreats) * 100
        }))
      };

      return {
        timeRange,
        summary,
        trends,
        geographicDistribution: geoData
      };
    } catch (error) {
      logger.error('Error getting threat analytics:', error);
      throw error;
    }
  }

  // ============================================================================
  // TIME SERIES DATA QUERIES
  // ============================================================================

  public async getTimeSeriesData(query: TimeSeriesQuery): Promise<InfluxDBQueryResult> {
    try {
      logger.debug('Getting time series data', { query });

      const options: QueryOptions = {
        measurement: query.measurement,
        startTime: query.timeRange.start,
        endTime: query.timeRange.end,
        tags: query.filters.tags,
        fields: query.filters.fields,
        aggregation: query.aggregation,
        groupBy: query.groupBy,
        limit: query.limit
      };

      return await this.influxDB.queryTimeSeries(options);
    } catch (error) {
      logger.error('Error getting time series data:', error);
      throw error;
    }
  }

  public async getAggregatedData(options: QueryOptions): Promise<InfluxDBQueryResult> {
    try {
      logger.debug('Getting aggregated data', { options });

      if (!options.aggregation) {
        throw new Error('Aggregation function is required for aggregated data');
      }

      const query = this.buildAggregationQuery(options);
      return await this.influxDB.query(query);
    } catch (error) {
      logger.error('Error getting aggregated data:', error);
      throw error;
    }
  }

  public async getRealTimeData(measurement: string, lastMinutes: number = 5): Promise<InfluxDBQueryResult> {
    try {
      logger.debug('Getting real-time data', { measurement, lastMinutes });

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - lastMinutes * 60 * 1000);

      const options: QueryOptions = {
        measurement,
        startTime,
        endTime,
        orderBy: 'DESC',
        limit: 1000
      };

      return await this.influxDB.queryTimeSeries(options);
    } catch (error) {
      logger.error('Error getting real-time data:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - PERFORMANCE METRICS
  // ============================================================================

  private async getResponseTimeMetrics(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT mean(response_time) as avg_response_time, 
             percentile(response_time, 95) as p95_response_time,
             percentile(response_time, 99) as p99_response_time
      FROM performance_metrics 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY time(5m), endpoint
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getThroughputMetrics(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT sum(request_count) as total_requests 
      FROM performance_metrics 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY time(5m)
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getErrorRateMetrics(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT (sum(error_count) / sum(request_count)) * 100 as error_rate 
      FROM performance_metrics 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY time(5m)
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getTopEndpoints(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT endpoint, 
             sum(request_count) as total_requests, 
             mean(response_time) as avg_response_time,
             (sum(error_count) / sum(request_count)) * 100 as error_rate
      FROM performance_metrics 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY endpoint
      ORDER BY total_requests DESC
      LIMIT 10
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - THREAT ANALYTICS
  // ============================================================================

  private async getThreatCountData(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT count(*) as threat_count 
      FROM threat_detection 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY time(1h), threat_type
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getRiskScoreData(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT mean(risk_score) as avg_risk_score 
      FROM threat_detection 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY time(1h)
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getBlockedThreatsData(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT count(*) as blocked_count 
      FROM threat_detection 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}' 
      AND blocked = true
      GROUP BY time(1h)
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getTopThreatTypes(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT threat_type, count(*) as count 
      FROM threat_detection 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY threat_type
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  private async getGeographicDistribution(options: QueryOptions): Promise<any[]> {
    const query = `
      SELECT country, 
             count(*) as threat_count, 
             mean(risk_score) as avg_risk_score
      FROM threat_detection 
      WHERE time >= '${this.formatTime(options.startTime)}' AND time <= '${this.formatTime(options.endTime)}'
      GROUP BY country
      ORDER BY threat_count DESC
      LIMIT 20
    `;
    
    const result = await this.influxDB.query(query);
    return result.success ? result.data : [];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - CALCULATIONS
  // ============================================================================

  private async calculateTrend(data: any[], field: string): Promise<TimeSeriesAnalytics> {
    if (data.length === 0) {
      return {
        trend: 'stable',
        changeRate: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        percentile95: 0,
        dataPoints: 0,
        timeRange: { start: new Date(), end: new Date() }
      };
    }

    const values = data.map(item => item[field] || 0).filter(val => !isNaN(val));
    
    if (values.length === 0) {
      return {
        trend: 'stable',
        changeRate: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        percentile95: 0,
        dataPoints: 0,
        timeRange: { start: new Date(), end: new Date() }
      };
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const percentile95 = sortedValues[Math.floor(sortedValues.length * 0.95)];

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const changeRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
    if (Math.abs(changeRate) > 10) {
      trend = changeRate > 0 ? 'increasing' : 'decreasing';
    } else if (Math.abs(changeRate) > 5) {
      trend = 'volatile';
    }

    return {
      trend,
      changeRate,
      average,
      median,
      min,
      max,
      percentile95,
      dataPoints: values.length,
      timeRange: {
        start: data[0]?.time ? new Date(data[0].time) : new Date(),
        end: data[data.length - 1]?.time ? new Date(data[data.length - 1].time) : new Date()
      }
    };
  }

  private calculateAverage(data: any[], field: string): number {
    if (data.length === 0) return 0;
    const values = data.map(item => item[field] || 0).filter(val => !isNaN(val));
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateSum(data: any[], field: string): number {
    if (data.length === 0) return 0;
    const values = data.map(item => item[field] || 0).filter(val => !isNaN(val));
    return values.reduce((sum, val) => sum + val, 0);
  }

  private calculatePercentile(data: any[], field: string, percentile: number): number {
    if (data.length === 0) return 0;
    const values = data.map(item => item[field] || 0).filter(val => !isNaN(val));
    if (values.length === 0) return 0;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sortedValues.length);
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS - QUERY BUILDING
  // ============================================================================

  private buildAggregationQuery(options: QueryOptions): string {
    let query = `SELECT `;
    
    if (options.aggregation) {
      const { function: func, field, percentile, groupByTime } = options.aggregation;
      
      if (func === 'percentile' && percentile) {
        query += `${func}(${field}, ${percentile}) as ${field}_${func}_${percentile}`;
      } else {
        query += `${func}(${field}) as ${field}_${func}`;
      }
    } else {
      query += '*';
    }
    
    query += ` FROM "${options.measurement}"`;
    
    // Add time range
    if (options.startTime || options.endTime) {
      const conditions: string[] = [];
      
      if (options.startTime) {
        conditions.push(`time >= '${this.formatTime(options.startTime)}'`);
      }
      
      if (options.endTime) {
        conditions.push(`time <= '${this.formatTime(options.endTime)}'`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    // Add tag filters
    if (options.tags) {
      const tagConditions = Object.entries(options.tags)
        .map(([key, value]) => `"${key}" = '${value}'`)
        .join(' AND ');
      
      if (tagConditions) {
        query += options.startTime || options.endTime ? ` AND ${tagConditions}` : ` WHERE ${tagConditions}`;
      }
    }
    
    // Add group by
    if (options.groupBy && options.groupBy.length > 0) {
      query += ` GROUP BY ${options.groupBy.join(', ')}`;
    }
    
    // Add group by time if specified
    if (options.aggregation?.groupByTime) {
      query += `, time(${options.aggregation.groupByTime})`;
    }
    
    // Add order by
    if (options.orderBy) {
      query += ` ORDER BY time ${options.orderBy}`;
    }
    
    // Add limit
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    return query;
  }

  private formatTime(time: string | Date | undefined): string {
    if (!time) return new Date().toISOString();
    if (typeof time === 'string') return time;
    return time.toISOString();
  }
}
