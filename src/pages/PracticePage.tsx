import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { Header } from '../components/Layout';
import { FlashMatch } from '../components/GameModes';
import { SessionWordList } from '../components/SessionWordList';
import { MatchDragDrop } from '../components/MatchDragDrop';
import { buildSessionPlan, buildQuestion, buildWordListPlan, getSessionWords, type SessionPlan } from '../lib/session';
import { getWordById } from '../lib/words';
import { updateWordProgress, recordSession, toggleMyList, markWordKnown, getDailySessionBreakdown, getActiveVocabulary, getVocabState } from '../lib/progress';
import type { SessionType, Word, VocabularyId } from '../types';
import { LearnWordsScreen } from '../components/LearnWordsScreen';
import { getNextLessonDayIndex, getWeekPlan } from '../lib/weekPlan';

type Phase = 'intro' | 'learn' | 'playing' | 'review' | 'matching' | 'done' | 'recheck' | 'recheck-done';

interface SessionSummary {
  knownWords: Word[];
  missedWords: Word[];
}

function buildSessionSummary(
  practicedIds: number[],
  missedIds: number[],
  vocabularyId: VocabularyId
): SessionSummary {
  const uniquePracticed = [...new Set(practicedIds)];
  const missedSet = new Set(missedIds);
  const knownWords = uniquePracticed
    .filter((id) => !missedSet.has(id))
    .map((id) => getWordById(id, vocabularyId))
    .filter(Boolean) as Word[];
  const missedWords = missedIds
    .map((id) => getWordById(id, vocabularyId))
    .filter(Boolean) as Word[];

  knownWords.sort((a, b) => a.entry.localeCompare(b.entry));
  missedWords.sort((a, b) => a.entry.localeCompare(b.entry));

  return { knownWords, missedWords };
}

interface CustomPracticeState {
  wordIds?: number[];
  returnTo?: string;
  vocabularyId?: VocabularyId;
}

export function PracticePage() {
  const { type } = useParams<{ type: string }>();
  const isCustom = type === 'custom';
  const sessionType: SessionType =
    type === 'mylist' || type === 'review' || type === 'exam' ? type : 'daily';
  const { t } = useTranslation();
  const { userData, updateData } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const customState = (location.state as CustomPracticeState | null) ?? {};
  const returnTo = customState.returnTo ?? '/';

  const [phase, setPhase] = useState<Phase>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [practicedIds, setPracticedIds] = useState<number[]>([]);
  const [missedIds, setMissedIds] = useState<number[]>([]);
  const [reviewWords, setReviewWords] = useState<Word[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [recheckWords, setRecheckWords] = useState<Word[]>([]);
  const [recheckIndex, setRecheckIndex] = useState(0);
  const [recheckCorrect, setRecheckCorrect] = useState(0);
  const [recheckWrong, setRecheckWrong] = useState(0);
  const [recheckMissedIds, setRecheckMissedIds] = useState<number[]>([]);
  const [matchingWords, setMatchingWords] = useState<Word[]>([]);
  const [liveData, setLiveData] = useState(userData);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);

  const customPreviewPlan = useMemo(() => {
    if (!isCustom || !customState.wordIds?.length) return null;
    const vocabularyId = customState.vocabularyId ?? userData?.profile.activeVocabulary ?? 'elementary';
    return buildWordListPlan(customState.wordIds, vocabularyId);
  }, [isCustom, customState.wordIds, customState.vocabularyId, userData?.profile.activeVocabulary]);

  const previewPlan = useMemo(() => {
    if (isCustom) return customPreviewPlan;
    if (!userData) return null;
    return buildSessionPlan(sessionType, userData);
  }, [isCustom, customPreviewPlan, userData, sessionType]);

  const plan = sessionPlan ?? previewPlan;
  const hasLearnStep =
    !isCustom && (sessionType === 'daily' || sessionType === 'review' || sessionType === 'exam');

  const learnWords = useMemo(() => {
    if (!plan || !hasLearnStep) return [];
    return getSessionWords(plan);
  }, [plan, hasLearnStep]);

  const isReview = phase === 'review';
  const currentRound = isReview
    ? { mode: 'flash' as const, label: 'flashMatch', words: reviewWords }
    : plan?.rounds[roundIndex];
  const currentWord = currentRound?.words[wordIndex];

  const question = useMemo(() => {
    if (!currentWord || !currentRound || !plan) return null;
    return buildQuestion(currentWord, currentRound.mode, plan.vocabularyId);
  }, [currentWord?.id, currentRound?.mode, wordIndex, roundIndex, phase, plan?.vocabularyId]);

  useEffect(() => {
    if (userData && phase === 'intro') setLiveData(userData);
  }, [userData, phase]);

  useEffect(() => {
    if (!isCustom || !userData || !customPreviewPlan?.rounds.length || phase !== 'intro') return;
    setSessionPlan(customPreviewPlan);
    setLiveData(userData);
    setPhase('playing');
  }, [isCustom, userData, customPreviewPlan, phase]);

  const recordType: SessionType = isCustom ? 'mylist' : sessionType;

  const finishSession = useCallback(async () => {
    if (!liveData || !plan) return;
    if (isCustom) {
      await updateData(liveData);
      setSessionSummary(buildSessionSummary(practicedIds, missedIds, plan.vocabularyId));
      setPhase('done');
      return;
    }
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const score = correct * 10;
    const data = recordSession(
      liveData,
      recordType,
      durationSec,
      practicedIds.length,
      score,
      practicedIds,
      missedIds,
      plan.vocabularyId,
      sessionType === 'daily' ? plan.lessonDayIndex : undefined
    );
    await updateData(data);
    setLiveData(data);
    setSessionSummary(buildSessionSummary(practicedIds, missedIds, plan.vocabularyId));
    setPhase('done');
  }, [liveData, plan, isCustom, recordType, sessionType, startedAt, correct, practicedIds, missedIds, updateData]);

  function startNextLesson() {
    if (!liveData) return;
    const nextPlan = buildSessionPlan('daily', liveData);
    if (!nextPlan.rounds.length) return;

    setSessionPlan(nextPlan);
    setRoundIndex(0);
    setWordIndex(0);
    setCorrect(0);
    setWrong(0);
    setPracticedIds([]);
    setMissedIds([]);
    setReviewWords([]);
    setSessionSummary(null);
    setMatchingWords([]);
    setStartedAt(Date.now());

    if (getSessionWords(nextPlan).length > 0) {
      setPhase('learn');
    } else {
      setPhase('playing');
    }
  }

  function startRecheck(words?: Word[]) {
    const toRecheck = words ?? sessionSummary?.missedWords ?? [];
    if (toRecheck.length === 0) return;
    setRecheckWords(toRecheck);
    setRecheckIndex(0);
    setRecheckCorrect(0);
    setRecheckWrong(0);
    setRecheckMissedIds([]);
    setPhase('recheck');
  }

  const handleRecheckAnswer = useCallback(
    (isCorrect: boolean) => {
      const word = recheckWords[recheckIndex];
      if (!word || !liveData) return;

      const data = updateWordProgress(liveData, word.id, isCorrect, plan?.vocabularyId);
      setLiveData(data);

      if (isCorrect) setRecheckCorrect((c) => c + 1);
      else {
        setRecheckWrong((w) => w + 1);
        setRecheckMissedIds((ids) => (ids.includes(word.id) ? ids : [...ids, word.id]));
      }

      if (recheckIndex + 1 < recheckWords.length) {
        setRecheckIndex((i) => i + 1);
        return;
      }

      setPhase('recheck-done');
    },
    [recheckWords, recheckIndex, liveData]
  );

  const goToMatchingOrDone = useCallback(
    (ids: number[]) => {
      if (!plan) return;
      const uniqueIds = [...new Set(ids)];
      const words = uniqueIds
        .map((id) => getWordById(id, plan.vocabularyId))
        .filter(Boolean) as Word[];

      if (words.length >= 2) {
        setMatchingWords(words);
        setPhase('matching');
        return;
      }

      finishSession();
    },
    [plan, finishSession]
  );

  const advance = useCallback(
    (lastPracticedId?: number) => {
      if (!plan) return;

      const round = isReview ? { words: reviewWords } : plan.rounds[roundIndex];

      if (!round) return;

      if (wordIndex + 1 < round.words.length) {
        setWordIndex((i) => i + 1);
        return;
      }

      const sessionIds =
        lastPracticedId && !practicedIds.includes(lastPracticedId)
          ? [...practicedIds, lastPracticedId]
          : practicedIds;

      if (isReview) {
        goToMatchingOrDone(sessionIds);
        return;
      }

      if (roundIndex + 1 < plan.rounds.length) {
        setRoundIndex((r) => r + 1);
        setWordIndex(0);
        return;
      }

      if (!isCustom && missedIds.length > 0) {
        const allWords = plan.rounds.flatMap((r) => r.words);
        const missed = missedIds
          .map((id) => allWords.find((w) => w.id === id))
          .filter(Boolean) as Word[];
        setReviewWords(missed.slice(0, 5));
        setPhase('review');
        setWordIndex(0);
        return;
      }

      goToMatchingOrDone(sessionIds);
    },
    [
      plan,
      isReview,
      isCustom,
      reviewWords,
      roundIndex,
      wordIndex,
      missedIds,
      practicedIds,
      goToMatchingOrDone,
    ]
  );

  const handleAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentWord || !liveData) return;

      const data = updateWordProgress(liveData, currentWord.id, isCorrect, plan?.vocabularyId);
      setLiveData(data);

      if (isCorrect) setCorrect((c) => c + 1);
      else {
        setWrong((w) => w + 1);
        setMissedIds((m) => (m.includes(currentWord.id) ? m : [...m, currentWord.id]));
      }
      setPracticedIds((ids) => [...ids, currentWord.id]);
      advance(currentWord.id);
    },
    [currentWord, liveData, advance, plan?.vocabularyId]
  );

  function handleToggleList() {
    if (!currentWord || !liveData) return;
    setLiveData(toggleMyList(liveData, currentWord.id, plan?.vocabularyId));
  }

  function handleMarkKnown() {
    if (!currentWord || !liveData) return;
    setLiveData(markWordKnown(liveData, currentWord.id, plan?.vocabularyId));
    setPracticedIds((ids) => [...ids, currentWord.id]);
    advance(currentWord.id);
  }

  if (!userData || !liveData) return null;

  if (!plan || plan.rounds.length === 0) {
    return (
      <div className="app-shell">
        <Header title={t('practice')} backTo={returnTo} />
        <main className="page page-no-nav">
          <div className="empty-state">
            <p>{isCustom ? t('sessionWordsUnavailable') : sessionType === 'mylist' ? t('myListEmpty') : sessionType === 'exam' ? t('weekExamEmpty') : sessionType === 'review' ? t('weekReviewEmpty') : t('noWordsDue')}</p>
            <button className="btn btn-primary mt-12" onClick={() => navigate(returnTo)}>
              {t('done')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'intro') {
    const dailyBreakdown =
      sessionType === 'daily' && userData
        ? getDailySessionBreakdown(userData, plan.vocabularyId)
        : null;

    const introTitle =
      sessionType === 'exam'
        ? t('weekExam')
        : sessionType === 'review'
          ? t('weekReview')
          : sessionType === 'mylist'
            ? t('myListOnly')
            : t('dailyPractice');

    return (
      <div className="app-shell">
        <Header title={introTitle} backTo="/" />
        <main className="page page-no-nav">
          <div className="session-intro">
            {sessionType === 'daily' && dailyBreakdown && (
              <div className="card daily-breakdown-card">
                <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>{t('weekPlanTitle')}</h3>
                <div className="daily-breakdown">
                  <div className="daily-breakdown-row">
                    <span className="daily-breakdown-label">{t('weekDayLabel', { day: dailyBreakdown.weekDay, total: 5 })}</span>
                    <strong>{dailyBreakdown.weekDay}/5</strong>
                  </div>
                  <div className="daily-breakdown-row">
                    <span className="daily-breakdown-label">🆕 {t('newWordsToday')}</span>
                    <strong>{dailyBreakdown.newCount}</strong>
                  </div>
                  <div className="daily-breakdown-row">
                    <span className="daily-breakdown-label">📚 {t('weekTotalWords')}</span>
                    <strong>{dailyBreakdown.weekTotal}</strong>
                  </div>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 12 }}>
                  {t('todaySessionTotal', { count: dailyBreakdown.totalCount })}
                </p>
              </div>
            )}
            {sessionType === 'review' && plan && (
              <div className="card">
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {t('weekReviewIntro', { count: getSessionWords(plan).length })}
                </p>
              </div>
            )}
            {sessionType === 'exam' && plan && (
              <div className="card">
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {t('weekExamIntro', { count: getSessionWords(plan).length })}
                </p>
              </div>
            )}
            {plan && plan.rounds.length > 0 && (
              <>
                <h2>{t('round', { current: 1, total: plan.rounds.length })}</h2>
                <p>{t(plan.rounds[0].label as 'flashMatch')}</p>
              </>
            )}
            <button
              className="btn btn-primary"
              onClick={() => {
                if (userData) {
                  const nextPlan = buildSessionPlan(sessionType, userData);
                  setSessionPlan(nextPlan);
                  setLiveData(userData);
                  if (hasLearnStep && getSessionWords(nextPlan).length > 0) {
                    setPhase('learn');
                  } else {
                    setStartedAt(Date.now());
                    setPhase('playing');
                  }
                }
              }}
            >
              {t('letsGo')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'learn' && plan && learnWords.length > 0) {
    const learnTitle =
      sessionType === 'exam'
        ? t('weekExamLearn')
        : sessionType === 'review'
          ? t('weekReviewLearn')
          : t('learnWordsTitle');

    return (
      <div className="app-shell">
        <Header title={learnTitle} backTo="/" />
        <main className="page page-no-nav">
          <LearnWordsScreen
            words={learnWords}
            onNext={() => {
              setStartedAt(Date.now());
              setPhase('playing');
            }}
          />
        </main>
      </div>
    );
  }

  if (phase === 'matching' && matchingWords.length > 0) {
    return (
      <div className="app-shell">
        <Header title={t('matchDragTitle')} backTo={returnTo} />
        <main className="page page-no-nav session-summary-page">
          <MatchDragDrop words={matchingWords} onComplete={finishSession} />
        </main>
      </div>
    );
  }

  if (phase === 'done' && sessionSummary) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const min = Math.max(1, Math.round(durationSec / 60));
    const stars =
      practicedIds.length === 0
        ? '⭐'
        : correct >= practicedIds.length * 0.8
          ? '⭐⭐⭐'
          : correct >= practicedIds.length * 0.5
            ? '⭐⭐'
            : '⭐';

    const nextLessonDay =
      sessionType === 'daily' && liveData && plan
        ? getNextLessonDayIndex(getWeekPlan(liveData, plan.vocabularyId))
        : null;
    const nextLessonCount =
      nextLessonDay !== null && liveData && plan
        ? buildSessionPlan('daily', liveData).rounds[0]?.words.length ?? 0
        : 0;

    return (
      <div className="app-shell">
        <Header title={isCustom ? t('recheckMissed') : t('greatSession')} backTo={returnTo} />
        <main className="page page-no-nav session-summary-page">
          <div className="card">
            <div className="results-stars">{stars}</div>
            <h2 className="results-title">{isCustom ? t('recheckComplete') : t('greatSession')}</h2>
            <div className="stat-row">
              <span>{t('wordsPracticed', { count: practicedIds.length })}</span>
            </div>
            <div className="stat-row">
              <span>{t('scoreLine', { correct, wrong })}</span>
            </div>
            {!isCustom && (
              <>
                <div className="stat-row">
                  <span>{t('durationScore', { min, score: correct * 10 })}</span>
                </div>
                <div className="stat-row">
                  <span>🔥 {t('streak', { count: liveData.streak.currentStreak })}</span>
                </div>
              </>
            )}
          </div>

          <div className="session-summary-lists">
            <SessionWordList words={sessionSummary.knownWords} variant="known" />
            <SessionWordList words={sessionSummary.missedWords} variant="missed" />
          </div>

          <div className="session-summary-actions">
            {sessionType === 'daily' && nextLessonDay !== null && nextLessonCount > 0 && (
              <button className="btn btn-primary" type="button" onClick={startNextLesson}>
                {t('continueNextLesson', { day: nextLessonDay + 1, count: nextLessonCount })}
              </button>
            )}
            {sessionSummary.missedWords.length > 0 && (
              <button
                className={`btn ${sessionType === 'daily' && nextLessonDay !== null && nextLessonCount > 0 ? 'btn-secondary' : 'btn-primary'}`}
                type="button"
                onClick={() => startRecheck()}
              >
                {t('recheckMissed')}
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={() => navigate(returnTo)}>
              {t('done')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'recheck-done') {
    const stillMissedWords = recheckMissedIds
      .map((id) => getWordById(id, plan?.vocabularyId ?? getActiveVocabulary(liveData)))
      .filter(Boolean) as Word[];

    return (
      <div className="app-shell">
        <Header title={t('recheckComplete')} backTo="/" />
        <main className="page page-no-nav session-summary-page">
          <div className="card">
            <h2 className="results-title">{t('recheckComplete')}</h2>
            <div className="stat-row">
              <span>{t('recheckScore', { correct: recheckCorrect, wrong: recheckWrong })}</span>
            </div>
          </div>

          {stillMissedWords.length > 0 && (
            <SessionWordList words={stillMissedWords} variant="missed" />
          )}

          <div className="session-summary-actions">
            {stillMissedWords.length > 0 && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => startRecheck(stillMissedWords)}
              >
                {t('recheckMissed')}
              </button>
            )}
            <button className="btn btn-secondary" type="button" onClick={() => navigate(returnTo)}>
              {t('done')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'recheck') {
    const recheckWord = recheckWords[recheckIndex];
    const recheckQuestion = recheckWord
      ? buildQuestion(recheckWord, 'flash', plan?.vocabularyId ?? getActiveVocabulary(liveData))
      : null;

    if (!recheckWord || !recheckQuestion?.options || !recheckQuestion.correctOption) return null;

    const inMyList = getVocabState(liveData, plan?.vocabularyId).myList.includes(recheckWord.id);
    const gameKey = `recheck-${recheckIndex}-${recheckWord.id}`;

    return (
      <div className="app-shell">
        <Header title={t('recheckMissed')} backTo={returnTo} />
        <div className="game-progress">
          <div className="game-dots">
            {recheckWords.map((_, i) => (
              <div
                key={i}
                className={`game-dot${i < recheckIndex ? ' done' : i === recheckIndex ? ' current' : ''}`}
              />
            ))}
          </div>
          <span>
            {recheckIndex + 1}/{recheckWords.length}
          </span>
        </div>

        <FlashMatch
          key={gameKey}
          word={recheckWord}
          options={recheckQuestion.options}
          correctOption={recheckQuestion.correctOption}
          onAnswer={handleRecheckAnswer}
          inMyList={inMyList}
          onToggleList={() => setLiveData(toggleMyList(liveData, recheckWord.id, plan?.vocabularyId))}
        />
      </div>
    );
  }

  if (!currentWord || !currentRound || !question) return null;

  const vocabularyId = plan.vocabularyId;
  const inMyList = getVocabState(liveData, vocabularyId).myList.includes(currentWord.id);
  const totalWords = isReview
    ? reviewWords.length
    : plan.rounds.reduce((s, r) => s + r.words.length, 0);
  const doneWords = isReview
    ? wordIndex
    : plan.rounds.slice(0, roundIndex).reduce((s, r) => s + r.words.length, 0) + wordIndex;

  const gameKey = `${phase}-${roundIndex}-${wordIndex}-${currentWord.id}`;

  return (
    <div className="app-shell">
      <Header title={t(currentRound.label as 'flashMatch')} backTo={isCustom ? returnTo : '/'} />
      <div className="game-progress">
        <div className="game-dots">
          {Array.from({ length: Math.min(totalWords, 20) }).map((_, i) => (
            <div
              key={i}
              className={`game-dot${i < doneWords ? ' done' : i === doneWords ? ' current' : ''}`}
            />
          ))}
        </div>
        <span>
          {doneWords + 1}/{totalWords}
        </span>
      </div>

      {question.options && question.correctOption && (
        <FlashMatch
          key={gameKey}
          word={currentWord}
          options={question.options}
          correctOption={question.correctOption}
          onAnswer={handleAnswer}
          inMyList={inMyList}
          onToggleList={handleToggleList}
          onMarkKnown={handleMarkKnown}
        />
      )}
    </div>
  );
}
