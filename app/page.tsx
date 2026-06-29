'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { getStatusClass, getStatusEmoji, formatTimestamp, getUptimeClass, getChartStatusClass } from '@/lib/utils';
import type { DashboardData } from '@/lib/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const defaultServiceColors = { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)' };
const serviceColors: Record<string, { border: string; background: string }> = {
  Weather: { border: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)' },
  Crypto: { border: '#f59e0b', background: 'rgba(245, 158, 11, 0.2)' },
  Jokes: { border: '#10b981', background: 'rgba(16, 185, 129, 0.2)' }
};

export default function Home() {
  const [data, setData] = useState<DashboardData & { calendar?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddAPI, setShowAddAPI] = useState(false);
  const [newApiName, setNewApiName] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newApiName, url: newApiUrl })
      });
      if (!res.ok) throw new Error('Failed to add API');
      
      setNewApiName('');
      setNewApiUrl('');
      setShowAddAPI(false);
      await fetchData();
      alert('API Added! The cron job will start fetching data for it shortly.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div>
          <div className="spinner"></div>
          <p className="loading-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-box">
          <p className="error-title">⚠️ {error}</p>
          <p className="error-sub">Please refresh the page</p>
        </div>
      </div>
    );
  }

  if (!data || !data.latest) {
    return (
      <div className="error-container">
        <div className="error-box">
          <p className="error-sub">No data available</p>
        </div>
      </div>
    );
  }

  const chartData = (serviceName: string) => {
    const history = data.history[serviceName.toUpperCase()] || [];
    const colors = serviceColors[serviceName] || defaultServiceColors;
    return {
      labels: history.map((item: any) => new Date(item.time).toLocaleTimeString()),
      datasets: [
        {
          label: 'Response Time (ms)',
          data: history.map((item: any) => item.value),
          borderColor: colors.border,
          backgroundColor: colors.background,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Response: ${context.parsed.y}ms`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Response Time (ms)', color: '#6b7280' },
        grid: { color: 'rgba(0, 0, 0, 0.05)' }
      },
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 10 }
      }
    },
    interaction: { intersect: false, mode: 'index' as const }
  };

  const renderCalendar = (serviceName: string) => {
    const calendarData = data.calendar?.[serviceName.toUpperCase()] || [];
    // Generate last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = calendarData.find((c: any) => c.date === dateStr);
      let colorClass = 'cal-none';
      let title = `${dateStr}: No Data`;
      
      if (entry) {
        if (entry.uptime >= 99) colorClass = 'cal-high';
        else if (entry.uptime >= 90) colorClass = 'cal-med';
        else colorClass = 'cal-low';
        title = `${dateStr}: ${entry.uptime}% uptime`;
      }

      days.push(
        <div key={dateStr} className={`cal-day ${colorClass}`} title={title}></div>
      );
    }

    return (
      <div className="calendar-container">
        <div className="calendar-grid">
          {days}
        </div>
        <div className="calendar-legend">
          <span>30 Day History</span>
          <div className="legend-items">
            <span className="cal-day cal-none"></span> None
            <span className="cal-day cal-low"></span> &lt;90%
            <span className="cal-day cal-med"></span> 90-99%
            <span className="cal-day cal-high"></span> 100%
          </div>
        </div>
      </div>
    );
  };

  const services = Object.keys(data.latest);

  return (
    <div className="container">
      {/* Header */}
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="header-title">
            <h1>🛡️ API Watchdog</h1>
            <p>Real-time API monitoring with AI-powered anomaly detection</p>
          </div>
          <div className="header-status">
            <div className="status-indicator">
              <span className={`status-dot ${data.allHealthy ? 'healthy' : 'down'}`}></span>
              <span>{data.allHealthy ? 'All Systems Operational' : 'Issues Detected'}</span>
            </div>
            <span className="timestamp">Updated: {formatTimestamp(data.lastUpdated)}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowAddAPI(!showAddAPI)}>
          {showAddAPI ? 'Cancel' : '+ Add API'}
        </button>
      </header>

      {/* Add API Form */}
      {showAddAPI && (
        <div className="card add-api-card" style={{ marginBottom: '2rem' }}>
          <h3>Monitor a New API</h3>
          <form onSubmit={handleAddApi} style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              placeholder="Service Name (e.g., GitHub)" 
              value={newApiName} 
              onChange={e => setNewApiName(e.target.value)} 
              required 
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
            />
            <input 
              type="url" 
              placeholder="API URL (e.g., https://api.github.com/zen)" 
              value={newApiUrl} 
              onChange={e => setNewApiUrl(e.target.value)} 
              required 
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', flex: 2 }}
            />
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? 'Adding...' : 'Save API'}
            </button>
          </form>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid-3">
        {services.map((name) => {
          const status = data.latest[name];
          return (
            <div key={name} className="card">
              <div className="card-header">
                <h2 className="card-title">{name}</h2>
                <div className="card-badge">
                  <span className={`badge-dot ${getStatusClass(status?.statusQuality || 'NO DATA')}`}></span>
                  <span>{status?.statusQuality || 'NO DATA'}</span>
                </div>
              </div>
              {status && status.statusQuality !== 'NO DATA' ? (
                <>
                  <div className="card-value">
                    {status.responseTime}
                    <small>ms</small>
                  </div>
                  <div className="card-footer">
                    <span className="time">{formatTimestamp(status.timestamp)}</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {status.aiDiagnosis && (
                        <span className="ai-badge" title={status.aiDiagnosis}>🤖 AI Diagnosed</span>
                      )}
                      {status.trendPrediction && status.trendPrediction !== 'STABLE' && (
                        <span className={`trend-badge ${status.trendPrediction.includes('FAIL') ? 'danger' : 'warning'}`}>
                          📊 {status.trendPrediction}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: '1rem 0' }}>Waiting for data...</p>
              )}
              {/* Calendar Grid inside Card */}
              {renderCalendar(name)}
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {services.map((service) => (
        <div key={service} className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">{service} - 24 Hour History</h3>
            <span className={`chart-status ${getChartStatusClass(data.latest[service]?.statusQuality || 'NO DATA')}`}>
              {getStatusEmoji(data.latest[service]?.statusQuality || 'NO DATA')} {data.latest[service]?.statusQuality || 'NO DATA'}
            </span>
          </div>
          <div className="chart-wrapper">
            <Line data={chartData(service)} options={chartOptions} />
          </div>
        </div>
      ))}

      {/* Footer */}
      <footer className="footer">
        <p>Powered by Next.js, PostgreSQL, Redis, and Groq AI</p>
        <p>Data updates every 10 minutes • AI analysis on failure</p>
      </footer>
    </div>
  );
}