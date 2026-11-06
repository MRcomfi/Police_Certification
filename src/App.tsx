import { useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { QuizScreen } from './components/QuizScreen';
import { ResultScreen, type FinishedAttempt } from './components/ResultScreen';
import { Backdrop } from './components/Backdrop';
import { StartScreen } from './components/StartScreen';
import { QUESTIONS } from './data/questions';
import { gradeAttempt } from './grading/grade';
import {
  alignDraft,
  clearAllData,
  clearDraft,
  clearLastAttempt,
  isLockActive,
  loadDraft,
  loadLastAttempt,
  loadNickname,
  loadPassed,
  RETAKE_LOCK_MS,
  saveDraft,
  saveLastAttempt,
  saveNickname,
  savePassed,
  type AttemptSummary,
  type DraftAttempt,
  type LastAttemptRecord,
} from './storage/storage';
import { createEmptyAnswers, withAnswer } from './utils/answers';
import { normalizeNickname, validateNickname } from './utils/nickname';

type Screen = { name: 'start' } | { name: 'quiz' } | { name: 'result'; attempt: FinishedAttempt };

interface InitialState {
  nickname: string;
  passed: AttemptSummary | null;
  lastAttempt: LastAttemptRecord | null;
  draft: DraftAttempt | null;
}

function loadInitialState(): InitialState {
  const now = Date.now();
  const passed = loadPassed();
  const lastAttempt = loadLastAttempt(now);
  let draft = loadDraft(QUESTIONS);
  // Незавершённая попытка не продолжается, если аттестация уже сдана или действует блокировка.
  if (draft !== null && (passed !== null || isLockActive(lastAttempt, now))) {
    clearDraft();
    draft = null;
  }
  return { nickname: draft?.nickname ?? loadNickname(), passed, lastAttempt, draft };
}

const OTHER_TAB_NOTICE =
  'Попытка не засчитана: в другой вкладке аттестация уже была завершена. Ниже показан сохранённый результат.';

export default function App() {
  const [initial] = useState(loadInitialState);
  const [nickname, setNickname] = useState(initial.nickname);
  const [passed, setPassed] = useState(initial.passed);
  const [lastAttempt, setLastAttempt] = useState(initial.lastAttempt);
  const [draft, setDraft] = useState(initial.draft);
  const [screen, setScreen] = useState<Screen>(initial.draft !== null ? { name: 'quiz' } : { name: 'start' });
  const [notice, setNotice] = useState<string | null>(null);

  // Защита от двойного завершения: попытка оценивается и сохраняется только один раз.
  const finishedRef = useRef(false);

  // Ответы текущей попытки дублируются в sessionStorage на случай обновления вкладки.
  useEffect(() => {
    if (draft !== null) saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen.name]);

  /** Перечитывает сохранённые данные (могли измениться в другой вкладке). */
  const refreshSaved = (now: number) => {
    const savedPassed = loadPassed();
    const savedLast = loadLastAttempt(now);
    setPassed(savedPassed);
    setLastAttempt(savedLast);
    return { savedPassed, savedLast };
  };

  const handleStart = () => {
    const nick = normalizeNickname(nickname);
    if (validateNickname(nick) !== null) return;

    const now = Date.now();
    const { savedPassed, savedLast } = refreshSaved(now);
    if (savedPassed !== null || isLockActive(savedLast, now)) return;

    saveNickname(nick);
    finishedRef.current = false;
    setNotice(null);
    setNickname(nick);
    setDraft({
      nickname: nick,
      questionIds: QUESTIONS.map((question) => question.id),
      answers: createEmptyAnswers(QUESTIONS),
      currentIndex: 0,
    });
    setScreen({ name: 'quiz' });
  };

  // Ответы привязаны к id вопросов: если список вопросов изменился во время попытки
  // (например, после обновления сайта), ответы не сдвигаются на соседние вопросы.
  const activeDraft = draft === null ? null : alignDraft(draft, QUESTIONS);

  const handleAnswerChange = (questionIndex: number, fieldIndex: number, value: string) => {
    setDraft((current) => {
      if (current === null) return null;
      const aligned = alignDraft(current, QUESTIONS);
      return { ...aligned, answers: withAnswer(aligned.answers, questionIndex, fieldIndex, value) };
    });
  };

  const handleNavigate = (index: number) => {
    if (index < 0 || index >= QUESTIONS.length) return;
    setDraft((current) => (current === null ? null : { ...alignDraft(current, QUESTIONS), currentIndex: index }));
  };

  const handleFinish = () => {
    if (finishedRef.current || activeDraft === null) return;
    finishedRef.current = true;

    const now = Date.now();
    const draft = activeDraft;
    const answers = draft.answers;
    // Тексты ответов удаляются из sessionStorage сразу после завершения.
    clearDraft();
    setDraft(null);

    const { savedPassed, savedLast } = refreshSaved(now);
    if (savedPassed !== null || isLockActive(savedLast, now)) {
      setNotice(OTHER_TAB_NOTICE);
      setScreen({ name: 'start' });
      return;
    }

    const grade = gradeAttempt(QUESTIONS, answers);
    const summary: AttemptSummary = { nickname: draft.nickname, finishedAt: now, ...grade };

    let lockedUntil: number | null = null;
    if (grade.passed) {
      savePassed(summary);
      clearLastAttempt();
      setPassed(summary);
      setLastAttempt(null);
    } else {
      // Таймер пересдачи запускается только в момент завершения неуспешной попытки.
      // Ответы сотрудника сохраняются, чтобы их можно было посмотреть на главной.
      lockedUntil = now + RETAKE_LOCK_MS;
      const record: LastAttemptRecord = { summary, lockedUntil, answers };
      saveLastAttempt(record);
      setLastAttempt(record);
    }

    setScreen({ name: 'result', attempt: { summary, answers, lockedUntil } });
  };

  const handleReset = () => {
    const now = Date.now();
    const { savedLast } = refreshSaved(now);
    // Во время блокировки сброс недоступен, иначе он позволял бы обойти таймер.
    if (isLockActive(savedLast, now)) return;

    clearAllData();
    setPassed(null);
    setLastAttempt(null);
    setDraft(null);
    setNickname('');
    setNotice(null);
  };

  return (
    <div className="app">
      <Backdrop />
      <AppHeader />
      <main className="container main">
        {screen.name === 'quiz' && activeDraft !== null ? (
          <QuizScreen
            questions={QUESTIONS}
            answers={activeDraft.answers}
            currentIndex={activeDraft.currentIndex}
            nickname={activeDraft.nickname}
            onAnswerChange={handleAnswerChange}
            onNavigate={handleNavigate}
            onFinish={handleFinish}
          />
        ) : screen.name === 'result' ? (
          <ResultScreen questions={QUESTIONS} attempt={screen.attempt} onHome={() => setScreen({ name: 'start' })} />
        ) : (
          <StartScreen
            questions={QUESTIONS}
            nickname={nickname}
            passed={passed}
            lastAttempt={lastAttempt}
            notice={notice}
            onNicknameChange={setNickname}
            onStart={handleStart}
            onReset={handleReset}
          />
        )}
      </main>
      <footer className="footer">
        <div className="container">
          Данные аттестации хранятся только в этом браузере и никуда не отправляются.
        </div>
      </footer>
    </div>
  );
}
