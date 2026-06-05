import User from '../models/User.model';
import Student from '../models/Student.model';

/** Permanently remove soft-deleted users/students blocking email or matric reuse. */
export async function purgeSoftDeletedIdentity(
  tenantId: string,
  opts: { email?: string; matric?: string }
): Promise<{ purgedUsers: number; purgedStudents: number }> {
  let purgedUsers = 0;
  let purgedStudents = 0;

  const userOr: Record<string, unknown>[] = [];
  if (opts.email) userOr.push({ email: opts.email.toLowerCase().trim() });
  if (opts.matric) userOr.push({ username: opts.matric.toLowerCase().trim() });

  if (userOr.length > 0) {
    const deletedUsers = await User.find({
      tenant: tenantId,
      isDeleted: true,
      $or: userOr,
    });
    if (deletedUsers.length > 0) {
      purgedUsers = deletedUsers.length;
      await User.deleteMany({ _id: { $in: deletedUsers.map((u) => u._id) } });
    }
  }

  if (opts.matric) {
    const normMatric = opts.matric.trim();
    const deletedStudents = await Student.find({
      tenant: tenantId,
      isDeleted: true,
      matricNumber: normMatric,
    });
    if (deletedStudents.length > 0) {
      purgedStudents = deletedStudents.length;
      const studentIds = deletedStudents.map((s) => s._id);
      const userIds = deletedStudents.map((s) => s.user);
      await Student.deleteMany({ _id: { $in: studentIds } });
      await User.deleteMany({ _id: { $in: userIds }, isDeleted: true });
      await User.deleteMany({
        tenant: tenantId,
        username: normMatric.toLowerCase(),
        isDeleted: true,
      });
    }
  }

  return { purgedUsers, purgedStudents };
}
