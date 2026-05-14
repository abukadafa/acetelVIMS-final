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

    // Only update if changed to avoid unnecessary DB writes
    if (student.riskScore !== newRiskScore || student.riskLevel !== newRiskLevel) {
      student.riskScore = newRiskScore;
      student.riskLevel = newRiskLevel;
      await student.save();
    }

    // 2. Escalation Logic
    // We only send emails for exact day milestones to avoid spamming every day
    if (daysInactive === 3) {
      await sendEmail(u.email, 'ACETEL Internship: 3-Day Activity Warning', 
        emailTemplates.inactivityWarning(u.firstName, 3));
    } 
    else if (daysInactive === 5) {
      await sendEmail(u.email, 'ACETEL Internship: URGENT 5-Day Warning', 
        emailTemplates.inactivityWarning(u.firstName, 5));
      
      if (student.supervisor) {
        const s = student.supervisor as any;
        await sendEmail(s.email, 'Student Inactivity Alert', 
          emailTemplates.supervisorEscalation(`${u.firstName} ${u.lastName}`, s.firstName, 5));
      }
    }
    else if (daysInactive === 7) {
      await sendEmail(u.email, 'ACETEL Internship: CRITICAL 7-Day Warning', 
        emailTemplates.inactivityWarning(u.firstName, 7));
      
      // Notify Programme Coordinator FOR THE STUDENT'S TENANT
      const coordinator = await User.findOne({ 
        role: 'prog_coordinator', 
        tenant: student.tenant,
        isActive: true 
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

  try {
    // Atomic lock acquisition using findOneAndUpdate with upsert
    const lock = await JobLock.findOneAndUpdate(
      { 
        jobName, 
        $or: [
          { expiresAt: { $lt: now } }, // Lock expired
          { lastRunSuccess: true }      // Lock from previous successful run is okay to take if it's been 24h (handled by cron)
        ]
      },
      { 
        lockedAt: now, 
        expiresAt,
        lastRunSuccess: false
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
