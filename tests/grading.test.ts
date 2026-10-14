import { describe, it, expect } from 'vitest';

interface QuestionMock {
  id: string;
  correct_option_id: string;
  marks: number;
  negative_penalty: number;
}

interface ResponseMock {
  question_id: string;
  selected_option_id: string | null;
}

function calculateExamGrade(
  questions: QuestionMock[],
  responses: ResponseMock[],
  negativeMarking: number
) {
  const qMap = new Map(questions.map(q => [q.id, q]));
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let grossPositive = 0;
  let grossNegative = 0;

  for (const r of responses) {
    const q = qMap.get(r.question_id);
    if (!q) continue;

    if (!r.selected_option_id) {
      unattemptedCount++;
    } else if (r.selected_option_id === q.correct_option_id) {
      correctCount++;
      grossPositive += q.marks;
    } else {
      incorrectCount++;
      grossNegative += negativeMarking ?? q.negative_penalty;
    }
  }

  const finalScore = Math.max(0, Number((grossPositive - grossNegative).toFixed(2)));
  const totalAttempted = correctCount + incorrectCount;
  const accuracy = totalAttempted > 0 ? Number(((correctCount / totalAttempted) * 100).toFixed(1)) : 0;

  return {
    finalScore,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracy
  };
}

describe('Server-Side Examination Grading Engine', () => {
  const sampleQuestions: QuestionMock[] = [
    { id: 'q1', correct_option_id: 'opt1', marks: 1.0, negative_penalty: 0.25 },
    { id: 'q2', correct_option_id: 'opt2', marks: 1.0, negative_penalty: 0.25 },
    { id: 'q3', correct_option_id: 'opt3', marks: 1.0, negative_penalty: 0.25 },
    { id: 'q4', correct_option_id: 'opt4', marks: 1.0, negative_penalty: 0.25 },
  ];

  it('correctly calculates 100% score when all questions answered correctly', () => {
    const responses: ResponseMock[] = [
      { question_id: 'q1', selected_option_id: 'opt1' },
      { question_id: 'q2', selected_option_id: 'opt2' },
      { question_id: 'q3', selected_option_id: 'opt3' },
      { question_id: 'q4', selected_option_id: 'opt4' },
    ];

    const result = calculateExamGrade(sampleQuestions, responses, 0.25);
    expect(result.finalScore).toBe(4.0);
    expect(result.correctCount).toBe(4);
    expect(result.incorrectCount).toBe(0);
    expect(result.unattemptedCount).toBe(0);
    expect(result.accuracy).toBe(100.0);
  });

  it('correctly deducts 0.25 negative marks for each incorrect answer', () => {
    // 2 correct (+2.0), 2 incorrect (-0.50) -> net score 1.50
    const responses: ResponseMock[] = [
      { question_id: 'q1', selected_option_id: 'opt1' }, // correct (+1.0)
      { question_id: 'q2', selected_option_id: 'opt2' }, // correct (+1.0)
      { question_id: 'q3', selected_option_id: 'opt1' }, // wrong (-0.25)
      { question_id: 'q4', selected_option_id: 'opt2' }, // wrong (-0.25)
    ];

    const result = calculateExamGrade(sampleQuestions, responses, 0.25);
    expect(result.finalScore).toBe(1.50);
    expect(result.correctCount).toBe(2);
    expect(result.incorrectCount).toBe(2);
    expect(result.accuracy).toBe(50.0);
  });

  it('does not penalize unattempted questions', () => {
    // 1 correct (+1.0), 3 unattempted (0 deduction) -> net score 1.0
    const responses: ResponseMock[] = [
      { question_id: 'q1', selected_option_id: 'opt1' },
      { question_id: 'q2', selected_option_id: null },
      { question_id: 'q3', selected_option_id: null },
      { question_id: 'q4', selected_option_id: null },
    ];

    const result = calculateExamGrade(sampleQuestions, responses, 0.25);
    expect(result.finalScore).toBe(1.0);
    expect(result.correctCount).toBe(1);
    expect(result.unattemptedCount).toBe(3);
    expect(result.accuracy).toBe(100.0);
  });

  it('floors final score at zero to prevent negative scores', () => {
    // 4 wrong (-1.0) -> score floored at 0
    const responses: ResponseMock[] = [
      { question_id: 'q1', selected_option_id: 'opt2' },
      { question_id: 'q2', selected_option_id: 'opt1' },
      { question_id: 'q3', selected_option_id: 'opt1' },
      { question_id: 'q4', selected_option_id: 'opt1' },
    ];

    const result = calculateExamGrade(sampleQuestions, responses, 0.25);
    expect(result.finalScore).toBe(0);
    expect(result.incorrectCount).toBe(4);
    expect(result.accuracy).toBe(0.0);
  });
});
