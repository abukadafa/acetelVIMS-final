import Student from '../models/Student.model';
import User from '../models/User.model';
import JobLock from '../models/JobLock.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import logger from '../utils/logger';
import pLimit from 'p-limit';

const CONCURRENCY_LIMIT = 5;
const JOB_NAME = 'STUDENT_ENGAGEMENT_MONITOR';
const LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Monitoring Job to track student engagement and logbook submissions.
 * Tiered Escalation: 3, 5, 7, 10 days of inactivity.
 */
export async function runMonitoringJob(): Promise<void> {
  const lock = await acquireLock(JOB_NAME, LOCK_TIMEOUT);
  if (!lock) {
    logger.info('🤖 Monitoring job already running or locked. Skipping.');
    return;
  }

  logger.info('🤖 Running ACETEL Multi-Tier Monitoring Job (Memory-Safe & Concurrent)...');
  
  try {
    // Memory-safe iteration using cursor
    const cursor = Student.find({ status: 'active', isDeleted: false })
      .populate('user')
      .populate('supervisor')
      .populate('programme')
      .cursor();

    const limit = pLimit(CONCURRENCY_LIMIT);
    const tasks: Promise<void>[] = [];

    for (let student = await cursor.next(); student != null; student = await cursor.next()) {
      tasks.push(limit(() => processStudent(student)));
    }

    await Promise.all(tasks);
    
    // Mark lock as successful
    await JobLock.findOneAndUpdate({ jobName: JOB_NAME }, { lastRunSuccess: true, expiresAt: new Date() });
    logger.info('✅ Monitoring job completed successfully.');
  } catch (error) {
    logger.error('❌ Monitoring job failed: %s', (error as Error).message);
    await JobLock.findOneAndUpdate({ jobName: JOB_NAME }, { lastRunSuccess: false, expiresAt: new Date() });
  } finally {
    await releaseLock(JOB_NAME);
  }
}

/** Escalation tiers, ascending. Each fires once per inactivity streak, even if the
 *  job didn't run on the exact day (e.g. server was down) — it fires for the
 *  highest tier newly crossed since the last check, instead of requiring an
 *  exact `daysInactive === N` match that could be silently skipped by drift. */
const ESCALATION_TIERS = [3, 5, 7, 10] as const;

async function processStudent(student: any): Promise<void> {
  try {
    const u = student.user as any;
    if (!u) return;

    const createdAt = student.createdAt || new Date();
    const lastSeen = student.lastSeen || createdAt;
    const daysInactive = Math.floor((Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24));

    // 1. Update Risk Score & Level
    let newRiskScore = daysInactive * 2;
    let newRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';

    if (newRiskScore >= 20) newRiskLevel = 'High';
    else if (newRiskScore >= 10) newRiskLevel = 'Medium';

    let dirty = false;
    if (student.riskScore !== newRiskScore || student.riskLevel !== newRiskLevel) {
      student.riskScore = newRiskScore;
      student.riskLevel = newRiskLevel;
      dirty = true;
    }

    // Student re-engaged (logged in / submitted since last check) — reset the
    // escalation streak so a future period of inactivity notifies again.
    if (daysInactive < ESCALATION_TIERS[0] && (student.lastEscalationTier || 0) > 0) {
      student.lastEscalationTier = 0;
      dirty = true;
    }

    if (dirty) await student.save();

    // 2. Escalation — fire for the highest tier newly crossed since we last notified.
    const currentTier = [...ESCALATION_TIERS].reverse().find((t) => daysInactive >= t);
    const alreadyNotifiedTier = student.lastEscalationTier || 0;

    if (currentTier && currentTier > alreadyNotifiedTier) {
      await sendEmail(u.email, `ACETEL Internship: ${currentTier}-Day Activity Warning`,
        emailTemplates.inactivityWarning(u.firstName, currentTier));

      if (currentTier >= 5 && student.supervisor) {
        const s = student.supervisor as any;
        await sendEmail(s.email, 'Student Inactivity Alert',
          emailTemplates.supervisorEscalation(`${u.firstName} ${u.lastName}`, s.firstName, currentTier));
      }

      if (currentTier >= 7) {
        const coordinator = await User.findOne({
          role: 'prog_coordinator',
          tenant: student.tenant,
          isActive: true,
        });

        if (coordinator) {
          if (currentTier >= 10) {
            await sendEmail(coordinator.email, 'CRITICAL: 10-Day Student Inactivity',
              emailTemplates.criticalInactivityEscalation(`${u.firstName} ${u.lastName}`, student.matricNumber, currentTier, coordinator.firstName));
          } else {
            await sendEmail(coordinator.email, 'High Risk Student Alert',
              emailTemplates.coordinatorEscalation(`${u.firstName} ${u.lastName}`, coordinator.firstName, currentTier));
          }
        }
      }

      student.lastEscalationTier = currentTier;
      await student.save();
    }
  } catch (err) {
    logger.error('Error processing student %s in monitoring job: %s', student._id, (err as Error).message);
  }
}

async function acquireLock(jobName: string, timeout: number): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeout);

  try {
    // Atomic lock acquisition using findOneAndUpdate with upsert.
    // IMPORTANT: only steal a lock that has actually expired. The previous
    // version also allowed stealing any lock where `lastRunSuccess: true`,
    // regardless of whether it was still within its timeout window — that
    // meant a second process (e.g. a PM2 cluster worker, or a cron overlap)
    // could grab the lock and start a duplicate run *while the first run was
    // still in progress*, sending every escalation email twice.
    const lock = await JobLock.findOneAndUpdate(
      {
        jobName,
        expiresAt: { $lt: now }, // only true once the lock has actually expired
      },
      {
        lockedAt: now,
        expiresAt,
        lastRunSuccess: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return !!lock;
  } catch (err) {
    // If unique constraint error (E11000), it means another instance has the lock
    return false;
  }
}

async function releaseLock(jobName: string): Promise<void> {
  // We don't delete the lock, just set expiresAt to now so it's available for next scheduled run
  await JobLock.findOneAndUpdate({ jobName }, { expiresAt: new Date() });
}

/**
 * Start the monitoring job at a specific interval (e.g., every 24 hours)
 */
export function startMonitoringSchedule() {
  const INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(runMonitoringJob, INTERVAL);
  // Run once immediately on start (with a delay to let system settle)
  setTimeout(runMonitoringJob, 10000); 
}
