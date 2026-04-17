import { BaseEntity } from './BaseEntity';

class TaskEntity extends BaseEntity {
  constructor() {
    // Checklist (zakázka -> checklist_item) je nový zdroj úkolů pro výrobu
    super('checklist_item');
  }

  async filterByUser(userId, sortBy = 'completed_at') {
    return this.filter({ assigned_to: userId }, sortBy);
  }

  async filterByProject(orderId, sortBy = 'completed_at') {
    return this.filter({ order_id: orderId }, sortBy);
  }
}

export const Task = new TaskEntity();
