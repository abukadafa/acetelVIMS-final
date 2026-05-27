import { Request, Response } from 'express';
import Application from '../models/Application.model';
import Company from '../models/Company.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const totalApplications = await Application.countDocuments();
    const accepted = await Application.countDocuments({ status: 'accepted' });
    const rejected = await Application.countDocuments({ status: 'rejected' });
    const pending = await Application.countDocuments({ status: 'pending' });

    const sectorStats = await Company.aggregate([
      {
        $lookup: {
          from: 'applications',
          localField: '_id',
          foreignField: 'company',
          as: 'applications'
        }
      },
      {
        $project: {
          sector: 1,
          applicationCount: { $size: '$applications' }
        }
      },
      { $sort: { applicationCount: -1 } }
    ]);

    res.json({
      totalApplications,
      accepted,
      rejected,
      pending,
      acceptanceRate: totalApplications > 0 ? Math.round((accepted / totalApplications) * 100) : 0,
      topSector: sectorStats[0]?.sector || 'N/A',
      sectorStats
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};
