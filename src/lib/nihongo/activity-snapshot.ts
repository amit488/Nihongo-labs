import type { LearnerSnapshot } from './data';

/**
 * Apply a server-confirmed study-time credit without reloading the dashboard.
 * The server supplies the learner-timezone activity date, so midnight handling
 * remains consistent with the database's daily activity bucket.
 */
export function applyStudyTimeCredit(
  snapshot: LearnerSnapshot,
  activityDate: string,
  creditedSeconds: number,
): LearnerSnapshot {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(activityDate) ||
    !Number.isSafeInteger(creditedSeconds) ||
    creditedSeconds <= 0
  ) {
    return snapshot;
  }

  const existingActivity = snapshot.recentActivity.some(
    (row) => row.activity_date === activityDate,
  );
  const recentActivity = existingActivity
    ? snapshot.recentActivity.map((row) =>
        row.activity_date === activityDate
          ? { ...row, study_seconds: row.study_seconds + creditedSeconds }
          : row,
      )
    : [
        { activity_date: activityDate, study_seconds: creditedSeconds },
        ...snapshot.recentActivity,
      ].slice(0, 400);

  return {
    ...snapshot,
    totalStudySeconds: snapshot.totalStudySeconds + creditedSeconds,
    activeDays: existingActivity
      ? snapshot.activeDays
      : [activityDate, ...snapshot.activeDays].slice(0, 400),
    dailyGoal: {
      ...snapshot.dailyGoal,
      studiedSeconds: existingActivity
        ? snapshot.dailyGoal.studiedSeconds + creditedSeconds
        : creditedSeconds,
    },
    recentActivity,
  };
}
