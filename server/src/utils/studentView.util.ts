/**
 * Hide partner placement details from students until internship coordinator approves posting.
 */
export function maskCompanyForStudentView(student: any, userRole: string) {
  if (userRole !== 'student' || student.postingApproved || !student.company) {
    return student;
  }
  const doc = typeof student.toObject === 'function' ? student.toObject() : { ...student };
  const c = doc.company;
  if (c && typeof c === 'object') {
    doc.company = {
      ...c,
      name: 'Assigned — awaiting coordinator approval',
      address: '',
      contactEmail: undefined,
      contactPhone: undefined,
      contactPerson: undefined,
    };
  }
  return doc;
}
