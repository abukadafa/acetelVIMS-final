import { Request, Response } from 'express';
import Application from '../models/Application.model';
import Company from '../models/Company.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, coverLetter } = req.body;
    const studentId = req.user?.studentId || req.user?.id;

    // Check if already applied
    const existing = await Application.findOne({ student: studentId, company: companyId });
    if (existing) {
      return res.status(400).json({ message: "You have already applied to this company" });
    }

    const application = await Application.create({
      student: studentId,
      company: companyId,
      coverLetter,
      status: 'pending'
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyApplications = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.studentId || req.user?.id;
    const applications = await Application.find({ student: studentId })
      .populate('company', 'name sector state')
      .sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllApplications = async (req: AuthRequest, res: Response) => {
  try {
    const applications = await Application.find()
      .populate('student', 'user')
      .populate('company', 'name sector')
      .sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    application.status = status;
    if (reviewNotes) application.reviewNotes = reviewNotes;
    application.reviewedBy = req.user?.id;
    await application.save();

    res.json({ success: true, application });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
