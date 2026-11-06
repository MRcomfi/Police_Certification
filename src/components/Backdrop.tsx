import { DepartmentEmblem } from './DepartmentEmblem';

/**
 * Фон: крупная полупрозрачная эмблема ПД и мягкое красно-синее свечение по углам.
 * Свечение медленно меняет яркость (без мигания); при «уменьшить движение» оно неподвижно.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__glow backdrop__glow--red" />
      <div className="backdrop__glow backdrop__glow--blue" />
      <DepartmentEmblem className="backdrop__emblem" />
    </div>
  );
}
