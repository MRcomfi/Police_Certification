import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { compositePoints, fieldCount, gradeAttempt, gradeQuestion, partialThreshold } from './grade';
import { extractNumbers } from './numbers';
import { stemRussian } from './stemmer';
import { tokenize } from './text';
import type { Question } from './types';

function question(id: number): Question {
  const found = QUESTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Нет вопроса ${id}`);
  return found;
}

/** Балл за одиночный вопрос. */
function single(id: number, answer: string): number {
  return gradeQuestion(question(id), [answer]).points;
}

/** Число засчитанных пунктов составного вопроса. */
function matched(id: number, fields: string[]): number | undefined {
  return gradeQuestion(question(id), fields).matched;
}

function composite(id: number, fields: string[]): number {
  return gradeQuestion(question(id), fields).points;
}

describe('структура вопросов', () => {
  it('15 вопросов с номерами 1–15', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('составные вопросы и число полей', () => {
    const counts = Object.fromEntries(
      QUESTIONS.filter((q) => q.kind === 'composite').map((q) => [q.id, fieldCount(q)]),
    );
    expect(counts).toEqual({ 2: 2, 6: 4, 8: 4, 9: 2, 13: 6, 15: 3 });
  });

  it('подсказки одиночных вопросов не раскрывают ответ', () => {
    for (const q of QUESTIONS) {
      if (q.kind !== 'single') continue;
      const hint = q.hint.toLowerCase();
      expect(hint).not.toMatch(/\d/);
      expect(hint).not.toContain(q.answer.toLowerCase());
    }
  });
});

describe('нормализация и разбор текста', () => {
  it('регистр, «ё», точки в сокращениях и дефисы', () => {
    expect(tokenize('Гос.-фракции, ЧЕТЫРЁХ  звёзд').map((t) => t.text)).toEqual([
      'гос', 'фракции', 'четырех', 'звезд',
    ]);
  });

  it('номера статей сохраняются целиком, запятая между цифрами = точка', () => {
    expect(tokenize('ст. 10.2.1 и 9,5 УК.').map((t) => t.text)).toEqual(['ст', '10.2.1', '9.5', 'ук']);
  });

  it('число отделяется от слитной единицы', () => {
    expect(tokenize('45мин').map((t) => t.text)).toEqual(['45', 'мин']);
  });

  it('формы слова приводятся к одной основе', () => {
    expect(stemRussian('судья')).toBe(stemRussian('судей'));
    expect(stemRussian('главы')).toBe(stemRussian('глав'));
    expect(stemRussian('замы')).toBe(stemRussian('зам'));
    expect(stemRussian('лидеров')).toBe(stemRussian('лидер'));
    expect(stemRussian('мэрии')).toBe(stemRussian('мэрия'));
  });

  it('числа словами', () => {
    const values = (text: string) => extractNumbers(tokenize(text)).map((n) => n.value);
    expect(values('сорок пять минут')).toEqual([45]);
    expect(values('семьдесят два часа')).toEqual([72]);
    expect(values('трое суток')).toEqual([3]);
    expect(values('на одну звезду')).toEqual([1]);
    expect(values('дважды')).toEqual([2]);
    expect(values('с третьего ранга')).toEqual([3]);
    expect(values('пятнадцать')).toEqual([15]);
    expect(values('по статье 10.2.1')).toEqual([]);
  });
});

describe('вопрос 1: длительность допроса (45 минут)', () => {
  it.each(['45', '45 мин', '45 мин.', '45 минут', 'сорок пять минут', 'Сорок пять', '45мин', 'Допрос длится 45 минут.'])(
    'засчитывается: %s',
    (answer) => expect(single(1, answer)).toBe(1),
  );

  it.each(['45 секунд', '45 часов', '45 или 60', '45-60 минут', '60 минут', 'не 45 минут', 'час', 'долго'])(
    'не засчитывается: %s',
    (answer) => expect(single(1, answer)).toBe(0),
  );

  it('пустой ответ — 0 баллов и статус «Нет ответа»', () => {
    expect(gradeQuestion(question(1), ['   '])).toEqual({ questionId: 1, points: 0, status: 'empty' });
  });
});

describe('вопрос 2: кто может продлить допрос', () => {
  it('оба пункта в своих полях', () => {
    expect(composite(2, ['Глава или заместитель фракции', 'Мэрия, ФБР, ЦПД'])).toBe(1);
  });

  it('порядок полей не важен, фракции в разных полях', () => {
    expect(composite(2, ['ЦПД', 'зам мэрии или ФБР'])).toBe(1);
  });

  it('всё в одном поле', () => {
    expect(composite(2, ['Лидер или заместитель мэрии, ФБР и ЦПД', ''])).toBe(1);
  });

  it('фракции засчитываются, только если названы все три', () => {
    expect(matched(2, ['глава', 'мэрия и ФБР'])).toBe(1);
    expect(composite(2, ['глава', 'мэрия и ФБР'])).toBe(0.5);
  });

  it('«Губернатор» засчитывается как глава', () => {
    expect(matched(2, ['Губернатор', ''])).toBe(1);
    expect(composite(2, ['Губернатор', 'Мэрия, ФБР, ЦПД'])).toBe(1);
  });

  it('неверный ответ — 0', () => {
    expect(composite(2, ['адвокат', 'судья'])).toBe(0);
  });
});

describe('вопрос 3: статья 10.2.1 (от 12 граммов)', () => {
  it.each(['12', 'от 12', '12 г', '12 гр', '12 грамм', '12 граммов', 'двенадцать', 'От 12 гр. по ст. 10.2.1'])(
    'засчитывается: %s',
    (answer) => expect(single(3, answer)).toBe(1),
  );

  it.each(['12 кг', '10', '12 или 15', 'от 5 грамм'])('не засчитывается: %s', (answer) =>
    expect(single(3, answer)).toBe(0),
  );
});

describe('вопрос 4: хранение записи с бодикамеры (3 дня)', () => {
  it.each(['3', '3 дня', 'три дня', 'трое суток', '72 часа', 'Три дня (72 часа)'])('засчитывается: %s', (answer) =>
    expect(single(4, answer)).toBe(1),
  );

  it.each(['3 часа', '72', '72 дня', '4 дня', '3 недели', '3 или 7 дней'])('не засчитывается: %s', (answer) =>
    expect(single(4, answer)).toBe(0),
  );
});

describe('вопрос 5: ранг для обыска (3-й, Лейтенант)', () => {
  it.each(['3', 'с 3 ранга', 'с 3-го ранга', 'с третьего ранга', 'лейтенант', 'С лейтенанта', 'С 3 ранга (Лейтенант)'])(
    'засчитывается: %s',
    (answer) => expect(single(5, answer)).toBe(1),
  );

  it.each(['4', 'с 2 ранга', 'сержант', 'старший лейтенант', 'лейтенант, 4 ранг', 'с 3 звёзд'])(
    'не засчитывается: %s',
    (answer) => expect(single(5, answer)).toBe(0),
  );
});

describe('вопрос 6: неприкосновенные личности', () => {
  it('все 4 пункта в разных полях и в любом порядке', () => {
    expect(composite(6, ['Судьи', 'заместители глав гос. фракций', 'Адвокаты', 'Лидеры госфракций'])).toBe(1);
  });

  it('синонимы: «главы гос. структур», «замы»', () => {
    expect(composite(6, ['адвокаты', 'судьи', 'главы гос. структур', 'замы'])).toBe(1);
  });

  it('«заместители глав госфракций» — только пункт «заместители»', () => {
    expect(matched(6, ['заместители глав госфракций', '', '', ''])).toBe(1);
    expect(matched(6, ['адвокаты', 'судьи', 'заместители глав госфракций', ''])).toBe(3);
  });

  it('«заместители лидеров госфракций» — только пункт «заместители»', () => {
    expect(matched(6, ['заместители лидеров госфракций'])).toBe(1);
  });

  it('«главы и заместители госфракций» — оба пункта', () => {
    expect(matched(6, ['главы и заместители госфракций'])).toBe(2);
    expect(matched(6, ['заместители и главы госфракций'])).toBe(2);
    expect(composite(6, ['адвокаты, судьи', 'главы и заместители госфракций'])).toBe(1);
  });

  it('повтор пункта засчитывается один раз', () => {
    expect(matched(6, ['адвокаты', 'Адвокат', 'адвокатов', 'судьи'])).toBe(2);
    expect(composite(6, ['адвокаты', 'Адвокат', 'адвокатов', 'судьи'])).toBe(0.5);
  });

  it('порог частичного зачёта: 2 из 4 — 0,5; 1 из 4 — 0', () => {
    expect(composite(6, ['адвокаты', 'судьи', '', ''])).toBe(0.5);
    expect(composite(6, ['адвокаты', '', '', ''])).toBe(0);
  });
});

describe('вопрос 7: бронежилет (да)', () => {
  it.each(['да', 'Да.', 'обязан', 'Обязаны', 'да, обязан', 'Так точно'])('засчитывается: %s', (answer) =>
    expect(single(7, answer)).toBe(1),
  );

  it.each(['нет', 'не обязан', 'не всегда', 'Да нет', 'необязательно', 'не знаю'])('не засчитывается: %s', (answer) =>
    expect(single(7, answer)).toBe(0),
  );
});

describe('вопрос 8: стадии применения силы', () => {
  it('основные формулировки', () => {
    expect(composite(8, ['Устные приказы', 'Физическая сила', 'Специальные средства', 'Огнестрельное оружие'])).toBe(1);
  });

  it('синонимы и сокращения', () => {
    expect(composite(8, ['огнестрел', 'спецсредства', 'физ. сила', 'устные команды'])).toBe(1);
    expect(composite(8, ['словесные приказы', 'физическое воздействие', 'спец. средства', 'оружие'])).toBe(1);
    expect(matched(8, ['устное требование', '', '', ''])).toBe(1);
  });

  it('несколько пунктов в одном поле', () => {
    expect(matched(8, ['устные приказы, физ сила', 'спецсредства', '', ''])).toBe(3);
  });
});

describe('вопрос 9: когда не проводится допрос', () => {
  it('оба пункта', () => {
    expect(composite(9, ['Преступник сам отказался от допроса', 'Розыск выдан диспетчером'])).toBe(1);
    expect(composite(9, ['диспетчер выдал розыск', 'отказ от допроса'])).toBe(1);
    expect(composite(9, ['розыск от диспетчера', 'отказался'])).toBe(1);
  });

  it('1 из 2 — 0,5', () => {
    expect(composite(9, ['отказался', ''])).toBe(0.5);
  });

  it('отрицание: «не отказался» не засчитывается', () => {
    expect(matched(9, ['преступник не отказался', ''])).toBe(0);
  });
});

describe('вопрос 10: статья 5.4 (от 2 ударов)', () => {
  it.each(['2', 'от 2', '2 удара', 'от двух ударов', 'с двух', 'От 2 ударов по ст. 5.4 УК'])('засчитывается: %s', (answer) =>
    expect(single(10, answer)).toBe(1),
  );

  it.each(['3', '1 удар', '2 или 3', 'от 2 звезд'])('не засчитывается: %s', (answer) =>
    expect(single(10, answer)).toBe(0),
  );
});

describe('вопрос 11: снижение розыска (на 1 звезду)', () => {
  it.each(['1', 'на 1', 'одну', 'на одну звезду', 'На 1 звезду'])('засчитывается: %s', (answer) =>
    expect(single(11, answer)).toBe(1),
  );

  it.each(['2', 'на 2 звезды', '1-2'])('не засчитывается: %s', (answer) => expect(single(11, answer)).toBe(0));
});

describe('вопрос 12: статья 4.2 (с 4 звёзд)', () => {
  it.each(['4', 'с 4', '4 звезды', 'с четырёх звёзд', 'С 4 звёзд статья 4.2 не применяется'])('засчитывается: %s', (answer) =>
    expect(single(12, answer)).toBe(1),
  );

  it.each(['3', 'с 5 звезд', '4 часа'])('не засчитывается: %s', (answer) => expect(single(12, answer)).toBe(0));
});

describe('вопрос 13: процессуальные действия', () => {
  const full = ['Арест', 'Задержание', 'Выдача штрафа', 'Обыск', 'Сбор улик', 'Использование специальных средств'];

  it('все 6 пунктов', () => {
    expect(composite(13, full)).toBe(1);
  });

  it('в обратном порядке и с синонимами', () => {
    expect(composite(13, ['спецсредства', 'собирание улик', 'обыск', 'штрафование', 'задержание', 'арест'])).toBe(1);
    expect(matched(13, ['сбор доказательств', '', '', '', '', ''])).toBe(1);
  });

  it('«арест» и «задержание» — разные пункты', () => {
    expect(matched(13, ['арест', 'арест', '', '', '', ''])).toBe(1);
    expect(matched(13, ['арест и задержание', '', '', '', '', ''])).toBe(2);
  });

  it('порог частичного зачёта: 3 из 6 — 0,5; 2 из 6 — 0', () => {
    expect(composite(13, ['арест', 'задержание', 'штраф', '', '', ''])).toBe(0.5);
    expect(composite(13, ['арест', 'задержание', '', '', '', ''])).toBe(0);
  });
});

describe('вопрос 14: Миранда (2 раза)', () => {
  it.each(['2', '2 раза', 'два', 'дважды', 'Два раза'])('засчитывается: %s', (answer) =>
    expect(single(14, answer)).toBe(1),
  );

  it.each(['1', '3 раза', '2 или 3', 'не 2'])('не засчитывается: %s', (answer) => expect(single(14, answer)).toBe(0));
});

describe('вопрос 15: применение огнестрельного оружия', () => {
  it('все пункты', () => {
    expect(composite(15, ['Во время рейда', 'Розыск по статьям 9.5 УК и 11.1 УК', 'Угроза жизни сотрудника'])).toBe(1);
  });

  it('статьи в разных полях, синонимы угрозы', () => {
    expect(composite(15, ['розыск по 9.5 УК, опасность для жизни', 'обыск', 'ст. 11.1'])).toBe(1);
    expect(matched(15, ['если угрожает жизни граждан', '', ''])).toBe(1);
  });

  it('названа только одна статья — пункт не засчитывается', () => {
    expect(matched(15, ['рейд', 'розыск по 9.5', 'угроза жизни'])).toBe(2);
    expect(composite(15, ['рейд', 'розыск по 9.5', 'угроза жизни'])).toBe(0.5);
  });

  it('1 из 3 — 0 баллов', () => {
    expect(composite(15, ['рейд', '', ''])).toBe(0);
  });
});

describe('пороги и подсчёт попытки', () => {
  it('частичный зачёт — половина пунктов с округлением вверх', () => {
    expect(partialThreshold(2)).toBe(1);
    expect(partialThreshold(3)).toBe(2);
    expect(partialThreshold(4)).toBe(2);
    expect(partialThreshold(6)).toBe(3);
    expect([compositePoints(1, 2), compositePoints(2, 2)]).toEqual([0.5, 1]);
    expect([compositePoints(1, 3), compositePoints(2, 3), compositePoints(3, 3)]).toEqual([0, 0.5, 1]);
    expect([compositePoints(1, 4), compositePoints(2, 4), compositePoints(3, 4)]).toEqual([0, 0.5, 0.5]);
    expect([compositePoints(2, 6), compositePoints(3, 6), compositePoints(5, 6)]).toEqual([0, 0.5, 0.5]);
    expect(compositePoints(0, 2)).toBe(0);
  });

  /** Ответы: 9 одиночных верно, вопросы 2, 6, 8, 13 — частично, 9 и 15 — пусто. */
  function nineFullFourPartial(): string[][] {
    return [
      ['45 минут'],
      ['глава', ''],
      ['12 грамм'],
      ['3 дня'],
      ['лейтенант'],
      ['адвокаты', 'судьи', '', ''],
      ['да'],
      ['устные приказы', 'физическая сила', '', ''],
      ['', ''],
      ['2 удара'],
      ['1 звезду'],
      ['4 звезды'],
      ['арест', 'задержание', 'штраф', '', '', ''],
      ['2 раза'],
      ['', '', ''],
    ];
  }

  it('9 полных + 4 частичных = 11 баллов, но аттестация не сдана', () => {
    const grade = gradeAttempt(QUESTIONS, nineFullFourPartial());
    expect(grade.score).toBe(11);
    expect(grade.fullCount).toBe(9);
    expect(grade.passed).toBe(false);
    expect(grade.results.filter((r) => r.status === 'partial')).toHaveLength(4);
    expect(grade.results.filter((r) => r.status === 'empty').map((r) => r.questionId)).toEqual([9, 15]);
  });

  it('10 полных — аттестация сдана', () => {
    const answers = nineFullFourPartial();
    answers[8] = ['отказался от допроса', 'розыск выдан диспетчером'];
    const grade = gradeAttempt(QUESTIONS, answers);
    expect(grade.fullCount).toBe(10);
    expect(grade.score).toBe(12);
    expect(grade.passed).toBe(true);
  });

  it('повторная оценка тех же ответов даёт тот же результат', () => {
    const answers = nineFullFourPartial();
    expect(gradeAttempt(QUESTIONS, answers)).toEqual(gradeAttempt(QUESTIONS, answers));
  });

  it('пустая попытка — 0 из 15', () => {
    const empty = QUESTIONS.map((q) => Array.from({ length: fieldCount(q) }, () => ''));
    const grade = gradeAttempt(QUESTIONS, empty);
    expect(grade.score).toBe(0);
    expect(grade.fullCount).toBe(0);
    expect(grade.results.every((r) => r.status === 'empty')).toBe(true);
  });
});
