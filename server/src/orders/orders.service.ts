import { Injectable } from '@nestjs/common';

export type GarmentStatus = 'received' | 'in_cleaning' | 'ready' | 'delivered';

export interface Garment {
  id: string;
  description: string;
  status: GarmentStatus;
}

export interface Order {
  id: string;
  customerName: string;
  createdAt: string; // ISO string
  garments: Garment[];
}

// In-memory mock data to simulate a POS-like workflow
const ORDERS: Order[] = [
  {
    id: 'ORD-1001',
    customerName: 'Alice Johnson',
    createdAt: new Date().toISOString(),
    garments: [
      { id: 'G-1', description: 'Blue Shirt', status: 'received' },
      { id: 'G-2', description: 'Black Trousers', status: 'in_cleaning' },
    ],
  },
  {
    id: 'ORD-1002',
    customerName: 'Bob Singh',
    createdAt: new Date().toISOString(),
    garments: [
      { id: 'G-3', description: 'Wedding Gown', status: 'ready' },
    ],
  },
];

@Injectable()
export class OrdersService {
  findAll(): Order[] {
    return ORDERS;
  }

  findOne(id: string): Order | undefined {
    return ORDERS.find((o) => o.id === id);
  }

  // NOTE: You will add more methods here in the implementation tasks.
  getGarmentStatusSummary(): { [status: string]: number } {
    const summary: { [status: string]: number } = {};

    for (const order of this.findAll()) {
      for (const garment of order.garments) {
        summary[garment.status] = (summary[garment.status] || 0) + 1;
      }
    }

    return summary;
  }
}
