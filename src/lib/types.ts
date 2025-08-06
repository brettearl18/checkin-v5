// Client Management
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: Date;
  status: 'active' | 'inactive' | 'at-risk';
  goals: Goal[];
  notes: Note[];
  checkInStats: CheckInStats;
  riskScore: number;
  tags: string[];
}

export interface Goal {
  id: string;
  title: string;
  targetDate: Date;
  progress: number; // 0-100
  category: string;
}

export interface Note {
  id: string;
  content: string;
  date: Date;
  type: 'progress' | 'challenge' | 'concern' | 'milestone';
}

export interface CheckInStats {
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  averageMood: number;
  averageEnergy: number;
  lastCheckIn: Date;
}

// Check-in System
export interface CheckIn {
  id: string;
  clientId: string;
  formId: string;
  responses: CheckInResponse[];
  mood: number; // 1-10
  energy: number; // 1-10
  date: Date;
  completed: boolean;
  analysis?: CheckInAnalysis;
}

export interface CheckInResponse {
  questionId: string;
  answer: string;
}

export interface CheckInAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  keyInsights: string[];
  recommendations: string[];
}

// Forms
export interface Form {
  id: string;
  title: string;
  description: string;
  questions: FormQuestion[];
  schedule: FormSchedule;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormQuestion {
  id: string;
  question: string;
  type: 'text' | 'scale' | 'yes-no' | 'multiple-choice';
  required: boolean;
  options?: string[];
}

export interface FormSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6, Sunday = 0
  time: string; // HH:MM format
  timezone: string;
}

// Analytics
export interface Analytics {
  groupOverview: GroupOverview;
  riskAnalysis: RiskAnalysis;
  engagementMetrics: EngagementMetrics;
  progressTrends: ProgressTrends;
  predictiveInsights: PredictiveInsights;
}

export interface GroupOverview {
  totalClients: number;
  activeClients: number;
  atRiskClients: number;
  averageProgress: number;
  averageEngagement: number;
  topPerformers: Client[];
  needsAttention: Client[];
  recentCheckIns: CheckIn[];
}

export interface RiskAnalysis {
  highRiskClients: Client[];
  mediumRiskClients: Client[];
  riskFactors: {
    checkInFrequency: number;
    progressDecline: number;
    moodTrend: number;
    goalCompletion: number;
    engagementDrop: number;
    communicationGap: number;
  };
  trendAnalysis: {
    date: Date;
    riskLevel: 'low' | 'medium' | 'high';
    factor: string;
  }[];
}

export interface EngagementMetrics {
  averageCheckInRate: number; // percentage
  formCompletionRate: number; // percentage
  responseTime: number; // hours
  activeStreaks: {
    clientId: string;
    streak: number;
  }[];
  engagementScore: number; // 0-100
}

export interface ProgressTrends {
  overallProgress: number; // 0-10
  goalCompletionRate: number; // percentage
  milestoneAchievements: number;
  progressByCategory: {
    health: number;
    nutrition: number;
    exercise: number;
    lifestyle: number;
  };
}

export interface PredictiveInsights {
  churnRisk: {
    clientId: string;
    riskScore: number;
    factors: string[];
  }[];
  successPredictions: {
    clientId: string;
    successProbability: number;
    timeframe: string;
  }[];
  interventionRecommendations: {
    clientId: string;
    type: 'check-in' | 'goal-review' | 'support' | 'celebration';
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }[];
}

// Custom Question System
export interface CustomQuestion {
  id: string;
  coachId: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'scale' | 'checkbox' | 'multiple-choice';
  weight: number; // 1-10 scale
  category: 'health' | 'lifestyle' | 'goals' | 'motivation' | 'risk' | 'custom';
  required: boolean;
  options?: string[]; // For select/multiple-choice questions
  scoring?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomForm {
  id: string;
  coachId: string;
  name: string;
  description: string;
  questions: CustomQuestion[];
  totalWeight: number;
  estimatedTime: number; // minutes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormResponse {
  questionId: string;
  clientId: string;
  formId: string;
  response: string | number | string[];
  weight: number;
  score?: number;
  answeredAt: Date;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'weight-loss' | 'fitness' | 'mental-health' | 'nutrition' | 'general';
  questions: Omit<CustomQuestion, 'id' | 'coachId' | 'createdAt' | 'updatedAt'>[];
  totalWeight: number;
  estimatedTime: number;
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Question Builder Types
export interface QuestionBuilderState {
  currentQuestion: Partial<CustomQuestion>;
  questionLibrary: CustomQuestion[];
  selectedQuestions: string[];
  formName: string;
  formDescription: string;
  isEditing: boolean;
}

export interface QuestionAnalytics {
  questionId: string;
  usageCount: number;
  averageResponseTime: number;
  completionRate: number;
  effectivenessScore: number;
  clientSatisfaction: number;
  correlationWithSuccess: number;
} 