import { Request, Response } from 'express';
import Application from '../models/Application.model';
import { AuthRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, coverLetter } = req.body;
    const userId = req.user?.id;

    const application = await Application.create({
      student: userId,
      company: companyId,
      coverLetter,
      status: 'pending'
    });

    res.status(201).json({ success: true, application });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getMyApplications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const applications = await Application.find({ student: userId })
      .populate('company', 'name sector state')
      .sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllApplications = async (req: AuthRequest, res: Response) => {
  try {
    const applications = await Application.find()
      .populate('student', 'user')
      .populate('company', 'name sector')
      .sort({ appliedAt: -1 });
    res.json(applications);
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
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
    
    // Fixed: Convert string to ObjectId
    if (req.user?.id) {
      application.reviewedBy = new mongoose.Types.ObjectId(req.user.id);
    }
    
    await application.save();

    res.json({ success: true, application });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
