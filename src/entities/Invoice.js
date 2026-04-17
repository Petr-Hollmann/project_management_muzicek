import { BaseEntity } from './BaseEntity';
// Dočasná kompatibilita: staré invoice se mapují na ordery (is_invoiced/export stavy)
export const Invoice = new BaseEntity('order');
