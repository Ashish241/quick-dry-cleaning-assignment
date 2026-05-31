import React, { useEffect, useState } from 'react';
import { OrdersList } from './OrdersList';

export interface Garment {
  id: string;
  description: string;
  status: 'received' | 'in_cleaning' | 'ready' | 'delivered';
}

export interface Order {
  id: string;
  customerName: string;
  createdAt: string;
  garments: Garment[];
}

type StatusFilter = 'all' | 'received' | 'in_cleaning' | 'ready' | 'delivered';

export const App: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:3001/api/orders');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as Order[];
        setOrders(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>QDC Mini Dashboard</h1>
      <p>Simple view of active orders and garments.</p>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="status-filter" style={{ marginRight: '0.5rem' }}>
          Filter by status:
        </label>
        <select
          id="status-filter"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
        >
          <option value="all">All</option>
          <option value="received">Received</option>
          <option value="in_cleaning">In Cleaning</option>
          <option value="ready">Ready for Pickup</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>
      
      {loading && <p>Loading orders...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && (<OrdersList orders={orders} selectedStatus={selectedStatus} />)}
    </div>
  );
};
