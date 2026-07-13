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
  logger.info('🤖 Running ACETEL Multi-Tier Monitoring Job (Memory-Safe & Concurrent)...');

  try {
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
    logger.info('✅ Monitoring job completed successfully.');
  } catch (error) {
    logger.error('❌ Monitoring job failed: %s', (error as Error).message);
    throw error;
  }
}

async function processStudent(student: any): Promise<void> {
  try {
    const u = student.user as any;
    if (!u) return;

    const createdAt = student.createdAt || new Date();
    const lastSeen = student.lastSeen || createdAt;
    const daysInactive = Math.floor((Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24));

    let newRiskScore = daysInactive * 2;
    let newRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';

    if (newRiskScore >= 20) newRiskLevel = 'High';
    else if (newRiskScore >= 10) newRiskLevel = 'Medium';

    if (student.riskScore !== newRiskScore || student.riskLevel !== newRiskLevel) {
      student.riskScore = newRiskScore;
      student.riskLevel = newRiskLevel;
      await student.save();
    }

    if (daysInactive === 3) {
      await sendEmail(u.email, 'ACETEL Internship: 3-Day Activity Warning',
        emailTemplates.inactivityWarning(u.firstName, 3));
    } else if (daysInactive === 5) {
      await sendEmail(u.email, 'ACETEL Internship: URGENT 5-Day Warning',
        emailTemplates.inactivityWarning(u.firstName, 5));

      if (student.supervisor) {
        const s = student.supervisor as any;
        await sendEmail(s.email, 'Student Inactivity Alert',
          emailTemplates.supervisorEscalation(`${u.firstName} ${u.lastName}`, s.firstName, 5));
      }
    } else if (daysInactive === 7) {
      await sendEmail(u.email, 'ACETEL Internship: CRITICAL 7-Day Warning',
        emailTemplates.inactivityWarning(u.firstName, 7));

      const coordinator = await User.findOne({
        role: 'prog_coordinator',
        tenant: student.tenant,
        isActive: true,
      });

      if (coordinator) {
        await sendEmail(coordinator.email, 'High Risk Student Alert',
          emailTemplates.coordinatorEscalation(`${u.firstName} ${u.lastName}`, coordinator.firstName, 7));
      }
    }
  } catch (err) {
    logger.error('Error processing student %s in monitoring job: %s', student._id, (err as Error).message);
  }
}

async function acquireLock(jobName: string, timeout: number): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeout);

  const held = await JobLock.findOne({ jobName, expiresAt: { $gt: now } });
  if (held) return false;

  try {
    const lock = await JobLock.findOneAndUpdate(
      {
        jobName,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      { jobName, lockedAt: now, expiresAt, lastRunSuccess: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return !!lock;
  } catch (err: any) {
    if (err?.code === 11000) return false;
    logger.error('Lock acquisition error: %s', err.message);
    return false;
  }
}

async function releaseLock(jobName: string): Promise<void> {
  await JobLock.findOneAndUpdate({ jobName }, { expiresAt: new Date() });
}

export function startMonitoringSchedule(): void {
  const INTERVAL = 24 * 60 * 60 * 1000;
  let running = false;

  const safeRun = async () => {
    if (running) {
      logger.info('🤖 Monitoring job already running — skipping');
      return;
    }
    running = true;
    const lock = await acquireLock(JOB_NAME, LOCK_TIMEOUT);
    if (!lock) {
      logger.info('🤖 Monitoring job locked by another instance — skipping');
      running = false;
      return;
    }
    try {
      await runMonitoringJob();
      await JobLock.findOneAndUpdate({ jobName: JOB_NAME }, { lastRunSuccess: true, expiresAt: new Date() });
    } catch (err) {
      await JobLock.findOneAndUpdate({ jobName: JOB_NAME }, { lastRunSuccess: false, expiresAt: new Date() });
      logger.error('Monitoring schedule error: %s', (err as Error).message);
    } finally {
      await releaseLock(JOB_NAME);
      running = false;
    }
  };

  setInterval(safeRun, INTERVAL);
  setTimeout(safeRun, 10000);
}
