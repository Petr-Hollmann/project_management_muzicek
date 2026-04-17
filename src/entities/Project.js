// Project.js
// Přemapováno na nové domain entity (zakázky) pro zachování zpětné kompatibility staré navigace.
import { BaseEntity } from './BaseEntity';
export const Project = new BaseEntity('order');
