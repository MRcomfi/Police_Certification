import { DepartmentEmblem } from './DepartmentEmblem';

export function AppHeader() {
  return (
    <header className="header">
      <div className="container header__inner">
        <DepartmentEmblem className="header__emblem" />
        <div>
          <h1 className="header__title">Электронная аттестация ПД</h1>
          <p className="header__subtitle">Для сотрудников ранга «Рядовой»</p>
        </div>
      </div>
    </header>
  );
}
